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
    } = options;

    // Construir consulta base
    let query = "SELECT * FROM media_items WHERE library_id = ?";
    const params = [libraryId];

    // Añadir filtro de tipo si es necesario
    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    // Validar campo de ordenación para evitar inyección SQL
    const validSortFields = [
      "title",
      "created_at",
      "year",
      "type",
      "duration",
      "size",
    ];
    const sortField = validSortFields.includes(sort) ? sort : "title";

    // Validar dirección de ordenación
    const sortOrder = order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Añadir ordenación y límites
    query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
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
      file_path,
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
    } = mediaData;

    const result = await db.asyncRun(
      `INSERT INTO media_items (
        library_id, title, original_title, description, type, file_path,
        duration, size, thumbnail_path, year, genre, director, actors,
        rating, parent_id, season_number, episode_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
   * @returns {Promise<Array>} - Elementos recientes
   */
  async getRecent(limit = 10) {
    return db.asyncAll(
      "SELECT * FROM media_items ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
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
}

module.exports = new MediaRepository();
