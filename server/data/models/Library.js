// server/data/models/Library.js
const db = require("../db");

/**
 * Modelo para bibliotecas
 */
class Library {
  /**
   * Crear una nueva biblioteca
   * @param {Object} libraryData - Datos de la biblioteca
   * @returns {Promise<Object>} - Biblioteca creada
   */
  static async create(libraryData) {
    const { name, path, type, scan_automatically = true } = libraryData;

    // Verificar que el tipo sea válido
    const validTypes = ["movies", "series", "music", "photos"];
    if (!validTypes.includes(type)) {
      throw new Error(
        `Tipo de biblioteca no válido. Debe ser uno de: ${validTypes.join(
          ", "
        )}`
      );
    }

    // Verificar si ya existe una biblioteca con la misma ruta
    const existingPath = await db.asyncGet(
      "SELECT id FROM libraries WHERE path = ?",
      [path]
    );
    if (existingPath) {
      throw new Error("Ya existe una biblioteca con esta ruta");
    }

    // Crear biblioteca en la base de datos
    const result = await db.asyncRun(
      "INSERT INTO libraries (name, path, type, scan_automatically) VALUES (?, ?, ?, ?)",
      [name, path, type, scan_automatically ? 1 : 0]
    );

    if (!result || !result.lastID) {
      throw new Error("Error al crear la biblioteca");
    }

    // Devolver la biblioteca creada
    return this.findById(result.lastID);
  }

  /**
   * Buscar una biblioteca por ID
   * @param {number} id - ID de la biblioteca
   * @returns {Promise<Object|null>} - Biblioteca encontrada o null
   */
  static async findById(id) {
    return db.asyncGet(
      "SELECT id, name, path, type, scan_automatically, created_at, updated_at FROM libraries WHERE id = ?",
      [id]
    );
  }

  /**
   * Buscar una biblioteca por ruta
   * @param {string} path - Ruta de la biblioteca
   * @returns {Promise<Object|null>} - Biblioteca encontrada o null
   */
  static async findByPath(path) {
    return db.asyncGet(
      "SELECT id, name, path, type, scan_automatically, created_at, updated_at FROM libraries WHERE path = ?",
      [path]
    );
  }

  /**
   * Obtener todas las bibliotecas
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Lista de bibliotecas
   */
  static async findAll(options = {}) {
    const { type = null } = options;

    // Si se especifica un tipo, filtrar por él
    if (type) {
      return db.asyncAll(
        "SELECT id, name, path, type, scan_automatically, created_at, updated_at FROM libraries WHERE type = ? ORDER BY name ASC",
        [type]
      );
    }

    // Si no, devolver todas
    return db.asyncAll(
      "SELECT id, name, path, type, scan_automatically, created_at, updated_at FROM libraries ORDER BY name ASC"
    );
  }

  /**
   * Obtener todas las bibliotecas accesibles para un usuario
   * @param {number} userId - ID del usuario
   * @param {boolean} includeItemCount - Incluir conteo de elementos
   * @returns {Promise<Array>} - Lista de bibliotecas accesibles
   */
  static async findAccessibleByUser(userId, includeItemCount = false) {
    // Verificar si el usuario es administrador
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);
    const isAdmin = user && user.is_admin === 1;

    let libraries;

    if (isAdmin) {
      // Los administradores pueden ver todas las bibliotecas
      libraries = await db.asyncAll(
        "SELECT id, name, path, type, scan_automatically, created_at, updated_at FROM libraries ORDER BY name ASC"
      );
    } else {
      // Usuarios normales solo ven bibliotecas a las que tienen acceso
      libraries = await db.asyncAll(
        `
        SELECT l.id, l.name, l.path, l.type, l.scan_automatically, l.created_at, l.updated_at
        FROM libraries l
        JOIN user_library_access ula ON l.id = ula.library_id
        WHERE ula.user_id = ? AND ula.has_access = 1
        ORDER BY l.name ASC
      `,
        [userId]
      );
    }

    // Si se solicita, incluir conteo de elementos
    if (includeItemCount && libraries.length > 0) {
      for (const library of libraries) {
        const countResult = await db.asyncGet(
          "SELECT COUNT(*) as count FROM media_items WHERE library_id = ?",
          [library.id]
        );
        library.itemCount = countResult ? countResult.count : 0;
      }
    }

    return libraries;
  }

  /**
   * Actualizar una biblioteca
   * @param {number} id - ID de la biblioteca
   * @param {Object} libraryData - Datos a actualizar
   * @returns {Promise<Object>} - Biblioteca actualizada
   */
  static async update(id, libraryData) {
    const fields = [];
    const values = [];

    // Construir consulta dinámicamente según los campos proporcionados
    if (libraryData.name !== undefined) {
      fields.push("name = ?");
      values.push(libraryData.name);
    }

    if (libraryData.path !== undefined) {
      // Verificar si ya existe otra biblioteca con la misma ruta
      if (libraryData.path) {
        const existingPath = await db.asyncGet(
          "SELECT id FROM libraries WHERE path = ? AND id != ?",
          [libraryData.path, id]
        );

        if (existingPath) {
          throw new Error("Ya existe otra biblioteca con esta ruta");
        }
      }

      fields.push("path = ?");
      values.push(libraryData.path);
    }

    if (libraryData.type !== undefined) {
      // Verificar que el tipo sea válido
      const validTypes = ["movies", "series", "music", "photos"];
      if (!validTypes.includes(libraryData.type)) {
        throw new Error(
          `Tipo de biblioteca no válido. Debe ser uno de: ${validTypes.join(
            ", "
          )}`
        );
      }

      fields.push("type = ?");
      values.push(libraryData.type);
    }

    if (libraryData.scan_automatically !== undefined) {
      fields.push("scan_automatically = ?");
      values.push(libraryData.scan_automatically ? 1 : 0);
    }

    // Añadir updated_at
    fields.push("updated_at = CURRENT_TIMESTAMP");

    // Si no hay campos para actualizar, devolver la biblioteca actual
    if (fields.length === 1) {
      return this.findById(id);
    }

    // Añadir ID al final de los valores
    values.push(id);

    // Ejecutar la actualización
    const result = await db.asyncRun(
      `UPDATE libraries SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (!result || !result.changes) {
      throw new Error(
        "Error al actualizar la biblioteca o ningún cambio realizado"
      );
    }

    // Devolver la biblioteca actualizada
    return this.findById(id);
  }

  /**
   * Eliminar una biblioteca
   * @param {number} id - ID de la biblioteca
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  static async delete(id) {
    // Iniciar transacción para eliminar datos relacionados
    await db.asyncRun("BEGIN TRANSACTION");

    try {
      // Eliminar elementos multimedia asociados
      await db.asyncRun("DELETE FROM media_items WHERE library_id = ?", [id]);

      // Eliminar permisos de acceso a la biblioteca
      await db.asyncRun(
        "DELETE FROM user_library_access WHERE library_id = ?",
        [id]
      );

      // Finalmente, eliminar la biblioteca
      const result = await db.asyncRun("DELETE FROM libraries WHERE id = ?", [
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
   * Actualizar acceso de usuario a una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {number} userId - ID del usuario
   * @param {boolean} hasAccess - Si tiene acceso
   * @returns {Promise<boolean>} - true si se actualizó correctamente
   */
  static async updateUserAccess(libraryId, userId, hasAccess) {
    // Verificar si ya existe un registro
    const existing = await db.asyncGet(
      "SELECT id FROM user_library_access WHERE user_id = ? AND library_id = ?",
      [userId, libraryId]
    );

    if (existing) {
      // Si hasAccess es true, actualizar; si es false, eliminar
      if (hasAccess) {
        await db.asyncRun(
          "UPDATE user_library_access SET has_access = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existing.id]
        );
      } else {
        await db.asyncRun("DELETE FROM user_library_access WHERE id = ?", [
          existing.id,
        ]);
      }
    } else if (hasAccess) {
      // Solo crear registro si hasAccess es true
      await db.asyncRun(
        "INSERT INTO user_library_access (user_id, library_id, has_access) VALUES (?, ?, 1)",
        [userId, libraryId]
      );
    }

    return true;
  }

  /**
   * Obtener usuarios con acceso a una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Array>} - Lista de usuarios con información de acceso
   */
  static async getUserAccess(libraryId) {
    return db.asyncAll(
      `
      SELECT u.id, u.username, u.email, u.is_admin, ula.has_access
      FROM users u
      LEFT JOIN user_library_access ula ON u.id = ula.user_id AND ula.library_id = ?
      ORDER BY u.username ASC
    `,
      [libraryId]
    );
  }

  /**
   * Verificar si un usuario tiene acceso a una biblioteca
   * @param {number} userId - ID del usuario
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<boolean>} - true si tiene acceso
   */
  static async checkAccess(userId, libraryId) {
    // Verificar si el usuario es administrador
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    // Los administradores tienen acceso a todas las bibliotecas
    if (user && user.is_admin === 1) {
      return true;
    }

    // Verificar acceso específico para usuarios normales
    const access = await db.asyncGet(
      "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
      [userId, libraryId]
    );

    return access && access.has_access === 1;
  }
}

module.exports = Library;
