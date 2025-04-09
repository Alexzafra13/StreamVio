// server/routes/streaming.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const authMiddleware = require("../middleware/enhancedAuth");
const db = require("../config/database");

/**
 * @route   GET /api/streaming/:id/stream
 * @desc    Streaming directo de archivo multimedia usando el token JWT principal
 * @access  Private
 */
router.get("/:id/stream", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;

  try {
    console.log(
      `Solicitud de streaming para usuario ${userId}, medio ${mediaId}`
    );

    // Verificar que el medio existe
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.file_path) {
      console.error(`Archivo no encontrado para media_id=${mediaId}`);
      return res.status(404).json({
        error: "No encontrado",
        message: "Archivo multimedia no encontrado",
      });
    }

    // Verificar que el usuario tiene acceso al medio (opcional, para mayor seguridad)
    // Puedes descomentar esto si quieres verificación adicional de permisos
    /*
    const hasAccess = await checkUserAccessToMedia(userId, mediaId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "No tienes permiso para acceder a este contenido"
      });
    }
    */

    // Normalizar la ruta del archivo para asegurar compatibilidad entre sistemas
    const filePath = mediaItem.file_path.replace(/\\/g, "/");
    console.log(`Accediendo al archivo: ${filePath}`);

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      console.error(`El archivo físico no existe: ${filePath}`);
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo físico no existe en el sistema",
      });
    }

    // Registrar la visualización (opcional)
    try {
      await db.asyncRun(
        `INSERT INTO watch_history (user_id, media_id, position, completed) 
         VALUES (?, ?, 0, 0)
         ON CONFLICT(user_id, media_id) 
         DO UPDATE SET watched_at = CURRENT_TIMESTAMP`,
        [userId, mediaId]
      );
    } catch (watchError) {
      console.warn("Error al registrar visualización:", watchError);
      // No interrumpir el streaming por errores de registro
    }

    // Obtener información del archivo
    const stats = await fs.promises.stat(filePath);
    const size = stats.size;

    // Determinar el tipo MIME basado en la extensión del archivo
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = "application/octet-stream";

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

    if (mimeTypes[ext]) {
      mimeType = mimeTypes[ext];
    }

    // Manejar solicitudes de rango (para streaming)
    const range = req.headers.range;

    if (range) {
      // Streaming con rango
      console.log(`Streaming con rango: ${range}`);

      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

      // Validar rango
      if (start >= size) {
        return res.status(416).send("Requested range not satisfiable");
      }

      const chunksize = end - start + 1;
      console.log(
        `Enviando chunk de ${chunksize} bytes (${start}-${end}/${size})`
      );

      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });

      // Streaming
      file.pipe(res);

      // Manejo de errores durante el streaming
      file.on("error", (err) => {
        console.error(`Error durante streaming de ${filePath}:`, err);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Error de streaming",
            message: "Error al leer el archivo multimedia",
          });
        } else {
          res.end();
        }
      });
    } else {
      // Streaming completo (sin rango)
      console.log(`Streaming completo: ${size} bytes`);

      res.writeHead(200, {
        "Content-Length": size,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });

      const file = fs.createReadStream(filePath);
      file.pipe(res);

      // Manejo de errores durante el streaming
      file.on("error", (err) => {
        console.error(`Error durante streaming de ${filePath}:`, err);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Error de streaming",
            message: "Error al leer el archivo multimedia",
          });
        } else {
          res.end();
        }
      });
    }
  } catch (error) {
    console.error(
      `Error al procesar solicitud de streaming para ${mediaId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar la solicitud de streaming",
    });
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
      await db.asyncRun(
        `INSERT INTO watch_history (user_id, media_id, position, completed) 
         VALUES (?, ?, 0, 0)
         ON CONFLICT(user_id, media_id) 
         DO UPDATE SET watched_at = CURRENT_TIMESTAMP`,
        [userId, mediaId]
      );
    } catch (watchError) {
      console.warn("Error al registrar visualización:", watchError);
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
    const result = await db.asyncRun(
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

    res.json({
      success: true,
      position,
      completed: !!completed,
      updated: true,
    });
  } catch (error) {
    console.error("Error al guardar progreso:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al guardar el progreso de visualización",
    });
  }
});

module.exports = router;
