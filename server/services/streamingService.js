// server/services/streamingService.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const mediaRepository = require("../data/repositories/mediaRepository");
const mediaService = require("./mediaService");
const eventBus = require("./eventBus");

// Promisificar operaciones de fs
const stat = promisify(fs.stat);
const access = promisify(fs.access);

/**
 * Servicio para streaming de contenido multimedia
 */
class StreamingService {
  constructor() {
    // Mapa de tipos MIME
    this.mimeTypes = {
      // Video
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".ogg": "video/ogg",
      ".ogv": "video/ogg",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".wmv": "video/x-ms-wmv",
      ".flv": "video/x-flv",
      ".mkv": "video/x-matroska",
      // Audio
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".flac": "audio/flac",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
      // Imágenes
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
    };
  }

  /**
   * Manejar una solicitud de streaming
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {number} mediaId - ID del medio a transmitir
   * @param {Object} userData - Datos del usuario autenticado
   * @returns {Promise<boolean>} - true si se manejó correctamente
   * @throws {Error} - Si ocurre un error
   */
  async handleStreamRequest(req, res, mediaId, userData) {
    try {
      // 1. Obtener información del medio desde la base de datos
      const mediaItem = await mediaRepository.findById(mediaId);

      if (!mediaItem) {
        return this.sendError(
          res,
          404,
          "Medio no encontrado",
          "El elemento multimedia solicitado no existe"
        );
      }

      // 2. Verificar permisos de acceso
      const hasAccess = await mediaService.checkAccess(
        userData.id,
        mediaItem.library_id
      );

      if (!hasAccess) {
        return this.sendError(
          res,
          403,
          "Acceso denegado",
          "No tienes permiso para acceder a este contenido"
        );
      }

      // 3. Verificar existencia y permisos del archivo
      const filePath = mediaItem.file_path;

      try {
        // Verificar que el archivo existe
        await access(filePath, fs.constants.F_OK);

        // Verificar permisos de lectura
        await access(filePath, fs.constants.R_OK);
      } catch (error) {
        if (error.code === "ENOENT") {
          return this.sendError(
            res,
            404,
            "Archivo no encontrado",
            "El archivo físico no existe en el sistema"
          );
        } else if (error.code === "EACCES") {
          return this.sendError(
            res,
            500,
            "Error de permisos",
            "No se puede leer el archivo debido a permisos insuficientes"
          );
        } else {
          return this.sendError(
            res,
            500,
            "Error de acceso",
            `Error al acceder al archivo: ${error.message}`
          );
        }
      }

      // 4. Obtener estadísticas del archivo
      const stats = await stat(filePath);
      const fileSize = stats.size;
      const mimeType = this.getMimeType(filePath);

      // 5. Registrar visualización en el historial (sin bloquear la respuesta)
      this.recordWatching(userData.id, mediaId).catch((err) => {
        console.warn(`Error al registrar visualización: ${err.message}`);
      });

      // 6. Manejar peticiones con rango (streaming)
      const range = req.headers.range;

      // Si no hay solicitud de rango, enviar archivo completo
      if (!range) {
        console.log(`Streaming completo: ${filePath} (${fileSize} bytes)`);

        res.writeHead(200, {
          "Content-Type": mimeType,
          "Content-Length": fileSize,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
        });

        fs.createReadStream(filePath).pipe(res);
        return true;
      }

      // Procesar petición de rango para streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validar rango solicitado
      if (isNaN(start) || start >= fileSize) {
        return this.sendError(
          res,
          416,
          "Rango no satisfactorio",
          "El rango solicitado no es válido"
        );
      }

      // Ajustar el fin si es necesario
      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;

      console.log(
        `Streaming con rango: ${start}-${end}/${fileSize} (${chunkSize} bytes)`
      );

      // Enviar respuesta parcial
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
        "Cache-Control": "no-cache",
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
      return true;
    } catch (error) {
      console.error(`Error en el streaming: ${error.message}`);

      // Si aún no se ha enviado respuesta, enviar error
      if (!res.headersSent) {
        return this.sendError(
          res,
          500,
          "Error interno",
          "Error al procesar la solicitud de streaming"
        );
      }

      return false;
    }
  }

  /**
   * Registrar visualización de un elemento
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del elemento
   * @returns {Promise<void>}
   */
  async recordWatching(userId, mediaId) {
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

      // Emitir evento
      eventBus.emitEvent("media:watched", { userId, mediaId });
    } catch (error) {
      console.warn(`Error al registrar visualización: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determina el tipo MIME basado en la extensión del archivo
   * @param {string} filePath - Ruta del archivo
   * @returns {string} - Tipo MIME
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.mimeTypes[ext] || "application/octet-stream";
  }

  /**
   * Envía una respuesta de error
   * @param {Object} res - Objeto de respuesta Express
   * @param {number} status - Código de estado HTTP
   * @param {string} title - Título del error
   * @param {string} message - Mensaje detallado
   * @returns {boolean} - false para indicar error
   */
  sendError(res, status, title, message) {
    console.error(`Error ${status}: ${title} - ${message}`);

    if (!res.headersSent) {
      res.status(status).json({
        error: title,
        message: message,
      });
    }

    return false;
  }

  /**
   * Obtener información de opciones de streaming disponibles
   * @param {number} mediaId - ID del elemento
   * @param {string} token - Token de autenticación para URLs
   * @returns {Promise<Object>} - Información de streaming
   */
  async getStreamingOptions(mediaId, token) {
    // Obtener información del medio
    const mediaItem = await mediaRepository.findById(mediaId);

    if (!mediaItem) {
      throw new Error("Elemento multimedia no encontrado");
    }

    // Normalizar la ruta del archivo
    const filePath = mediaItem.file_path
      ? mediaItem.file_path.replace(/\\/g, "/")
      : null;

    // Verificar si hay versión HLS disponible
    let hlsAvailable = false;
    let hlsPath = null;

    if (filePath) {
      const fileName = path.basename(filePath, path.extname(filePath));
      const hlsDir = path.join(
        process.cwd(),
        "data-storage/transcoded",
        `${fileName}_hls`
      );
      const masterPlaylist = path.join(hlsDir, "master.m3u8");

      hlsAvailable = fs.existsSync(masterPlaylist);

      if (hlsAvailable) {
        hlsPath = `/data-storage/transcoded/${fileName}_hls/master.m3u8`;
      }
    }

    // Verificar archivo original
    let fileInfo = null;

    if (filePath) {
      try {
        const stats = await stat(filePath);
        fileInfo = {
          exists: true,
          size: stats.size,
          mimeType: this.getMimeType(filePath),
        };
      } catch (fsError) {
        fileInfo = { exists: false, error: fsError.code };
      }
    }

    // Construir respuesta con opciones de streaming
    const authParam = token ? `?auth=${token}` : "";

    return {
      mediaId,
      title: mediaItem.title,
      type: mediaItem.type,
      fileExists: fileInfo?.exists || false,
      fileSize: fileInfo?.size,
      options: {
        direct: {
          available: fileInfo?.exists || false,
          url: `/api/streaming/${mediaId}/stream${authParam}`,
          type: fileInfo?.mimeType || "video/mp4",
        },
        hls: {
          available: hlsAvailable,
          url: hlsAvailable ? `${hlsPath}${authParam}` : null,
          type: "application/vnd.apple.mpegurl",
        },
      },
    };
  }
}

module.exports = new StreamingService();
