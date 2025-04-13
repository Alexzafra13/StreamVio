// server/data/models/WatchHistory.js
const db = require("../db");
const User = require("./User");
const MediaItem = require("./MediaItem");

/**
 * Modelo para el historial de visualización
 */
class WatchHistory {
  /**
   * Registrar o actualizar progreso de visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento multimedia
   * @param {Object} progressData - Datos de progreso
   * @returns {Promise<Object>} - Registro de visualización actualizado
   */
  static async updateProgress(userId, mediaId, progressData) {
    const { position, completed = false, duration = null } = progressData;

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Verificar que el elemento multimedia existe
    const media = await MediaItem.findById(mediaId);
    if (!media) {
      throw new Error("Elemento multimedia no encontrado");
    }

    // Verificar si ya existe un registro de visualización
    const existing = await db.asyncGet(
      "SELECT id FROM watch_history WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    if (existing) {
      // Actualizar registro existente
      await db.asyncRun(
        "UPDATE watch_history SET position = ?, completed = ?, duration = ?, watched_at = CURRENT_TIMESTAMP WHERE id = ?",
        [position, completed ? 1 : 0, duration, existing.id]
      );

      return this.findById(existing.id);
    } else {
      // Crear nuevo registro
      const result = await db.asyncRun(
        "INSERT INTO watch_history (user_id, media_id, position, completed, duration) VALUES (?, ?, ?, ?, ?)",
        [userId, mediaId, position, completed ? 1 : 0, duration]
      );

      if (!result || !result.lastID) {
        throw new Error("Error al registrar progreso de visualización");
      }

      return this.findById(result.lastID);
    }
  }

  /**
   * Buscar un registro de historial por ID
   * @param {number} id - ID del registro
   * @returns {Promise<Object|null>} - Registro encontrado o null
   */
  static async findById(id) {
    return db.asyncGet("SELECT * FROM watch_history WHERE id = ?", [id]);
  }

  /**
   * Obtener progreso de visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {Promise<Object>} - Datos de progreso o objeto vacío
   */
  static async getProgress(userId, mediaId) {
    const progress = await db.asyncGet(
      "SELECT id, position, completed, duration, watched_at FROM watch_history WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    if (!progress) {
      return {
        mediaId,
        position: 0,
        completed: false,
        duration: null,
        watched: false,
      };
    }

    return {
      id: progress.id,
      mediaId,
      position: progress.position || 0,
      completed: !!progress.completed,
      duration: progress.duration,
      watched: true,
      lastWatched: progress.watched_at,
    };
  }

  /**
   * Obtener historial de visualización completo de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Historial de visualización
   */
  static async getUserHistory(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      includeCompleted = true,
      includeDetails = true,
    } = options;

    // Si se solicitan detalles, unir con la tabla de elementos multimedia
    if (includeDetails) {
      let query = `
        SELECT 
          wh.id, wh.user_id, wh.media_id, wh.position, wh.completed, 
          wh.duration, wh.watched_at, 
          m.title, m.type, m.thumbnail_path, m.duration as total_duration, 
          l.id as library_id, l.name as library_name
        FROM 
          watch_history wh
        JOIN 
          media_items m ON wh.media_id = m.id
        JOIN
          libraries l ON m.library_id = l.id
        WHERE 
          wh.user_id = ?
      `;

      // Filtrar por completados si se solicita
      if (!includeCompleted) {
        query += " AND (wh.completed = 0 OR wh.completed IS NULL)";
      }

      // Ordenar y limitar resultados
      query += " ORDER BY wh.watched_at DESC LIMIT ? OFFSET ?";

      return db.asyncAll(query, [userId, limit, offset]);
    } else {
      // Consulta simple sin detalles
      let query = "SELECT * FROM watch_history WHERE user_id = ?";

      // Filtrar por completados si se solicita
      if (!includeCompleted) {
        query += " AND (completed = 0 OR completed IS NULL)";
      }

      // Ordenar y limitar resultados
      query += " ORDER BY watched_at DESC LIMIT ? OFFSET ?";

      return db.asyncAll(query, [userId, limit, offset]);
    }
  }

  /**
   * Obtener elementos recientemente vistos
   * @param {number} userId - ID del usuario
   * @param {number} limit - Número máximo de elementos
   * @returns {Promise<Array>} - Elementos recientemente vistos
   */
  static async getRecentlyWatched(userId, limit = 10) {
    const query = `
      SELECT 
        m.*, wh.position, wh.completed, wh.watched_at
      FROM 
        watch_history wh
      JOIN 
        media_items m ON wh.media_id = m.id
      WHERE 
        wh.user_id = ?
      ORDER BY 
        wh.watched_at DESC
      LIMIT ?
    `;

    return db.asyncAll(query, [userId, limit]);
  }

  /**
   * Obtener elementos en progreso (no completados)
   * @param {number} userId - ID del usuario
   * @param {number} limit - Número máximo de elementos
   * @returns {Promise<Array>} - Elementos en progreso
   */
  static async getInProgress(userId, limit = 10) {
    const query = `
      SELECT 
        m.*, wh.position, wh.completed, wh.watched_at,
        CASE 
          WHEN m.duration > 0 THEN CAST(wh.position AS FLOAT) / m.duration * 100 
          ELSE 0 
        END as progress_percent
      FROM 
        watch_history wh
      JOIN 
        media_items m ON wh.media_id = m.id
      WHERE 
        wh.user_id = ? AND (wh.completed = 0 OR wh.completed IS NULL) AND wh.position > 0
      ORDER BY 
        wh.watched_at DESC
      LIMIT ?
    `;

    return db.asyncAll(query, [userId, limit]);
  }

  /**
   * Eliminar un registro de historial
   * @param {number} id - ID del registro
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  static async delete(id) {
    const result = await db.asyncRun("DELETE FROM watch_history WHERE id = ?", [
      id,
    ]);
    return result && result.changes > 0;
  }

  /**
   * Eliminar todo el historial de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  static async deleteAllForUser(userId) {
    const result = await db.asyncRun(
      "DELETE FROM watch_history WHERE user_id = ?",
      [userId]
    );
    return result && result.changes > 0;
  }

  /**
   * Marcar un elemento como completado
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {Promise<Object>} - Registro actualizado
   */
  static async markAsCompleted(userId, mediaId) {
    // Obtener información del elemento multimedia para la duración
    const media = await MediaItem.findById(mediaId);

    if (!media) {
      throw new Error("Elemento multimedia no encontrado");
    }

    // Actualizar o crear registro
    return this.updateProgress(userId, mediaId, {
      position: media.duration || 0,
      completed: true,
      duration: media.duration,
    });
  }
}

module.exports = WatchHistory;
