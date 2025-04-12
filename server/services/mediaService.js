// server/services/mediaService.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const mediaRepository = require("../data/repositories/mediaRepository");
const libraryRepository = require("../data/repositories/libraryRepository");
const eventBus = require("./eventBus");
const { THUMBNAILS_DIR } = require("../config/paths");

// Promisificar operaciones de fs
const access = promisify(fs.access);
const stat = promisify(fs.stat);

/**
 * Servicio para gestión de elementos multimedia
 */
class MediaService {
  /**
   * Obtener un elemento multimedia por ID
   * @param {number} id - ID del elemento
   * @param {number} userId - ID del usuario que solicita el elemento
   * @returns {Promise<Object>} - Elemento multimedia
   * @throws {Error} - Si no se encuentra o no se tiene acceso
   */
  async getMediaById(id, userId) {
    // Obtener el elemento
    const media = await mediaRepository.findById(id);

    if (!media) {
      throw new Error("Elemento multimedia no encontrado");
    }

    // Verificar acceso a la biblioteca
    if (media.library_id) {
      const hasAccess = await this.checkAccess(userId, media.library_id);

      if (!hasAccess) {
        throw new Error("No tienes permiso para acceder a este elemento");
      }
    }

    return media;
  }

  /**
   * Verificar si un usuario tiene acceso a una biblioteca
   * @param {number} userId - ID del usuario
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<boolean>} - true si tiene acceso
   */
  async checkAccess(userId, libraryId) {
    // Verificar si el usuario es administrador
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    // Los administradores tienen acceso a todo
    if (user && user.is_admin === 1) {
      return true;
    }

    // Verificar acceso específico
    const access = await db.asyncGet(
      "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
      [userId, libraryId]
    );

    return access && access.has_access === 1;
  }

  /**
   * Buscar elementos multimedia
   * @param {Object} searchParams - Parámetros de búsqueda
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} - Resultados paginados
   */
  async searchMedia(searchParams, userId) {
    const {
      query,
      libraryId,
      type,
      page = 1,
      limit = 20,
      sort = "title",
      order = "asc",
    } = searchParams;

    // Si se especifica una biblioteca, verificar acceso
    if (libraryId) {
      const hasAccess = await this.checkAccess(userId, libraryId);

      if (!hasAccess) {
        throw new Error("No tienes permiso para acceder a esta biblioteca");
      }
    }

    // Preparar opciones de búsqueda
    const options = {
      libraryId: libraryId || null,
      type: type || null,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      sort,
      order,
    };

    let items = [];
    let total = 0;

    // Si hay término de búsqueda, usar search; si no, buscar por biblioteca
    if (query) {
      items = await mediaRepository.search(query, options);

      // Obtener conteo total aproximado para paginación
      // Esta es una simplificación para evitar una consulta adicional
      total = options.limit * 10; // Estimación aproximada
    } else if (libraryId) {
      items = await mediaRepository.findByLibrary(libraryId, options);
      total = await mediaRepository.countByLibrary(libraryId, type);
    } else {
      // Sin biblioteca ni término, devolver elementos recientes
      items = await mediaRepository.getRecent(options.limit);
      total = options.limit; // Simplificación
    }

    // Calcular información de paginación
    const totalPages = Math.ceil(total / options.limit);

    return {
      items,
      pagination: {
        total,
        page: parseInt(page),
        limit: options.limit,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    };
  }

  /**
   * Obtener la URL de miniatura para un elemento multimedia
   * @param {number} mediaId - ID del elemento
   * @returns {Promise<string>} - URL de la miniatura o null
   */
  async getThumbnailPath(mediaId) {
    const media = await mediaRepository.findById(mediaId);

    if (!media || !media.thumbnail_path) {
      return null;
    }

    // Verificar que el archivo existe
    try {
      await access(media.thumbnail_path, fs.constants.R_OK);
      return media.thumbnail_path;
    } catch (error) {
      return null;
    }
  }

  /**
   * Registrar progreso de visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento
   * @param {Object} progressData - Datos de progreso
   * @returns {Promise<Object>} - Datos de progreso actualizados
   */
  async updateWatchProgress(userId, mediaId, progressData) {
    const { position, completed = false } = progressData;

    // Verificar que el elemento existe
    const media = await mediaRepository.findById(mediaId);

    if (!media) {
      throw new Error("Elemento multimedia no encontrado");
    }

    // Verificar si ya existe un registro
    const existing = await db.asyncGet(
      "SELECT id FROM watch_history WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    if (existing) {
      // Actualizar registro existente
      await db.asyncRun(
        "UPDATE watch_history SET position = ?, completed = ?, watched_at = CURRENT_TIMESTAMP WHERE id = ?",
        [position, completed ? 1 : 0, existing.id]
      );
    } else {
      // Crear nuevo registro
      await db.asyncRun(
        "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, ?, ?)",
        [userId, mediaId, position, completed ? 1 : 0]
      );
    }

    // Emitir evento de progreso
    eventBus.emitEvent("media:progress-updated", {
      userId,
      mediaId,
      position,
      completed,
    });

    return {
      mediaId,
      position,
      completed: !!completed,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Obtener progreso de visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento
   * @returns {Promise<Object>} - Datos de progreso
   */
  async getWatchProgress(userId, mediaId) {
    // Verificar que el elemento existe
    const media = await mediaRepository.findById(mediaId);

    if (!media) {
      throw new Error("Elemento multimedia no encontrado");
    }

    // Buscar progreso
    const progress = await db.asyncGet(
      "SELECT position, completed, watched_at FROM watch_history WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    if (!progress) {
      return {
        mediaId,
        position: 0,
        completed: false,
        watched: false,
      };
    }

    return {
      mediaId,
      position: progress.position || 0,
      completed: !!progress.completed,
      watched: true,
      lastWatched: progress.watched_at,
    };
  }

  /**
   * Obtener historial de visualización del usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Historial de visualización
   */
  async getWatchHistory(userId, options = {}) {
    const { limit = 10, includeCompleted = false } = options;

    // Construir consulta para obtener historial con detalles
    const query = `
      SELECT 
        wh.id,
        wh.media_id,
        wh.position,
        wh.completed,
        wh.watched_at,
        m.title,
        m.type,
        m.duration,
        m.thumbnail_path
      FROM 
        watch_history wh
      JOIN 
        media_items m ON wh.media_id = m.id
      WHERE 
        wh.user_id = ? 
        ${
          !includeCompleted
            ? "AND (wh.completed = 0 OR wh.completed IS NULL)"
            : ""
        }
      ORDER BY 
        wh.watched_at DESC
      LIMIT ?
    `;

    return db.asyncAll(query, [userId, limit]);
  }
}

module.exports = new MediaService();
