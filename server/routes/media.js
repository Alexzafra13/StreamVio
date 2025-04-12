// server/routes/media.js (parte de streaming)
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/enhancedAuth");
const streamingService = require("../services/streamingService");
const db = require("../config/database");
const path = require("path");
const fs = require("fs");

/**
 * @route   GET /api/media/:id/stream
 * @desc    Transmitir un archivo multimedia
 * @access  Private (verificación de token)
 */
router.get("/:id/stream", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userData = req.user;

  try {
    console.log(
      `Solicitud de streaming para medio ${mediaId} por usuario ${userData.id}`
    );

    // Delegamos el manejo del streaming al servicio especializado
    await streamingService.handleStreamRequest(req, res, mediaId, userData);
  } catch (error) {
    console.error(`Error en streaming para medio ${mediaId}:`, error);

    // Si aún no se ha enviado respuesta, enviar error
    if (!res.headersSent) {
      res.status(500).json({
        error: "Error del servidor",
        message: "Error al procesar la solicitud de streaming",
      });
    }
  }
});

/**
 * @route   GET /api/media/:id/thumbnail
 * @desc    Obtener thumbnail de un elemento multimedia
 * @access  Private (verificación de token)
 */
router.get("/:id/thumbnail", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userData = req.user;

  try {
    // Obtener el elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT thumbnail_path, library_id FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    if (!mediaItem.thumbnail_path) {
      return res.status(404).json({
        error: "Miniatura no disponible",
        message: "Este elemento no tiene miniatura disponible",
      });
    }

    // Verificar permisos de acceso
    const hasAccess = await streamingService.checkAccess(
      userData.id,
      mediaId,
      mediaItem.library_id
    );
    if (!hasAccess) {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "No tienes permiso para acceder a este contenido",
      });
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(mediaItem.thumbnail_path)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "La miniatura no existe en el sistema",
      });
    }

    // Determinar el tipo MIME
    const ext = path.extname(mediaItem.thumbnail_path).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = mimeTypes[ext] || "image/jpeg";

    // Establecer headers y enviar archivo
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400"); // Cache por 24 horas
    res.sendFile(mediaItem.thumbnail_path);
  } catch (error) {
    console.error(`Error al obtener thumbnail para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar la miniatura",
    });
  }
});

/**
 * @route   POST /api/media/:id/progress
 * @desc    Guardar el progreso de reproducción
 * @access  Private
 */
router.post("/:id/progress", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;
  const { position, completed } = req.body;

  try {
    // Validar entrada
    if (position === undefined) {
      return res.status(400).json({
        error: "Datos incompletos",
        message: "Se requiere la posición actual de reproducción",
      });
    }

    // Verificar si ya existe un registro para este usuario y medio
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

    res.json({
      success: true,
      message: "Progreso guardado correctamente",
      position,
      completed: !!completed,
    });
  } catch (error) {
    console.error(`Error al guardar progreso para ${mediaId}:`, error);

    // Si hay error por tabla inexistente, crearla e intentar de nuevo
    if (error.message && error.message.includes("no such table")) {
      try {
        await db.asyncRun(`
          CREATE TABLE IF NOT EXISTS watch_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            position INTEGER DEFAULT 0,
            completed BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
          )
        `);

        // Intentar nuevamente la inserción
        await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, ?, ?)",
          [userId, mediaId, position, completed ? 1 : 0]
        );

        res.json({
          success: true,
          message: "Progreso guardado correctamente (tabla creada)",
          position,
          completed: !!completed,
        });
      } catch (err) {
        res.status(500).json({
          error: "Error del servidor",
          message: `Error al guardar el progreso: ${err.message}`,
        });
      }
    } else {
      res.status(500).json({
        error: "Error del servidor",
        message: "Error al guardar el progreso de reproducción",
      });
    }
  }
});

/**
 * @route   GET /api/media/:id/progress
 * @desc    Obtener el progreso de reproducción
 * @access  Private
 */
router.get("/:id/progress", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;

  try {
    // Obtener el registro de visualización
    const watchRecord = await db.asyncGet(
      "SELECT position, completed, watched_at FROM watch_history WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    if (!watchRecord) {
      return res.json({
        mediaId,
        position: 0,
        completed: false,
        watched: false,
      });
    }

    res.json({
      mediaId,
      position: watchRecord.position || 0,
      completed: !!watchRecord.completed,
      watched: true,
      lastWatched: watchRecord.watched_at,
    });
  } catch (error) {
    console.error(`Error al obtener progreso para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener el progreso de reproducción",
    });
  }
});

module.exports = router;
