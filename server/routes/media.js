// server/routes/media.js (parte del streaming)
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const db = require("../config/database");

/**
 * @route   GET /api/media/:id/stream
 * @desc    Transmitir un archivo multimedia con soporte para streaming parcial
 * @access  Private
 */
router.get("/:id/stream", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Obtener información del elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.file_path) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Archivo multimedia no encontrado",
      });
    }

    // 2. Verificar que el archivo existe
    const filePath = mediaItem.file_path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo físico no existe en el servidor",
      });
    }

    // 3. Registrar la visualización (asíncrono, sin bloquear respuesta)
    try {
      // Verificar si ya existe un registro
      const existing = await db.asyncGet(
        "SELECT id FROM watch_history WHERE user_id = ? AND media_id = ?",
        [userId, mediaId]
      );

      if (existing) {
        // Actualizar registro existente
        await db.asyncRun(
          "UPDATE watch_history SET watched_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existing.id]
        );
      } else {
        // Crear nuevo registro
        await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, 0, 0)",
          [userId, mediaId]
        );
      }
    } catch (watchError) {
      console.warn("Error al registrar visualización:", watchError);
      // No bloqueamos el streaming por este error
    }

    // 4. Obtener información del archivo
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // 5. Determinar tipo MIME basado en extensión
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".mp4": "video/mp4",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".wmv": "video/x-ms-wmv",
      ".m4v": "video/mp4",
      ".webm": "video/webm",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      ".m4a": "audio/mp4",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    // 6. Manejar streaming parcial (ranges) para video/audio
    if (
      range &&
      (contentType.startsWith("video/") || contentType.startsWith("audio/"))
    ) {
      // Parsear rango
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validar rango
      if (isNaN(start) || start < 0 || start >= fileSize) {
        return res.status(416).json({
          error: "Rango no satisfactorio",
          message: "El rango solicitado es inválido",
        });
      }

      // Ajustar fin para no exceder el tamaño
      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;

      // Configurar headers para respuesta parcial
      res.status(206);
      res.set({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });

      // Stream parcial del archivo
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // 7. Si no hay rango, enviar archivo completo
      res.set({
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });

      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error(`Error al transmitir archivo para medio ${mediaId}:`, error);

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
 * @desc    Obtener la miniatura de un elemento multimedia
 * @access  Private
 */
router.get("/:id/thumbnail", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;

  try {
    // Obtener información de la miniatura
    const mediaItem = await db.asyncGet(
      "SELECT thumbnail_path FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.thumbnail_path) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Miniatura no disponible para este elemento",
      });
    }

    // Verificar que el archivo existe
    const thumbnailPath = mediaItem.thumbnail_path;

    if (!fs.existsSync(thumbnailPath)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "La miniatura no existe en el servidor",
      });
    }

    // Determinar tipo MIME
    const ext = path.extname(thumbnailPath).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = mimeTypes[ext] || "image/jpeg";

    // Configurar cabeceras de caché para miniaturas (pueden cachearse por más tiempo)
    res.set({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400", // Cache durante 24 horas
    });

    // Enviar archivo
    res.sendFile(thumbnailPath);
  } catch (error) {
    console.error(`Error al obtener miniatura para medio ${mediaId}:`, error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Error del servidor",
        message: "Error al obtener la miniatura",
      });
    }
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

  // Validar datos
  if (position === undefined) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere la posición de reproducción",
    });
  }

  try {
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
      position,
      completed: !!completed,
    });
  } catch (error) {
    console.error(`Error al guardar progreso para medio ${mediaId}:`, error);

    // Si hay error por tabla inexistente, intentar crearla
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

        // Intentar inserción nuevamente
        await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, ?, ?)",
          [userId, mediaId, position, completed ? 1 : 0]
        );

        return res.json({
          success: true,
          position,
          completed: !!completed,
          message: "Tabla creada y progreso guardado",
        });
      } catch (createError) {
        return res.status(500).json({
          error: "Error del servidor",
          message: `Error al crear tabla de historial: ${createError.message}`,
        });
      }
    }

    res.status(500).json({
      error: "Error del servidor",
      message: "Error al guardar el progreso de reproducción",
    });
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
    // Obtener progreso
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
    console.error(`Error al obtener progreso para medio ${mediaId}:`, error);

    // Error genérico - no crítico
    res.json({
      mediaId,
      position: 0,
      completed: false,
      watched: false,
      error: "No se pudo obtener el progreso",
    });
  }
});

module.exports = router;
