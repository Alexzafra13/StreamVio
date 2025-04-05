// server/services/streamingService.js
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../config/database");
const { promisify } = require("util");

// Promisificar operaciones de sistema de archivos
const stat = promisify(fs.stat);
const access = promisify(fs.access);

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
   * Genera un token para streaming de un medio específico
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   * @param {number} durationHours - Duración de validez del token en horas
   * @returns {Promise<object>} - Token y fecha de expiración
   */
  async generateStreamToken(userId, mediaId, durationHours = null) {
    try {
      if (!userId || !mediaId) {
        throw new Error("Se requieren userId y mediaId para generar un token");
      }

      // Usar duración predeterminada si no se especifica
      const tokenDuration = durationHours || this.tokenExpiry;

      // Generar token aleatorio seguro (64 caracteres hexadecimales = 32 bytes)
      const token = crypto.randomBytes(32).toString("hex");

      // Calcular fecha de expiración
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + tokenDuration);

      // Verificar si el usuario tiene acceso al medio antes de generar el token
      const hasAccess = await this.checkUserAccessToMedia(userId, mediaId);
      if (!hasAccess) {
        throw new Error(
          "El usuario no tiene permiso para acceder a este contenido"
        );
      }

      // Guardar token en la base de datos
      await db.asyncRun(
        `INSERT INTO streaming_tokens (user_id, media_id, token, expires_at) 
         VALUES (?, ?, ?, datetime(?))`,
        [userId, mediaId, token, expiresAt.toISOString()]
      );

      // Limpiar tokens antiguos del mismo usuario para el mismo medio
      await this.cleanupOldTokens(userId, mediaId);

      // Registrar la generación de token en log
      console.log(
        `Token de streaming generado para usuario ${userId}, medio ${mediaId}, expira en ${tokenDuration}h`
      );

      return {
        token,
        expiresAt,
      };
    } catch (error) {
      console.error("Error al generar token de streaming:", error);
      throw error;
    }
  }

  /**
   * Verifica si un token de streaming es válido
   * @param {string} token - Token a verificar
   * @param {number} mediaId - ID del medio
   * @returns {Promise<object|null>} - Información del token o null si no es válido
   */
  async verifyStreamToken(token, mediaId) {
    try {
      if (!token || !mediaId) {
        console.log("Token o mediaId no proporcionados");
        return null;
      }

      // Verificar token en la base de datos
      const tokenRecord = await db.asyncGet(
        `SELECT * FROM streaming_tokens 
         WHERE token = ? AND media_id = ? AND expires_at > datetime('now')`,
        [token, mediaId]
      );

      if (!tokenRecord) {
        console.log(`Token no válido o expirado para mediaId ${mediaId}`);
        return null;
      }

      return tokenRecord;
    } catch (error) {
      console.error("Error al verificar token de streaming:", error);
      return null;
    }
  }

  /**
   * Verifica si un usuario tiene permiso para acceder a un medio
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   * @returns {Promise<boolean>} - true si tiene acceso, false en caso contrario
   */
  async checkUserAccessToMedia(userId, mediaId) {
    try {
      // Primero verificar si el usuario es administrador
      const isAdmin = await this.isUserAdmin(userId);
      if (isAdmin) {
        return true; // Los administradores tienen acceso a todo
      }

      // Obtener información del medio
      const mediaItem = await db.asyncGet(
        "SELECT library_id FROM media_items WHERE id = ?",
        [mediaId]
      );

      if (!mediaItem) {
        return false; // El medio no existe
      }

      // Por ahora, todos los usuarios tienen acceso a todos los medios
      // Aquí se podría implementar una verificación de permisos más detallada
      // basada en bibliotecas o reglas de acceso
      return true;
    } catch (error) {
      console.error(
        `Error al verificar acceso de usuario ${userId} a medio ${mediaId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Verifica si un usuario es administrador
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} - true si es administrador, false en caso contrario
   */
  async isUserAdmin(userId) {
    try {
      const user = await db.asyncGet(
        "SELECT is_admin FROM users WHERE id = ?",
        [userId]
      );

      return user && user.is_admin === 1;
    } catch (error) {
      console.error(
        `Error al verificar si el usuario ${userId} es administrador:`,
        error
      );
      return false;
    }
  }

  /**
   * Elimina tokens antiguos del mismo usuario para el mismo medio
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   */
  async cleanupOldTokens(userId, mediaId) {
    try {
      // Mantener solo los 3 tokens más recientes por usuario y medio
      await db.asyncRun(
        `DELETE FROM streaming_tokens 
         WHERE user_id = ? AND media_id = ? 
         AND id NOT IN (
           SELECT id FROM streaming_tokens 
           WHERE user_id = ? AND media_id = ? 
           ORDER BY created_at DESC LIMIT 3
         )`,
        [userId, mediaId, userId, mediaId]
      );

      // Eliminar tokens expirados globalmente (puede ejecutarse de forma periódica)
      await db.asyncRun(
        `DELETE FROM streaming_tokens WHERE expires_at < datetime('now')`
      );
    } catch (error) {
      console.error("Error al limpiar tokens antiguos:", error);
    }
  }

  /**
   * Realiza limpieza periódica de tokens expirados
   * Puede llamarse desde un trabajo programado
   */
  async periodicTokenCleanup() {
    try {
      // Eliminar tokens que han expirado
      const result = await db.asyncRun(
        `DELETE FROM streaming_tokens WHERE expires_at < datetime('now')`
      );

      if (result.changes > 0) {
        console.log(
          `Limpieza de tokens: ${result.changes} tokens expirados eliminados`
        );
      }

      return result.changes;
    } catch (error) {
      console.error("Error durante limpieza periódica de tokens:", error);
      throw error;
    }
  }

  /**
   * Obtiene información de un archivo para streaming
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<object>} - Información del archivo
   */
  async getFileInfo(filePath) {
    try {
      // Verificar que el archivo existe y es accesible
      await access(filePath, fs.constants.R_OK);

      // Obtener estadísticas del archivo
      const stats = await stat(filePath);

      const fileName = path.basename(filePath);
      const fileExt = path.extname(filePath).toLowerCase();
      const mimeType = this.getMimeType(fileExt);

      return {
        path: filePath,
        size: stats.size,
        name: fileName,
        mimeType,
        lastModified: stats.mtime,
        exists: true,
        readable: true,
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        // Archivo no encontrado
        return {
          path: filePath,
          exists: false,
          error: "FILE_NOT_FOUND",
          message: "El archivo no existe",
        };
      } else if (error.code === "EACCES") {
        // Sin permiso para acceder al archivo
        return {
          path: filePath,
          exists: true,
          readable: false,
          error: "ACCESS_DENIED",
          message: "Sin permisos para acceder al archivo",
        };
      } else {
        // Otro error
        return {
          path: filePath,
          error: "UNKNOWN_ERROR",
          message: error.message,
        };
      }
    }
  }

  /**
   * Determina el tipo MIME basado en la extensión del archivo
   * @param {string} ext - Extensión del archivo
   * @returns {string} - Tipo MIME
   */
  getMimeType(ext) {
    return (
      this.defaultStreamSettings.allowedMimeTypes[ext] ||
      "application/octet-stream"
    );
  }

  /**
   * Registra el inicio de una visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   * @returns {Promise<object>} - Información del registro
   */
  async recordViewStart(userId, mediaId) {
    try {
      // Verificar si ya existe un registro para este usuario y medio
      const existingRecord = await db.asyncGet(
        "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
        [userId, mediaId]
      );

      let historyId;

      if (existingRecord) {
        // Actualizar registro existente
        await db.asyncRun(
          "UPDATE watch_history SET watched_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existingRecord.id]
        );
        historyId = existingRecord.id;
      } else {
        // Crear nuevo registro
        const result = await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id) VALUES (?, ?)",
          [userId, mediaId]
        );
        historyId = result.lastID;
      }

      return {
        id: historyId,
        userId,
        mediaId,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error al registrar visualización:", error);
      // No lanzar error para no interrumpir el streaming
      return null;
    }
  }

  /**
   * Actualiza el progreso de visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   * @param {number} position - Posición actual en segundos
   * @param {boolean} completed - Si se ha completado la visualización
   * @returns {Promise<object>} - Información actualizada
   */
  async updateProgress(userId, mediaId, position, completed = false) {
    try {
      // Verificar si ya existe un registro para este usuario y medio
      const existingRecord = await db.asyncGet(
        "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
        [userId, mediaId]
      );

      if (existingRecord) {
        // Actualizar registro existente
        await db.asyncRun(
          "UPDATE watch_history SET position = ?, completed = ?, watched_at = CURRENT_TIMESTAMP WHERE id = ?",
          [position, completed ? 1 : 0, existingRecord.id]
        );

        return {
          id: existingRecord.id,
          position,
          completed,
          updated: true,
        };
      } else {
        // Crear nuevo registro con posición
        const result = await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, ?, ?)",
          [userId, mediaId, position, completed ? 1 : 0]
        );

        return {
          id: result.lastID,
          position,
          completed,
          created: true,
        };
      }
    } catch (error) {
      console.error(
        `Error al actualizar progreso para usuario ${userId}, medio ${mediaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene el progreso de visualización de un usuario para un medio
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   * @returns {Promise<object|null>} - Información del progreso o null si no existe
   */
  async getProgress(userId, mediaId) {
    try {
      const record = await db.asyncGet(
        "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
        [userId, mediaId]
      );

      if (!record) {
        return null;
      }

      return {
        id: record.id,
        position: record.position || 0,
        completed: record.completed === 1,
        lastWatched: record.watched_at,
      };
    } catch (error) {
      console.error(
        `Error al obtener progreso para usuario ${userId}, medio ${mediaId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Crea un stream para enviar el archivo al cliente
   * @param {string} filePath - Ruta del archivo
   * @param {object} range - Información de rango (opcional)
   * @returns {Promise<object>} - Objeto con stream y headers
   */
  async createFileStream(filePath, range = null) {
    try {
      // Obtener información del archivo
      const fileInfo = await this.getFileInfo(filePath);

      if (!fileInfo.exists) {
        throw new Error("El archivo no existe");
      }

      if (!fileInfo.readable) {
        throw new Error("No se puede leer el archivo");
      }

      const { size, mimeType } = fileInfo;

      // Preparar headers base
      const headers = {
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      };

      let statusCode = 200;
      let start = 0;
      let end = size - 1;

      // Procesar rango si se proporciona
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");

        // Obtener inicio y fin del rango
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : size - 1;

        // Validar rango
        if (isNaN(start)) {
          start = 0;
        }

        if (isNaN(end)) {
          end = size - 1;
        }

        // Limitar el tamaño del chunk a un valor razonable
        if (end - start >= this.defaultStreamSettings.chunkSize) {
          end = start + this.defaultStreamSettings.chunkSize - 1;
        }

        // Verificar que el rango sea válido
        if (start >= size) {
          throw new Error("Rango solicitado no satisfactible");
        }

        // Ajustar headers para respuesta parcial
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
        headers["Content-Length"] = end - start + 1;
        statusCode = 206; // Partial Content
      } else {
        // Para respuesta completa
        headers["Content-Length"] = size;
      }

      // Crear stream
      const stream = fs.createReadStream(filePath, { start, end });

      return {
        stream,
        headers,
        statusCode,
        fileInfo,
      };
    } catch (error) {
      console.error(
        `Error al crear stream para el archivo ${filePath}:`,
        error
      );
      throw error;
    }
  }
}

module.exports = new StreamingService();
