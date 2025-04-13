// server/media/scanner/directoryScanner.js
const path = require("path");
const filesystem = require("../../utils/filesystem");
const logger = require("../../utils/logger");
const eventBus = require("../../services/eventBus");

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("DirectoryScanner");

/**
 * Clase especializada en escanear directorios para buscar archivos multimedia
 */
class DirectoryScanner {
  /**
   * Constructor
   * @param {Object} options - Opciones del escáner
   */
  constructor(options = {}) {
    // Extensiones de archivos multimedia soportadas
    this.SUPPORTED_EXTENSIONS = {
      video: [
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
      ],
      audio: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"],
      image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"],
    };

    // Configuraciones
    this.options = {
      maxDepth: options.maxDepth || 10,
      followSymlinks: options.followSymlinks || false,
      includeHidden: options.includeHidden || false,
      recursiveScanning: options.recursiveScanning ?? true,
      ...options,
    };

    // Set para registrar directorios visitados (evitar bucles infinitos con symlinks)
    this.visitedDirs = new Set();

    // Contadores para estadísticas
    this.stats = {
      scannedDirs: 0,
      scannedFiles: 0,
      mediaFiles: {
        video: 0,
        audio: 0,
        image: 0,
        total: 0,
      },
      elapsedTimeMs: 0,
    };
  }

  /**
   * Reinicia las estadísticas del escáner
   */
  resetStats() {
    this.visitedDirs.clear();
    this.stats = {
      scannedDirs: 0,
      scannedFiles: 0,
      mediaFiles: {
        video: 0,
        audio: 0,
        image: 0,
        total: 0,
      },
      elapsedTimeMs: 0,
    };
  }

  /**
   * Filtra archivos basándose en extensiones soportadas
   * @param {string} filePath - Ruta del archivo
   * @returns {Object|null} - Información del tipo de archivo o null si no es soportado
   */
  filterMediaFile(filePath) {
    if (!filePath) return null;

    const ext = path.extname(filePath).toLowerCase();

    // Comprobar si es un archivo oculto
    if (
      !this.options.includeHidden &&
      path.basename(filePath).startsWith(".")
    ) {
      return null;
    }

    // Comprobar extensión para cada tipo
    if (this.SUPPORTED_EXTENSIONS.video.includes(ext)) {
      return { type: "video", extension: ext, mediaType: "movie" };
    } else if (this.SUPPORTED_EXTENSIONS.audio.includes(ext)) {
      return { type: "audio", extension: ext, mediaType: "music" };
    } else if (this.SUPPORTED_EXTENSIONS.image.includes(ext)) {
      return { type: "image", extension: ext, mediaType: "photo" };
    }

    return null;
  }

  /**
   * Escanea un directorio y sus subdirectorios buscando archivos multimedia
   * @param {string} directoryPath - Ruta del directorio a escanear
   * @param {Object} context - Contexto adicional para el escaneo
   * @param {number} currentDepth - Profundidad actual del escaneo (para recursión)
   * @returns {Promise<Array>} - Lista de archivos multimedia encontrados
   */
  async scan(directoryPath, context = {}, currentDepth = 0) {
    const startTime = Date.now();
    const mediaFiles = [];

    try {
      // Verificar que no excede la profundidad máxima
      if (currentDepth > this.options.maxDepth) {
        log.debug(
          `Profundidad máxima alcanzada (${this.options.maxDepth}) en: ${directoryPath}`
        );
        return mediaFiles;
      }

      // Normalizar la ruta
      const normalizedDirPath = filesystem.normalizePath(directoryPath);

      // Verificar que no hemos visitado ya este directorio (evitar bucles con symlinks)
      if (this.visitedDirs.has(normalizedDirPath)) {
        log.debug(
          `Directorio ya visitado (posible symlink circular): ${normalizedDirPath}`
        );
        return mediaFiles;
      }

      // Agregar a visitados
      this.visitedDirs.add(normalizedDirPath);
      this.stats.scannedDirs++;

      // Verificar que el directorio existe
      if (!(await filesystem.exists(normalizedDirPath))) {
        log.warn(`Directorio no encontrado: ${normalizedDirPath}`);
        return mediaFiles;
      }

      // Verificar permisos de lectura
      if (!(await filesystem.isReadable(normalizedDirPath))) {
        log.warn(
          `Sin permisos de lectura para el directorio: ${normalizedDirPath}`
        );
        return mediaFiles;
      }

      // Emitir evento de progreso si se proporciona el contexto necesario
      if (context.libraryId) {
        eventBus.emitEvent("library:scan-progress", {
          libraryId: context.libraryId,
          status: "scanning",
          directory: normalizedDirPath,
          currentDepth,
          scannedDirs: this.stats.scannedDirs,
          filesFound: this.stats.mediaFiles.total,
        });
      }

      // Leer el contenido del directorio
      log.debug(`Escaneando directorio: ${normalizedDirPath}`);

      const entries = await filesystem.readDirectory(normalizedDirPath, {
        withFileTypes: true,
        includeStats: false,
      });

      // Procesar cada entrada
      for (const entry of entries) {
        const fullPath = entry.path;

        if (entry.isDirectory && this.options.recursiveScanning) {
          // Si es un enlace simbólico a un directorio, verificar configuración
          if (entry.isSymbolicLink && !this.options.followSymlinks) {
            log.debug(`Omitiendo enlace simbólico a directorio: ${fullPath}`);
            continue;
          }

          // Escanear recursivamente el subdirectorio
          const subDirFiles = await this.scan(
            fullPath,
            context,
            currentDepth + 1
          );
          mediaFiles.push(...subDirFiles);
        } else if (entry.isFile) {
          // Incrementar contador de archivos escaneados
          this.stats.scannedFiles++;

          // Verificar si es un archivo multimedia soportado
          const mediaInfo = this.filterMediaFile(fullPath);

          if (mediaInfo) {
            // Incrementar contadores
            this.stats.mediaFiles[mediaInfo.type]++;
            this.stats.mediaFiles.total++;

            // Agregar a la lista de resultados
            mediaFiles.push({
              path: fullPath,
              type: mediaInfo.mediaType,
              fileType: mediaInfo.type,
              extension: mediaInfo.extension,
              libraryId: context.libraryId || null,
            });

            log.debug(
              `Archivo multimedia encontrado: ${fullPath} (${mediaInfo.type})`
            );
          }
        }
      }

      // Actualizar tiempo transcurrido
      this.stats.elapsedTimeMs = Date.now() - startTime;

      return mediaFiles;
    } catch (error) {
      log.error(`Error al escanear directorio ${directoryPath}:`, {
        error: error.message,
        stack: error.stack,
      });

      // Emitir evento de error si se proporciona el contexto necesario
      if (context.libraryId) {
        eventBus.emitEvent("library:scan-error", {
          libraryId: context.libraryId,
          directory: directoryPath,
          error: error.message,
        });
      }

      // Actualizar tiempo transcurrido incluso en caso de error
      this.stats.elapsedTimeMs = Date.now() - startTime;

      return mediaFiles;
    }
  }

  /**
   * Obtiene las estadísticas del último escaneo
   * @returns {Object} - Estadísticas de escaneo
   */
  getStats() {
    return {
      ...this.stats,
      visitedDirs: this.visitedDirs.size,
    };
  }

  /**
   * Escaneo completo de una biblioteca
   * @param {Object} library - Información de la biblioteca
   * @returns {Promise<Object>} - Resultados del escaneo
   */
  async scanLibrary(library) {
    if (!library || !library.id || !library.path) {
      throw new Error("Se requiere una biblioteca válida con ID y ruta");
    }

    // Reiniciar estadísticas
    this.resetStats();
    const startTime = Date.now();

    const results = {
      libraryId: library.id,
      libraryName: library.name,
      libraryPath: library.path,
      mediaFiles: [],
      stats: null,
      startTime: new Date(startTime),
      endTime: null,
      durationMs: 0,
      error: null,
    };

    try {
      // Emitir evento de inicio
      eventBus.emitEvent("library:scan-started", {
        libraryId: library.id,
        libraryName: library.name,
        path: library.path,
      });

      // Configurar contexto para el escaneo
      const context = {
        libraryId: library.id,
        libraryType: library.type,
      };

      // Realizar escaneo
      log.info(
        `Iniciando escaneo de biblioteca: ${library.name} (${library.path})`
      );

      const mediaFiles = await this.scan(library.path, context);

      // Actualizar resultados
      results.mediaFiles = mediaFiles;
      results.stats = this.getStats();
      results.endTime = new Date();
      results.durationMs = Date.now() - startTime;

      // Emitir evento de finalización
      eventBus.emitEvent("library:scan-completed", {
        libraryId: library.id,
        mediaFilesCount: mediaFiles.length,
        stats: results.stats,
        durationMs: results.durationMs,
      });

      log.info(
        `Escaneo completado para ${library.name}: ${mediaFiles.length} archivos multimedia encontrados en ${results.durationMs}ms`
      );

      return results;
    } catch (error) {
      // En caso de error
      results.endTime = new Date();
      results.durationMs = Date.now() - startTime;
      results.error = error.message;
      results.stats = this.getStats();

      log.error(`Error durante el escaneo de biblioteca ${library.name}:`, {
        error: error.message,
        libraryId: library.id,
      });

      // Emitir evento de error
      eventBus.emitEvent("library:scan-error", {
        libraryId: library.id,
        error: error.message,
        stats: results.stats,
      });

      throw error;
    }
  }

  /**
   * Verifica si un directorio es válido y accesible para escaneo
   * @param {string} directoryPath - Ruta a verificar
   * @returns {Promise<boolean>} - true si es válido para escaneo
   */
  async isValidScanDirectory(directoryPath) {
    try {
      // Verificar existencia
      if (!(await filesystem.exists(directoryPath))) {
        log.warn(`Directorio no encontrado: ${directoryPath}`);
        return false;
      }

      // Verificar que es un directorio
      const stats = await filesystem.getFileInfo(directoryPath);
      if (!stats || !stats.isDirectory) {
        log.warn(`No es un directorio: ${directoryPath}`);
        return false;
      }

      // Verificar permisos de lectura
      if (!(await filesystem.isReadable(directoryPath))) {
        log.warn(`Sin permisos de lectura: ${directoryPath}`);
        return false;
      }

      return true;
    } catch (error) {
      log.error(`Error al verificar directorio ${directoryPath}:`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Obtener directorios potenciales para usar como bibliotecas
   * @param {string} rootPath - Directorio raíz para buscar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Lista de directorios potenciales
   */
  async findPotentialLibraryDirectories(rootPath, options = {}) {
    const { maxResults = 50, minMediaFiles = 5 } = options;
    const results = [];

    try {
      // Verificar que el directorio raíz existe
      if (!(await this.isValidScanDirectory(rootPath))) {
        return results;
      }

      // Obtener subdirectorios del primer nivel
      const entries = await filesystem.readDirectory(rootPath, {
        withFileTypes: true,
        includeStats: false,
      });

      const directories = entries.filter((entry) => entry.isDirectory);

      // Para cada subdirectorio, hacer un escaneo rápido para ver si contiene archivos multimedia
      for (const dir of directories) {
        if (results.length >= maxResults) break;

        // Crear un escáner específico para este subdirectorio con escaneo no recursivo
        const quickScanner = new DirectoryScanner({
          maxDepth: 2,
          followSymlinks: false,
          recursiveScanning: true,
        });

        // Realizar un escaneo rápido
        const mediaFiles = await quickScanner.scan(dir.path);
        const stats = quickScanner.getStats();

        // Si encontramos suficientes archivos multimedia, agregar a los resultados
        if (mediaFiles.length >= minMediaFiles) {
          results.push({
            path: dir.path,
            name: path.basename(dir.path),
            mediaCount: mediaFiles.length,
            mediaTypes: {
              video: stats.mediaFiles.video,
              audio: stats.mediaFiles.audio,
              image: stats.mediaFiles.image,
            },
            suggestedType: this.suggestLibraryType(stats.mediaFiles),
          });
        }
      }

      return results;
    } catch (error) {
      log.error(
        `Error al buscar directorios para bibliotecas en ${rootPath}:`,
        { error: error.message }
      );
      return results;
    }
  }

  /**
   * Sugiere un tipo de biblioteca basado en el contenido
   * @param {Object} mediaStats - Estadísticas de archivos multimedia
   * @returns {string} - Tipo de biblioteca sugerido
   */
  suggestLibraryType(mediaStats) {
    const { video, audio, image } = mediaStats;

    if (video > audio && video > image) {
      return "movies";
    } else if (audio > video && audio > image) {
      return "music";
    } else if (image > video && image > audio) {
      return "photos";
    } else if (video > 0) {
      return "movies";
    } else if (audio > 0) {
      return "music";
    } else if (image > 0) {
      return "photos";
    }

    return "movies"; // Por defecto
  }
}

module.exports = DirectoryScanner;
