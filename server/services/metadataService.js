// server/services/metadataService.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const mediaRepository = require("../data/repositories/mediaRepository");
const environment = require("../config/environment");
const eventBus = require("./eventBus");
const { METADATA_DIR, THUMBNAILS_DIR } = require("../config/paths");

// Promisificar operaciones de fs
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

/**
 * Servicio para gestión de metadatos de elementos multimedia
 */
class MetadataService {
  constructor() {
    // Configuración para TMDb
    this.apiKey = environment.TMDB_API_KEY;
    this.apiToken = environment.TMDB_ACCESS_TOKEN;
    this.baseUrl = "https://api.themoviedb.org/3";
    this.language = "es-ES"; // Podría hacerse configurable

    // Configurar directorios de caché
    this.cacheDir = path.join(METADATA_DIR, "cache");

    // Crear directorios si no existen
    this.setupDirectories();
  }

  /**
   * Configurar directorios necesarios
   */
  async setupDirectories() {
    try {
      if (!fs.existsSync(METADATA_DIR)) {
        await mkdir(METADATA_DIR, { recursive: true });
      }

      if (!fs.existsSync(this.cacheDir)) {
        await mkdir(this.cacheDir, { recursive: true });
      }

      if (!fs.existsSync(THUMBNAILS_DIR)) {
        await mkdir(THUMBNAILS_DIR, { recursive: true });
      }
    } catch (error) {
      console.error("Error al crear directorios de metadatos:", error);
    }
  }

  /**
   * Busca una película por título
   * @param {string} title - Título de la película
   * @param {number} year - Año de lanzamiento (opcional)
   * @returns {Promise<Array>} - Resultados de la búsqueda
   */
  async searchMovie(title, year = null) {
    try {
      // Verificar API key
      if (!this.apiKey) {
        console.warn("API key de TMDb no configurada");
        return [];
      }

      // Construir URL de búsqueda
      let url = `${this.baseUrl}/search/movie?api_key=${
        this.apiKey
      }&query=${encodeURIComponent(title)}&language=${this.language}`;

      if (year) {
        url += `&year=${year}`;
      }

      const response = await axios.get(url);
      return response.data.results;
    } catch (error) {
      console.error(`Error buscando película "${title}":`, error.message);
      return [];
    }
  }

  /**
   * Obtiene detalles completos de una película por su ID
   * @param {number} movieId - ID de la película en TMDb
   * @returns {Promise<Object|null>} - Detalles de la película
   */
  async getMovieDetails(movieId) {
    try {
      // Verificar API key
      if (!this.apiKey) {
        console.warn("API key de TMDb no configurada");
        return null;
      }

      // Verificar primero si está en caché
      const cacheFile = path.join(this.cacheDir, `movie_${movieId}.json`);

      if (fs.existsSync(cacheFile)) {
        try {
          const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
          // Verificar si la caché tiene menos de 30 días
          const cacheDate = new Date(cacheData._cacheDate);
          const now = new Date();
          const diffDays = Math.floor(
            (now - cacheDate) / (1000 * 60 * 60 * 24)
          );

          if (diffDays < 30) {
            return cacheData;
          }
        } catch (cacheError) {
          console.warn(
            `Error al leer caché para película ${movieId}:`,
            cacheError.message
          );
        }
      }

      // Si no está en caché o está obsoleta, obtener de la API
      const url = `${this.baseUrl}/movie/${movieId}?api_key=${this.apiKey}&language=${this.language}&append_to_response=credits,images`;
      const response = await axios.get(url);

      // Guardar en caché con fecha
      const dataToCache = {
        ...response.data,
        _cacheDate: new Date().toISOString(),
      };

      try {
        await writeFile(cacheFile, JSON.stringify(dataToCache, null, 2));
      } catch (writeError) {
        console.warn(
          `Error al guardar caché para película ${movieId}:`,
          writeError.message
        );
      }

      return response.data;
    } catch (error) {
      console.error(
        `Error obteniendo detalles de película ID ${movieId}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Obtener URL para poster de TMDb
   * @param {string} posterPath - Ruta relativa del poster en TMDb
   * @param {string} size - Tamaño del poster (w92, w154, w185, w342, w500, w780, original)
   * @returns {string} - URL completa del poster
   */
  getPosterUrl(posterPath, size = "w500") {
    if (!posterPath) return null;
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  }

  /**
   * Descargar y guardar el póster como thumbnail
   * @param {number} mediaId - ID del elemento multimedia
   * @param {string} posterPath - Ruta relativa del póster en TMDb
   * @returns {Promise<string|null>} - Ruta del poster descargado o null
   */
  async downloadPoster(mediaId, posterPath) {
    try {
      // Verificar que se ha proporcionado una ruta de póster
      if (!posterPath) {
        return null;
      }

      // Ruta donde guardaremos el póster
      const thumbnailPath = path.join(
        THUMBNAILS_DIR,
        `movie_${mediaId}_poster.jpg`
      );

      // URL completa del póster (tamaño w500)
      const posterUrl = this.getPosterUrl(posterPath, "w500");

      // Descargar imagen
      const response = await axios({
        method: "get",
        url: posterUrl,
        responseType: "arraybuffer",
      });

      // Guardar en disco
      await writeFile(thumbnailPath, response.data);

      // Actualizar ruta del thumbnail en la base de datos
      await mediaRepository.update(mediaId, {
        thumbnail_path: thumbnailPath,
      });

      return thumbnailPath;
    } catch (error) {
      console.error(
        `Error al descargar póster para elemento ${mediaId}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Busca y aplica metadatos a un elemento multimedia
   * @param {number} mediaId - ID del elemento en nuestra base de datos
   * @returns {Promise<boolean>} - true si se aplicaron metadatos correctamente
   */
  async enrichMediaItem(mediaId) {
    try {
      // Verificar API key
      if (!this.apiKey) {
        console.warn("API key de TMDb no configurada");
        return false;
      }

      // Emitir evento de inicio
      eventBus.emitEvent("media:metadata-started", { mediaId });

      // 1. Obtener información básica del elemento
      const mediaItem = await mediaRepository.findById(mediaId);

      if (!mediaItem) {
        throw new Error(`Elemento multimedia no encontrado: ${mediaId}`);
      }

      // Solo procesar películas por ahora
      if (mediaItem.type !== "movie") {
        console.log(
          `El elemento ${mediaId} no es una película, es ${mediaItem.type}`
        );
        return false;
      }

      // 2. Extraer título y año (si está disponible)
      const title = mediaItem.title;
      let year = null;

      // Intentar extraer año del título si existe en formato "Título (2020)"
      const yearMatch = title.match(/\((\d{4})\)$/);
      if (yearMatch && yearMatch[1]) {
        year = parseInt(yearMatch[1]);
      }

      // 3. Buscar película
      const searchResults = await this.searchMovie(
        // Limpiar el título de posibles añadidos como (2020)
        title.replace(/\(\d{4}\)$/, "").trim(),
        year
      );

      if (!searchResults || searchResults.length === 0) {
        console.log(`No se encontraron resultados para "${title}"`);

        // Emitir evento de finalización sin éxito
        eventBus.emitEvent("media:metadata-failed", {
          mediaId,
          reason: "NO_RESULTS",
          message: `No se encontraron resultados para "${title}"`,
        });

        return false;
      }

      // 4. Obtener detalles completos del primer resultado (más relevante)
      const movieDetails = await this.getMovieDetails(searchResults[0].id);

      if (!movieDetails) {
        console.log(`No se pudieron obtener detalles para "${title}"`);

        // Emitir evento de finalización sin éxito
        eventBus.emitEvent("media:metadata-failed", {
          mediaId,
          reason: "DETAILS_FAILED",
          message: `No se pudieron obtener detalles para "${title}"`,
        });

        return false;
      }

      // 5. Preparar datos para actualizar en nuestra base de datos
      const updateData = {
        title: movieDetails.title,
        original_title: movieDetails.original_title,
        description: movieDetails.overview,
        year: movieDetails.release_date
          ? parseInt(movieDetails.release_date.substring(0, 4))
          : null,
        genre: movieDetails.genres.map((g) => g.name).join(", "),
        rating: movieDetails.vote_average,
      };

      // Extraer director
      if (movieDetails.credits && movieDetails.credits.crew) {
        const director = movieDetails.credits.crew.find(
          (person) => person.job === "Director"
        );
        if (director) {
          updateData.director = director.name;
        }
      }

      // Extraer actores principales (primeros 5)
      if (
        movieDetails.credits &&
        movieDetails.credits.cast &&
        movieDetails.credits.cast.length > 0
      ) {
        updateData.actors = movieDetails.credits.cast
          .slice(0, 5)
          .map((actor) => actor.name)
          .join(", ");
      }

      // 6. Actualizar en base de datos
      await mediaRepository.update(mediaId, updateData);

      // 7. Descargar póster si está disponible
      if (movieDetails.poster_path) {
        await this.downloadPoster(mediaId, movieDetails.poster_path);
      }

      console.log(`Metadatos aplicados con éxito a "${title}"`);

      // Emitir evento de finalización con éxito
      eventBus.emitEvent("media:metadata-completed", {
        mediaId,
        tmdbId: movieDetails.id,
        title: movieDetails.title,
      });

      return true;
    } catch (error) {
      console.error(`Error al enriquecer elemento ${mediaId}:`, error);

      // Emitir evento de error
      eventBus.emitEvent("media:metadata-failed", {
        mediaId,
        reason: "ERROR",
        message: error.message,
      });

      return false;
    }
  }

  /**
   * Enriquecer todos los elementos de una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Object>} - Resultado del proceso
   */
  async enrichLibrary(libraryId) {
    try {
      // Obtener todos los elementos de la biblioteca
      const mediaItems = await mediaRepository.findByLibrary(libraryId, {
        type: "movie",
      });

      if (!mediaItems || mediaItems.length === 0) {
        return {
          libraryId,
          message: "La biblioteca no contiene películas para enriquecer",
          count: 0,
          success: true,
        };
      }

      // Emitir evento de inicio
      eventBus.emitEvent("library:metadata-started", {
        libraryId,
        count: mediaItems.length,
      });

      // Procesar elementos secuencialmente para no sobrecargar la API
      let enriched = 0;
      let failed = 0;

      for (const item of mediaItems) {
        // Solo procesar películas por ahora
        if (item.type === "movie") {
          // Emitir evento de progreso
          eventBus.emitEvent("library:metadata-progress", {
            libraryId,
            current: enriched + failed + 1,
            total: mediaItems.length,
            mediaId: item.id,
            title: item.title,
          });

          const success = await this.enrichMediaItem(item.id);

          if (success) {
            enriched++;
          } else {
            failed++;
          }

          // Pequeña pausa para no sobrecargar la API de TMDb (opcional)
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Emitir evento de finalización
      eventBus.emitEvent("library:metadata-completed", {
        libraryId,
        total: mediaItems.length,
        enriched,
        failed,
      });

      return {
        libraryId,
        message: `Proceso completado: ${enriched} películas enriquecidas, ${failed} fallidas`,
        count: mediaItems.length,
        enriched,
        failed,
        success: true,
      };
    } catch (error) {
      console.error(`Error al enriquecer biblioteca ${libraryId}:`, error);

      // Emitir evento de error
      eventBus.emitEvent("library:metadata-failed", {
        libraryId,
        error: error.message,
      });

      throw error;
    }
  }
}

module.exports = new MetadataService();
