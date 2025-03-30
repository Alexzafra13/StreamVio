// server/services/enhancedTranscoderService.js
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { exec } = require("child_process");
const db = require("../config/database");
const EventEmitter = require("events");

// Promisify exec para usar con async/await
const execAsync = promisify(exec);

// Creamos un event emitter para notificar eventos de transcodificación
const transcoderEvents = new EventEmitter();

class EnhancedTranscoderService {
  constructor() {
    this.activeJobs = new Map();
    this.transcoderBinPath =
      process.env.TRANSCODER_BIN_PATH ||
      path.join(__dirname, "../../core/build/streamvio_transcoder");
    this.outputDir = path.join(__dirname, "../data/transcoded");
    this.thumbnailsDir = path.join(__dirname, "../data/thumbnails");
    this.cachesDir = path.join(__dirname, "../data/caches");

    // Crear directorios si no existen
    this.createDirectories();

    // Definir perfiles de transcodificación
    this.profiles = {
      // Móviles/datos limitados
      "mobile-low": {
        width: 480,
        height: 360,
        videoBitrate: 500, // kbps
        audioBitrate: 64, // kbps
        videoCodec: "h264",
        audioCodec: "aac",
        outputFormat: "mp4",
      },
      // Tablet/Mobile WiFi
      "mobile-high": {
        width: 720,
        height: 480,
        videoBitrate: 1500,
        audioBitrate: 128,
        videoCodec: "h264",
        audioCodec: "aac",
        outputFormat: "mp4",
      },
      // Computadoras/TV HD
      standard: {
        width: 1280,
        height: 720,
        videoBitrate: 2500,
        audioBitrate: 192,
        videoCodec: "h264",
        audioCodec: "aac",
        outputFormat: "mp4",
      },
      // TV Full HD
      high: {
        width: 1920,
        height: 1080,
        videoBitrate: 5000,
        audioBitrate: 256,
        videoCodec: "h264",
        audioCodec: "aac",
        outputFormat: "mp4",
      },
      // 4K/UHD
      ultra: {
        width: 3840,
        height: 2160,
        videoBitrate: 15000,
        audioBitrate: 320,
        videoCodec: "h264",
        audioCodec: "aac",
        outputFormat: "mp4",
      },
      // Audio solamente
      "audio-only": {
        audioBitrate: 192,
        audioCodec: "aac",
        outputFormat: "mp4",
      },
    };
  }

  // Crear todos los directorios necesarios
  createDirectories() {
    [this.outputDir, this.thumbnailsDir, this.cachesDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Obtener información detallada del archivo multimedia
  async getMediaInfo(filePath) {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }

      // Verificar si el transcodificador nativo está disponible
      if (fs.existsSync(this.transcoderBinPath)) {
        // Usar el transcodificador nativo
        const { stdout } = await execAsync(
          `${this.transcoderBinPath} info "${filePath}"`
        );

        return this.parseNativeTranscoderOutput(stdout, filePath);
      } else {
        // Alternativa: Usar FFprobe
        return await this.getMediaInfoWithFfprobe(filePath);
      }
    } catch (error) {
      console.error(`Error al obtener información de ${filePath}:`, error);
      throw new Error(
        `No se pudo obtener información del archivo: ${error.message}`
      );
    }
  }

  // Parsear la salida del transcodificador nativo
  parseNativeTranscoderOutput(stdout, filePath) {
    const info = {
      path: filePath,
      format: path.extname(filePath).substring(1) || "unknown",
      duration: 0,
      width: 0,
      height: 0,
      videoCodec: "",
      videoBitrate: 0,
      audioCodec: "",
      audioBitrate: 0,
      audioChannels: 0,
      audioSampleRate: 0,
      metadata: {},
    };

    // Extraer información línea por línea
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
      } else if (line.includes("Frecuencia de muestreo:")) {
        info.audioSampleRate = parseInt(
          line.split(":")[1].trim().split(" ")[0]
        );
      } else if (line.includes("Metadatos:")) {
        // Extraer metadatos en líneas subsiguientes
        let i = lines.indexOf(line) + 1;
        while (i < lines.length && lines[i].includes(":")) {
          const [key, value] = lines[i].split(":").map((part) => part.trim());
          info.metadata[key] = value;
          i++;
        }
      }
    }

    return info;
  }

  // Obtener información con FFprobe
  async getMediaInfoWithFfprobe(filePath) {
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
      `ffprobe -v error -show_entries format=duration,bit_rate,tags:stream=width,height,codec_name,bit_rate,channels,sample_rate -of json "${filePath}"`
    );

    const ffprobeData = JSON.parse(stdout);
    const info = {
      path: filePath,
      format: path.extname(filePath).substring(1) || "unknown",
      duration: 0,
      width: 0,
      height: 0,
      videoCodec: "",
      videoBitrate: 0,
      audioCodec: "",
      audioBitrate: 0,
      audioChannels: 0,
      audioSampleRate: 0,
      metadata: {},
    };

    // Extraer metadatos si están disponibles
    if (ffprobeData.format && ffprobeData.format.tags) {
      info.metadata = ffprobeData.format.tags;
    }

    if (ffprobeData.format) {
      info.duration = ffprobeData.format.duration
        ? Math.floor(parseFloat(ffprobeData.format.duration) * 1000)
        : 0;
      info.format = ffprobeData.format.format_name
        ? ffprobeData.format.format_name.split(",")[0]
        : info.format;
    }

    if (ffprobeData.streams) {
      for (const stream of ffprobeData.streams) {
        if (stream.codec_type === "video") {
          info.width = stream.width || 0;
          info.height = stream.height || 0;
          info.videoCodec = stream.codec_name || "";
          info.videoBitrate = stream.bit_rate
            ? parseInt(stream.bit_rate) / 1000
            : 0;

          // Extraer metadatos del stream si están disponibles
          if (stream.tags) {
            Object.assign(info.metadata, stream.tags);
          }
        } else if (stream.codec_type === "audio") {
          info.audioCodec = stream.codec_name || "";
          info.audioBitrate = stream.bit_rate
            ? parseInt(stream.bit_rate) / 1000
            : 0;
          info.audioChannels = stream.channels || 0;
          info.audioSampleRate = stream.sample_rate
            ? parseInt(stream.sample_rate)
            : 0;

          // Extraer metadatos del stream si están disponibles
          if (stream.tags) {
            Object.assign(info.metadata, stream.tags);
          }
        }
      }
    }

    return info;
  }

  // Determinar el perfil óptimo basado en el dispositivo y la conexión
  getOptimalProfile(userAgent, connectionType, bandwidth) {
    // Analizar user-agent para detectar dispositivo
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);

    // Analizar tipo de conexión y ancho de banda
    const is3G = connectionType === "3g" || (bandwidth > 0 && bandwidth < 1500);
    const is4G =
      connectionType === "4g" || (bandwidth >= 1500 && bandwidth < 5000);
    const isWifi = connectionType === "wifi" || bandwidth >= 5000;

    // Seleccionar perfil basado en dispositivo y conexión
    if (isMobile && is3G) {
      return "mobile-low";
    } else if ((isMobile || isTablet) && (is4G || isWifi)) {
      return "mobile-high";
    } else if (isWifi && !isMobile && !isTablet) {
      return "standard";
    } else if (isWifi && bandwidth >= 10000) {
      return "high";
    } else if (isWifi && bandwidth >= 20000) {
      return "ultra";
    } else {
      // Perfil por defecto
      return "standard";
    }
  }

  // Iniciar trabajo de transcodificación
  async startTranscodeJob(mediaId, inputPath, options = {}) {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      // Determinar el perfil a utilizar
      const profileName = options.profile || "standard";
      const profile = this.profiles[profileName] || this.profiles.standard;

      // Combinar opciones del perfil con opciones personalizadas
      const transcodingOptions = { ...profile, ...options };

      // Verificar si ya existe una versión transcodificada con este perfil
      const fileBasename = path.basename(inputPath, path.extname(inputPath));
      const outputFileName = `${fileBasename}_${profileName}.${
        transcodingOptions.outputFormat || "mp4"
      }`;
      const outputPath = path.join(this.outputDir, outputFileName);

      // Si ya existe y no se fuerza la regeneración, reutilizarlo
      if (fs.existsSync(outputPath) && !options.forceRegenerate) {
        console.log(`Usando versión transcodificada existente: ${outputPath}`);
        return {
          jobId: null,
          mediaId,
          status: "completed",
          outputPath,
          profile: profileName,
        };
      }

      // Crear un registro en la base de datos
      const jobResult = await db.asyncRun(
        `INSERT INTO transcoding_jobs 
         (media_id, status, target_format, target_resolution, output_path, started_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          mediaId,
          "pending",
          transcodingOptions.outputFormat || "mp4",
          transcodingOptions.width && transcodingOptions.height
            ? `${transcodingOptions.width}x${transcodingOptions.height}`
            : null,
          outputPath,
        ]
      );

      const jobId = jobResult.lastID;

      // Guardar información del trabajo activo
      this.activeJobs.set(jobId, {
        mediaId,
        inputPath,
        outputPath,
        options: transcodingOptions,
        progress: 0,
        status: "pending",
      });

      // Iniciar la transcodificación en segundo plano
      this.runTranscodeProcess(
        jobId,
        inputPath,
        outputPath,
        transcodingOptions
      );

      return {
        jobId,
        mediaId,
        status: "pending",
        outputPath,
        profile: profileName,
      };
    } catch (error) {
      console.error(`Error al iniciar transcodificación:`, error);
      throw new Error(
        `No se pudo iniciar la transcodificación: ${error.message}`
      );
    }
  }

  // Ejecutar proceso de transcodificación
  async runTranscodeProcess(jobId, inputPath, outputPath, options) {
    try {
      // Actualizar estado a 'processing'
      await db.asyncRun("UPDATE transcoding_jobs SET status = ? WHERE id = ?", [
        "processing",
        jobId,
      ]);

      // Actualizar estado interno
      this.activeJobs.get(jobId).status = "processing";

      // Emitir evento de inicio
      transcoderEvents.emit("jobStarted", {
        jobId,
        mediaId: this.activeJobs.get(jobId).mediaId,
      });

      // Verificar si el transcodificador está disponible
      if (fs.existsSync(this.transcoderBinPath)) {
        // Construir argumentos para el transcodificador
        const args = this.buildTranscoderArgs(inputPath, outputPath, options);

        // Ejecutar el transcodificador
        const command = `${this.transcoderBinPath} ${args}`;

        // Función para monitorizar y reportar progreso
        const monitorProgress = async () => {
          let isRunning = true;
          let progress = 0;

          while (isRunning && progress < 100) {
            // Verificar progreso usando el transcodificador
            try {
              const { stdout } = await execAsync(
                `${this.transcoderBinPath} progress "${outputPath}"`
              );
              const progressMatch = stdout.match(/(\d+)%/);
              if (progressMatch) {
                progress = parseInt(progressMatch[1]);

                // Actualizar progreso
                this.activeJobs.get(jobId).progress = progress;

                // Emitir evento de progreso
                transcoderEvents.emit("jobProgress", {
                  jobId,
                  mediaId: this.activeJobs.get(jobId).mediaId,
                  progress,
                });
              }
            } catch (error) {
              console.warn(`Error al monitorizar progreso: ${error.message}`);
            }

            // Esperar antes de la siguiente verificación
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verificar si el trabajo sigue activo
            isRunning =
              this.activeJobs.has(jobId) &&
              ["processing", "pending"].includes(
                this.activeJobs.get(jobId).status
              );
          }
        };

        // Iniciar monitorización en segundo plano
        monitorProgress();

        // Ejecutar transcodificación
        await execAsync(command);

        // Verificar que el archivo de salida existe
        if (!fs.existsSync(outputPath)) {
          throw new Error(
            "La transcodificación no generó ningún archivo de salida"
          );
        }

        // Actualizar estado a 'completed'
        await db.asyncRun(
          "UPDATE transcoding_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          ["completed", jobId]
        );

        // Actualizar estado interno
        if (this.activeJobs.has(jobId)) {
          this.activeJobs.get(jobId).status = "completed";
          this.activeJobs.get(jobId).progress = 100;
        }

        // Emitir evento de finalización
        transcoderEvents.emit("jobCompleted", {
          jobId,
          mediaId: this.activeJobs.get(jobId).mediaId,
          outputPath,
        });

        console.log(`Transcodificación completada para el trabajo ${jobId}`);
      } else {
        // Alternativa: usar FFmpeg
        await this.transcodeWithFfmpeg(jobId, inputPath, outputPath, options);
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

      // Actualizar estado interno
      if (this.activeJobs.has(jobId)) {
        this.activeJobs.get(jobId).status = "failed";
        this.activeJobs.get(jobId).error = error.message;
      }

      // Emitir evento de error
      transcoderEvents.emit("jobFailed", {
        jobId,
        mediaId: this.activeJobs.get(jobId)?.mediaId,
        error: error.message,
      });
    } finally {
      // Limpiar trabajo después de un tiempo
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 3600000); // Mantener en memoria por 1 hora
    }
  }

  // Construir argumentos para el transcodificador
  buildTranscoderArgs(inputPath, outputPath, options) {
    const args = [`transcode "${inputPath}" "${outputPath}"`];

    if (options.outputFormat) {
      args.push(`--format=${options.outputFormat}`);
    }

    if (options.videoCodec) {
      args.push(`--vcodec=${options.videoCodec}`);
    }

    if (options.audioCodec) {
      args.push(`--acodec=${options.audioCodec}`);
    }

    if (options.videoBitrate) {
      args.push(`--vbitrate=${options.videoBitrate}`);
    }

    if (options.audioBitrate) {
      args.push(`--abitrate=${options.audioBitrate}`);
    }

    if (options.width) {
      args.push(`--width=${options.width}`);
    }

    if (options.height) {
      args.push(`--height=${options.height}`);
    }

    if (options.disableHardwareAcceleration) {
      args.push("--no-hwaccel");
    }

    return args.join(" ");
  }

  // Alternativa de transcodificación usando FFmpeg
  async transcodeWithFfmpeg(jobId, inputPath, outputPath, options) {
    console.warn(
      "Transcodificador nativo no encontrado. Utilizando FFmpeg como alternativa."
    );

    // Verificar que ffmpeg está disponible
    try {
      await execAsync("ffmpeg -version");
    } catch (error) {
      throw new Error(
        "FFmpeg no está disponible. No se puede realizar la transcodificación."
      );
    }

    // Construir comando FFmpeg
    const ffmpegArgs = [];

    // Input
    ffmpegArgs.push("-i", `"${inputPath}"`);

    // Video codec
    if (options.videoCodec) {
      ffmpegArgs.push("-c:v", options.videoCodec);
    } else {
      ffmpegArgs.push("-c:v", "libx264"); // Usar H.264 por defecto
    }

    // Audio codec
    if (options.audioCodec) {
      ffmpegArgs.push("-c:a", options.audioCodec);
    } else {
      ffmpegArgs.push("-c:a", "aac"); // Usar AAC por defecto
    }

    // Bitrates
    if (options.videoBitrate) {
      ffmpegArgs.push("-b:v", `${options.videoBitrate}k`);
    }

    if (options.audioBitrate) {
      ffmpegArgs.push("-b:a", `${options.audioBitrate}k`);
    }

    // Resolución
    if (options.width && options.height) {
      ffmpegArgs.push("-vf", `scale=${options.width}:${options.height}`);
    }

    // Preset de codificación
    ffmpegArgs.push("-preset", "medium");

    // Aceleración por hardware si está disponible y no se ha desactivado
    if (!options.disableHardwareAcceleration) {
      // Intentar detectar si hay aceleración por hardware disponible
      try {
        const { stdout: hwaccelOutput } = await execAsync("ffmpeg -hwaccels");

        if (hwaccelOutput.includes("cuda")) {
          // NVIDIA
          ffmpegArgs.unshift("-hwaccel", "cuda");
        } else if (hwaccelOutput.includes("vaapi")) {
          // Intel VA-API
          ffmpegArgs.unshift("-hwaccel", "vaapi");
        } else if (hwaccelOutput.includes("qsv")) {
          // Intel Quick Sync
          ffmpegArgs.unshift("-hwaccel", "qsv");
        } else if (hwaccelOutput.includes("videotoolbox")) {
          // macOS VideoToolbox
          ffmpegArgs.unshift("-hwaccel", "videotoolbox");
        }
      } catch (error) {
        console.warn(
          "No se pudo detectar aceleración por hardware:",
          error.message
        );
      }
    }

    // Forzar sobrescritura y output
    ffmpegArgs.push("-y", `"${outputPath}"`);

    // Construir comando completo
    const ffmpegCommand = `ffmpeg ${ffmpegArgs.join(" ")}`;

    // Función para monitorizar y reportar progreso
    const monitorFfmpegProgress = async (process) => {
      let progress = 0;

      // Obtener duración total primero
      let totalDuration = 0;
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
        );
        totalDuration = parseFloat(stdout);
      } catch (error) {
        console.warn(
          `No se pudo obtener la duración del video: ${error.message}`
        );
        return;
      }

      // Si no se pudo obtener duración, no podemos monitorizar el progreso
      if (!totalDuration) return;

      // Monitorizar progreso
      while (
        this.activeJobs.has(jobId) &&
        ["processing", "pending"].includes(this.activeJobs.get(jobId).status)
      ) {
        try {
          // Intentar obtener tiempo actual de procesamiento
          const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`
          );
          const currentDuration = parseFloat(stdout) || 0;

          // Calcular porcentaje
          progress = Math.min(
            Math.round((currentDuration / totalDuration) * 100),
            99
          );

          // Actualizar progreso
          if (this.activeJobs.has(jobId)) {
            this.activeJobs.get(jobId).progress = progress;

            // Emitir evento de progreso
            transcoderEvents.emit("jobProgress", {
              jobId,
              mediaId: this.activeJobs.get(jobId).mediaId,
              progress,
            });
          }
        } catch (error) {
          // Ignorar errores durante el monitoreo de progreso
        }

        // Esperar antes de la siguiente verificación
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    };

    // Empezar a monitorizar en segundo plano
    monitorFfmpegProgress();

    // Ejecutar FFmpeg
    await execAsync(ffmpegCommand);

    // Verificar que el archivo de salida existe
    if (!fs.existsSync(outputPath)) {
      throw new Error(
        "La transcodificación no generó ningún archivo de salida"
      );
    }

    // Actualizar estado a 'completed'
    await db.asyncRun(
      "UPDATE transcoding_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
      ["completed", jobId]
    );

    // Actualizar estado interno
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.get(jobId).status = "completed";
      this.activeJobs.get(jobId).progress = 100;
    }

    // Emitir evento de finalización
    transcoderEvents.emit("jobCompleted", {
      jobId,
      mediaId: this.activeJobs.get(jobId).mediaId,
      outputPath,
    });

    console.log(
      `Transcodificación con FFmpeg completada para el trabajo ${jobId}`
    );
  }

  // Cancelar una transcodificación en curso
  async cancelTranscodeJob(jobId) {
    if (!this.activeJobs.has(jobId)) {
      throw new Error(`Trabajo de transcodificación no encontrado: ${jobId}`);
    }

    const job = this.activeJobs.get(jobId);

    // Marcar como cancelado en la base de datos
    await db.asyncRun(
      "UPDATE transcoding_jobs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
      ["failed", "Trabajo cancelado por el usuario", jobId]
    );

    // Actualizar estado interno
    job.status = "cancelled";

    // Emitir evento de cancelación
    transcoderEvents.emit("jobCancelled", {
      jobId,
      mediaId: job.mediaId,
    });

    // Si hay un archivo parcial, eliminarlo
    if (fs.existsSync(job.outputPath)) {
      try {
        fs.unlinkSync(job.outputPath);
      } catch (error) {
        console.warn(
          `No se pudo eliminar el archivo parcial: ${error.message}`
        );
      }
    }

    return { success: true, jobId };
  }

  // Obtener estado de una transcodificación
  getTranscodeJobStatus(jobId) {
    // Primero verificar en la memoria
    if (this.activeJobs.has(jobId)) {
      const job = this.activeJobs.get(jobId);
      return {
        jobId,
        mediaId: job.mediaId,
        status: job.status,
        progress: job.progress,
        outputPath: job.outputPath,
        error: job.error,
      };
    }

    // Si no está en memoria, buscar en la base de datos
    return db
      .asyncGet(`SELECT * FROM transcoding_jobs WHERE id = ?`, [jobId])
      .then((job) => {
        if (!job) {
          throw new Error(
            `Trabajo de transcodificación no encontrado: ${jobId}`
          );
        }

        return {
          jobId: job.id,
          mediaId: job.media_id,
          status: job.status,
          progress: job.status === "completed" ? 100 : 0,
          outputPath: job.output_path,
          error: job.error_message,
        };
      });
  }

  // Generar una miniatura para un video
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
        const command = `ffmpeg -y -ss ${timeOffset} -i "${videoPath}" -vframes 1 -vf "scale=320:-1" "${thumbnailPath}"`;
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

  // Generar un conjunto de miniaturas para previsualización (storyboard)
  async generatePreviewStoryboard(videoPath, numThumbnails = 10) {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Archivo no encontrado: ${videoPath}`);
      }

      // Obtener información del video para conocer su duración
      const mediaInfo = await this.getMediaInfo(videoPath);
      const duration = mediaInfo.duration / 1000; // Convertir ms a segundos

      if (!duration || duration <= 0) {
        throw new Error("No se pudo determinar la duración del video");
      }

      // Crear directorio para las miniaturas del storyboard
      const fileName = path.basename(videoPath, path.extname(videoPath));
      const storyboardDir = path.join(
        this.thumbnailsDir,
        `${fileName}_storyboard`
      );

      if (!fs.existsSync(storyboardDir)) {
        fs.mkdirSync(storyboardDir, { recursive: true });
      }

      // Calcular los intervalos para las miniaturas
      const interval = duration / (numThumbnails + 1);
      const thumbnails = [];

      // Generar cada miniatura
      for (let i = 1; i <= numThumbnails; i++) {
        const timeOffset = Math.floor(interval * i);
        const thumbnailFileName = `${fileName}_thumb_${i}.jpg`;
        const thumbnailPath = path.join(storyboardDir, thumbnailFileName);

        // Verificar si el transcodificador está disponible
        if (fs.existsSync(this.transcoderBinPath)) {
          // Usar el transcodificador nativo
          const command = `${this.transcoderBinPath} thumbnail "${videoPath}" "${thumbnailPath}" ${timeOffset}`;
          await execAsync(command);
        } else {
          // Alternativa: usar FFmpeg
          const command = `ffmpeg -y -ss ${timeOffset} -i "${videoPath}" -vframes 1 -vf "scale=160:-1" "${thumbnailPath}"`;
          await execAsync(command);
        }

        // Verificar que la miniatura se ha creado correctamente
        if (fs.existsSync(thumbnailPath)) {
          thumbnails.push({
            path: thumbnailPath,
            timeOffset,
            index: i,
          });
        }
      }

      return {
        videoPath,
        storyboardDir,
        thumbnails,
        count: thumbnails.length,
      };
    } catch (error) {
      console.error(`Error al generar storyboard para ${videoPath}:`, error);
      throw new Error(`No se pudo generar el storyboard: ${error.message}`);
    }
  }

  // Crear HLS (HTTP Live Streaming) para streaming adaptativo
  async createHLSStream(mediaId, videoPath, options = {}) {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Archivo no encontrado: ${videoPath}`);
      }

      // Crear directorio para el streaming
      const fileName = path.basename(videoPath, path.extname(videoPath));
      const hlsDir = path.join(this.outputDir, `${fileName}_hls`);

      if (!fs.existsSync(hlsDir)) {
        fs.mkdirSync(hlsDir, { recursive: true });
      }

      // Definir calidades para el streaming adaptativo
      const qualities = options.qualities || [
        { name: "240p", height: 240, bitrate: 400 },
        { name: "360p", height: 360, bitrate: 800 },
        { name: "480p", height: 480, bitrate: 1400 },
        { name: "720p", height: 720, bitrate: 2800 },
        { name: "1080p", height: 1080, bitrate: 5000 },
      ];

      // Limitar las calidades según las opciones
      let filteredQualities = qualities;
      if (options.maxHeight) {
        filteredQualities = qualities.filter(
          (q) => q.height <= options.maxHeight
        );
      }

      // Verificar que hay al menos una calidad
      if (filteredQualities.length === 0) {
        filteredQualities = [{ name: "360p", height: 360, bitrate: 800 }];
      }

      // Crear registro en la base de datos
      const jobResult = await db.asyncRun(
        `INSERT INTO transcoding_jobs 
         (media_id, status, target_format, target_resolution, output_path, started_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [mediaId, "pending", "hls", "adaptative", hlsDir]
      );

      const jobId = jobResult.lastID;

      // Guardar información del trabajo activo
      this.activeJobs.set(jobId, {
        mediaId,
        inputPath: videoPath,
        outputPath: hlsDir,
        options,
        progress: 0,
        status: "pending",
        type: "hls",
      });

      // Actualizar estado
      await db.asyncRun("UPDATE transcoding_jobs SET status = ? WHERE id = ?", [
        "processing",
        jobId,
      ]);

      // Actualizar estado interno
      this.activeJobs.get(jobId).status = "processing";

      // Emitir evento de inicio
      transcoderEvents.emit("jobStarted", {
        jobId,
        mediaId,
        type: "hls",
      });

      // Comando FFMPEG para generar HLS
      let ffmpegCommand = "ffmpeg";

      // Entrada
      ffmpegCommand += ` -i "${videoPath}"`;

      // Opciones globales
      ffmpegCommand += " -preset medium -g 48 -sc_threshold 0";

      // Map de audio y video
      ffmpegCommand += " -map 0:v:0 -map 0:a:0";

      // Generar streams para cada calidad
      filteredQualities.forEach((quality) => {
        // Video stream
        ffmpegCommand += ` -c:v:0 libx264 -b:v:0 ${
          quality.bitrate
        }k -s ${Math.ceil((quality.height * 16) / 9)}x${quality.height}`;
        ffmpegCommand += ` -var_stream_map "v:0,a:0"`;

        // Audio stream
        ffmpegCommand += " -c:a aac -b:a 128k -ac 2";
      });

      // Opciones de salida HLS
      ffmpegCommand += ` -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "${hlsDir}/${fileName}_%v_%03d.ts"`;
      ffmpegCommand += ` -master_pl_name master.m3u8 "${hlsDir}/${fileName}_%v.m3u8"`;

      console.log(`Iniciando generación HLS para ${videoPath}`);
      console.log(`Comando: ${ffmpegCommand}`);

      // Función para monitorizar progreso
      const monitorHLSProgress = async () => {
        let progress = 0;

        // Obtener duración total primero
        let totalDuration = 0;
        try {
          const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
          );
          totalDuration = parseFloat(stdout);
        } catch (error) {
          console.warn(
            `No se pudo obtener la duración del video: ${error.message}`
          );
          return;
        }

        // Si no se pudo obtener duración, no podemos monitorizar el progreso
        if (!totalDuration) return;

        // Intervalo para verificar el progreso
        const interval = setInterval(async () => {
          if (
            !this.activeJobs.has(jobId) ||
            this.activeJobs.get(jobId).status !== "processing"
          ) {
            clearInterval(interval);
            return;
          }

          try {
            // Contar segmentos generados
            const files = fs.readdirSync(hlsDir);
            const segments = files.filter((f) => f.endsWith(".ts"));

            // Cada segmento es de 4 segundos (según hls_time)
            const secondsProcessed = segments.length * 4;
            progress = Math.min(
              Math.round((secondsProcessed / totalDuration) * 100),
              99
            );

            // Actualizar progreso
            if (this.activeJobs.has(jobId)) {
              this.activeJobs.get(jobId).progress = progress;

              // Emitir evento de progreso
              transcoderEvents.emit("jobProgress", {
                jobId,
                mediaId,
                progress,
                type: "hls",
              });
            }
          } catch (error) {
            // Ignorar errores durante el monitoreo
          }
        }, 3000);

        return interval;
      };

      // Iniciar monitorización
      const progressInterval = await monitorHLSProgress();

      try {
        // Ejecutar FFmpeg
        await execAsync(ffmpegCommand);

        // Verificar que se generaron los archivos
        const files = fs.readdirSync(hlsDir);
        if (!files.includes("master.m3u8")) {
          throw new Error("No se generó el archivo master.m3u8");
        }

        // Actualizar estado a 'completed'
        await db.asyncRun(
          "UPDATE transcoding_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          ["completed", jobId]
        );

        // Actualizar estado interno
        if (this.activeJobs.has(jobId)) {
          this.activeJobs.get(jobId).status = "completed";
          this.activeJobs.get(jobId).progress = 100;
        }

        // Detener intervalo de progreso
        if (progressInterval) clearInterval(progressInterval);

        // Emitir evento de finalización
        transcoderEvents.emit("jobCompleted", {
          jobId,
          mediaId,
          outputPath: hlsDir,
          masterPlaylist: path.join(hlsDir, "master.m3u8"),
          type: "hls",
        });

        console.log(`Generación HLS completada para ${videoPath}`);

        return {
          jobId,
          mediaId,
          status: "completed",
          outputPath: hlsDir,
          masterPlaylist: path.join(hlsDir, "master.m3u8"),
          qualities: filteredQualities,
        };
      } catch (error) {
        // Detener intervalo de progreso
        if (progressInterval) clearInterval(progressInterval);

        console.error(`Error en la generación HLS: ${error.message}`);

        // Actualizar estado a 'failed'
        await db.asyncRun(
          "UPDATE transcoding_jobs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          ["failed", error.message, jobId]
        );

        // Actualizar estado interno
        if (this.activeJobs.has(jobId)) {
          this.activeJobs.get(jobId).status = "failed";
          this.activeJobs.get(jobId).error = error.message;
        }

        // Emitir evento de error
        transcoderEvents.emit("jobFailed", {
          jobId,
          mediaId,
          error: error.message,
          type: "hls",
        });

        throw error;
      }
    } catch (error) {
      console.error(`Error al crear stream HLS para ${videoPath}:`, error);
      throw new Error(`No se pudo crear el stream HLS: ${error.message}`);
    }
  }

  // Suscribirse a eventos del transcodificador
  on(event, callback) {
    transcoderEvents.on(event, callback);
    return this; // Para encadenamiento
  }

  // Cancelar suscripción a eventos
  off(event, callback) {
    transcoderEvents.off(event, callback);
    return this;
  }
}

module.exports = new EnhancedTranscoderService();
