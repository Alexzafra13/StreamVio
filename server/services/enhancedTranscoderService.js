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
    try {
      [this.outputDir, this.thumbnailsDir, this.cachesDir].forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });
    } catch (error) {
      console.error(`Error al crear directorios: ${error.message}`);
    }
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
        try {
          // Usar comando directo del transcodificador
          const { stdout } = await execAsync(
            `${this.transcoderBinPath} info "${filePath}"`
          );

          // Verificar que stdout no esté vacío
          if (!stdout) {
            throw new Error("No se pudo obtener información del archivo");
          }

          // Parsear la salida
          return this.parseNativeTranscoderOutput(stdout, filePath);
        } catch (error) {
          console.error(
            `Error con transcodificador nativo para ${filePath}:`,
            error
          );

          // Intentar método alternativo (FFprobe)
          return this.getMediaInfoWithFfprobe(filePath);
        }
      } else {
        // Método alternativo usando FFprobe
        return this.getMediaInfoWithFfprobe(filePath);
      }
    } catch (error) {
      console.error(`Error al obtener información de ${filePath}:`, error);
      throw new Error(
        `No se pudo obtener información del archivo: ${error.message}`
      );
    }
  }

  // Método de respaldo para obtener información con FFprobe
  async getMediaInfoWithFfprobe(filePath) {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
      );

      if (!stdout) {
        throw new Error(
          "No se pudo obtener información del archivo con FFprobe"
        );
      }

      const ffprobeData = JSON.parse(stdout);

      // Parsear la salida de FFprobe
      return this.parseFFprobeOutput(ffprobeData, filePath);
    } catch (error) {
      console.error(`Error con FFprobe para ${filePath}:`, error);
      throw error;
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

  // Parsear la salida de FFprobe
  parseFFprobeOutput(ffprobeData, filePath) {
    const info = {
      path: filePath,
      format: ffprobeData.format?.format_name || "unknown",
      duration: Math.floor(
        parseFloat(ffprobeData.format?.duration || 0) * 1000
      ),
      width: 0,
      height: 0,
      videoCodec: "",
      videoBitrate: 0,
      audioCodec: "",
      audioBitrate: 0,
      audioChannels: 0,
      audioSampleRate: 0,
      metadata: ffprobeData.format?.tags || {},
    };

    // Buscar streams de video y audio
    const videoStream = ffprobeData.streams?.find(
      (stream) => stream.codec_type === "video"
    );
    const audioStream = ffprobeData.streams?.find(
      (stream) => stream.codec_type === "audio"
    );

    if (videoStream) {
      info.width = videoStream.width || 0;
      info.height = videoStream.height || 0;
      info.videoCodec = videoStream.codec_name || "";
      info.videoBitrate = videoStream.bit_rate
        ? parseInt(videoStream.bit_rate) / 1000
        : 0;
    }

    if (audioStream) {
      info.audioCodec = audioStream.codec_name || "";
      info.audioChannels = audioStream.channels || 0;
      info.audioBitrate = audioStream.bit_rate
        ? parseInt(audioStream.bit_rate) / 1000
        : 0;
      info.audioSampleRate = audioStream.sample_rate
        ? parseInt(audioStream.sample_rate)
        : 0;
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
    } else if (isWifi && bandwidth >= 20000) {
      return "ultra";
    } else if (isWifi && bandwidth >= 10000) {
      return "high";
    } else if (isWifi && !isMobile && !isTablet) {
      return "standard";
    } else {
      // Perfil por defecto
      return "standard";
    }
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