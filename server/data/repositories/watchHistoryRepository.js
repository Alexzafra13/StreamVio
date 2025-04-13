// server/data/repositories/watchHistoryRepository.js
const db = require("../db");
const WatchHistory = require("../models/WatchHistory");

/**
 * Repositorio para operaciones con el historial de visualización
 */
class WatchHistoryRepository {
  /**
   * Registrar o actualizar progreso de visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento multimedia
   * @param {Object} progressData - Datos de progreso
   * @returns {Promise<Object>} - Registro actualizado
   */
  async updateProgress(userId, mediaId, progressData) {
    return WatchHistory.updateProgress(userId, mediaId, progressData);
  }

  /**
   * Obtener progreso de visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {Promise<Object>} - Datos de progreso
   */
  async getProgress(userId, mediaId) {
    return WatchHistory.getProgress(userId, mediaId);
  }

  /**
   * Obtener historial de visualización de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Historial de visualización
   */
  async getUserHistory(userId, options = {}) {
    return WatchHistory.getUserHistory(userId, options);
  }

  /**
   * Obtener elementos recientemente vistos por un usuario
   * @param {number} userId - ID del usuario
   * @param {number} limit - Número máximo de elementos
   * @returns {Promise<Array>} - Elementos recientemente vistos
   */
  async getRecentlyWatched(userId, limit = 10) {
    return WatchHistory.getRecentlyWatched(userId, limit);
  }

  /**
   * Obtener elementos en progreso (no completados)
   * @param {number} userId - ID del usuario
   * @param {number} limit - Número máximo de elementos
   * @returns {Promise<Array>} - Elementos en progreso
   */
  async getInProgress(userId, limit = 10) {
    return WatchHistory.getInProgress(userId, limit);
  }

  /**
   * Marcar un elemento como completado
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {Promise<Object>} - Registro actualizado
   */
  async markAsCompleted(userId, mediaId) {
    return WatchHistory.markAsCompleted(userId, mediaId);
  }

  /**
   * Eliminar un registro del historial
   * @param {number} id - ID del registro
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async delete(id) {
    return WatchHistory.delete(id);
  }

  /**
   * Eliminar todo el historial de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async deleteAllForUser(userId) {
    return WatchHistory.deleteAllForUser(userId);
  }

  /**
   * Obtener estadísticas de visualización de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} - Estadísticas de visualización
   */
  async getUserStats(userId) {
    try {
      // Estadísticas básicas
      const stats = {
        totalWatched: 0,
        totalCompleted: 0,
        totalInProgress: 0,
        watchTime: 0, // En segundos
        byType: {},
        recentActivity: [],
      };

      // Total elementos vistos
      const totalResult = await db.asyncGet(
        "SELECT COUNT(*) as count FROM watch_history WHERE user_id = ?",
        [userId]
      );
      stats.totalWatched = totalResult ? totalResult.count : 0;

      // Elementos completados
      const completedResult = await db.asyncGet(
        "SELECT COUNT(*) as count FROM watch_history WHERE user_id = ? AND completed = 1",
        [userId]
      );
      stats.totalCompleted = completedResult ? completedResult.count : 0;

      // Elementos en progreso
      stats.totalInProgress = stats.totalWatched - stats.totalCompleted;

      // Tiempo total de visualización
      const watchTimeResult = await db.asyncGet(
        "SELECT SUM(position) as total FROM watch_history WHERE user_id = ?",
        [userId]
      );
      stats.watchTime =
        watchTimeResult && watchTimeResult.total
          ? Math.floor(watchTimeResult.total)
          : 0;

      // Estadísticas por tipo de contenido
      const typeCountQuery = `
        SELECT 
          m.type, COUNT(*) as count
        FROM 
          watch_history wh
        JOIN 
          media_items m ON wh.media_id = m.id
        WHERE 
          wh.user_id = ?
        GROUP BY 
          m.type
      `;

      const typeCounts = await db.asyncAll(typeCountQuery, [userId]);

      // Inicializar conteo por tipo
      for (const typeCount of typeCounts) {
        stats.byType[typeCount.type] = typeCount.count;
      }

      // Actividad reciente (últimos 5 elementos)
      const recentActivityQuery = `
        SELECT 
          wh.media_id, wh.position, wh.completed, wh.watched_at,
          m.title, m.type, m.duration
        FROM 
          watch_history wh
        JOIN 
          media_items m ON wh.media_id = m.id
        WHERE 
          wh.user_id = ?
        ORDER BY 
          wh.watched_at DESC
        LIMIT 5
      `;

      stats.recentActivity = await db.asyncAll(recentActivityQuery, [userId]);

      return stats;
    } catch (error) {
      console.error(
        `Error al obtener estadísticas para usuario ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtener elementos populares basados en visualizaciones
   * @param {number} limit - Número máximo de elementos
   * @returns {Promise<Array>} - Elementos populares
   */
  async getPopularItems(limit = 10) {
    const query = `
      SELECT 
        m.*, COUNT(wh.id) as view_count
      FROM 
        media_items m
      JOIN 
        watch_history wh ON m.id = wh.media_id
      GROUP BY 
        m.id
      ORDER BY 
        view_count DESC
      LIMIT ?
    `;

    return db.asyncAll(query, [limit]);
  }

  /**
   * Obtener recomendaciones de contenido para un usuario
   * @param {number} userId - ID del usuario
   * @param {number} limit - Número máximo de elementos
   * @returns {Promise<Array>} - Elementos recomendados
   */
  async getRecommendations(userId, limit = 10) {
    // Esta es una implementación básica de recomendaciones basada en:
    // 1. Elementos del mismo tipo que el usuario ha visto
    // 2. Elementos con géneros similares
    // 3. Elementos populares que el usuario aún no ha visto

    try {
      // Obtener tipos de contenido que el usuario ve con frecuencia
      const preferredTypesQuery = `
        SELECT 
          m.type, COUNT(*) as count
        FROM 
          watch_history wh
        JOIN 
          media_items m ON wh.media_id = m.id
        WHERE 
          wh.user_id = ?
        GROUP BY 
          m.type
        ORDER BY 
          count DESC
      `;

      const preferredTypes = await db.asyncAll(preferredTypesQuery, [userId]);

      // Si el usuario no tiene historial, devolver elementos populares
      if (preferredTypes.length === 0) {
        return this.getPopularItems(limit);
      }

      // Obtener los géneros preferidos del usuario
      const preferredGenresQuery = `
        SELECT 
          m.genre, COUNT(*) as count
        FROM 
          watch_history wh
        JOIN 
          media_items m ON wh.media_id = m.id
        WHERE 
          wh.user_id = ? AND m.genre IS NOT NULL
        GROUP BY 
          m.genre
        ORDER BY 
          count DESC
        LIMIT 5
      `;

      const preferredGenres = await db.asyncAll(preferredGenresQuery, [userId]);

      // Construir cláusula para tipos preferidos
      const typeClause =
        preferredTypes.length > 0
          ? `m.type IN (${preferredTypes.map(() => "?").join(",")})`
          : "1=1";

      // Construir cláusula para géneros preferidos
      const genreClause =
        preferredGenres.length > 0
          ? preferredGenres.map(() => "m.genre LIKE ?").join(" OR ")
          : "1=1";

      // Consulta para obtener recomendaciones
      const recommendationsQuery = `
        SELECT 
          m.*, COUNT(wh_others.id) as popularity
        FROM 
          media_items m
        LEFT JOIN 
          watch_history wh_others ON m.id = wh_others.media_id
        LEFT JOIN 
          watch_history wh_user ON m.id = wh_user.media_id AND wh_user.user_id = ?
        WHERE 
          wh_user.id IS NULL AND (${typeClause}) AND (${genreClause})
        GROUP BY 
          m.id
        ORDER BY 
          popularity DESC, m.created_at DESC
        LIMIT ?
      `;

      // Preparar parámetros
      const params = [userId];

      // Añadir tipos preferidos
      for (const type of preferredTypes) {
        params.push(type.type);
      }

      // Añadir géneros preferidos (con wildcards para búsqueda parcial)
      for (const genre of preferredGenres) {
        params.push(`%${genre.genre}%`);
      }

      // Añadir límite
      params.push(limit);

      // Ejecutar consulta
      return db.asyncAll(recommendationsQuery, params);
    } catch (error) {
      console.error(
        `Error al obtener recomendaciones para usuario ${userId}:`,
        error
      );
      // En caso de error, devolver elementos populares como fallback
      return this.getPopularItems(limit);
    }
  }
}

module.exports = new WatchHistoryRepository();
