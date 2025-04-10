// server/routes/streaming.js (Versión actualizada)
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const authMiddleware = require("../middleware/enhancedAuth");
const db = require("../config/database");
const streamingService = require("../services/streamingService");

/**
 * @route   GET /api/streaming/:id/stream
 * @desc    Streaming directo de archivo multimedia usando el token JWT principal
 * @access  Private
 */
router.get("/:id/stream", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userData = req.user;

  try {
    console.log(
      `Solicitud de streaming para usuario ${userData.id}, medio ${mediaId}`
    );

    // Delegar el procesamiento al servicio de streaming mejorado
    await streamingService.handleStreamRequest(req, res, mediaId, userData);
  } catch (error) {
    console.error(
      `Error al procesar solicitud de streaming para ${mediaId}:`,
      error
    );

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
 * @route   GET /api/streaming/:id/hls
 * @desc    Streaming HLS adaptativo
 * @access  Private
 */
router.get("/:id/hls", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;

  try {
    // Obtener el elemento multimedia
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

    // Determinar la ruta al directorio HLS
    const filePath = mediaItem.file_path.replace(/\\/g, "/");
    const fileName = path.basename(filePath, path.extname(filePath));
    const hlsDir = path.join(
      process.cwd(),
      "server/data/transcoded",
      `${fileName}_hls`
    );
    const masterPlaylist = path.join(hlsDir, "master.m3u8");

    // Verificar que existe el directorio HLS
    if (!fs.existsSync(hlsDir) || !fs.existsSync(masterPlaylist)) {
      return res.status(404).json({
        error: "HLS no disponible",
        message: "El streaming HLS no está disponible para este medio",
      });
    }

    // Registrar la visualización
    try {
      await streamingService.recordViewing(userId, mediaId);
    } catch (watchError) {
      console.warn("Error al registrar visualización HLS:", watchError);
    }

    // Extraer el token JWT para pasarlo a los segmentos HLS
    const token = req.query.auth || req.query.token;

    // Devolver la información necesaria para reproducir HLS
    res.json({
      mediaId,
      hlsBaseUrl: `/data/transcoded/${fileName}_hls`,
      masterPlaylist: `data/transcoded/${fileName}_hls/master.m3u8?auth=${token}`,
    });
  } catch (error) {
    console.error(`Error al procesar solicitud HLS para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar la solicitud de streaming HLS",
    });
  }
});

/**
 * @route   POST /api/streaming/:id/progress
 * @desc    Actualizar el progreso de visualización
 * @access  Private
 */
router.post("/:id/progress", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;
  const { position, completed } = req.body;

  try {
    // Validar datos
    if (position === undefined) {
      return res.status(400).json({
        error: "Datos inválidos",
        message: "Se requiere la posición actual",
      });
    }

    // Guardar progreso en la base de datos
    try {
      await db.asyncRun(
        `INSERT INTO watch_history (user_id, media_id, position, completed, watched_at) 
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, media_id) 
         DO UPDATE SET position = ?, completed = ?, watched_at = CURRENT_TIMESTAMP`,
        [
          userId,
          mediaId,
          position,
          completed ? 1 : 0,
          position,
          completed ? 1 : 0,
        ]
      );
    } catch (dbError) {
      // Si hay error por tabla inexistente, crearla e intentar de nuevo
      if (dbError.message && dbError.message.includes("no such table")) {
        await db.asyncRun(`
          CREATE TABLE IF NOT EXISTS watch_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            position INTEGER DEFAULT 0,
            completed BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE,
            UNIQUE(user_id, media_id)
          )
        `);

        // Intentar nuevamente la inserción
        await db.asyncRun(
          `INSERT INTO watch_history (user_id, media_id, position, completed, watched_at) 
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [userId, mediaId, position, completed ? 1 : 0]
        );
      } else {
        throw dbError;
      }
    }

    res.json({
      success: true,
      message: "Progreso guardado correctamente",
      position,
      completed: !!completed,
    });
  } catch (error) {
    console.error("Error al guardar progreso:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al guardar el progreso de visualización",
    });
  }
});

/**
 * @route   GET /api/streaming/:id/info
 * @desc    Obtener información de opciones de streaming disponibles
 * @access  Private
 */
router.get("/:id/info", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;

  try {
    // Obtener información del medio
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Normalizar la ruta del archivo
    const filePath = mediaItem.file_path
      ? mediaItem.file_path.replace(/\\/g, "/")
      : null;

    // Verificar si hay versión HLS disponible
    let hlsAvailable = false;
    if (filePath) {
      const fileName = path.basename(filePath, path.extname(filePath));
      const hlsDir = path.join(
        process.cwd(),
        "server/data/transcoded",
        `${fileName}_hls`
      );
      const masterPlaylist = path.join(hlsDir, "master.m3u8");

      hlsAvailable = fs.existsSync(masterPlaylist);
    }

    // Verificar archivo original
    let fileInfo = null;
    if (filePath) {
      try {
        const stats = fs.statSync(filePath);
        fileInfo = {
          exists: true,
          size: stats.size,
          mimeType: getMimeType(filePath),
        };
      } catch (fsError) {
        fileInfo = { exists: false, error: fsError.code };
      }
    }

    // Construir respuesta con opciones de streaming
    const token = req.query.auth || req.headers.authorization?.split(" ")[1];

    res.json({
      mediaId,
      title: mediaItem.title,
      type: mediaItem.type,
      fileExists: fileInfo?.exists || false,
      fileSize: fileInfo?.size,
      options: {
        direct: {
          available: fileInfo?.exists || false,
          url: `/api/streaming/${mediaId}/stream${
            token ? `?auth=${token}` : ""
          }`,
          type: fileInfo?.mimeType || "video/mp4",
        },
        hls: {
          available: hlsAvailable,
          url: hlsAvailable
            ? `/data/transcoded/${path.basename(
                filePath,
                path.extname(filePath)
              )}_hls/master.m3u8${token ? `?auth=${token}` : ""}`
            : null,
          type: "application/vnd.apple.mpegurl",
        },
      },
    });
  } catch (error) {
    console.error(`Error al obtener info de streaming para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener información de streaming",
    });
  }
});

/**
 * Función para determinar el MIME type basado en la extensión del archivo
 * @param {string} filePath - Ruta del archivo
 * @returns {string} - MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".ogv": "video/ogg",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv",
    ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

module.exports = router;
