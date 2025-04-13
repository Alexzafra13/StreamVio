// server/data/models/Session.js
const db = require("../db");
const User = require("./User");

/**
 * Modelo para sesiones de usuario
 */
class Session {
  /**
   * Crear una nueva sesión
   * @param {Object} sessionData - Datos de la sesión
   * @returns {Promise<Object>} - Sesión creada
   */
  static async create(sessionData) {
    const {
      user_id,
      token,
      device_info = null,
      ip_address = null,
      expires_at,
    } = sessionData;

    // Verificar que el usuario existe
    const user = await User.findById(user_id);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Crear sesión en la base de datos
    const result = await db.asyncRun(
      "INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)",
      [user_id, token, device_info, ip_address, expires_at]
    );

    if (!result || !result.lastID) {
      throw new Error("Error al crear la sesión");
    }

    // Devolver la sesión creada
    return this.findById(result.lastID);
  }

  /**
   * Buscar una sesión por ID
   * @param {number} id - ID de la sesión
   * @returns {Promise<Object|null>} - Sesión encontrada o null
   */
  static async findById(id) {
    return db.asyncGet("SELECT * FROM sessions WHERE id = ?", [id]);
  }

  /**
   * Buscar una sesión por token
   * @param {string} token - Token de la sesión
   * @returns {Promise<Object|null>} - Sesión encontrada o null
   */
  static async findByToken(token) {
    return db.asyncGet("SELECT * FROM sessions WHERE token = ?", [token]);
  }

  /**
   * Verificar si un token de sesión es válido
   * @param {string} token - Token de la sesión
   * @returns {Promise<Object|null>} - Datos de sesión si es válida, null en caso contrario
   */
  static async verifyToken(token) {
    // Buscar sesión por token
    const session = await db.asyncGet(
      "SELECT s.*, u.username, u.email, u.is_admin FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP",
      [token]
    );

    return session;
  }

  /**
   * Obtener todas las sesiones de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array>} - Lista de sesiones
   */
  static async getUserSessions(userId) {
    return db.asyncAll(
      "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
  }

  /**
   * Eliminar una sesión por su ID
   * @param {number} id - ID de la sesión
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  static async delete(id) {
    const result = await db.asyncRun("DELETE FROM sessions WHERE id = ?", [id]);
    return result && result.changes > 0;
  }

  /**
   * Eliminar una sesión por su token
   * @param {string} token - Token de la sesión
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  static async deleteByToken(token) {
    const result = await db.asyncRun("DELETE FROM sessions WHERE token = ?", [
      token,
    ]);
    return result && result.changes > 0;
  }

  /**
   * Eliminar todas las sesiones de un usuario
   * @param {number} userId - ID del usuario
   * @param {string} exceptToken - Token de sesión a preservar (opcional)
   * @returns {Promise<number>} - Número de sesiones eliminadas
   */
  static async deleteAllForUser(userId, exceptToken = null) {
    let query = "DELETE FROM sessions WHERE user_id = ?";
    const params = [userId];

    if (exceptToken) {
      query += " AND token != ?";
      params.push(exceptToken);
    }

    const result = await db.asyncRun(query, params);
    return result ? result.changes : 0;
  }

  /**
   * Limpiar sesiones expiradas
   * @returns {Promise<number>} - Número de sesiones eliminadas
   */
  static async clearExpired() {
    const result = await db.asyncRun(
      "DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP"
    );
    return result ? result.changes : 0;
  }

  /**
   * Extender la duración de una sesión
   * @param {string} token - Token de la sesión
   * @param {string} newExpiryDate - Nueva fecha de expiración
   * @returns {Promise<boolean>} - true si se actualizó correctamente
   */
  static async extendSession(token, newExpiryDate) {
    const result = await db.asyncRun(
      "UPDATE sessions SET expires_at = ? WHERE token = ?",
      [newExpiryDate, token]
    );

    return result && result.changes > 0;
  }

  /**
   * Actualizar información de dispositivo o IP
   * @param {string} token - Token de la sesión
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<boolean>} - true si se actualizó correctamente
   */
  static async updateInfo(token, updateData) {
    const { device_info, ip_address } = updateData;
    const fields = [];
    const values = [];

    if (device_info !== undefined) {
      fields.push("device_info = ?");
      values.push(device_info);
    }

    if (ip_address !== undefined) {
      fields.push("ip_address = ?");
      values.push(ip_address);
    }

    if (fields.length === 0) {
      return true; // Nada que actualizar
    }

    values.push(token);

    const result = await db.asyncRun(
      `UPDATE sessions SET ${fields.join(", ")} WHERE token = ?`,
      values
    );

    return result && result.changes > 0;
  }
}

module.exports = Session;
