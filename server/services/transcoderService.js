const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { exec } = require("child_process");
const db = require("../config/database");

// Promisify exec para usar con async/await
const execAsync = promisify(exec);

class TranscoderService {
  constructor() {
    this.activeJobs = new Map();
    this.transcoderBinPath =
      process.env.TRANSCODER_BIN_PATH ||
      path.join(__dirname, "../../core/build/streamvio_transcoder");
    this.outputDir = path.join(__dirname, "../data/transcoded");
    this.thumbnailsDir = path.join(__dirname, "../data/thumbnails");

    // Crear directorios si no existen
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }
  }

  async getMediaInfo(filePath) {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }

      // Verificar si el transcodificador está disponible
      if (fs.existsSync(this.transcoderBinPath)) {
        // Usar el transcodificador nativo si está disponible
        const { stdout } = await execAsync(
          `${this.transcoderBinPath} info "${filePath}"`
        );

        // Parsear la salida del comando
        const info = {
          path: filePath,
          format: "unknown",
          duration: 0,
          width: 0,
          height: 0,
          videoCodec: "",
          audioBitrate: 0,
          audioCodec: "",
          audioChannels: 0,
        };

        // Extraer información de la salida del comando
        const lines = stdout.split("\n");
        for (const line of lines) {
          if (line.includes("Formato:")) {
            info.format = line.split(":")[1].trim();
          } else if (line.includes("Duración:")) {
            const durationStr = line.split(":")[1].trim();
            info.duration = parseFloat(durationStr) * 1000; // Convertir a milisegundos
          } else if (line.includes("Resolución:")) {
            const resolution = line.split(":")[1].trim();
            const [width, height] = resolution.split("x");
            info.width = parseInt(width);
            info.height = parseInt(height);
          } else if (line.includes("Codec de video:")) {
            const parts = line.split(":")[1].trim().split("(");
            info.videoCodec = parts[0].trim();
            if (parts.length > 1) {
              info.videoBitrate = parseInt(parts[1].split(" ")[0]);
            }
          } else if (line.includes("Codec de audio:")) {
            const parts = line.split(":")[1].trim().split("(");
            info.audioCodec = parts[0].trim();
            if (parts.length > 1) {
              info.audioBitrate = parseInt(parts[1].split(" ")[0]);
            }
          } else if (line.includes("Canales de audio:")) {
            info.audioChannels = parseInt(line.split(":")[1].trim());
          }
        }

        return info;
      } else {
        // Alternativa: Usar FFprobe si el transcodificador no está disponible
        console.warn(
          "Transcodificador nativo no encontrado. Utilizando FFprobe como alternativa."
        );

        // Verificar que ffprobe está disponible
        try {
          await execAsync("ffprobe -version");
        } catch (error) {
          throw new Error(
            "FFprobe no está disponible. No se puede obtener información del archivo."
          );
        }

        // Obtener información con FFprobe
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration,bit_rate:stream=width,height,codec_name,bit_rate,channels,sample_rate -of json "${filePath}"`
        );

        const ffprobeData = JSON.parse(stdout);
        const info = {
          path: filePath,
          format: path.extname(filePath).substring(1),
          duration: 0,
          width: 0,
          height: 0,
          videoCodec: "",
          videoBitrate: 0,
          audioCodec: "",
          audioBitrate: 0,
          audioChannels: 0,
          audioSampleRate: 0,
        };

        if (ffprobeData.format) {
          info.duration = ffprobeData.format.duration
            ? Math.floor(parseFloat(ffprobeData.format.duration) * 1000)
            : 0;
          info.bitrate = ffprobeData.format.bit_rate
            ? parseInt(ffprobeData.format.bit_rate) / 1000
            : 0;
        }

        if (ffprobeData.streams && ffprobeData.streams.length > 0) {
          for (const stream of ffprobeData.streams) {
            if (stream.codec_type === "video") {
              info.width = stream.width || 0;
              info.height = stream.height || 0;
              info.videoCodec = stream.codec_name || "";
              info.videoBitrate = stream.bit_rate
                ? parseInt(stream.bit_rate) / 1000
                : 0;
            } else if (stream.codec_type === "audio") {
              info.audioCodec = stream.codec_name || "";
              info.audioBitrate = stream.bit_rate
                ? parseInt(stream.bit_rate) / 1000
                : 0;
              info.audioChannels = stream.channels || 0;
              info.audioSampleRate = stream.sample_rate
                ? parseInt(stream.sample_rate)
                : 0;
            }
          }
        }

        return info;
      }
    } catch (error) {
      console.error(`Error al obtener información de ${filePath}:`, error);
      throw new Error(
        `No se pudo obtener información del archivo: ${error.message}`
      );
    }
  }

  async startTranscodeJob(mediaId, inputPath, options = {}) {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      // Crear un nombre de archivo para la salida
      const fileExtension =
        options.outputFormat || path.extname(inputPath).substring(1) || "mp4";
      const outputFileName = `${path.basename(
        inputPath,
        path.extname(inputPath)
      )}_transcoded.${fileExtension}`;
      const outputPath = path.join(this.outputDir, outputFileName);

      // Crear un registro en la base de datos
      const jobResult = await db.asyncRun(
        `INSERT INTO transcoding_jobs 
         (media_id, status, target_format, target_resolution, output_path, started_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          mediaId,
          "pending",
          fileExtension,
          options.width && options.height
            ? `${options.width}x${options.height}`
            : null,
          outputPath,
        ]
      );

      const jobId = jobResult.lastID;

      // Construir argumentos para el transcodificador
      let transcoderArgs = ["transcode", `"${inputPath}"`, `"${outputPath}"`];

      if (options.outputFormat) {
        transcoderArgs.push(`--format=${options.outputFormat}`);
      }

      if (options.videoCodec) {
        transcoderArgs.push(`--vcodec=${options.videoCodec}`);
      }

      if (options.audioCodec) {
        transcoderArgs.push(`--acodec=${options.audioCodec}`);
      }

      if (options.videoBitrate) {
        transcoderArgs.push(`--vbitrate=${options.videoBitrate}`);
      }

      if (options.audioBitrate) {
        transcoderArgs.push(`--abitrate=${options.audioBitrate}`);
      }

      if (options.width) {
        transcoderArgs.push(`--width=${options.width}`);
      }

      if (options.height) {
        transcoderArgs.push(`--height=${options.height}`);
      }

      if (options.disableHardwareAcceleration) {
        transcoderArgs.push("--no-hwaccel");
      }

      // Iniciar la transcodificación en segundo plano
      this.runTranscodeProcess(jobId, transcoderArgs.join(" "));

      return {
        jobId,
        mediaId,
        status: "pending",
        outputPath,
      };
    } catch (error) {
      console.error(`Error al iniciar transcodificación:`, error);
      throw new Error(
        `No se pudo iniciar la transcodificación: ${error.message}`
      );
    }
  }

  async runTranscodeProcess(jobId, args) {
    try {
      // Actualizar estado a 'processing'
      await db.asyncRun("UPDATE transcoding_jobs SET status = ? WHERE id = ?", [
        "processing",
        jobId,
      ]);

      // Verificar si el transcodificador está disponible
      if (fs.existsSync(this.transcoderBinPath)) {
        // Ejecutar el transcodificador
        const command = `${this.transcoderBinPath} ${args}`;
        const { stdout, stderr } = await execAsync(command);

        // Actualizar estado a 'completed'
        await db.asyncRun(
          "UPDATE transcoding_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          ["completed", jobId]
        );

        console.log(`Transcodificación completada para el trabajo ${jobId}`);
      } else {
        // Alternativa: usar FFmpeg si el transcodificador no está disponible
        console.warn(
          "Transcodificador nativo no encontrado. Utilizando FFmpeg como alternativa."
        );

        // Obtener información del trabajo
        const job = await db.asyncGet(
          "SELECT * FROM transcoding_jobs WHERE id = ?",
          [jobId]
        );
        if (!job) {
          throw new Error(
            `Trabajo de transcodificación no encontrado: ${jobId}`
          );
        }

        // Obtener información del archivo de entrada
        const mediaItem = await db.asyncGet(
          "SELECT file_path FROM media_items WHERE id = ?",
          [job.media_id]
        );
        if (!mediaItem) {
          throw new Error(
            `Elemento multimedia no encontrado para el trabajo: ${jobId}`
          );
        }

        // Comando FFmpeg básico
        let ffmpegCommand = `ffmpeg -i "${mediaItem.file_path}" -y "${job.output_path}"`;

        // Ejecutar FFmpeg
        const { stdout, stderr } = await execAsync(ffmpegCommand);

        // Actualizar estado a 'completed'
        await db.asyncRun(
          "UPDATE transcoding_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          ["completed", jobId]
        );

        console.log(
          `Transcodificación con FFmpeg completada para el trabajo ${jobId}`
        );
      }
    } catch (error) {
      console.error(
        `Error durante la transcodificación del trabajo ${jobId}:`,
        error
      );

      // Actualizar estado a 'failed'
      await db.asyncRun(
        "UPDATE transcoding_jobs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        ["failed", error.message, jobId]
      );
    }
  }

  async generateThumbnail(videoPath, timeOffset = 5) {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Archivo no encontrado: ${videoPath}`);
      }

      // Crear nombre para la miniatura
      const fileName = path.basename(videoPath, path.extname(videoPath));
      const thumbnailFileName = `${fileName}_thumb.jpg`;
      const thumbnailPath = path.join(this.thumbnailsDir, thumbnailFileName);

      // Verificar si el transcodificador está disponible
      if (fs.existsSync(this.transcoderBinPath)) {
        // Usar el transcodificador nativo
        const command = `${this.transcoderBinPath} thumbnail "${videoPath}" "${thumbnailPath}" ${timeOffset}`;
        await execAsync(command);
      } else {
        // Alternativa: usar FFmpeg
        console.warn(
          "Transcodificador nativo no encontrado. Utilizando FFmpeg como alternativa."
        );

        // Verificar que ffmpeg está disponible
        try {
          await execAsync("ffmpeg -version");
        } catch (error) {
          throw new Error(
            "FFmpeg no está disponible. No se puede generar la miniatura."
          );
        }

        // Comando FFmpeg para generar miniatura
        const command = `ffmpeg -y -i "${videoPath}" -ss ${timeOffset} -vframes 1 -vf "scale=320:-1" "${thumbnailPath}"`;
        await execAsync(command);
      }

      // Verificar que la miniatura se ha creado
      if (!fs.existsSync(thumbnailPath)) {
        throw new Error("No se pudo generar la miniatura");
      }

      return thumbnailPath;
    } catch (error) {
      console.error(`Error al generar miniatura para ${videoPath}:`, error);
      throw new Error(`No se pudo generar la miniatura: ${error.message}`);
    }
  }
}

module.exports = new TranscoderService();
