// server/media/metadata/localMetadataManager.js
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { METADATA_DIR } = require("../../config/paths");
const logger = require("../../utils/logger");
const filesystem = require("../../utils/filesystem");
const SecurityUtils = require("../../utils/security");

// Promisificar operaciones de fs
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("LocalMetadataManager");

/**
 * Gestor de metadatos locales
 * Maneja la metadata obtenida localmente de archivos o ingresada por el usuario
 */
class LocalMetadataManager {
  constructor() {
    // Configurar directorios
    this.metadataDir = path.join(METADATA_DIR, "local");
    this.nfoDir = path.join(METADATA_DIR, "nfo");

    // Crear directorios si no existen
    this.setupDirectories();
  }

  /**
   * Configurar directorios necesarios
   */
  async setupDirectories() {
    try {
      await filesystem.ensureDir(METADATA_DIR);
      await filesystem.ensureDir(this.metadataDir);
      await filesystem.ensureDir(this.nfoDir);
    } catch (error) {
      log.error("Error al crear directorios de metadatos:", { error });
    }
  }

  /**
   * Guarda metadatos personalizados para un elemento
   * @param {number} mediaId - ID del elemento multimedia
   * @param {Object} metadata - Metadatos a guardar
   * @returns {Promise<boolean>} - true si se guardó correctamente
   */
  async saveMetadata(mediaId, metadata) {
    try {
      // Validar entrada
      if (!mediaId || !metadata) {
        log.warn("Intento de guardar metadatos sin ID o datos válidos");
        return false;
      }

      // Generar nombre de archivo
      const fileName = `${mediaId}.json`;
      const filePath = path.join(this.metadataDir, fileName);

      // Añadir timestamps
      const dataToSave = {
        ...metadata,
        _mediaId: mediaId,
        _lastUpdated: new Date().toISOString(),
        _source: "local",
      };

      // Guardar en formato JSON
      await filesystem.writeToFile(
        filePath,
        JSON.stringify(dataToSave, null, 2)
      );

      log.info(`Metadatos guardados correctamente para mediaId: ${mediaId}`);
      return true;
    } catch (error) {
      log.error(`Error al guardar metadatos para mediaId ${mediaId}:`, {
        error,
      });
      return false;
    }
  }

  /**
   * Recupera metadatos guardados de un elemento
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {Promise<Object|null>} - Metadatos guardados o null si no existen
   */
  async getMetadata(mediaId) {
    try {
      // Validar entrada
      if (!mediaId) {
        log.warn("Intento de obtener metadatos sin ID válido");
        return null;
      }

      // Ruta del archivo
      const fileName = `${mediaId}.json`;
      const filePath = path.join(this.metadataDir, fileName);

      // Verificar si existe
      if (!(await filesystem.exists(filePath))) {
        log.debug(`No existen metadatos locales para mediaId: ${mediaId}`);
        return null;
      }

      // Leer el archivo
      const content = await filesystem.readTextFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      log.error(`Error al obtener metadatos para mediaId ${mediaId}:`, {
        error,
      });
      return null;
    }
  }

  /**
   * Elimina metadatos guardados de un elemento
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async deleteMetadata(mediaId) {
    try {
      // Validar entrada
      if (!mediaId) {
        log.warn("Intento de eliminar metadatos sin ID válido");
        return false;
      }

      // Ruta del archivo
      const fileName = `${mediaId}.json`;
      const filePath = path.join(this.metadataDir, fileName);

      // Verificar si existe
      if (!(await filesystem.exists(filePath))) {
        log.debug(
          `No existen metadatos locales para eliminar, mediaId: ${mediaId}`
        );
        return true; // Consideramos éxito si no había nada que eliminar
      }

      // Eliminar el archivo
      await filesystem.removeFile(filePath);
      log.info(`Metadatos eliminados correctamente para mediaId: ${mediaId}`);
      return true;
    } catch (error) {
      log.error(`Error al eliminar metadatos para mediaId ${mediaId}:`, {
        error,
      });
      return false;
    }
  }

  /**
   * Exporta metadatos a un archivo NFO (formato XML compatible con otros media centers)
   * @param {number} mediaId - ID del elemento multimedia
   * @param {Object} metadata - Metadatos a exportar
   * @param {string} type - Tipo de elemento ('movie', 'tvshow', 'episode')
   * @returns {Promise<string|null>} - Ruta del archivo NFO generado o null
   */
  async exportToNFO(mediaId, metadata, type = "movie") {
    try {
      // Validar entrada
      if (!mediaId || !metadata) {
        log.warn("Intento de exportar a NFO sin ID o datos válidos");
        return null;
      }

      // Generar nombre y ruta del archivo
      const fileName = `${mediaId}_${type}.nfo`;
      const filePath = path.join(this.nfoDir, fileName);

      // Generar XML según el tipo
      let xmlContent = "";

      if (type === "movie") {
        xmlContent = this.generateMovieNFO(metadata);
      } else if (type === "tvshow") {
        xmlContent = this.generateTVShowNFO(metadata);
      } else if (type === "episode") {
        xmlContent = this.generateEpisodeNFO(metadata);
      } else {
        log.warn(`Tipo de NFO no soportado: ${type}`);
        return null;
      }

      // Guardar el archivo
      await filesystem.writeToFile(filePath, xmlContent);

      log.info(
        `Archivo NFO generado correctamente para mediaId: ${mediaId}, tipo: ${type}`
      );
      return filePath;
    } catch (error) {
      log.error(`Error al exportar a NFO para mediaId ${mediaId}:`, { error });
      return null;
    }
  }

  /**
   * Genera XML para un archivo NFO de película
   * @param {Object} metadata - Metadatos de la película
   * @returns {string} - Contenido XML
   */
  generateMovieNFO(metadata) {
    // Sanitizar datos para evitar problemas con XML
    const sanitize = (text) => {
      if (!text) return "";
      return SecurityUtils.sanitizeString(text.toString());
    };

    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n';
    xml += "<movie>\n";

    if (metadata.title) xml += `  <title>${sanitize(metadata.title)}</title>\n`;
    if (metadata.originalTitle)
      xml += `  <originaltitle>${sanitize(
        metadata.originalTitle
      )}</originaltitle>\n`;
    if (metadata.year) xml += `  <year>${sanitize(metadata.year)}</year>\n`;
    if (metadata.overview || metadata.description) {
      xml += `  <plot>${sanitize(
        metadata.overview || metadata.description
      )}</plot>\n`;
    }
    if (metadata.runtime)
      xml += `  <runtime>${sanitize(metadata.runtime)}</runtime>\n`;
    if (metadata.tagline)
      xml += `  <tagline>${sanitize(metadata.tagline)}</tagline>\n`;
    if (metadata.director)
      xml += `  <director>${sanitize(metadata.director)}</director>\n`;

    // Añadir categorías/géneros
    if (metadata.genres || metadata.genre) {
      const genres = (metadata.genres || metadata.genre || "").split(",");
      for (const genre of genres) {
        if (genre.trim()) {
          xml += `  <genre>${sanitize(genre.trim())}</genre>\n`;
        }
      }
    }

    // Añadir actores
    if (metadata.actors) {
      const actors = metadata.actors.split(",");
      for (const actor of actors) {
        if (actor.trim()) {
          xml += "  <actor>\n";
          xml += `    <name>${sanitize(actor.trim())}</name>\n`;
          xml += "  </actor>\n";
        }
      }
    }

    // Añadir datos de calificación
    if (metadata.rating)
      xml += `  <rating>${sanitize(metadata.rating)}</rating>\n`;

    // Añadir IDs externos
    if (metadata.imdbId)
      xml += `  <imdbid>${sanitize(metadata.imdbId)}</imdbid>\n`;
    if (metadata.externalId && metadata.externalSource) {
      xml += `  <${sanitize(metadata.externalSource)}id>${sanitize(
        metadata.externalId
      )}</${sanitize(metadata.externalSource)}id>\n`;
    }

    xml += "</movie>";
    return xml;
  }

  /**
   * Genera XML para un archivo NFO de serie
   * @param {Object} metadata - Metadatos de la serie
   * @returns {string} - Contenido XML
   */
  generateTVShowNFO(metadata) {
    // Sanitizar datos para evitar problemas con XML
    const sanitize = (text) => {
      if (!text) return "";
      return SecurityUtils.sanitizeString(text.toString());
    };

    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n';
    xml += "<tvshow>\n";

    if (metadata.title) xml += `  <title>${sanitize(metadata.title)}</title>\n`;
    if (metadata.originalTitle)
      xml += `  <originaltitle>${sanitize(
        metadata.originalTitle
      )}</originaltitle>\n`;
    if (metadata.year) xml += `  <year>${sanitize(metadata.year)}</year>\n`;
    if (metadata.overview || metadata.description) {
      xml += `  <plot>${sanitize(
        metadata.overview || metadata.description
      )}</plot>\n`;
    }
    if (metadata.runtime)
      xml += `  <runtime>${sanitize(metadata.runtime)}</runtime>\n`;
    if (metadata.status)
      xml += `  <status>${sanitize(metadata.status)}</status>\n`;

    // Añadir categorías/géneros
    if (metadata.genres || metadata.genre) {
      const genres = (metadata.genres || metadata.genre || "").split(",");
      for (const genre of genres) {
        if (genre.trim()) {
          xml += `  <genre>${sanitize(genre.trim())}</genre>\n`;
        }
      }
    }

    // Añadir actores
    if (metadata.actors) {
      const actors = metadata.actors.split(",");
      for (const actor of actors) {
        if (actor.trim()) {
          xml += "  <actor>\n";
          xml += `    <name>${sanitize(actor.trim())}</name>\n`;
          xml += "  </actor>\n";
        }
      }
    }

    // Añadir datos específicos de series
    if (metadata.seasonsCount)
      xml += `  <season>${sanitize(metadata.seasonsCount)}</season>\n`;
    if (metadata.episodesCount)
      xml += `  <episode>${sanitize(metadata.episodesCount)}</episode>\n`;
    if (metadata.creators)
      xml += `  <credits>${sanitize(metadata.creators)}</credits>\n`;

    // Añadir datos de calificación
    if (metadata.rating)
      xml += `  <rating>${sanitize(metadata.rating)}</rating>\n`;

    // Añadir IDs externos
    if (metadata.externalId && metadata.externalSource) {
      xml += `  <${sanitize(metadata.externalSource)}id>${sanitize(
        metadata.externalId
      )}</${sanitize(metadata.externalSource)}id>\n`;
    }

    xml += "</tvshow>";
    return xml;
  }

  /**
   * Genera XML para un archivo NFO de episodio
   * @param {Object} metadata - Metadatos del episodio
   * @returns {string} - Contenido XML
   */
  generateEpisodeNFO(metadata) {
    // Sanitizar datos para evitar problemas con XML
    const sanitize = (text) => {
      if (!text) return "";
      return SecurityUtils.sanitizeString(text.toString());
    };

    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n';
    xml += "<episodedetails>\n";

    if (metadata.title) xml += `  <title>${sanitize(metadata.title)}</title>\n`;
    if (metadata.seasonNumber !== undefined)
      xml += `  <season>${sanitize(metadata.seasonNumber)}</season>\n`;
    if (metadata.episodeNumber !== undefined)
      xml += `  <episode>${sanitize(metadata.episodeNumber)}</episode>\n`;
    if (metadata.overview || metadata.description) {
      xml += `  <plot>${sanitize(
        metadata.overview || metadata.description
      )}</plot>\n`;
    }
    if (metadata.runtime)
      xml += `  <runtime>${sanitize(metadata.runtime)}</runtime>\n`;

    // Añadir datos de calificación
    if (metadata.rating)
      xml += `  <rating>${sanitize(metadata.rating)}</rating>\n`;

    // Añadir fecha de emisión
    if (metadata.airDate)
      xml += `  <aired>${sanitize(metadata.airDate)}</aired>\n`;

    xml += "</episodedetails>";
    return xml;
  }

  /**
   * Extrae metadatos de un archivo NFO existente
   * @param {string} nfoPath - Ruta al archivo NFO
   * @returns {Promise<Object|null>} - Metadatos extraídos o null
   */
  async extractFromNFO(nfoPath) {
    try {
      // Validar entrada
      if (!nfoPath || !(await filesystem.exists(nfoPath))) {
        log.warn(`Archivo NFO no encontrado: ${nfoPath}`);
        return null;
      }

      // Leer el archivo
      const content = await filesystem.readTextFile(nfoPath);

      // Parseamos el XML de forma sencilla
      // En una implementación real, usaríamos una librería XML adecuada
      const metadata = {};

      // Extraer título
      const titleMatch = content.match(/<title>(.*?)<\/title>/);
      if (titleMatch && titleMatch[1]) metadata.title = titleMatch[1];

      // Extraer año
      const yearMatch = content.match(/<year>(.*?)<\/year>/);
      if (yearMatch && yearMatch[1]) metadata.year = parseInt(yearMatch[1]);

      // Extraer sinopsis
      const plotMatch = content.match(/<plot>(.*?)<\/plot>/s);
      if (plotMatch && plotMatch[1]) metadata.overview = plotMatch[1];

      // Extraer director
      const directorMatch = content.match(/<director>(.*?)<\/director>/);
      if (directorMatch && directorMatch[1])
        metadata.director = directorMatch[1];

      // Extraer géneros
      const genres = [];
      const genreRegex = /<genre>(.*?)<\/genre>/g;
      let genreMatch;
      while ((genreMatch = genreRegex.exec(content)) !== null) {
        genres.push(genreMatch[1]);
      }
      if (genres.length > 0) metadata.genres = genres.join(", ");

      log.info(`Metadatos extraídos correctamente de NFO: ${nfoPath}`);
      return metadata;
    } catch (error) {
      log.error(`Error al extraer metadatos de NFO ${nfoPath}:`, { error });
      return null;
    }
  }

  /**
   * Busca archivos NFO junto a un archivo multimedia
   * @param {string} mediaFilePath - Ruta del archivo multimedia
   * @returns {Promise<string|null>} - Ruta del archivo NFO encontrado o null
   */
  async findNFOFile(mediaFilePath) {
    try {
      // Validar entrada
      if (!mediaFilePath) {
        log.warn("Ruta de archivo vacía al buscar NFO");
        return null;
      }

      const dirPath = path.dirname(mediaFilePath);
      const baseName = path.basename(
        mediaFilePath,
        path.extname(mediaFilePath)
      );

      // Posibles nombres de archivos NFO
      const nfoNames = [`${baseName}.nfo`, "movie.nfo", "tvshow.nfo"];

      // Buscar cada posible archivo
      for (const nfoName of nfoNames) {
        const nfoPath = path.join(dirPath, nfoName);
        if (await filesystem.exists(nfoPath)) {
          log.debug(`Archivo NFO encontrado: ${nfoPath}`);
          return nfoPath;
        }
      }

      log.debug(`No se encontraron archivos NFO para: ${mediaFilePath}`);
      return null;
    } catch (error) {
      log.error(`Error al buscar archivo NFO para ${mediaFilePath}:`, {
        error,
      });
      return null;
    }
  }

  /**
   * Fusiona metadatos de diferentes fuentes, con prioridades
   * @param {Object} localMetadata - Metadatos locales ingresados por el usuario
   * @param {Object} externalMetadata - Metadatos de fuentes externas (TMDb)
   * @param {Object} fileMetadata - Metadatos extraídos del archivo
   * @returns {Object} - Metadatos combinados
   */
  mergeMetadata(localMetadata = {}, externalMetadata = {}, fileMetadata = {}) {
    // Prioridad: Local > Externo > Archivo
    const merged = {
      // Primero añadimos los metadatos del archivo
      ...fileMetadata,
      // Luego los metadatos externos sobrescriben los del archivo
      ...externalMetadata,
      // Finalmente los metadatos locales tienen prioridad máxima
      ...localMetadata,
    };

    // Eliminar campos internos con prefijo _
    const cleanedMetadata = {};
    for (const [key, value] of Object.entries(merged)) {
      if (!key.startsWith("_")) {
        cleanedMetadata[key] = value;
      }
    }

    // Añadir información sobre las fuentes usadas
    cleanedMetadata._sources = {
      local: !!localMetadata && Object.keys(localMetadata).length > 0,
      external: !!externalMetadata && Object.keys(externalMetadata).length > 0,
      file: !!fileMetadata && Object.keys(fileMetadata).length > 0,
    };

    return cleanedMetadata;
  }
}

module.exports = new LocalMetadataManager();
