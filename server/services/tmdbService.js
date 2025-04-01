// server/services/tmdbService.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const db = require("../config/database");

class TMDbService {
  constructor() {
    // Esta API key deberías guardarla en tu .env
    this.apiKey =
      process.env.TMDB_API_KEY || "3513e6a639243a52c48fac57427aa933";
    this.baseUrl = "https://api.themoviedb.org/3";
    this.language = "es-ES"; // Podríamos hacerlo configurable

    // Directorio para almacenar la caché de metadatos
    this.cacheDir = path.join(__dirname, "../data/cache/metadata");

    // Crear directorio si no existe
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Busca una película por título
   * @param {string} title - Título de la película
   * @param {number} year - Año de lanzamiento (opcional)
   */
  async searchMovie(title, year = null) {
    try {
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
   */
  async getMovieDetails(movieId) {
    try {
      // Verificar primero si está en caché
      const cacheFile = path.join(this.cacheDir, `movie_${movieId}.json`);

      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        // Verificar si la caché tiene menos de 30 días
        const cacheDate = new Date(cacheData._cacheDate);
        const now = new Date();
        const diffDays = Math.floor((now - cacheDate) / (1000 * 60 * 60 * 24));

        if (diffDays < 30) {
          return cacheData;
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

      fs.writeFileSync(cacheFile, JSON.stringify(dataToCache, null, 2));

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
   * Busca y aplica metadatos a un elemento multimedia
   * @param {number} mediaId - ID del elemento en nuestra base de datos
   */
  async enrichMediaItem(mediaId) {
    try {
      // 1. Obtener información básica del elemento
      const mediaItem = await db.asyncGet(
        "SELECT * FROM media_items WHERE id = ?",
        [mediaId]
      );

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
        return false;
      }

      // 4. Obtener detalles completos del primer resultado (más relevante)
      const movieDetails = await this.getMovieDetails(searchResults[0].id);

      if (!movieDetails) {
        console.log(`No se pudieron obtener detalles para "${title}"`);
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
      const fields = Object.keys(updateData)
        .map((field) => `${field} = ?`)
        .join(", ");

      const values = [...Object.values(updateData), mediaId];

      await db.asyncRun(
        `UPDATE media_items SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      // 7. Descargar póster si está disponible
      if (movieDetails.poster_path) {
        await this.downloadPoster(mediaId, movieDetails.poster_path);
      }

      console.log(`Metadatos aplicados con éxito a "${title}"`);
      return true;
    } catch (error) {
      console.error(`Error al enriquecer elemento ${mediaId}:`, error);
      return false;
    }
  }

  /**
   * Descarga y guarda el póster como thumbnail
   * @param {number} mediaId - ID del elemento multimedia
   * @param {string} posterPath - Ruta relativa del póster en TMDb
   */
  async downloadPoster(mediaId, posterPath) {
    try {
      // Directorio para thumbnails
      const thumbnailsDir = path.join(__dirname, "../data/thumbnails");
      if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
      }

      // Ruta donde guardaremos el póster
      const thumbnailPath = path.join(
        thumbnailsDir,
        `movie_${mediaId}_poster.jpg`
      );

      // URL completa del póster (tamaño w500)
      const posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;

      // Descargar imagen
      const response = await axios({
        method: "get",
        url: posterUrl,
        responseType: "stream",
      });

      // Guardar en disco
      const writer = fs.createWriteStream(thumbnailPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", async () => {
          // Actualizar ruta del thumbnail en la base de datos
          await db.asyncRun(
            "UPDATE media_items SET thumbnail_path = ? WHERE id = ?",
            [thumbnailPath, mediaId]
          );
          resolve(thumbnailPath);
        });
        writer.on("error", reject);
      });
    } catch (error) {
      console.error(
        `Error al descargar póster para elemento ${mediaId}:`,
        error
      );
      return null;
    }
  }
}

module.exports = new TMDbService();
