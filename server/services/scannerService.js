// server/services/scannerService.js
const path = require("path");
const libraryRepository = require("../data/repositories/libraryRepository");
const mediaRepository = require("../data/repositories/mediaRepository");
const metadataService = require("./metadataService");
const eventBus = require("./eventBus");
const environment = require("../config/environment");
const filesystem = require("../utils/filesystem");
const logger = require("../utils/logger");
const DirectoryScanner = require("../media/scanner/directoryScanner");
const FileAnalyzer = require("../media/scanner/fileAnalyzer");

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("ScannerService");

/**
 * Servicio para escanear directorios en busca de archivos multimedia
 */
class ScannerService {
  constructor() {
    // Inicializar componentes especializados
    this.directoryScanner = new DirectoryScanner({
      maxDepth: 15,
      followSymlinks: false,
      includeHidden: false,
      recursiveScanning: true,
    });

    this.fileAnalyzer = new FileAnalyzer({
      ffmpegPath: environment.FFMPEG_PATH || "ffmpeg",
      ffprobePath: environment.FFPROBE_PATH || "ffprobe",
      generateThumbnails: environment.AUTO_GENERATE_THUMBNAILS !== false,
      thumbnailTimePosition: 10,
      thumbnailSize: "320:-1",
    });

    // Verificar herramientas al iniciar
    this.verifyTools();

    // Registrar escuchadores de eventos
    this.registerEventListeners();
  }

  /**
   * Verificar disponibilidad de herramientas
   */
  async verifyTools() {
    try {
      const toolsAvailable = await this.fileAnalyzer.checkTools();
      if (toolsAvailable) {
        log.info("Herramientas de análisis multimedia disponibles");
      } else {
        log.warn(
          "Algunas herramientas de análisis multimedia no están disponibles. La generación de miniaturas y extracción de metadatos pueden estar limitadas."
        );
      }
    } catch (error) {
      log.error("Error al verificar herramientas:", { error: error.message });
    }
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
        log.info(
          `Escaneando automáticamente nueva biblioteca: ${library.name}`,
          { libraryId }
        );
        this.scanLibrary(libraryId).catch((err) => {
          log.error(`Error al escanear biblioteca ${libraryId}:`, {
            error: err.message,
          });
        });
      }
    });
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

      log.info(`Escaneando biblioteca: ${library.name} (${library.path})`);

      // Emitir evento de inicio de escaneo
      eventBus.emitEvent("library:scan-started", {
        libraryId,
        libraryName: library.name,
        path: library.path,
      });

      // Verificar que la ruta existe
      const pathExists = await filesystem.exists(library.path);
      if (!pathExists) {
        throw new Error(`La ruta de la biblioteca no existe: ${library.path}`);
      }

      // Escanear la biblioteca con el nuevo componente especializado
      const scanResults = await this.directoryScanner.scanLibrary(library);
      const mediaFiles = scanResults.mediaFiles;

      // Obtener metadatos detallados para cada archivo
      const totalFiles = mediaFiles.length;
      log.info(
        `Encontrados ${totalFiles} archivos multimedia para analizar en biblioteca ${library.name}`
      );

      // Procesar archivos en lotes para mejorar rendimiento
      const BATCH_SIZE = 5;
      for (let i = 0; i < mediaFiles.length; i += BATCH_SIZE) {
        const batch = mediaFiles.slice(i, i + BATCH_SIZE);

        // Analizar el lote actual
        const analyzedBatch = await this.processMediaBatch(batch, library);

        // Actualizar contadores de resultados
        results.totalScanned += analyzedBatch.totalProcessed;
        results.newFiles += analyzedBatch.newFiles;
        results.updatedFiles += analyzedBatch.updatedFiles;
        results.failedFiles += analyzedBatch.failedFiles;

        // Emitir evento de progreso
        const progress = Math.floor((results.totalScanned / totalFiles) * 100);
        eventBus.emitEvent("library:scan-progress", {
          libraryId,
          status: "analyzing",
          progress,
          totalScanned: results.totalScanned,
          totalFiles,
        });
      }

      results.endTime = new Date();
      results.duration = (results.endTime - results.startTime) / 1000; // en segundos

      // Actualizar la biblioteca con la fecha del último escaneo
      await libraryRepository.update(libraryId, {
        updated_at: new Date().toISOString(),
      });

      log.info(
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

      // Agrupar episodios de series si es una biblioteca de series/películas
      if (library.type === "movies" || library.type === "series") {
        setTimeout(() => {
          this.detectAndProcessTVShows(libraryId).catch((err) => {
            log.error(`Error al procesar series en biblioteca ${libraryId}:`, {
              error: err.message,
            });
          });
        }, 1000);
      }

      return results;
    } catch (error) {
      log.error(`Error durante el escaneo de la biblioteca ${libraryId}:`, {
        error: error.message,
        stack: error.stack,
      });

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
   * Procesa un lote de archivos multimedia
   * @param {Array} mediaFiles - Lote de archivos a procesar
   * @param {Object} library - Información de la biblioteca
   * @returns {Promise<Object>} - Resultados del procesamiento
   */
  async processMediaBatch(mediaFiles, library) {
    const results = {
      totalProcessed: 0,
      newFiles: 0,
      updatedFiles: 0,
      failedFiles: 0,
    };

    // Extraer solo las rutas de los archivos
    const filePaths = mediaFiles.map((file) => file.path);

    // Analizar archivos para obtener metadatos detallados
    const analyzedFiles = await this.fileAnalyzer.analyzeBatch(filePaths, {
      concurrency: 3,
    });

    // Procesar cada archivo analizado
    for (const mediaFile of analyzedFiles) {
      try {
        // Buscar el item original para obtener el tipo correcto de medios
        const originalItem = mediaFiles.find(
          (item) => item.path === mediaFile.path
        );

        if (!originalItem) {
          results.failedFiles++;
          continue;
        }

        // Verificar si el archivo ya existe en la base de datos
        const existingMedia = await mediaRepository.findByPath(mediaFile.path);

        // Preparar datos para la base de datos
        const mediaData = {
          library_id: library.id,
          title: mediaFile.title,
          type: originalItem.type,
          file_path: mediaFile.path,
          duration: mediaFile.duration,
          size: mediaFile.size,
          thumbnail_path: mediaFile.thumbnailPath,
          year: mediaFile.year || null,
          genre: mediaFile.genre || null,
          // Datos adicionales específicos por tipo
          ...(mediaFile.type === "movie"
            ? {
                width: mediaFile.width,
                height: mediaFile.height,
                codec: mediaFile.codec,
              }
            : {}),
          ...(mediaFile.type === "music"
            ? {
                artist: mediaFile.artist,
                album: mediaFile.album,
                audioCodec: mediaFile.audioCodec,
                channels: mediaFile.channels,
              }
            : {}),
        };

        if (existingMedia) {
          // Actualizar archivo existente
          await mediaRepository.update(existingMedia.id, mediaData);
          results.updatedFiles++;

          // Emitir evento de actualización
          eventBus.emitEvent("media:updated", { mediaId: existingMedia.id });
        } else {
          // Insertar nuevo archivo
          const newMedia = await mediaRepository.create(mediaData);
          results.newFiles++;

          // Emitir evento de creación
          eventBus.emitEvent("media:created", { mediaId: newMedia.id });

          // Buscar metadatos para películas si está habilitado
          if (mediaData.type === "movie" && environment.AUTO_FETCH_METADATA) {
            setTimeout(async () => {
              try {
                await metadataService.enrichMediaItem(newMedia.id);
              } catch (error) {
                log.error(`Error al obtener metadatos para ${newMedia.id}:`, {
                  error: error.message,
                });
              }
            }, 0);
          }
        }

        results.totalProcessed++;
      } catch (error) {
        log.error(`Error al procesar archivo ${mediaFile.path}:`, {
          error: error.message,
        });
        results.failedFiles++;
        results.totalProcessed++;
      }
    }

    return results;
  }

  /**
   * Detectar y procesar series de TV basadas en patrones de archivos
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async detectAndProcessTVShows(libraryId) {
    try {
      // Obtener todos los archivos de video de la biblioteca
      const mediaItems = await mediaRepository.findByLibrary(libraryId, {
        type: "movie", // Esto obtiene todos los videos inicialmente marcados como películas
        limit: 10000, // Un límite alto para incluir toda la biblioteca
      });

      if (!mediaItems || mediaItems.length === 0) {
        log.info(
          `No se encontraron elementos de video en biblioteca ${libraryId}`
        );
        return { processed: 0 };
      }

      log.info(
        `Analizando ${mediaItems.length} elementos de video para detectar series de TV en biblioteca ${libraryId}`
      );

      // Detectar series utilizando el analizador de archivos
      const { processedItems, shows } =
        this.fileAnalyzer.detectTVShows(mediaItems);

      if (shows.length === 0) {
        log.info(`No se detectaron series de TV en biblioteca ${libraryId}`);
        return { processed: 0 };
      }

      log.info(
        `Detectadas ${shows.length} series de TV en biblioteca ${libraryId}`
      );

      // Actualizar elementos en la base de datos para marcarlos como episodios
      let processed = 0;

      for (const show of shows) {
        log.info(
          `Procesando serie "${show.title}" con ${show.episodeCount} episodios`
        );

        // Crear o actualizar entrada de serie principal
        let seriesId = null;

        // Buscar si la serie ya existe
        const existingSeries = await mediaRepository.findByTitleAndType(
          show.title,
          "series"
        );

        if (existingSeries) {
          seriesId = existingSeries.id;
          log.debug(`Serie "${show.title}" ya existe con ID ${seriesId}`);
        } else {
          // Crear nueva entrada para la serie
          const newSeries = await mediaRepository.create({
            library_id: libraryId,
            title: show.title,
            type: "series",
            season_count: show.seasons,
            episode_count: show.episodeCount,
          });

          seriesId = newSeries.id;
          log.debug(`Creada nueva serie "${show.title}" con ID ${seriesId}`);

          // Buscar metadatos para la serie
          if (environment.AUTO_FETCH_METADATA) {
            setTimeout(async () => {
              try {
                await metadataService.enrichMediaItem(seriesId);
              } catch (error) {
                log.error(
                  `Error al obtener metadatos para serie ${seriesId}:`,
                  { error: error.message }
                );
              }
            }, 0);
          }
        }

        // Actualizar cada episodio
        for (const episode of show.episodes) {
          try {
            const existingEpisode = await mediaRepository.findByPath(
              episode.path
            );

            if (existingEpisode) {
              // Actualizar episodio existente
              await mediaRepository.update(existingEpisode.id, {
                type: "episode",
                parent_id: seriesId,
                season_number: episode.seasonNumber,
                episode_number: episode.episodeNumber,
                title: episode.title,
              });

              processed++;
              log.debug(`Actualizado episodio ${episode.title}`);
            }
          } catch (error) {
            log.error(`Error al actualizar episodio ${episode.title}:`, {
              error: error.message,
            });
          }
        }
      }

      log.info(
        `Procesamiento de series completado. ${processed} episodios actualizados en biblioteca ${libraryId}`
      );

      // Emitir evento de procesamiento de series
      eventBus.emitEvent("library:series-processed", {
        libraryId,
        seriesCount: shows.length,
        episodesProcessed: processed,
      });

      return {
        processed,
        seriesCount: shows.length,
        library: libraryId,
      };
    } catch (error) {
      log.error(`Error al procesar series en biblioteca ${libraryId}:`, {
        error: error.message,
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
        log.info("No hay bibliotecas configuradas para escanear");

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
          log.info(
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
          log.error(`Error al escanear biblioteca ${library.name}:`, {
            error: error.message,
          });

          results.libraries.push({
            id: library.id,
            name: library.name,
            error: error.message,
          });
        }
      }

      results.endTime = new Date();
      results.duration = (results.endTime - results.startTime) / 1000; // en segundos

      log.info(
        `Escaneo completo. Total archivos: ${results.totalScanned}, ` +
          `Nuevos: ${results.newFiles}, Actualizados: ${results.updatedFiles}, ` +
          `Fallidos: ${results.failedFiles}`
      );

      // Emitir evento de finalización
      eventBus.emitEvent("libraries:scan-completed", results);

      return results;
    } catch (error) {
      log.error("Error durante el escaneo de bibliotecas:", {
        error: error.message,
      });

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
   * Buscar directorios potenciales para usar como bibliotecas
   * @param {string} rootPath - Directorio raíz para buscar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Lista de directorios potenciales
   */
  async findPotentialLibraryDirectories(rootPath, options = {}) {
    try {
      log.info(
        `Buscando directorios potenciales para bibliotecas en: ${rootPath}`
      );

      const results =
        await this.directoryScanner.findPotentialLibraryDirectories(
          rootPath,
          options
        );

      log.info(
        `Encontrados ${results.length} directorios potenciales para bibliotecas`
      );

      return results;
    } catch (error) {
      log.error(
        `Error al buscar directorios para bibliotecas en ${rootPath}:`,
        { error: error.message }
      );
      return [];
    }
  }

  /**
   * Programa un escaneo automático de todas las bibliotecas
   * @param {number} intervalMinutes - Intervalo en minutos entre escaneos
   * @returns {Object} - Objeto con método para detener los escaneos automáticos
   */
  scheduleAutomaticScans(intervalMinutes = 60) {
    const interval = Math.max(10, intervalMinutes) * 60 * 1000; // Mínimo 10 minutos
    log.info(
      `Programando escaneos automáticos cada ${intervalMinutes} minutos`
    );

    // Iniciar temporizador
    const timer = setInterval(async () => {
      log.info("Iniciando escaneo automático programado...");
      try {
        await this.scanAllLibraries();
      } catch (error) {
        log.error("Error durante el escaneo automático:", {
          error: error.message,
        });
      }
    }, interval);

    // Devolver objeto con método para detener los escaneos
    return {
      stop: () => {
        clearInterval(timer);
        log.info("Escaneos automáticos detenidos");
      },
    };
  }
}

module.exports = new ScannerService();
