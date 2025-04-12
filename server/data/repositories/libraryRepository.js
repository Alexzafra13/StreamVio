// server/data/repositories/libraryRepository.js
const db = require("../db");

/**
 * Repositorio para operaciones con bibliotecas
 */
class LibraryRepository {
  /**
   * Buscar una biblioteca por su ID
   * @param {number} id - ID de la biblioteca
   * @returns {Promise<Object|null>} - Biblioteca encontrada o null
   */
  async findById(id) {
    return db.asyncGet("SELECT * FROM libraries WHERE id = ?", [id]);
  }

  /**
   * Buscar biblioteca por ruta
   * @param {string} path - Ruta de la biblioteca
   * @returns {Promise<Object|null>} - Biblioteca encontrada o null
   */
  async findByPath(path) {
    return db.asyncGet("SELECT * FROM libraries WHERE path = ?", [path]);
  }

  /**
   * Obtener todas las bibliotecas
   * @returns {Promise<Array>} - Lista de bibliotecas
   */
  async findAll() {
    return db.asyncAll("SELECT * FROM libraries ORDER BY name ASC");
  }

  /**
   * Obtener bibliotecas accesibles para un usuario
   * @param {number} userId - ID del usuario
   * @param {boolean} includeItemCount - Incluir conteo de elementos
   * @returns {Promise<Array>} - Lista de bibliotecas
   */
  async findAccessibleByUser(userId, includeItemCount = false) {
    // Primero verificar si el usuario es administrador
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);
    const isAdmin = user && user.is_admin === 1;

    let libraries;

    if (isAdmin) {
      // Los administradores pueden ver todas las bibliotecas
      libraries = await db.asyncAll(
        "SELECT * FROM libraries ORDER BY name ASC"
      );
    } else {
      // Usuarios normales solo ven bibliotecas a las que tienen acceso
      libraries = await db.asyncAll(
        `
        SELECT l.* 
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
   * Crear una nueva biblioteca
   * @param {Object} libraryData - Datos de la biblioteca
   * @returns {Promise<Object>} - Biblioteca creada con su ID
   */
  async create(libraryData) {
    const { name, path, type, scan_automatically = true } = libraryData;

    const result = await db.asyncRun(
      "INSERT INTO libraries (name, path, type, scan_automatically) VALUES (?, ?, ?, ?)",
      [name, path, type, scan_automatically ? 1 : 0]
    );

    if (result && result.lastID) {
      return this.findById(result.lastID);
    }

    throw new Error("Error al crear biblioteca");
  }

  /**
   * Actualizar una biblioteca existente
   * @param {number} id - ID de la biblioteca
   * @param {Object} libraryData - Datos a actualizar
   * @returns {Promise<Object>} - Biblioteca actualizada
   */
  async update(id, libraryData) {
    const fields = [];
    const values = [];

    // Construir consulta dinámicamente según los campos proporcionados
    if (libraryData.name !== undefined) {
      fields.push("name = ?");
      values.push(libraryData.name);
    }

    if (libraryData.path !== undefined) {
      fields.push("path = ?");
      values.push(libraryData.path);
    }

    if (libraryData.type !== undefined) {
      fields.push("type = ?");
      values.push(libraryData.type);
    }

    if (libraryData.scan_automatically !== undefined) {
      fields.push("scan_automatically = ?");
      values.push(libraryData.scan_automatically ? 1 : 0);
    }

    // Añadir updated_at
    fields.push("updated_at = CURRENT_TIMESTAMP");

    // Añadir ID al final de los valores
    values.push(id);

    // Si no hay campos para actualizar, devolver la biblioteca actual
    if (fields.length === 1) {
      return this.findById(id);
    }

    // Ejecutar la actualización
    await db.asyncRun(
      `UPDATE libraries SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    // Devolver la biblioteca actualizada
    return this.findById(id);
  }

  /**
   * Eliminar una biblioteca
   * @param {number} id - ID de la biblioteca
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async delete(id) {
    // Iniciar transacción
    await db.asyncRun("BEGIN TRANSACTION");

    try {
      // Primero eliminar los elementos asociados
      await db.asyncRun("DELETE FROM media_items WHERE library_id = ?", [id]);

      // Luego eliminar los permisos de acceso
      await db.asyncRun(
        "DELETE FROM user_library_access WHERE library_id = ?",
        [id]
      );

      // Finalmente eliminar la biblioteca
      const result = await db.asyncRun("DELETE FROM libraries WHERE id = ?", [
        id,
      ]);

      // Confirmar transacción
      await db.asyncRun("COMMIT");

      return result && result.changes > 0;
    } catch (error) {
      // Revertir en caso de error
      await db.asyncRun("ROLLBACK");
      throw error;
    }
  }

  /**
   * Obtener permisos de usuarios para una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Array>} - Lista de permisos de usuario
   */
  async getUserAccess(libraryId) {
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
   * Actualizar acceso de usuario a una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {number} userId - ID del usuario
   * @param {boolean} hasAccess - Si tiene acceso
   * @returns {Promise<boolean>} - true si se actualizó correctamente
   */
  async updateUserAccess(libraryId, userId, hasAccess) {
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
}

module.exports = new LibraryRepository();
