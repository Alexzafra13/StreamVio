// server/services/streamingService.js - Versión optimizada
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const db = require("../config/database");
const settings = require("../config/settings");

// Convertir callbacks a promesas
const stat = promisify(fs.stat);
const access = promisify(fs.access);
const exists = async (path) => {
  try {
    await access(path, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Servicio optimizado para streaming de archivos multimedia
 * con soporte para autenticación y rangos de bytes
 */
class StreamingService {
  constructor() {
    // Configuración por defecto
    this.tokenExpiry = 4; // horas
    this.defaultStreamSettings = {
      cacheDuration: 60 * 60, // 1 hora en segundos
      chunkSize: 1024 * 1024, // 1MB
      allowedMimeTypes: {
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
      },
    };
  }

  /**
   * Procesa una solicitud de streaming
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {number} mediaId - ID del medio a transmitir
   * @param {Object} userData - Datos del usuario autenticado
   */
  async handleStreamRequest(req, res, mediaId, userData) {
    try {
      console.log(
        `Procesando solicitud de streaming para medio ${mediaId} por usuario ${userData.id}`
      );

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

      // 2. Verificar permisos de acceso (redundante ya que el middleware ya lo hace, pero por si acaso)
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
      const fileInfo = await this.getFileInfo(filePath);

      if (!fileInfo.exists) {
        return this.sendError(
          res,
          404,
          "Archivo no encontrado",
          "El archivo físico no existe en el sistema"
        );
      }

      if (!fileInfo.readable) {
        console.error(`Error de permisos en archivo: ${filePath}`);
        return this.sendError(
          res,
          500,
          "Error de permisos",
          "No se puede leer el archivo debido a permisos insuficientes"
        );
      }

      // 4. Registrar visualización en el historial (sin esperar la finalización)
      this.recordViewing(userData.id, mediaId).catch((err) => {
        console.warn(
          `Error al registrar visualización para usuario ${userData.id}, medio ${mediaId}:`,
          err
        );
      });

      // 5. Manejar la transmisión con soporte para rangos
      return await this.streamFile(req, res, filePath, fileInfo);
    } catch (error) {
      console.error("Error en solicitud de streaming:", error);
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
      const mediaItem = await db.asyncGet(
        "SELECT * FROM media_items WHERE id = ?",
        [mediaId]
      );
      return mediaItem;
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
   * @param {number|null} libraryId - ID de la biblioteca (si aplica)
   * @returns {Promise<boolean>} - true si tiene acceso, false en caso contrario
   */
  async checkAccess(userId, mediaId, libraryId) {
    try {
      // Verificar si el usuario es administrador (siempre tienen acceso)
      const user = await db.asyncGet(
        "SELECT is_admin FROM users WHERE id = ?",
        [userId]
      );
      if (user && user.is_admin === 1) {
        return true;
      }

      // Si el medio no pertenece a una biblioteca, cualquier usuario autenticado tiene acceso
      if (!libraryId) {
        return true;
      }

      // Verificar acceso específico a la biblioteca
      const access = await db.asyncGet(
        "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
        [userId, libraryId]
      );

      // Si hay un registro explícito, verificar valor
      if (access) {
        return access.has_access === 1;
      }

      // Por defecto, permitir acceso (comportamiento configurable)
      return true;
    } catch (error) {
      console.error(
        `Error al verificar acceso para usuario ${userId}, medio ${mediaId}:`,
        error
      );
      // En caso de error, permitir acceso para no bloquear contenido legítimo
      return true;
    }
  }

  /**
   * Obtiene información de un archivo
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<Object>} - Información del archivo
   */
  async getFileInfo(filePath) {
    try {
      const fileExists = await exists(filePath);
      if (!fileExists) {
        return { exists: false, path: filePath };
      }

      // Verificar permisos de lectura
      try {
        await access(filePath, fs.constants.R_OK);
      } catch (err) {
        return {
          exists: true,
          readable: false,
          path: filePath,
          error: "Sin permiso de lectura",
        };
      }

      // Obtener estadísticas del archivo
      const stats = await stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType =
        this.defaultStreamSettings.allowedMimeTypes[ext] ||
        "application/octet-stream";

      return {
        exists: true,
        readable: true,
        path: filePath,
        size: stats.size,
        mimeType,
        modified: stats.mtime,
        extension: ext,
      };
    } catch (error) {
      console.error(
        `Error al obtener información del archivo ${filePath}:`,
        error
      );
      return {
        exists: false,
        path: filePath,
        error: error.message,
      };
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
      console.warn(
        `Error al registrar visualización para usuario ${userId}, medio ${mediaId}:`,
        error
      );

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
          console.log("Tabla watch_history creada correctamente");

          // Intentar nuevamente la inserción
          await db.asyncRun(
            "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, 0, 0)",
            [userId, mediaId]
          );
        } catch (err) {
          console.error("Error al crear tabla watch_history:", err);
        }
      }
    }
  }

  /**
   * Transmite un archivo al cliente con soporte para rangos
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {string} filePath - Ruta del archivo a transmitir
   * @param {Object} fileInfo - Información del archivo
   */
  async streamFile(req, res, filePath, fileInfo) {
    try {
      const range = req.headers.range;
      const { size, mimeType } = fileInfo;

      // Preparar headers básicos
      const headers = {
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      };

      // Si no hay solicitud de rango, enviar archivo completo
      if (!range) {
        console.log(`Streaming completo: ${filePath} (${size} bytes)`);
        res.writeHead(200, {
          ...headers,
          "Content-Length": size,
        });

        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // Procesar solicitud de rango
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

      // Validar rango
      if (isNaN(start) || start >= size) {
        return this.sendError(
          res,
          416,
          "Rango no válido",
          "Requested Range Not Satisfiable"
        );
      }

      // Ajustar fin si es necesario
      const finalEnd = Math.min(end, size - 1);
      const chunkSize = finalEnd - start + 1;

      console.log(
        `Streaming con rango: ${start}-${finalEnd}/${size} (${chunkSize} bytes)`
      );

      // Enviar respuesta parcial
      res.writeHead(206, {
        ...headers,
        "Content-Range": `bytes ${start}-${finalEnd}/${size}`,
        "Content-Length": chunkSize,
      });

      fs.createReadStream(filePath, { start, end: finalEnd }).pipe(res);
    } catch (error) {
      console.error(`Error al transmitir ${filePath}:`, error);
      this.sendError(
        res,
        500,
        "Error de streaming",
        "Error al transmitir el archivo"
      );
    }
  }

  /**
   * Envía una respuesta de error al cliente
   * @param {Object} res - Objeto de respuesta Express
   * @param {number} status - Código de estado HTTP
   * @param {string} errorType - Tipo de error
   * @param {string} message - Mensaje de error
   */
  sendError(res, status, errorType, message) {
    console.error(`Error de streaming [${status}]: ${errorType} - ${message}`);

    if (!res.headersSent) {
      res.status(status).json({
        error: errorType,
        message: message,
      });
    }

    return false;
  }
}

// Exportar instancia única del servicio
const streamingService = new StreamingService();
module.exports = streamingService;
