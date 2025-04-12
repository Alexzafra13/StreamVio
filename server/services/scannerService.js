// server/services/scannerService.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const libraryRepository = require("../data/repositories/libraryRepository");
const mediaRepository = require("../data/repositories/mediaRepository");
const metadataService = require("./metadataService");
const eventBus = require("./eventBus");
const { THUMBNAILS_DIR } = require("../config/paths");
const environment = require("../config/environment");

// Promisificar operaciones
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const execPromise = promisify(exec);

/**
 * Servicio para escanear directorios en busca de archivos multimedia
 */
class ScannerService {
  constructor() {
    // Extensiones de archivos multimedia soportadas
    this.SUPPORTED_VIDEO_EXTENSIONS = [
      ".mp4",
      ".mkv",
      ".avi",
      ".mov",
      ".wmv",
      ".m4v",
      ".webm",
      ".mpg",
      ".mpeg",
      ".3gp",
      ".flv",
    ];

    this.SUPPORTED_AUDIO_EXTENSIONS = [
      ".mp3",
      ".wav",
      ".flac",
      ".aac",
      ".ogg",
      ".m4a",
      ".wma",
    ];

    this.SUPPORTED_IMAGE_EXTENSIONS = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
    ];

    // Escuchadores de eventos
    this.registerEventListeners();
  }

  /**
   * Configurar escuchadores de eventos
   */
  registerEventListeners() {
    // Cuando se crea una biblioteca, escanearla automáticamente si está configurado
    eventBus.on("library:created", async (event) => {
      const { libraryId } = event.payload;
      const library = await libraryRepository.findById(libraryId);

      if (library && library.scan_automatically) {
        console.log(
          `Escaneando automáticamente nueva biblioteca: ${library.name}`
        );
        this.scanLibrary(libraryId).catch((err) => {
          console.error(`Error al escanear biblioteca ${libraryId}:`, err);
        });
      }
    });
  }

  /**
   * Verifica si un archivo es un archivo multimedia soportado
   * @param {string} filePath - Ruta del archivo
   * @returns {boolean} - true si es un archivo multimedia soportado
   */
  isMediaFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return (
      this.SUPPORTED_VIDEO_EXTENSIONS.includes(ext) ||
      this.SUPPORTED_AUDIO_EXTENSIONS.includes(ext) ||
      this.SUPPORTED_IMAGE_EXTENSIONS.includes(ext)
    );
  }

  /**
   * Determina el tipo de archivo multimedia
   * @param {string} filePath - Ruta del archivo
   * @returns {string} - Tipo de archivo ('movie', 'music', 'photo', 'unknown')
   */
  getMediaType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (this.SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
      return "movie"; // Por defecto asumimos película
    } else if (this.SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
      return "music";
    } else if (this.SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
      return "photo";
    }

    return "unknown";
  }

  /**
   * Normaliza una ruta para usar siempre barras diagonales (/)
   * @param {string} filePath - Ruta a normalizar
   * @returns {string} - Ruta normalizada
   */
  normalizePath(filePath) {
    return filePath.replace(/\\/g, "/");
  }

  /**
   * Extrae metadatos básicos de un archivo utilizando ffprobe
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<Object>} - Objeto con metadatos
   */
  async extractMetadata(filePath) {
    // Metadatos por defecto
    const metadata = {
      title: path.basename(filePath, path.extname(filePath)),
      duration: null,
      size: 0,
      width: null,
      height: null,
      codec: null,
      bitrate: null,
    };

    try {
      // Obtener tamaño del archivo
      const stats = await stat(filePath);
      metadata.size = stats.size;

      const type = this.getMediaType(filePath);

      // Para archivos de video o audio, usar ffprobe para extraer metadatos
      if (type === "movie" || type === "music") {
        try {
          // Verificar si ffprobe está disponible
          await execPromise("ffprobe -version");

          // Extraer duración, resolución, etc.
          const { stdout } = await execPromise(
            `ffprobe -v error -select_streams v:0 -show_entries format=duration,bit_rate:stream=width,height,codec_name -of json "${filePath}"`
          );

          const probeData = JSON.parse(stdout);

          if (probeData.format) {
            metadata.duration = parseFloat(probeData.format.duration) || null;
            metadata.bitrate = probeData.format.bit_rate
              ? parseInt(probeData.format.bit_rate)
              : null;
          }

          if (probeData.streams && probeData.streams.length > 0) {
            const videoStream = probeData.streams[0];
            metadata.width = videoStream.width || null;
            metadata.height = videoStream.height || null;
            metadata.codec = videoStream.codec_name || null;
          }
        } catch (error) {
          console.warn(
            `FFprobe no disponible o error al procesar ${filePath}:`,
            error.message
          );
        }
      }

      return metadata;
    } catch (error) {
      console.error(`Error al extraer metadatos de ${filePath}:`, error);
      return metadata;
    }
  }

  /**
   * Genera una miniatura para un archivo de video
   * @param {string} videoPath - Ruta del archivo de video
   * @returns {Promise<string|null>} - Ruta de la miniatura generada o null si falla
   */
  async generateThumbnail(videoPath) {
    const type = this.getMediaType(videoPath);
    if (type !== "movie") return null;

    try {
      // Verificar si ffmpeg está disponible
      await execPromise("ffmpeg -version");

      // Crear directorio de miniaturas si no existe
      if (!fs.existsSync(THUMBNAILS_DIR)) {
        fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
      }

      const fileName = path.basename(videoPath, path.extname(videoPath));
      const thumbnailPath = path.join(THUMBNAILS_DIR, `${fileName}_thumb.jpg`);
      const normalizedThumbnailPath = this.normalizePath(thumbnailPath);

      // Generar miniatura al 20% del video (o a los 10 segundos)
      await execPromise(
        `ffmpeg -y -i "${videoPath}" -ss 00:00:10 -vframes 1 -vf "scale=320:-1" "${thumbnailPath}"`
      );

      return normalizedThumbnailPath;
    } catch (error) {
      console.warn(
        `FFmpeg no disponible o error al generar miniatura para ${videoPath}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Escanea recursivamente un directorio en busca de archivos multimedia
   * @param {string} directory - Directorio a escanear
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Array>} - Array de archivos encontrados con sus metadatos
   */
  async scanDirectory(directory, libraryId) {
    const mediaFiles = [];

    try {
      // Emitir evento de progreso
      eventBus.emitEvent("library:scan-progress", {
        libraryId,
        status: "scanning",
        currentDirectory: directory,
      });

      const entries = await readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        // Normalizar la ruta para consistencia entre sistemas operativos
        const normalizedPath = this.normalizePath(fullPath);

        if (entry.isDirectory()) {
          // Recursivamente escanear subdirectorios
          const subDirFiles = await this.scanDirectory(
            normalizedPath,
            libraryId
          );
          mediaFiles.push(...subDirFiles);
        } else if (entry.isFile() && this.isMediaFile(normalizedPath)) {
          // Extraer metadatos si es un archivo multimedia
          console.log(`Escaneando archivo: ${normalizedPath}`);
          const metadata = await this.extractMetadata(normalizedPath);
          const type = this.getMediaType(normalizedPath);

          // Generar miniatura para videos
          let thumbnailPath = null;
          if (type === "movie") {
            thumbnailPath = await this.generateThumbnail(normalizedPath);
          }

          mediaFiles.push({
            path: normalizedPath,
            type,
            libraryId,
            ...metadata,
            thumbnailPath,
          });
        }
      }

      return mediaFiles;
    } catch (error) {
      console.error(`Error al escanear directorio ${directory}:`, error);

      // Emitir evento de error
      eventBus.emitEvent("library:scan-error", {
        libraryId,
        directory,
        error: error.message,
      });

      return mediaFiles;
    }
  }

  /**
   * Guarda un archivo multimedia en la base de datos
   * @param {Object} mediaFile - Información del archivo
   * @returns {Promise<number>} - ID del archivo en la base de datos
   */
  async saveMediaFileToDB(mediaFile) {
    try {
      // Normalizar la ruta antes de verificar si existe en la BD
      const normalizedPath = this.normalizePath(mediaFile.path);

      // Verificar si el archivo ya existe en la base de datos
      const existingMedia = await mediaRepository.findByPath(normalizedPath);

      let mediaId;

      if (existingMedia) {
        // Actualizar el archivo existente
        const updatedMedia = await mediaRepository.update(existingMedia.id, {
          title: mediaFile.title,
          description: mediaFile.description || null,
          type: mediaFile.type,
          duration: mediaFile.duration,
          size: mediaFile.size,
          thumbnail_path: mediaFile.thumbnailPath,
        });

        console.log(
          `Archivo actualizado en la base de datos: ${normalizedPath}`
        );
        mediaId = existingMedia.id;

        // Emitir evento de actualización
        eventBus.emitEvent("media:updated", { mediaId });
      } else {
        // Insertar nuevo archivo
        const newMedia = await mediaRepository.create({
          library_id: mediaFile.libraryId,
          title: mediaFile.title,
          type: mediaFile.type,
          file_path: normalizedPath,
          duration: mediaFile.duration,
          size: mediaFile.size,
          thumbnail_path: mediaFile.thumbnailPath,
        });

        console.log(
          `Nuevo archivo añadido a la base de datos: ${normalizedPath}`
        );
        mediaId = newMedia.id;

        // Emitir evento de creación
        eventBus.emitEvent("media:created", { mediaId });
      }

      // Intentar obtener metadatos de TMDb si es una película y está activado en configuración
      if (mediaFile.type === "movie" && environment.AUTO_FETCH_METADATA) {
        try {
          // Ejecutar en segundo plano para no bloquear el escaneo
          setTimeout(async () => {
            try {
              console.log(`Buscando metadatos para: ${mediaFile.title}`);
              await metadataService.enrichMediaItem(mediaId);
            } catch (metadataError) {
              console.error(
                `Error al obtener metadatos para ${mediaId}:`,
                metadataError
              );
            }
          }, 0);
        } catch (err) {
          console.error(
            `Error al configurar búsqueda de metadatos para ${mediaFile.title}:`,
            err
          );
        }
      }

      return mediaId;
    } catch (error) {
      console.error(
        `Error al guardar archivo ${mediaFile.path} en la base de datos:`,
        error
      );
      throw error;
    }
  }

  /**
   * Escanea una biblioteca específica
   * @param {number} libraryId - ID de la biblioteca a escanear
   * @returns {Promise<Object>} - Resultado del escaneo
   */
  async scanLibrary(libraryId) {
    const results = {
      libraryId,
      totalScanned: 0,
      newFiles: 0,
      updatedFiles: 0,
      failedFiles: 0,
      startTime: new Date(),
      endTime: null,
    };

    try {
      // Obtener información de la biblioteca
      const library = await libraryRepository.findById(libraryId);

      if (!library) {
        throw new Error(`No se encontró una biblioteca con ID ${libraryId}`);
      }

      console.log(`Escaneando biblioteca: ${library.name} (${library.path})`);

      // Emitir evento de inicio de escaneo
      eventBus.emitEvent("library:scan-started", {
        libraryId,
        libraryName: library.name,
        path: library.path,
      });

      // Normalizar ruta de la biblioteca
      const normalizedLibraryPath = this.normalizePath(library.path);

      // Verificar que la ruta existe
      if (!fs.existsSync(normalizedLibraryPath)) {
        throw new Error(
          `La ruta de la biblioteca no existe: ${normalizedLibraryPath}`
        );
      }

      // Escanear la biblioteca
      const mediaFiles = await this.scanDirectory(
        normalizedLibraryPath,
        libraryId
      );

      for (const mediaFile of mediaFiles) {
        try {
          // Verificar si el archivo ya existe en la base de datos
          const existingMedia = await mediaRepository.findByPath(
            mediaFile.path
          );

          const mediaId = await this.saveMediaFileToDB(mediaFile);

          results.totalScanned++;

          if (existingMedia) {
            results.updatedFiles++;
          } else {
            results.newFiles++;
          }
        } catch (error) {
          console.error(`Error al procesar archivo ${mediaFile.path}:`, error);
          results.failedFiles++;
        }
      }

      results.endTime = new Date();
      results.duration = (results.endTime - results.startTime) / 1000; // en segundos

      // Actualizar la biblioteca con la fecha del último escaneo
      await libraryRepository.update(libraryId, {
        updated_at: new Date().toISOString(),
      });

      console.log(
        `Escaneo de biblioteca ${library.name} completo. ` +
          `Total archivos: ${results.totalScanned}, ` +
          `Nuevos: ${results.newFiles}, ` +
          `Actualizados: ${results.updatedFiles}, ` +
          `Fallidos: ${results.failedFiles}`
      );

      // Emitir evento de finalización
      eventBus.emitEvent("library:scan-completed", {
        libraryId,
        ...results,
      });

      return results;
    } catch (error) {
      console.error(
        `Error durante el escaneo de la biblioteca ${libraryId}:`,
        error
      );

      results.endTime = new Date();
      results.duration = (results.endTime - results.startTime) / 1000;
      results.error = error.message;

      // Emitir evento de error
      eventBus.emitEvent("library:scan-error", {
        libraryId,
        error: error.message,
        results,
      });

      throw error;
    }
  }

  /**
   * Inicia un escaneo de todas las bibliotecas configuradas
   * @returns {Promise<Object>} - Resultado del escaneo
   */
  async scanAllLibraries() {
    const results = {
      totalScanned: 0,
      newFiles: 0,
      updatedFiles: 0,
      failedFiles: 0,
      librariesScanned: 0,
      startTime: new Date(),
      endTime: null,
      libraries: [],
    };

    try {
      // Emitir evento de inicio de escaneo completo
      eventBus.emitEvent("libraries:scan-started", {});

      // Obtener todas las bibliotecas de la base de datos
      const libraries = await libraryRepository.findAll();

      if (libraries.length === 0) {
        console.log("No hay bibliotecas configuradas para escanear");

        results.endTime = new Date();
        results.duration = 0;

        eventBus.emitEvent("libraries:scan-completed", results);

        return {
          ...results,
          message: "No hay bibliotecas configuradas",
        };
      }

      // Escanear cada biblioteca
      for (const library of libraries) {
        // Solo escanear bibliotecas con escaneo automático habilitado
        if (!library.scan_automatically) {
          console.log(
            `Omitiendo biblioteca ${library.name} (escaneo automático deshabilitado)`
          );
          continue;
        }

        try {
          const libraryResult = await this.scanLibrary(library.id);

          // Acumular resultados
          results.totalScanned += libraryResult.totalScanned;
          results.newFiles += libraryResult.newFiles;
          results.updatedFiles += libraryResult.updatedFiles;
          results.failedFiles += libraryResult.failedFiles;
          results.libraries.push({
            id: library.id,
            name: library.name,
            ...libraryResult,
          });

          results.librariesScanned++;
        } catch (error) {
          console.error(`Error al escanear biblioteca ${library.name}:`, error);

          results.libraries.push({
            id: library.id,
            name: library.name,
            error: error.message,
          });
        }
      }

      results.endTime = new Date();
      results.duration = (results.endTime - results.startTime) / 1000; // en segundos

      console.log(
        `Escaneo completo. Total archivos: ${results.totalScanned}, ` +
          `Nuevos: ${results.newFiles}, Actualizados: ${results.updatedFiles}, ` +
          `Fallidos: ${results.failedFiles}`
      );

      // Emitir evento de finalización
      eventBus.emitEvent("libraries:scan-completed", results);

      return results;
    } catch (error) {
      console.error("Error durante el escaneo de bibliotecas:", error);

      results.endTime = new Date();
      results.duration = (results.endTime - results.startTime) / 1000;
      results.error = error.message;

      // Emitir evento de error
      eventBus.emitEvent("libraries:scan-error", {
        error: error.message,
        results,
      });

      throw error;
    }
  }

  /**
   * Programa un escaneo automático de todas las bibliotecas
   * @param {number} intervalMinutes - Intervalo en minutos entre escaneos
   * @returns {Object} - Objeto con método para detener los escaneos automáticos
   */
  scheduleAutomaticScans(intervalMinutes = 60) {
    console.log(
      `Programando escaneos automáticos cada ${intervalMinutes} minutos`
    );

    // Convertir minutos a milisegundos
    const interval = intervalMinutes * 60 * 1000;

    // Iniciar temporizador
    const timer = setInterval(async () => {
      console.log("Iniciando escaneo automático programado...");
      try {
        await this.scanAllLibraries();
      } catch (error) {
        console.error("Error durante el escaneo automático:", error);
      }
    }, interval);

    // Devolver objeto con método para detener los escaneos
    return {
      stop: () => {
        clearInterval(timer);
        console.log("Escaneos automáticos detenidos");
      },
    };
  }
}

module.exports = new ScannerService();
