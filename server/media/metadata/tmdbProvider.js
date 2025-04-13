// server/media/metadata/tmdbProvider.js
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const environment = require("../../config/environment");
const { METADATA_DIR, THUMBNAILS_DIR } = require("../../config/paths");
const logger = require("../../utils/logger");
const filesystem = require("../../utils/filesystem");

// Promisificar operaciones de fs
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("TMDbProvider");

/**
 * Proveedor de metadatos desde The Movie Database (TMDb)
 * Se encarga de buscar, obtener y procesar información de películas y series
 */
class TMDbProvider {
  constructor() {
    // Configuración para TMDb
    this.apiKey = environment.TMDB_API_KEY;
    this.apiToken = environment.TMDB_ACCESS_TOKEN;
    this.baseUrl = "https://api.themoviedb.org/3";
    this.language = environment.TMDB_LANGUAGE || "es-ES";

    // Configurar directorios de caché
    this.cacheDir = path.join(METADATA_DIR, "tmdb");
    this.posterDir = path.join(THUMBNAILS_DIR, "posters");

    // Crear directorios si no existen
    this.setupDirectories();
  }

  /**
   * Configurar directorios necesarios
   */
  async setupDirectories() {
    try {
      await filesystem.ensureDir(METADATA_DIR);
      await filesystem.ensureDir(this.cacheDir);
      await filesystem.ensureDir(this.posterDir);
    } catch (error) {
      log.error("Error al crear directorios de metadatos:", { error });
    }
  }

  /**
   * Verificar si TMDb está configurado y disponible
   * @returns {boolean} - true si TMDb está configurado
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Busca películas por título
   * @param {string} title - Título de la película
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Resultados de la búsqueda
   */
  async searchMovies(title, options = {}) {
    const { year = null, includeAdult = false } = options;

    try {
      // Verificar API key
      if (!this.apiKey) {
        log.warn("API key de TMDb no configurada");
        return [];
      }

      // Construir URL de búsqueda
      let url = `${this.baseUrl}/search/movie?api_key=${
        this.apiKey
      }&query=${encodeURIComponent(title)}&language=${
        this.language
      }&include_adult=${includeAdult}`;

      if (year) {
        url += `&primary_release_year=${year}`;
      }

      log.debug(`Buscando película: "${title}"${year ? ` (${year})` : ""}`);
      const response = await axios.get(url);

      log.info(
        `Encontrados ${response.data.results.length} resultados para "${title}"`
      );
      return response.data.results;
    } catch (error) {
      log.error(`Error buscando película "${title}":`, {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Busca series de TV por título
   * @param {string} title - Título de la serie
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Resultados de la búsqueda
   */
  async searchTVShows(title, options = {}) {
    const { firstAirYear = null, includeAdult = false } = options;

    try {
      // Verificar API key
      if (!this.apiKey) {
        log.warn("API key de TMDb no configurada");
        return [];
      }

      // Construir URL de búsqueda
      let url = `${this.baseUrl}/search/tv?api_key=${
        this.apiKey
      }&query=${encodeURIComponent(title)}&language=${
        this.language
      }&include_adult=${includeAdult}`;

      if (firstAirYear) {
        url += `&first_air_date_year=${firstAirYear}`;
      }

      log.debug(
        `Buscando serie: "${title}"${firstAirYear ? ` (${firstAirYear})` : ""}`
      );
      const response = await axios.get(url);

      log.info(
        `Encontrados ${response.data.results.length} resultados para "${title}"`
      );
      return response.data.results;
    } catch (error) {
      log.error(`Error buscando serie "${title}":`, { error: error.message });
      return [];
    }
  }

  /**
   * Obtiene detalles completos de una película por su ID
   * @param {number} movieId - ID de la película en TMDb
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object|null>} - Detalles de la película
   */
  async getMovieDetails(movieId, options = {}) {
    const { useCache = true } = options;

    try {
      // Verificar API key
      if (!this.apiKey) {
        log.warn("API key de TMDb no configurada");
        return null;
      }

      // Verificar primero si está en caché
      const cacheFile = path.join(this.cacheDir, `movie_${movieId}.json`);

      if (useCache && (await filesystem.exists(cacheFile))) {
        try {
          const cacheContent = await filesystem.readTextFile(cacheFile);
          const cacheData = JSON.parse(cacheContent);
          // Verificar si la caché tiene menos de 30 días
          const cacheDate = new Date(cacheData._cacheDate);
          const now = new Date();
          const diffDays = Math.floor(
            (now - cacheDate) / (1000 * 60 * 60 * 24)
          );

          if (diffDays < 30) {
            log.debug(`Usando datos en caché para película ${movieId}`);
            return cacheData;
          }
        } catch (cacheError) {
          log.warn(`Error al leer caché para película ${movieId}:`, {
            error: cacheError.message,
          });
        }
      }

      // Si no está en caché o está obsoleta, obtener de la API
      log.debug(`Obteniendo detalles de TMDb para película ${movieId}`);
      const url = `${this.baseUrl}/movie/${movieId}?api_key=${this.apiKey}&language=${this.language}&append_to_response=credits,images,videos,similar,recommendations`;
      const response = await axios.get(url);

      // Guardar en caché con fecha
      const dataToCache = {
        ...response.data,
        _cacheDate: new Date().toISOString(),
      };

      try {
        await filesystem.writeToFile(
          cacheFile,
          JSON.stringify(dataToCache, null, 2)
        );
        log.debug(`Guardada caché para película ${movieId}`);
      } catch (writeError) {
        log.warn(`Error al guardar caché para película ${movieId}:`, {
          error: writeError.message,
        });
      }

      return response.data;
    } catch (error) {
      log.error(`Error obteniendo detalles de película ID ${movieId}:`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Obtiene detalles completos de una serie de TV por su ID
   * @param {number} tvId - ID de la serie en TMDb
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object|null>} - Detalles de la serie
   */
  async getTVShowDetails(tvId, options = {}) {
    const { useCache = true } = options;

    try {
      // Verificar API key
      if (!this.apiKey) {
        log.warn("API key de TMDb no configurada");
        return null;
      }

      // Verificar primero si está en caché
      const cacheFile = path.join(this.cacheDir, `tv_${tvId}.json`);

      if (useCache && (await filesystem.exists(cacheFile))) {
        try {
          const cacheContent = await filesystem.readTextFile(cacheFile);
          const cacheData = JSON.parse(cacheContent);
          // Verificar si la caché tiene menos de 30 días
          const cacheDate = new Date(cacheData._cacheDate);
          const now = new Date();
          const diffDays = Math.floor(
            (now - cacheDate) / (1000 * 60 * 60 * 24)
          );

          if (diffDays < 30) {
            log.debug(`Usando datos en caché para serie ${tvId}`);
            return cacheData;
          }
        } catch (cacheError) {
          log.warn(`Error al leer caché para serie ${tvId}:`, {
            error: cacheError.message,
          });
        }
      }

      // Si no está en caché o está obsoleta, obtener de la API
      log.debug(`Obteniendo detalles de TMDb para serie ${tvId}`);
      const url = `${this.baseUrl}/tv/${tvId}?api_key=${this.apiKey}&language=${this.language}&append_to_response=credits,images,videos,similar,recommendations`;
      const response = await axios.get(url);

      // Guardar en caché con fecha
      const dataToCache = {
        ...response.data,
        _cacheDate: new Date().toISOString(),
      };

      try {
        await filesystem.writeToFile(
          cacheFile,
          JSON.stringify(dataToCache, null, 2)
        );
        log.debug(`Guardada caché para serie ${tvId}`);
      } catch (writeError) {
        log.warn(`Error al guardar caché para serie ${tvId}:`, {
          error: writeError.message,
        });
      }

      return response.data;
    } catch (error) {
      log.error(`Error obteniendo detalles de serie ID ${tvId}:`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Obtiene los detalles de una temporada específica de una serie
   * @param {number} tvId - ID de la serie
   * @param {number} seasonNumber - Número de temporada
   * @returns {Promise<Object|null>} - Detalles de la temporada
   */
  async getSeasonDetails(tvId, seasonNumber) {
    try {
      // Verificar API key
      if (!this.apiKey) {
        log.warn("API key de TMDb no configurada");
        return null;
      }

      // Verificar primero si está en caché
      const cacheFile = path.join(
        this.cacheDir,
        `tv_${tvId}_season_${seasonNumber}.json`
      );

      if (await filesystem.exists(cacheFile)) {
        try {
          const cacheContent = await filesystem.readTextFile(cacheFile);
          const cacheData = JSON.parse(cacheContent);
          // Verificar si la caché tiene menos de 30 días
          const cacheDate = new Date(cacheData._cacheDate);
          const now = new Date();
          const diffDays = Math.floor(
            (now - cacheDate) / (1000 * 60 * 60 * 24)
          );

          if (diffDays < 30) {
            log.debug(
              `Usando datos en caché para temporada ${seasonNumber} de serie ${tvId}`
            );
            return cacheData;
          }
        } catch (cacheError) {
          log.warn(`Error al leer caché para temporada:`, {
            error: cacheError.message,
          });
        }
      }

      // Si no está en caché o está obsoleta, obtener de la API
      const url = `${this.baseUrl}/tv/${tvId}/season/${seasonNumber}?api_key=${this.apiKey}&language=${this.language}`;
      const response = await axios.get(url);

      // Guardar en caché con fecha
      const dataToCache = {
        ...response.data,
        _cacheDate: new Date().toISOString(),
      };

      try {
        await filesystem.writeToFile(
          cacheFile,
          JSON.stringify(dataToCache, null, 2)
        );
      } catch (writeError) {
        log.warn(`Error al guardar caché para temporada:`, {
          error: writeError.message,
        });
      }

      return response.data;
    } catch (error) {
      log.error(
        `Error obteniendo detalles de temporada ${seasonNumber} para serie ${tvId}:`,
        { error: error.message }
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
   * Descargar y guardar el póster
   * @param {number} id - ID del elemento
   * @param {string} posterPath - Ruta relativa del póster en TMDb
   * @param {string} type - Tipo de elemento ('movie' o 'tv')
   * @returns {Promise<string|null>} - Ruta del poster descargado o null
   */
  async downloadPoster(id, posterPath, type = "movie") {
    try {
      // Verificar que se ha proporcionado una ruta de póster
      if (!posterPath) {
        return null;
      }

      // Ruta donde guardaremos el póster
      const fileName = `${type}_${id}_poster.jpg`;
      const posterPath = path.join(this.posterDir, fileName);

      // URL completa del póster (tamaño w500)
      const posterUrl = this.getPosterUrl(posterPath, "w500");

      log.debug(`Descargando póster desde: ${posterUrl}`);

      // Descargar imagen
      const response = await axios({
        method: "get",
        url: posterUrl,
        responseType: "arraybuffer",
      });

      // Guardar en disco
      await filesystem.writeToFile(posterPath, response.data);

      log.debug(`Póster guardado en: ${posterPath}`);
      return posterPath;
    } catch (error) {
      log.error(`Error al descargar póster para ${type} ${id}:`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Convierte los datos de TMDb a un formato estándar interno
   * @param {Object} tmdbData - Datos originales de TMDb
   * @param {string} type - Tipo de elemento ('movie' o 'tv')
   * @returns {Object} - Datos en formato estándar
   */
  normalizeMetadata(tmdbData, type = "movie") {
    if (!tmdbData) return null;

    // Datos comunes para películas y series
    const normalized = {
      title: tmdbData.title || tmdbData.name,
      originalTitle: tmdbData.original_title || tmdbData.original_name,
      overview: tmdbData.overview,
      posterPath: tmdbData.poster_path,
      backdropPath: tmdbData.backdrop_path,
      popularity: tmdbData.popularity,
      voteAverage: tmdbData.vote_average,
      voteCount: tmdbData.vote_count,
      genres: tmdbData.genres
        ? tmdbData.genres.map((g) => g.name).join(", ")
        : "",
      externalId: tmdbData.id.toString(),
      externalSource: "tmdb",
    };

    // Campos específicos para películas
    if (type === "movie") {
      normalized.year = tmdbData.release_date
        ? parseInt(tmdbData.release_date.substring(0, 4))
        : null;
      normalized.releaseDate = tmdbData.release_date;
      normalized.runtime = tmdbData.runtime;
      normalized.status = tmdbData.status;
      normalized.tagline = tmdbData.tagline;
      normalized.imdbId = tmdbData.imdb_id;

      // Extraer director y actores principales
      if (tmdbData.credits && tmdbData.credits.crew) {
        const director = tmdbData.credits.crew.find(
          (person) => person.job === "Director"
        );
        if (director) {
          normalized.director = director.name;
        }
      }

      if (
        tmdbData.credits &&
        tmdbData.credits.cast &&
        tmdbData.credits.cast.length > 0
      ) {
        normalized.actors = tmdbData.credits.cast
          .slice(0, 5)
          .map((actor) => actor.name)
          .join(", ");
      }
    }
    // Campos específicos para series
    else if (type === "tv") {
      normalized.firstAirDate = tmdbData.first_air_date;
      normalized.year = tmdbData.first_air_date
        ? parseInt(tmdbData.first_air_date.substring(0, 4))
        : null;
      normalized.lastAirDate = tmdbData.last_air_date;
      normalized.status = tmdbData.status;
      normalized.type = tmdbData.type;
      normalized.networks = tmdbData.networks
        ? tmdbData.networks.map((n) => n.name).join(", ")
        : "";
      normalized.seasonsCount = tmdbData.number_of_seasons;
      normalized.episodesCount = tmdbData.number_of_episodes;
      normalized.runtime =
        tmdbData.episode_run_time && tmdbData.episode_run_time.length > 0
          ? tmdbData.episode_run_time[0]
          : null;

      // Extraer creadores y actores principales
      if (tmdbData.created_by && tmdbData.created_by.length > 0) {
        normalized.creators = tmdbData.created_by
          .map((person) => person.name)
          .join(", ");
      }

      if (
        tmdbData.credits &&
        tmdbData.credits.cast &&
        tmdbData.credits.cast.length > 0
      ) {
        normalized.actors = tmdbData.credits.cast
          .slice(0, 5)
          .map((actor) => actor.name)
          .join(", ");
      }
    }

    return normalized;
  }

  /**
   * Procesa y normaliza información de un episodio
   * @param {Object} episodeData - Datos del episodio de TMDb
   * @param {number} tvId - ID de la serie
   * @returns {Object} - Datos del episodio normalizados
   */
  normalizeEpisodeData(episodeData, tvId) {
    if (!episodeData) return null;

    return {
      title: episodeData.name,
      overview: episodeData.overview,
      seasonNumber: episodeData.season_number,
      episodeNumber: episodeData.episode_number,
      airDate: episodeData.air_date,
      stillPath: episodeData.still_path,
      voteAverage: episodeData.vote_average,
      voteCount: episodeData.vote_count,
      runtime: episodeData.runtime,
      externalId: `${tvId}_s${episodeData.season_number}_e${episodeData.episode_number}`,
      externalSource: "tmdb",
    };
  }
}

module.exports = new TMDbProvider();
