// server/data/models/MediaItem.js
const db = require("../db");
const Library = require("./Library");

/**
 * Modelo para elementos multimedia
 */
class MediaItem {
  /**
   * Crear un nuevo elemento multimedia
   * @param {Object} mediaData - Datos del elemento
   * @returns {Promise<Object>} - Elemento creado
   */
  static async create(mediaData) {
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

    // Verificar que el tipo sea válido
    const validTypes = ["movie", "series", "episode", "music", "photo"];
    if (!validTypes.includes(type)) {
      throw new Error(
        `Tipo de medio no válido. Debe ser uno de: ${validTypes.join(", ")}`
      );
    }

    // Verificar que la biblioteca existe
    if (library_id) {
      const library = await Library.findById(library_id);
      if (!library) {
        throw new Error("La biblioteca especificada no existe");
      }
    }

    // Verificar que el archivo no está duplicado
    if (file_path) {
      const existingFile = await db.asyncGet(
        "SELECT id FROM media_items WHERE file_path = ?",
        [file_path]
      );
      if (existingFile) {
        throw new Error("Ya existe un elemento con la misma ruta de archivo");
      }
    }

    // Verificar que el padre existe si se especifica
    if (parent_id) {
      const parent = await this.findById(parent_id);
      if (!parent) {
        throw new Error("El elemento padre especificado no existe");
      }
    }

    // Crear elemento en la base de datos
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

    if (!result || !result.lastID) {
      throw new Error("Error al crear el elemento multimedia");
    }

    // Devolver el elemento creado
    return this.findById(result.lastID);
  }

  /**
   * Buscar un elemento multimedia por ID
   * @param {number} id - ID del elemento
   * @returns {Promise<Object|null>} - Elemento encontrado o null
   */
  static async findById(id) {
    return db.asyncGet("SELECT * FROM media_items WHERE id = ?", [id]);
  }

  /**
   * Buscar un elemento multimedia por ruta de archivo
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<Object|null>} - Elemento encontrado o null
   */
  static async findByPath(filePath) {
    return db.asyncGet("SELECT * FROM media_items WHERE file_path = ?", [
      filePath,
    ]);
  }

  /**
   * Obtener elementos multimedia de una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Lista de elementos
   */
  static async findByLibrary(libraryId, options = {}) {
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
  static async countByLibrary(libraryId, type = null) {
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
   * Buscar elementos por título o descripción
   * @param {string} searchTerm - Término de búsqueda
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Resultados de la búsqueda
   */
  static async search(searchTerm, options = {}) {
    const {
      libraryId = null,
      type = null,
      userId = null,
      limit = 50,
      offset = 0,
    } = options;

    // Lista de parámetros para la consulta
    const params = [];

    // Construir consulta base con término de búsqueda
    let query = "SELECT m.* FROM media_items m";

    // Si se especifica userId, unir con permisos de biblioteca
    if (userId !== null) {
      // Verificar primero si el usuario es administrador
      const user = await db.asyncGet(
        "SELECT is_admin FROM users WHERE id = ?",
        [userId]
      );
      const isAdmin = user && user.is_admin === 1;

      if (!isAdmin) {
        // Si no es administrador, aplicar filtro de permisos
        query += `
          JOIN libraries l ON m.library_id = l.id
          JOIN user_library_access ula ON l.id = ula.library_id AND ula.user_id = ? AND ula.has_access = 1
        `;
        params.push(userId);
      }
    }

    // Añadir cláusula WHERE
    query += " WHERE (m.title LIKE ? OR m.description LIKE ?)";
    params.push(`%${searchTerm}%`, `%${searchTerm}%`);

    // Añadir filtro de biblioteca si es necesario
    if (libraryId !== null) {
      query += " AND m.library_id = ?";
      params.push(libraryId);
    }

    // Añadir filtro de tipo si es necesario
    if (type !== null) {
      query += " AND m.type = ?";
      params.push(type);
    }

    // Añadir ordenación y límites
    query += " ORDER BY m.title ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return db.asyncAll(query, params);
  }

  /**
   * Actualizar un elemento multimedia
   * @param {number} id - ID del elemento
   * @param {Object} mediaData - Datos a actualizar
   * @returns {Promise<Object>} - Elemento actualizado
   */
  static async update(id, mediaData) {
    const fields = [];
    const values = [];

    // Construir consulta dinámicamente con los campos proporcionados
    for (const [key, value] of Object.entries(mediaData)) {
      // Evitar campos especiales
      if (key !== "id" && key !== "created_at" && key !== "updated_at") {
        // Validar el tipo si se está actualizando
        if (key === "type") {
          const validTypes = ["movie", "series", "episode", "music", "photo"];
          if (!validTypes.includes(value)) {
            throw new Error(
              `Tipo de medio no válido. Debe ser uno de: ${validTypes.join(
                ", "
              )}`
            );
          }
        }

        // Validar la biblioteca si se está actualizando
        if (key === "library_id" && value !== null) {
          const library = await Library.findById(value);
          if (!library) {
            throw new Error("La biblioteca especificada no existe");
          }
        }

        // Validar el padre si se está actualizando
        if (key === "parent_id" && value !== null) {
          const parent = await this.findById(value);
          if (!parent) {
            throw new Error("El elemento padre especificado no existe");
          }
        }

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
    const result = await db.asyncRun(
      `UPDATE media_items SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (!result || !result.changes) {
      throw new Error(
        "Error al actualizar el elemento multimedia o ningún cambio realizado"
      );
    }

    // Devolver el elemento actualizado
    return this.findById(id);
  }

  /**
   * Eliminar un elemento multimedia
   * @param {number} id - ID del elemento
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  static async delete(id) {
    // Iniciar transacción para eliminar datos relacionados
    await db.asyncRun("BEGIN TRANSACTION");

    try {
      // Eliminar historial de visualización
      await db.asyncRun("DELETE FROM watch_history WHERE media_id = ?", [id]);

      // Eliminar elemento multimedia
      const result = await db.asyncRun("DELETE FROM media_items WHERE id = ?", [
        id,
      ]);

      // Confirmar transacción
      await db.asyncRun("COMMIT");

      return result && result.changes > 0;
    } catch (error) {
      // Revertir cambios en caso de error
      await db.asyncRun("ROLLBACK");
      throw error;
    }
  }

  /**
   * Obtener elementos recientemente añadidos
   * @param {number} limit - Número máximo de elementos
   * @param {number} userId - ID del usuario para filtrar por permisos
   * @returns {Promise<Array>} - Elementos recientes
   */
  static async getRecent(limit = 10, userId = null) {
    // Lista de parámetros para la consulta
    const params = [];

    // Construir consulta base
    let query = "SELECT m.* FROM media_items m";

    // Si se especifica userId, unir con permisos de biblioteca
    if (userId !== null) {
      // Verificar primero si el usuario es administrador
      const user = await db.asyncGet(
        "SELECT is_admin FROM users WHERE id = ?",
        [userId]
      );
      const isAdmin = user && user.is_admin === 1;

      if (!isAdmin) {
        // Si no es administrador, aplicar filtro de permisos
        query += `
          JOIN libraries l ON m.library_id = l.id
          JOIN user_library_access ula ON l.id = ula.library_id AND ula.user_id = ? AND ula.has_access = 1
        `;
        params.push(userId);
      }
    }

    // Añadir ordenación y límites
    query += " ORDER BY m.created_at DESC LIMIT ?";
    params.push(limit);

    return db.asyncAll(query, params);
  }

  /**
   * Obtener elementos con mejor valoración
   * @param {number} minRating - Valoración mínima
   * @param {number} limit - Número máximo de elementos
   * @param {number} userId - ID del usuario para filtrar por permisos
   * @returns {Promise<Array>} - Elementos mejor valorados
   */
  static async getTopRated(minRating = 4.0, limit = 10, userId = null) {
    // Lista de parámetros para la consulta
    const params = [];

    // Construir consulta base
    let query = "SELECT m.* FROM media_items m";

    // Si se especifica userId, unir con permisos de biblioteca
    if (userId !== null) {
      // Verificar primero si el usuario es administrador
      const user = await db.asyncGet(
        "SELECT is_admin FROM users WHERE id = ?",
        [userId]
      );
      const isAdmin = user && user.is_admin === 1;

      if (!isAdmin) {
        // Si no es administrador, aplicar filtro de permisos
        query += `
          JOIN libraries l ON m.library_id = l.id
          JOIN user_library_access ula ON l.id = ula.library_id AND ula.user_id = ? AND ula.has_access = 1
        `;
        params.push(userId);
      }
    }

    // Añadir filtro de valoración
    query += " WHERE m.rating >= ?";
    params.push(minRating);

    // Añadir ordenación y límites
    query += " ORDER BY m.rating DESC LIMIT ?";
    params.push(limit);

    return db.asyncAll(query, params);
  }
}

module.exports = MediaItem;
