// server/routes/user-history.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/authMiddleware");

// Middleware de autenticación para todas las rutas
router.use(enhancedAuthMiddleware);

/**
 * @route   GET /api/user/history
 * @desc    Obtener historial de visualización del usuario
 * @access  Private
 */
router.get("/history", async (req, res) => {
  const userId = req.user.id;
  const { limit = 10, completed = "false" } = req.query;

  try {
    // Validar parámetros
    const limitNum = parseInt(limit) || 10;
    const isCompleted = completed === "true";

    // Construir consulta para obtener historial de visualización
    // Unimos watch_history con media_items para obtener información completa
    const historyQuery = `
      SELECT 
        wh.id, 
        wh.media_id as mediaId, 
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
          isCompleted
            ? "AND wh.completed = 1"
            : "AND (wh.completed = 0 OR wh.completed IS NULL)"
        }
      ORDER BY 
        wh.watched_at DESC
      LIMIT ?
    `;

    const historyItems = await db.asyncAll(historyQuery, [userId, limitNum]);

    // Enviar respuesta
    res.json(historyItems || []);
  } catch (error) {
    console.error(`Error al obtener historial de usuario ${userId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener el historial de visualización",
    });
  }
});

/**
 * @route   GET /api/user/media/:id/history
 * @desc    Obtener historial de visualización de un elemento específico
 * @access  Private
 */
router.get("/media/:id/history", async (req, res) => {
  const userId = req.user.id;
  const mediaId = req.params.id;

  try {
    // Verificar si existe un registro para este usuario y medio
    const historyRecord = await db.asyncGet(
      "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    if (!historyRecord) {
      return res.json({
        mediaId,
        position: 0,
        completed: false,
        watched: false,
      });
    }

    // Obtener información del medio
    const mediaItem = await db.asyncGet(
      "SELECT title, type, duration, thumbnail_path FROM media_items WHERE id = ?",
      [mediaId]
    );

    // Combinar datos de historial con información del medio
    const historyData = {
      id: historyRecord.id,
      mediaId: parseInt(mediaId),
      position: historyRecord.position || 0,
      completed: !!historyRecord.completed,
      watched: true,
      watched_at: historyRecord.watched_at,
      // Agregar información del medio si está disponible
      ...mediaItem,
    };

    res.json(historyData);
  } catch (error) {
    console.error(`Error al obtener historial para medio ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener el historial de visualización",
    });
  }
});

/**
 * @route   POST /api/user/media/:id/history
 * @desc    Actualizar historial de visualización de un elemento
 * @access  Private
 */
router.post("/media/:id/history", async (req, res) => {
  const userId = req.user.id;
  const mediaId = req.params.id;
  const { position, completed } = req.body;

  if (position === undefined) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere la posición actual de reproducción",
    });
  }

  try {
    // Verificar si ya existe un registro para este usuario y medio
    const existingRecord = await db.asyncGet(
      "SELECT id FROM watch_history WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    if (existingRecord) {
      // Actualizar registro existente
      await db.asyncRun(
        "UPDATE watch_history SET position = ?, completed = ?, watched_at = CURRENT_TIMESTAMP WHERE id = ?",
        [position, completed ? 1 : 0, existingRecord.id]
      );
    } else {
      // Crear nuevo registro
      await db.asyncRun(
        "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, ?, ?)",
        [userId, mediaId, position, completed ? 1 : 0]
      );
    }

    res.json({
      message: "Historial actualizado correctamente",
      mediaId,
      position,
      completed: !!completed,
    });
  } catch (error) {
    console.error(
      `Error al actualizar historial para medio ${mediaId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al actualizar el historial de visualización",
    });
  }
});

/**
 * @route   DELETE /api/user/history/:id
 * @desc    Eliminar un elemento del historial
 * @access  Private
 */
router.delete("/history/:id", async (req, res) => {
  const userId = req.user.id;
  const historyId = req.params.id;

  try {
    // Verificar que el registro pertenece al usuario
    const historyRecord = await db.asyncGet(
      "SELECT id FROM watch_history WHERE id = ? AND user_id = ?",
      [historyId, userId]
    );

    if (!historyRecord) {
      return res.status(404).json({
        error: "No encontrado",
        message: "El registro de historial no existe o no pertenece al usuario",
      });
    }

    // Eliminar el registro
    await db.asyncRun("DELETE FROM watch_history WHERE id = ?", [historyId]);

    res.json({
      message: "Elemento eliminado del historial",
      id: historyId,
    });
  } catch (error) {
    console.error(`Error al eliminar historial ${historyId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al eliminar el registro del historial",
    });
  }
});

/**
 * @route   DELETE /api/user/history
 * @desc    Limpiar todo el historial del usuario
 * @access  Private
 */
router.delete("/history", async (req, res) => {
  const userId = req.user.id;

  try {
    // Eliminar todos los registros del usuario
    const result = await db.asyncRun(
      "DELETE FROM watch_history WHERE user_id = ?",
      [userId]
    );

    res.json({
      message: "Historial limpiado correctamente",
      count: result.changes,
    });
  } catch (error) {
    console.error(`Error al limpiar historial del usuario ${userId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al limpiar el historial de visualización",
    });
  }
});

module.exports = router;
