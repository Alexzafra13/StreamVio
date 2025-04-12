// server/data/repositories/userRepository.js
const db = require("../db");

/**
 * Repositorio para operaciones de usuario en la base de datos
 */
class UserRepository {
  /**
   * Buscar un usuario por su ID
   * @param {number} id - ID del usuario
   * @returns {Promise<Object|null>} - Usuario encontrado o null
   */
  async findById(id) {
    return db.asyncGet(
      "SELECT id, username, email, password, is_admin, force_password_change, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );
  }

  /**
   * Buscar un usuario por su email
   * @param {string} email - Email del usuario
   * @returns {Promise<Object|null>} - Usuario encontrado o null
   */
  async findByEmail(email) {
    return db.asyncGet(
      "SELECT id, username, email, password, is_admin, force_password_change, created_at, updated_at FROM users WHERE email = ?",
      [email]
    );
  }

  /**
   * Buscar un usuario por su nombre de usuario
   * @param {string} username - Nombre de usuario
   * @returns {Promise<Object|null>} - Usuario encontrado o null
   */
  async findByUsername(username) {
    return db.asyncGet(
      "SELECT id, username, email, password, is_admin, force_password_change, created_at, updated_at FROM users WHERE username = ?",
      [username]
    );
  }

  /**
   * Obtener todos los usuarios
   * @param {Object} options - Opciones de consulta (limit, offset, etc.)
   * @returns {Promise<Array>} - Lista de usuarios
   */
  async findAll(options = {}) {
    const { limit = 100, offset = 0 } = options;

    return db.asyncAll(
      "SELECT id, username, email, is_admin, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
  }

  /**
   * Contar el número total de usuarios
   * @returns {Promise<number>} - Número de usuarios
   */
  async count() {
    const result = await db.asyncGet("SELECT COUNT(*) as count FROM users");
    return result ? result.count : 0;
  }

  /**
   * Crear un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} - Usuario creado con su ID
   */
  async create(userData) {
    const {
      username,
      email,
      password,
      isAdmin = false,
      forcePasswordChange = false,
    } = userData;

    const result = await db.asyncRun(
      "INSERT INTO users (username, email, password, is_admin, force_password_change) VALUES (?, ?, ?, ?, ?)",
      [username, email, password, isAdmin ? 1 : 0, forcePasswordChange ? 1 : 0]
    );

    if (result && result.lastID) {
      return this.findById(result.lastID);
    }

    throw new Error("Error al crear usuario");
  }

  /**
   * Actualizar un usuario existente
   * @param {number} id - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<Object>} - Usuario actualizado
   */
  async update(id, userData) {
    const fields = [];
    const values = [];

    // Construir dinámicamente la consulta según los campos proporcionados
    if (userData.username !== undefined) {
      fields.push("username = ?");
      values.push(userData.username);
    }

    if (userData.email !== undefined) {
      fields.push("email = ?");
      values.push(userData.email);
    }

    if (userData.password !== undefined) {
      fields.push("password = ?");
      values.push(userData.password);
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

    // Añadir id al final de los valores
    values.push(id);

    // Si no hay campos para actualizar, devolver el usuario actual
    if (fields.length === 1) {
      return this.findById(id);
    }

    // Ejecutar la actualización
    await db.asyncRun(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    // Devolver el usuario actualizado
    return this.findById(id);
  }

  /**
   * Eliminar un usuario
   * @param {number} id - ID del usuario
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async delete(id) {
    const result = await db.asyncRun("DELETE FROM users WHERE id = ?", [id]);
    return result && result.changes > 0;
  }

  /**
   * Verificar si un usuario es administrador
   * @param {number} id - ID del usuario
   * @returns {Promise<boolean>} - true si es administrador
   */
  async isAdmin(id) {
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      id,
    ]);
    return user && user.is_admin === 1;
  }
}

module.exports = new UserRepository();
