// server/data/repositories/mediaRepository.js
const db = require("../db");

/**
 * Repositorio para operaciones con elementos multimedia
 */
class MediaRepository {
  /**
   * Buscar un elemento multimedia por su ID
   * @param {number} id - ID del elemento
   * @returns {Promise<Object|null>} - Elemento encontrado o null
   */
  async findById(id) {
    return db.asyncGet("SELECT * FROM media_items WHERE id = ?", [id]);
  }

  /**
   * Buscar un elemento multimedia por su ruta de archivo
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<Object|null>} - Elemento encontrado o null
   */
  async findByPath(filePath) {
    return db.asyncGet("SELECT * FROM media_items WHERE file_path = ?", [
      filePath,
    ]);
  }

  /**
   * Buscar un elemento multimedia por título y tipo
   * @param {string} title - Título del elemento
   * @param {string} type - Tipo del elemento (movie, series, episode, etc.)
   * @returns {Promise<Object|null>} - Elemento encontrado o null
   */
  async findByTitleAndType(title, type) {
    return db.asyncGet(
      "SELECT * FROM media_items WHERE title = ? AND type = ?",
      [title, type]
    );
  }

  /**
   * Buscar elementos por biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {Object} options - Opciones de consulta (limit, offset, etc.)
   * @returns {Promise<Array>} - Lista de elementos
   */
  async findByLibrary(libraryId, options = {}) {
    const {
      limit = 100,
      offset = 0,
      sort = "title",
      order = "ASC",
      type = null,
      parent_id = null,
    } = options;

    // Construir consulta base
    let query = "SELECT * FROM media_items WHERE library_id = ?";
    const params = [libraryId];

    // Añadir filtro de tipo si es necesario
    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    // Añadir filtro de elemento padre si es necesario (para episodios de series)
    if (parent_id !== null) {
      query += " AND parent_id = ?";
      params.push(parent_id);
    }

    // Validar campo de ordenación para evitar inyección SQL
    const validSortFields = [
      "title",
      "created_at",
      "year",
      "type",
      "duration",
      "size",
      "season_number",
      "episode_number",
    ];
    const sortField = validSortFields.includes(sort) ? sort : "title";

    // Validar dirección de ordenación
    const sortOrder = order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Añadir ordenación específica para episodios si corresponde
    if (type === "episode" && parent_id !== null) {
      query +=
        " ORDER BY season_number ASC, episode_number ASC LIMIT ? OFFSET ?";
    } else {
      // Añadir ordenación y límites estándar
      query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    }

    params.push(limit, offset);

    return db.asyncAll(query, params);
  }

  /**
   * Contar elementos por biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {string} type - Tipo de elemento (opcional)
   * @returns {Promise<number>} - Número de elementos
   */
  async countByLibrary(libraryId, type = null) {
    let query =
      "SELECT COUNT(*) as count FROM media_items WHERE library_id = ?";
    const params = [libraryId];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    const result = await db.asyncGet(query, params);
    return result ? result.count : 0;
  }

  /**
   * Buscar elementos por nombre o descripción
   * @param {string} searchTerm - Término de búsqueda
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Resultados de la búsqueda
   */
  async search(searchTerm, options = {}) {
    const { libraryId = null, type = null, limit = 50, offset = 0 } = options;

    // Construir consulta base con término de búsqueda
    let query =
      "SELECT * FROM media_items WHERE (title LIKE ? OR description LIKE ?)";
    const params = [`%${searchTerm}%`, `%${searchTerm}%`];

    // Añadir filtro de biblioteca si es necesario
    if (libraryId !== null) {
      query += " AND library_id = ?";
      params.push(libraryId);
    }

    // Añadir filtro de tipo si es necesario
    if (type !== null) {
      query += " AND type = ?";
      params.push(type);
    }

    // Añadir ordenación y límites
    query += " ORDER BY title ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return db.asyncAll(query, params);
  }

  /**
   * Crear un nuevo elemento multimedia
   * @param {Object} mediaData - Datos del elemento
   * @returns {Promise<Object>} - Elemento creado con su ID
   */
  async create(mediaData) {
    const {
      library_id,
      title,
      original_title = null,
      description = null,
      type,
      file_path = null,
      duration = null,
      size = null,
      thumbnail_path = null,
      year = null,
      genre = null,
      director = null,
      actors = null,
      rating = null,
      parent_id = null,
      season_number = null,
      episode_number = null,
      // Campos adicionales para metadatos extendidos
      width = null,
      height = null,
      codec = null,
      bitrate = null,
      artist = null,
      album = null,
      audioCodec = null,
      channels = null,
      // Campos adicionales para series
      season_count = null,
      episode_count = null,
    } = mediaData;

    const result = await db.asyncRun(
      `INSERT INTO media_items (
        library_id, title, original_title, description, type, file_path,
        duration, size, thumbnail_path, year, genre, director, actors,
        rating, parent_id, season_number, episode_number, width, height,
        codec, bitrate, artist, album, audioCodec, channels, season_count, episode_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        library_id,
        title,
        original_title,
        description,
        type,
        file_path,
        duration,
        size,
        thumbnail_path,
        year,
        genre,
        director,
        actors,
        rating,
        parent_id,
        season_number,
        episode_number,
        width,
        height,
        codec,
        bitrate,
        artist,
        album,
        audioCodec,
        channels,
        season_count,
        episode_count,
      ]
    );

    if (result && result.lastID) {
      return this.findById(result.lastID);
    }

    throw new Error("Error al crear elemento multimedia");
  }

  /**
   * Actualizar un elemento multimedia existente
   * @param {number} id - ID del elemento
   * @param {Object} mediaData - Datos a actualizar
   * @returns {Promise<Object>} - Elemento actualizado
   */
  async update(id, mediaData) {
    const fields = [];
    const values = [];

    // Construir consulta dinámicamente con los campos proporcionados
    for (const [key, value] of Object.entries(mediaData)) {
      // Evitar campos especiales
      if (key !== "id" && key !== "created_at" && key !== "updated_at") {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    // Si no hay campos para actualizar, devolver el elemento actual
    if (fields.length === 0) {
      return this.findById(id);
    }

    // Añadir updated_at
    fields.push("updated_at = CURRENT_TIMESTAMP");

    // Añadir ID al final de los valores
    values.push(id);

    // Ejecutar la actualización
    await db.asyncRun(
      `UPDATE media_items SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    // Devolver el elemento actualizado
    return this.findById(id);
  }

  /**
   * Eliminar un elemento multimedia
   * @param {number} id - ID del elemento
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async delete(id) {
    const result = await db.asyncRun("DELETE FROM media_items WHERE id = ?", [
      id,
    ]);
    return result && result.changes > 0;
  }

  /**
   * Obtener elementos recientemente añadidos
   * @param {number} limit - Número máximo de elementos
   * @param {string} type - Tipo de elemento (opcional)
   * @returns {Promise<Array>} - Elementos recientes
   */
  async getRecent(limit = 10, type = null) {
    let query = "SELECT * FROM media_items";
    const params = [];

    if (type) {
      query += " WHERE type = ?";
      params.push(type);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    return db.asyncAll(query, params);
  }

  /**
   * Obtener elementos con una valoración mínima
   * @param {number} minRating - Valoración mínima
   * @param {number} limit - Número máximo de elementos
   * @returns {Promise<Array>} - Elementos con buena valoración
   */
  async getTopRated(minRating = 4.0, limit = 10) {
    return db.asyncAll(
      "SELECT * FROM media_items WHERE rating >= ? ORDER BY rating DESC LIMIT ?",
      [minRating, limit]
    );
  }

  /**
   * Obtener elementos específicos por tipo
   * @param {string} type - Tipo de elemento (movie, series, episode, etc.)
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Elementos del tipo especificado
   */
  async findByType(type, options = {}) {
    const { limit = 100, offset = 0, sort = "title", order = "ASC" } = options;

    // Validar campo de ordenación
    const validSortFields = ["title", "created_at", "year", "rating"];
    const sortField = validSortFields.includes(sort) ? sort : "title";

    // Validar dirección de ordenación
    const sortOrder = order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    return db.asyncAll(
      `SELECT * FROM media_items WHERE type = ? ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`,
      [type, limit, offset]
    );
  }

  /**
   * Obtener episodios de una serie
   * @param {number} seriesId - ID de la serie
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Episodios de la serie
   */
  async getEpisodes(seriesId, options = {}) {
    const {
      seasonNumber = null,
      sort = "episode_number",
      order = "ASC",
      limit = 1000,
      offset = 0,
    } = options;

    let query =
      "SELECT * FROM media_items WHERE parent_id = ? AND type = 'episode'";
    const params = [seriesId];

    if (seasonNumber !== null) {
      query += " AND season_number = ?";
      params.push(seasonNumber);
    }

    // Ordenar episodios por temporada y número de episodio
    query += " ORDER BY season_number ASC, episode_number ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return db.asyncAll(query, params);
  }

  /**
   * Obtener temporadas disponibles para una serie
   * @param {number} seriesId - ID de la serie
   * @returns {Promise<Array>} - Lista de temporadas
   */
  async getSeasons(seriesId) {
    return db.asyncAll(
      `SELECT DISTINCT season_number, COUNT(*) as episode_count 
       FROM media_items 
       WHERE parent_id = ? AND type = 'episode' AND season_number IS NOT NULL
       GROUP BY season_number 
       ORDER BY season_number ASC`,
      [seriesId]
    );
  }

  /**
   * Actualizar metadatos de elementos relacionados (como episodios de una serie)
   * @param {number} parentId - ID del elemento padre
   * @param {Object} metadata - Metadatos a propagar a los elementos relacionados
   * @returns {Promise<number>} - Número de elementos actualizados
   */
  async updateRelatedItems(parentId, metadata) {
    const fields = [];
    const values = [];

    // Solo propagar ciertos campos
    const allowedFields = [
      "year",
      "genre",
      "director",
      "rating",
      "original_title",
    ];

    for (const [key, value] of Object.entries(metadata)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return 0; // No hay campos para actualizar
    }

    // Añadir updated_at
    fields.push("updated_at = CURRENT_TIMESTAMP");

    // Añadir el parentId para la cláusula WHERE
    values.push(parentId);

    // Ejecutar la actualización para todos los elementos hijos
    const result = await db.asyncRun(
      `UPDATE media_items SET ${fields.join(", ")} WHERE parent_id = ?`,
      values
    );

    return result ? result.changes : 0;
  }
}

module.exports = new MediaRepository();
