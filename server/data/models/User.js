// server/data/models/User.js
const db = require("../db");
const bcrypt = require("bcrypt");

/**
 * Modelo para el usuario
 */
class User {
  /**
   * Crear un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} - Usuario creado
   */
  static async create(userData) {
    const {
      username,
      email,
      password,
      isAdmin = false,
      forcePasswordChange = false,
    } = userData;

    // Verificar si el email ya existe
    const existingEmail = await db.asyncGet(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingEmail) {
      throw new Error("Este email ya está en uso");
    }

    // Verificar si el nombre de usuario ya existe
    const existingUsername = await db.asyncGet(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    if (existingUsername) {
      throw new Error("Este nombre de usuario ya está en uso");
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario en la base de datos
    const result = await db.asyncRun(
      "INSERT INTO users (username, email, password, is_admin, force_password_change) VALUES (?, ?, ?, ?, ?)",
      [
        username,
        email,
        hashedPassword,
        isAdmin ? 1 : 0,
        forcePasswordChange ? 1 : 0,
      ]
    );

    if (!result || !result.lastID) {
      throw new Error("Error al crear el usuario");
    }

    // Devolver el usuario creado
    return this.findById(result.lastID);
  }

  /**
   * Buscar un usuario por ID
   * @param {number} id - ID del usuario
   * @returns {Promise<Object|null>} - Usuario encontrado o null
   */
  static async findById(id) {
    return db.asyncGet(
      "SELECT id, username, email, password, is_admin, force_password_change, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );
  }

  /**
   * Buscar un usuario por email
   * @param {string} email - Email del usuario
   * @returns {Promise<Object|null>} - Usuario encontrado o null
   */
  static async findByEmail(email) {
    return db.asyncGet(
      "SELECT id, username, email, password, is_admin, force_password_change, created_at, updated_at FROM users WHERE email = ?",
      [email]
    );
  }

  /**
   * Buscar un usuario por nombre de usuario
   * @param {string} username - Nombre de usuario
   * @returns {Promise<Object|null>} - Usuario encontrado o null
   */
  static async findByUsername(username) {
    return db.asyncGet(
      "SELECT id, username, email, password, is_admin, force_password_change, created_at, updated_at FROM users WHERE username = ?",
      [username]
    );
  }

  /**
   * Obtener todos los usuarios
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Lista de usuarios
   */
  static async findAll(options = {}) {
    const { limit = 100, offset = 0, withoutPassword = true } = options;

    const fields = withoutPassword
      ? "id, username, email, is_admin, force_password_change, created_at, updated_at"
      : "id, username, email, password, is_admin, force_password_change, created_at, updated_at";

    return db.asyncAll(
      `SELECT ${fields} FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  /**
   * Contar el número total de usuarios
   * @returns {Promise<number>} - Número de usuarios
   */
  static async count() {
    const result = await db.asyncGet("SELECT COUNT(*) as count FROM users");
    return result ? result.count : 0;
  }

  /**
   * Actualizar un usuario
   * @param {number} id - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<Object>} - Usuario actualizado
   */
  static async update(id, userData) {
    const fields = [];
    const values = [];

    // Construir consulta dinámicamente según los campos proporcionados
    if (userData.username !== undefined) {
      // Verificar si el nombre de usuario ya está en uso por otro usuario
      if (userData.username) {
        const existingUsername = await db.asyncGet(
          "SELECT id FROM users WHERE username = ? AND id != ?",
          [userData.username, id]
        );

        if (existingUsername) {
          throw new Error("Este nombre de usuario ya está en uso");
        }
      }

      fields.push("username = ?");
      values.push(userData.username);
    }

    if (userData.email !== undefined) {
      // Verificar si el email ya está en uso por otro usuario
      if (userData.email) {
        const existingEmail = await db.asyncGet(
          "SELECT id FROM users WHERE email = ? AND id != ?",
          [userData.email, id]
        );

        if (existingEmail) {
          throw new Error("Este email ya está en uso");
        }
      }

      fields.push("email = ?");
      values.push(userData.email);
    }

    if (userData.password !== undefined) {
      // Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      fields.push("password = ?");
      values.push(hashedPassword);
    }

    if (userData.isAdmin !== undefined) {
      fields.push("is_admin = ?");
      values.push(userData.isAdmin ? 1 : 0);
    }

    if (userData.forcePasswordChange !== undefined) {
      fields.push("force_password_change = ?");
      values.push(userData.forcePasswordChange ? 1 : 0);
    }

    // Añadir updated_at
    fields.push("updated_at = CURRENT_TIMESTAMP");

    // Si no hay campos para actualizar, devolver el usuario actual
    if (fields.length === 1) {
      return this.findById(id);
    }

    // Añadir ID al final de los valores
    values.push(id);

    // Ejecutar la actualización
    const result = await db.asyncRun(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (!result || !result.changes) {
      throw new Error(
        "Error al actualizar el usuario o ningún cambio realizado"
      );
    }

    // Devolver el usuario actualizado
    return this.findById(id);
  }

  /**
   * Eliminar un usuario
   * @param {number} id - ID del usuario
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  static async delete(id) {
    // Iniciar transacción para eliminar datos relacionados
    await db.asyncRun("BEGIN TRANSACTION");

    try {
      // Eliminar sesiones del usuario
      await db.asyncRun("DELETE FROM sessions WHERE user_id = ?", [id]);

      // Eliminar historial de visualización
      await db.asyncRun("DELETE FROM watch_history WHERE user_id = ?", [id]);

      // Eliminar permisos de bibliotecas
      await db.asyncRun("DELETE FROM user_library_access WHERE user_id = ?", [
        id,
      ]);

      // Actualizar códigos de invitación (no eliminar, pero marcar como usuario eliminado)
      await db.asyncRun(
        "UPDATE invitation_codes SET used_by = NULL WHERE used_by = ?",
        [id]
      );

      // Finalmente, eliminar el usuario
      const result = await db.asyncRun("DELETE FROM users WHERE id = ?", [id]);

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
   * Verificar si un usuario es administrador
   * @param {number} id - ID del usuario
   * @returns {Promise<boolean>} - true si es administrador
   */
  static async isAdmin(id) {
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      id,
    ]);
    return user && user.is_admin === 1;
  }

  /**
   * Verificar credenciales de usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object|null>} - Usuario si las credenciales son correctas, null en caso contrario
   */
  static async verifyCredentials(email, password) {
    // Buscar usuario por email
    const user = await this.findByEmail(email);

    if (!user) {
      return null;
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // Devolver usuario sin contraseña
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

module.exports = User;
