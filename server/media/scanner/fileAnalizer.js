// server/media/scanner/fileAnalyzer.js
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const execPromise = promisify(exec);
const filesystem = require("../../utils/filesystem");
const logger = require("../../utils/logger");
const { THUMBNAILS_DIR } = require("../../config/paths");

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("FileAnalyzer");

/**
 * Clase especializada en analizar archivos multimedia para extraer metadatos
 */
class FileAnalyzer {
  /**
   * Constructor
   * @param {Object} options - Opciones del analizador
   */
  constructor(options = {}) {
    this.options = {
      ffmpegPath: options.ffmpegPath || "ffmpeg",
      ffprobePath: options.ffprobePath || "ffprobe",
      generateThumbnails: options.generateThumbnails ?? true,
      thumbnailTimePosition: options.thumbnailTimePosition || 10, // segundos
      thumbnailSize: options.thumbnailSize || "320:-1", // ancho:alto
      extractAudioMetadata: options.extractAudioMetadata ?? true,
      extractVideoMetadata: options.extractVideoMetadata ?? true,
      extractImageMetadata: options.extractImageMetadata ?? true,
      detectionThreshold: options.detectionThreshold || 0.6, // para detección de contenido
      ...options,
    };

    // Verificar disponibilidad de herramientas en el sistema
    this.toolsAvailable = {
      ffmpeg: false,
      ffprobe: false,
    };
  }

  /**
   * Verifica la disponibilidad de las herramientas necesarias
   * @returns {Promise<boolean>} - true si todas las herramientas están disponibles
   */
  async checkTools() {
    try {
      // Verificar FFmpeg
      await execPromise(`${this.options.ffmpegPath} -version`);
      this.toolsAvailable.ffmpeg = true;
      log.debug("FFmpeg disponible en el sistema");

      // Verificar FFprobe
      await execPromise(`${this.options.ffprobePath} -version`);
      this.toolsAvailable.ffprobe = true;
      log.debug("FFprobe disponible en el sistema");

      return this.toolsAvailable.ffmpeg && this.toolsAvailable.ffprobe;
    } catch (error) {
      log.warn("Herramientas de análisis no disponibles en el sistema:", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Analiza un archivo multimedia y extrae sus metadatos
   * @param {string} filePath - Ruta del archivo a analizar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - Metadatos extraídos
   */
  async analyzeFile(filePath, options = {}) {
    const startTime = Date.now();

    // Metadatos por defecto con información básica del archivo
    const metadata = {
      path: filePath,
      filename: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      title: path.basename(filePath, path.extname(filePath)),
      size: 0,
      type: this.getMediaType(filePath),
      mime: filesystem.getMimeType(filePath),
      duration: null,
      width: null,
      height: null,
      bitrate: null,
      codec: null,
      audioCodec: null,
      sampleRate: null,
      channels: null,
      thumbnailPath: null,
      analyzed: false,
      analysisTime: 0,
      error: null,
    };

    try {
      // Verificar que el archivo existe
      if (!(await filesystem.exists(filePath))) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }

      // Obtener información básica del archivo
      const fileInfo = await filesystem.getFileInfo(filePath);
      if (!fileInfo) {
        throw new Error(
          `No se pudo obtener información del archivo: ${filePath}`
        );
      }

      metadata.size = fileInfo.size;
      metadata.created = fileInfo.created;
      metadata.modified = fileInfo.modified;

      // Verificar si tenemos las herramientas necesarias
      if (!this.toolsAvailable.ffmpeg || !this.toolsAvailable.ffprobe) {
        await this.checkTools();
      }

      // Si es un archivo de video o audio, extraer metadatos con ffprobe
      if (
        (metadata.type === "movie" || metadata.type === "music") &&
        this.toolsAvailable.ffprobe
      ) {
        const probeData = await this.extractFFprobeMetadata(filePath);

        // Integrar datos de ffprobe con los metadatos
        Object.assign(metadata, probeData);

        // Generar miniatura para videos si está habilitado
        if (
          metadata.type === "movie" &&
          this.options.generateThumbnails &&
          this.toolsAvailable.ffmpeg
        ) {
          metadata.thumbnailPath = await this.generateThumbnail(
            filePath,
            options
          );
        }
      }

      // Si es una imagen, extraer metadatos específicos
      if (metadata.type === "photo" && this.options.extractImageMetadata) {
        try {
          const imageMetadata = await this.extractImageMetadata(filePath);
          Object.assign(metadata, imageMetadata);
        } catch (imgError) {
          log.warn(`Error al extraer metadatos de imagen ${filePath}:`, {
            error: imgError.message,
          });
        }
      }

      metadata.analyzed = true;
      metadata.analysisTime = Date.now() - startTime;

      return metadata;
    } catch (error) {
      log.error(`Error al analizar archivo ${filePath}:`, {
        error: error.message,
        stack: error.stack,
      });

      metadata.error = error.message;
      metadata.analyzed = false;
      metadata.analysisTime = Date.now() - startTime;

      return metadata;
    }
  }

  /**
   * Extrae metadatos usando FFprobe
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<Object>} - Metadatos extraídos
   */
  async extractFFprobeMetadata(filePath) {
    const metadata = {};

    try {
      // Ejecutar ffprobe para obtener información en formato JSON
      const { stdout } = await execPromise(
        `${this.options.ffprobePath} -v error -select_streams v:0 -show_entries format=duration,bit_rate,tags:stream=width,height,codec_name,sample_rate,channels -of json "${filePath}"`
      );

      const probeData = JSON.parse(stdout);

      // Extraer información del formato
      if (probeData.format) {
        metadata.duration = parseFloat(probeData.format.duration) || null;
        metadata.bitrate = probeData.format.bit_rate
          ? parseInt(probeData.format.bit_rate)
          : null;

        // Extraer tags si existen
        if (probeData.format.tags) {
          // Título desde metadatos si existe
          if (probeData.format.tags.title) {
            metadata.title = probeData.format.tags.title;
          }

          // Artista
          if (probeData.format.tags.artist) {
            metadata.artist = probeData.format.tags.artist;
          }

          // Álbum
          if (probeData.format.tags.album) {
            metadata.album = probeData.format.tags.album;
          }

          // Año
          if (probeData.format.tags.date) {
            metadata.year = this.extractYear(probeData.format.tags.date);
          }

          // Género
          if (probeData.format.tags.genre) {
            metadata.genre = probeData.format.tags.genre;
          }
        }
      }

      // Extraer información de streams (video, audio)
      if (probeData.streams && probeData.streams.length > 0) {
        for (const stream of probeData.streams) {
          // Stream de video
          if (stream.codec_type === "video") {
            metadata.width = stream.width || null;
            metadata.height = stream.height || null;
            metadata.codec = stream.codec_name || null;
            metadata.frameRate = stream.r_frame_rate
              ? this.calculateFrameRate(stream.r_frame_rate)
              : null;

            // Aspect ratio
            if (metadata.width && metadata.height) {
              metadata.aspectRatio = this.calculateAspectRatio(
                metadata.width,
                metadata.height
              );
            }
          }

          // Stream de audio
          if (stream.codec_type === "audio") {
            metadata.audioCodec = stream.codec_name || null;
            metadata.sampleRate = stream.sample_rate
              ? parseInt(stream.sample_rate)
              : null;
            metadata.channels = stream.channels || null;
            metadata.audioLanguage = stream.tags?.language || null;
          }
        }
      }

      return metadata;
    } catch (error) {
      log.warn(`Error al extraer metadatos con FFprobe de ${filePath}:`, {
        error: error.message,
      });
      return metadata;
    }
  }

  /**
   * Genera una miniatura para un archivo de video
   * @param {string} videoPath - Ruta del archivo de video
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<string|null>} - Ruta de la miniatura generada o null si falla
   */
  async generateThumbnail(videoPath, options = {}) {
    try {
      // Crear directorio de miniaturas si no existe
      await filesystem.ensureDir(THUMBNAILS_DIR);

      const fileName = path.basename(videoPath, path.extname(videoPath));
      const thumbnailPath = path.join(THUMBNAILS_DIR, `${fileName}_thumb.jpg`);
      const normalizedThumbnailPath = filesystem.normalizePath(thumbnailPath);

      // Posición de tiempo para la miniatura (por defecto a los 10 segundos o personalizada)
      const timePosition =
        options.timePosition || this.options.thumbnailTimePosition;

      // Tamaño de la miniatura (por defecto 320px de ancho con altura proporcional)
      const size = options.size || this.options.thumbnailSize;

      // Generar miniatura usando ffmpeg
      await execPromise(
        `${this.options.ffmpegPath} -y -i "${videoPath}" -ss 00:00:${timePosition} -vframes 1 -vf "scale=${size}" "${thumbnailPath}"`
      );

      // Verificar que la miniatura se generó correctamente
      if (await filesystem.exists(thumbnailPath)) {
        log.debug(`Miniatura generada correctamente: ${thumbnailPath}`);
        return normalizedThumbnailPath;
      } else {
        log.warn(`No se pudo generar la miniatura para ${videoPath}`);
        return null;
      }
    } catch (error) {
      log.warn(`Error al generar miniatura para ${videoPath}:`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Extraer metadatos específicos de imágenes
   * @param {string} imagePath - Ruta de la imagen
   * @returns {Promise<Object>} - Metadatos de la imagen
   */
  async extractImageMetadata(imagePath) {
    const metadata = {};

    try {
      // Usar ffprobe para imágenes también
      if (this.toolsAvailable.ffprobe) {
        const { stdout } = await execPromise(
          `${this.options.ffprobePath} -v error -select_streams v:0 -show_entries stream=width,height -of json "${imagePath}"`
        );

        const probeData = JSON.parse(stdout);

        if (probeData.streams && probeData.streams.length > 0) {
          const stream = probeData.streams[0];
          metadata.width = stream.width || null;
          metadata.height = stream.height || null;

          // Calcular aspect ratio
          if (metadata.width && metadata.height) {
            metadata.aspectRatio = this.calculateAspectRatio(
              metadata.width,
              metadata.height
            );
          }
        }
      }

      return metadata;
    } catch (error) {
      log.warn(`Error al extraer metadatos de imagen ${imagePath}:`, {
        error: error.message,
      });
      return metadata;
    }
  }

  /**
   * Determina el tipo de archivo multimedia
   * @param {string} filePath - Ruta del archivo
   * @returns {string} - Tipo de archivo (movie, music, photo)
   */
  getMediaType(filePath) {
    const fileType = filesystem.getFileType(filePath);

    switch (fileType) {
      case "video":
        return "movie";
      case "audio":
        return "music";
      case "image":
        return "photo";
      default:
        return "unknown";
    }
  }

  /**
   * Calcular aspect ratio de una imagen o video
   * @param {number} width - Ancho
   * @param {number} height - Alto
   * @returns {string} - Aspect ratio como string (ej: "16:9")
   */
  calculateAspectRatio(width, height) {
    if (!width || !height) return null;

    const gcd = this.gcd(width, height);
    return `${width / gcd}:${height / gcd}`;
  }

  /**
   * Calcular máximo común divisor (para aspect ratio)
   * @param {number} a - Primer número
   * @param {number} b - Segundo número
   * @returns {number} - Máximo común divisor
   */
  gcd(a, b) {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  /**
   * Calcular frame rate a partir de la cadena proporcionada por ffprobe
   * @param {string} rateString - Cadena de tasa de frames (ej: "24000/1001")
   * @returns {number} - Frame rate calculado
   */
  calculateFrameRate(rateString) {
    try {
      if (!rateString || !rateString.includes("/")) {
        return parseFloat(rateString);
      }

      const [numerator, denominator] = rateString.split("/").map(Number);
      return parseFloat((numerator / denominator).toFixed(3));
    } catch (error) {
      return null;
    }
  }

  /**
   * Extraer año de una cadena de fecha
   * @param {string} dateString - Cadena que contiene una fecha
   * @returns {number|null} - Año extraído o null
   */
  extractYear(dateString) {
    if (!dateString) return null;

    // Intentar extraer un patrón de 4 dígitos (un año)
    const yearMatch = dateString.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return parseInt(yearMatch[0]);
    }

    // Intentar interpretar como fecha ISO
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.getFullYear();
      }
    } catch (e) {
      // Ignorar errores de parsing
    }

    return null;
  }

  /**
   * Analiza un lote de archivos multimedia
   * @param {Array<string>} filePaths - Lista de rutas de archivos
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Lista de metadatos para cada archivo
   */
  async analyzeBatch(filePaths, options = {}) {
    const results = [];
    const { concurrency = 3 } = options;

    // Si no hay concurrencia, procesar secuencialmente
    if (concurrency <= 1) {
      for (const filePath of filePaths) {
        const metadata = await this.analyzeFile(filePath, options);
        results.push(metadata);
      }
      return results;
    }

    // Procesar con concurrencia limitada
    const batches = [];
    for (let i = 0; i < filePaths.length; i += concurrency) {
      batches.push(filePaths.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      const batchPromises = batch.map((filePath) =>
        this.analyzeFile(filePath, options)
      );
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Detectar episodios de series mediante el análisis de nombres de archivo
   * @param {Array<Object>} mediaItems - Lista de items multimedia con metadatos
   * @returns {Array<Object>} - Items agrupados y con información de episodio/temporada
   */
  detectTVShows(mediaItems) {
    // Patrones comunes para detectar series de TV
    const patterns = [
      // Patrón común "Show Name S01E01"
      {
        regex: /(.+)[Ss](\d{1,2})[Ee](\d{1,2})/,
        extractInfo: (matches) => ({
          title: matches[1].trim(),
          season: parseInt(matches[2]),
          episode: parseInt(matches[3]),
        }),
      },
      // Patrón "Show Name 1x01"
      {
        regex: /(.+)(\d{1,2})x(\d{1,2})/,
        extractInfo: (matches) => ({
          title: matches[1].trim(),
          season: parseInt(matches[2]),
          episode: parseInt(matches[3]),
        }),
      },
      // Patrón "Show.Name.S01.E01"
      {
        regex: /(.+)[Ss](\d{1,2})\.?[Ee](\d{1,2})/,
        extractInfo: (matches) => ({
          title: matches[1].replace(/\./g, " ").trim(),
          season: parseInt(matches[2]),
          episode: parseInt(matches[3]),
        }),
      },
    ];

    // Solo procesar archivos de video
    const videoItems = mediaItems.filter((item) => item.type === "movie");

    // Resultado procesado
    const processedItems = [];

    // Map para agrupar por serie
    const showMap = new Map();

    for (const item of videoItems) {
      let isEpisode = false;
      let showInfo = null;

      // Probar cada patrón
      for (const pattern of patterns) {
        const matches = item.title.match(pattern.regex);
        if (matches) {
          showInfo = pattern.extractInfo(matches);
          isEpisode = true;
          break;
        }
      }

      if (isEpisode && showInfo) {
        // Es un episodio de serie
        const cleanTitle = showInfo.title
          .replace(/\./g, " ")
          .replace(/_/g, " ")
          .replace(/-/g, " ")
          .trim();

        // Modificar el item para reflejar que es un episodio
        const episodeItem = {
          ...item,
          type: "episode",
          seriesTitle: cleanTitle,
          seasonNumber: showInfo.season,
          episodeNumber: showInfo.episode,
          title: `${cleanTitle} - S${String(showInfo.season).padStart(
            2,
            "0"
          )}E${String(showInfo.episode).padStart(2, "0")}`,
        };

        // Agregar al mapa de series
        if (!showMap.has(cleanTitle)) {
          showMap.set(cleanTitle, []);
        }

        showMap.get(cleanTitle).push(episodeItem);
        processedItems.push(episodeItem);
      } else {
        // No es un episodio, mantener como película
        processedItems.push(item);
      }
    }

    return {
      processedItems,
      shows: Array.from(showMap.entries()).map(([title, episodes]) => ({
        title,
        episodeCount: episodes.length,
        seasons: [...new Set(episodes.map((ep) => ep.seasonNumber))].length,
        episodes,
      })),
    };
  }
}

module.exports = FileAnalyzer;
