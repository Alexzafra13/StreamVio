// server/services/streamingService.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const db = require("../config/database");
const settings = require("../config/settings");
const authService = require("./authService");

// Promisificar operaciones de fs
const stat = promisify(fs.stat);
const access = promisify(fs.access);

/**
 * Servicio unificado para streaming de archivos multimedia
 */
class StreamingService {
  constructor() {
    // Configuración por defecto
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

    // Directorio para thumbnails
    this.thumbnailsDir = path.join(__dirname, "../data/thumbnails");
  }

  /**
   * Maneja una solicitud de streaming
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {number} mediaId - ID del medio a transmitir
   * @param {Object} userData - Datos del usuario autenticado
   */
  async handleStreamRequest(req, res, mediaId, userData) {
    try {
      // 1. Obtener información del medio desde la base de datos
      const mediaItem = await this.getMediaItem(mediaId);
      if (!mediaItem) {
        return this.sendError(
          res,
          404,
          "Medio no encontrado",
          "El elemento multimedia solicitado no existe"
        );
      }

      // 2. Verificar permisos de acceso utilizando el servicio de autenticación
      const hasAccess = await this.checkAccess(
        userData.id,
        mediaId,
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
      const filePath = mediaItem.file_path.replace(/\\/g, "/");

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
      this.recordViewing(userData.id, mediaId).catch((err) => {
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
        return;
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
    } catch (error) {
      console.error(`Error en el streaming: ${error.message}`);
      return this.sendError(
        res,
        500,
        "Error interno",
        "Error al procesar la solicitud de streaming"
      );
    }
  }

  /**
   * Obtiene información del medio desde la base de datos
   * @param {number} mediaId - ID del medio
   * @returns {Promise<Object|null>} - Información del medio o null si no existe
   */
  async getMediaItem(mediaId) {
    try {
      return await db.asyncGet("SELECT * FROM media_items WHERE id = ?", [
        mediaId,
      ]);
    } catch (error) {
      console.error(
        `Error al obtener información del medio ${mediaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Verifica si un usuario tiene acceso a un medio
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   * @param {number|null} libraryId - ID de la biblioteca
   * @returns {Promise<boolean>} - true si tiene acceso, false en caso contrario
   */
  async checkAccess(userId, mediaId, libraryId) {
    try {
      // Si el medio no pertenece a una biblioteca, cualquier usuario autenticado tiene acceso
      if (!libraryId) {
        return true;
      }

      // Usar el servicio de autenticación para verificar acceso a la biblioteca
      return await authService.hasLibraryAccess(userId, libraryId);
    } catch (error) {
      console.error(
        `Error al verificar acceso para usuario ${userId}, medio ${mediaId}:`,
        error
      );
      return false; // En caso de error, denegar acceso por seguridad
    }
  }

  /**
   * Registra una visualización en el historial
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   */
  async recordViewing(userId, mediaId) {
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
    } catch (error) {
      console.warn(`Error al registrar visualización: ${error.message}`);

      // Si la tabla no existe, intentar crearla
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
            "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, 0, 0)",
            [userId, mediaId]
          );
        } catch (err) {
          console.error(`Error al crear tabla watch_history: ${err.message}`);
        }
      }
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
   * Genera una miniatura para un archivo multimedia
   * @param {string} filePath - Ruta del archivo de origen
   * @param {number} timeOffset - Offset en segundos para extraer el frame en videos
   * @returns {Promise<string>} - Ruta de la miniatura generada
   */
  async generateThumbnail(filePath, timeOffset = 5) {
    // Implementación del método de generación de miniaturas
    // Esta implementación sería necesaria para el servicio de transcoding
    // pero no es esencial para el streaming básico
    return "path/to/thumbnail.jpg";
  }
}

// Exportar instancia única del servicio
module.exports = new StreamingService();
