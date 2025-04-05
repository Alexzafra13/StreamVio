// server/services/streamingService.js
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../config/database");

class StreamingService {
  /**
   * Genera un token para streaming de un medio específico
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   * @param {number} durationHours - Duración de validez del token en horas
   * @returns {Promise<object>} - Token y fecha de expiración
   */
  async generateStreamToken(userId, mediaId, durationHours = 4) {
    try {
      // Generar token aleatorio
      const token = crypto.randomBytes(32).toString("hex");

      // Calcular fecha de expiración
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

      // Guardar token en la base de datos
      await db.asyncRun(
        `INSERT INTO streaming_tokens (user_id, media_id, token, expires_at) 
         VALUES (?, ?, ?, datetime(?))`,
        [userId, mediaId, token, expiresAt.toISOString()]
      );

      // Limpiar tokens antiguos del mismo usuario para el mismo medio
      await this.cleanupOldTokens(userId, mediaId);

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
      // Verificar token en la base de datos
      const tokenRecord = await db.asyncGet(
        `SELECT * FROM streaming_tokens 
         WHERE token = ? AND media_id = ? AND expires_at > datetime('now')`,
        [token, mediaId]
      );

      return tokenRecord || null;
    } catch (error) {
      console.error("Error al verificar token de streaming:", error);
      return null;
    }
  }

  /**
   * Elimina tokens antiguos del mismo usuario para el mismo medio
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   */
  async cleanupOldTokens(userId, mediaId) {
    try {
      // Mantener solo los 2 tokens más recientes por usuario y medio
      await db.asyncRun(
        `DELETE FROM streaming_tokens 
         WHERE user_id = ? AND media_id = ? 
         AND id NOT IN (
           SELECT id FROM streaming_tokens 
           WHERE user_id = ? AND media_id = ? 
           ORDER BY created_at DESC LIMIT 2
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
   * Obtiene información de un archivo de video para streaming
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<object>} - Información del archivo
   */
  async getFileInfo(filePath) {
    return new Promise((resolve, reject) => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          return reject(err);
        }

        const fileName = path.basename(filePath);
        const fileExt = path.extname(filePath).toLowerCase();
        const mimeType = this.getMimeType(fileExt);

        resolve({
          path: filePath,
          size: stats.size,
          name: fileName,
          mimeType,
          lastModified: stats.mtime,
        });
      });
    });
  }

  /**
   * Determina el tipo MIME basado en la extensión del archivo
   * @param {string} ext - Extensión del archivo
   * @returns {string} - Tipo MIME
   */
  getMimeType(ext) {
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

  /**
   * Registra el inicio de una visualización
   * @param {number} userId - ID del usuario
   * @param {number} mediaId - ID del medio
   */
  async recordViewStart(userId, mediaId) {
    try {
      // Verificar si ya existe un registro para este usuario y medio
      const existingRecord = await db.asyncGet(
        "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
        [userId, mediaId]
      );

      if (existingRecord) {
        // Actualizar registro existente
        await db.asyncRun(
          "UPDATE watch_history SET watched_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existingRecord.id]
        );
      } else {
        // Crear nuevo registro
        await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id) VALUES (?, ?)",
          [userId, mediaId]
        );
      }
    } catch (error) {
      console.error("Error al registrar visualización:", error);
      // No lanzar error para no interrumpir el streaming
    }
  }
}

module.exports = new StreamingService();
