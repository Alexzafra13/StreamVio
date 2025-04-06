// server/services/streamingTokenService.js
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const settings = require("../config/settings");

/**
 * Servicio para gestionar tokens de streaming específicos
 * Estos tokens son de corta duración y específicos para cada recurso
 */
class StreamingTokenService {
  constructor() {
    // Clave secreta para tokens de streaming (diferente de la JWT principal)
    this.tokenSecret =
      process.env.STREAMING_TOKEN_SECRET || settings.jwtSecret + "_streaming";
    // Duración del token en segundos (15 minutos por defecto)
    this.tokenDuration =
      parseInt(process.env.STREAMING_TOKEN_DURATION) || 15 * 60;
    // Umbral para renovación automática (2 minutos antes de caducar)
    this.renewalThreshold =
      parseInt(process.env.STREAMING_RENEWAL_THRESHOLD) || 2 * 60;
  }

  /**
   * Genera un nuevo token de streaming
   * @param {Object} data - Datos para el token
   * @param {number} data.userId - ID del usuario
   * @param {number} data.mediaId - ID del medio
   * @returns {Promise<string>} Token generado
   */
  async generateToken(data) {
    try {
      // Validar datos requeridos
      if (!data.userId || !data.mediaId) {
        throw new Error(
          "userId y mediaId son requeridos para generar un token de streaming"
        );
      }

      // Generar un ID único para el token
      const tokenId = crypto.randomBytes(16).toString("hex");

      // Datos para el token
      const tokenData = {
        tid: tokenId, // Token ID único
        uid: data.userId, // User ID
        mid: data.mediaId, // Media ID
        ip: data.ip || null, // IP opcional para validación adicional
        iat: Math.floor(Date.now() / 1000), // Issued At (timestamp actual en segundos)
        exp: Math.floor(Date.now() / 1000) + this.tokenDuration, // Expiración
      };

      // Firmar el token con la clave secreta específica para streaming
      const token = jwt.sign(tokenData, this.tokenSecret);

      // Guardar el token en la base de datos para control y revocación
      await db.asyncRun(
        `INSERT INTO streaming_tokens 
         (token_id, user_id, media_id, ip_address, expires_at) 
         VALUES (?, ?, ?, ?, datetime(?, 'unixepoch'))`,
        [tokenId, data.userId, data.mediaId, data.ip || null, tokenData.exp]
      );

      console.log(
        `Token de streaming generado: ${tokenId} para usuario:${data.userId}, media:${data.mediaId}`
      );
      return token;
    } catch (error) {
      console.error("Error al generar token de streaming:", error);
      throw error;
    }
  }

  /**
   * Verifica un token de streaming
   * @param {string} token - Token a verificar
   * @returns {Promise<Object>} Datos del token si es válido
   */
  async verifyToken(token) {
    try {
      // Verificar firma del token
      const decoded = jwt.verify(token, this.tokenSecret);

      // Verificar si el token está en la base de datos y no ha sido revocado
      const tokenRecord = await db.asyncGet(
        `SELECT * FROM streaming_tokens 
         WHERE token_id = ? AND revoked = 0 AND expires_at > datetime('now')`,
        [decoded.tid]
      );

      if (!tokenRecord) {
        throw new Error("Token de streaming inválido, expirado o revocado");
      }

      // Verificar si el token está cerca de expirar (para renovación)
      const now = Math.floor(Date.now() / 1000);
      const needsRenewal = decoded.exp - now < this.renewalThreshold;

      return {
        isValid: true,
        data: decoded,
        needsRenewal,
      };
    } catch (error) {
      console.error("Error al verificar token de streaming:", error);

      // Devolver información detallada sobre el error
      return {
        isValid: false,
        error: error.message,
        code:
          error.name === "TokenExpiredError"
            ? "TOKEN_EXPIRED"
            : "TOKEN_INVALID",
      };
    }
  }

  /**
   * Renueva un token de streaming existente
   * @param {string} token - Token actual a renovar
   * @returns {Promise<string>} Nuevo token
   */
  async renewToken(token) {
    try {
      // Verificar el token actual (ignorando si ha expirado)
      const decoded = jwt.decode(token);

      if (!decoded || !decoded.tid) {
        throw new Error("Token inválido o malformado");
      }

      // Verificar si el token está en la base de datos
      const tokenRecord = await db.asyncGet(
        "SELECT * FROM streaming_tokens WHERE token_id = ? AND revoked = 0",
        [decoded.tid]
      );

      if (!tokenRecord) {
        throw new Error("Token no encontrado o revocado");
      }

      // Revocar el token actual
      await db.asyncRun(
        'UPDATE streaming_tokens SET revoked = 1, revoked_at = datetime("now") WHERE token_id = ?',
        [decoded.tid]
      );

      // Generar un nuevo token con los mismos datos pero nueva expiración
      return this.generateToken({
        userId: tokenRecord.user_id,
        mediaId: tokenRecord.media_id,
        ip: tokenRecord.ip_address,
      });
    } catch (error) {
      console.error("Error al renovar token de streaming:", error);
      throw error;
    }
  }

  /**
   * Revoca un token específico
   * @param {string} tokenId - ID del token a revocar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async revokeToken(tokenId) {
    try {
      await db.asyncRun(
        'UPDATE streaming_tokens SET revoked = 1, revoked_at = datetime("now") WHERE token_id = ?',
        [tokenId]
      );
      return true;
    } catch (error) {
      console.error("Error al revocar token de streaming:", error);
      return false;
    }
  }

  /**
   * Revoca todos los tokens de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<number>} Número de tokens revocados
   */
  async revokeAllUserTokens(userId) {
    try {
      const result = await db.asyncRun(
        'UPDATE streaming_tokens SET revoked = 1, revoked_at = datetime("now") WHERE user_id = ? AND revoked = 0',
        [userId]
      );
      return result.changes;
    } catch (error) {
      console.error("Error al revocar todos los tokens del usuario:", error);
      return 0;
    }
  }

  /**
   * Limpieza periódica de tokens expirados
   * @returns {Promise<number>} Número de tokens eliminados
   */
  async periodicTokenCleanup() {
    try {
      // Eliminar tokens expirados que tengan más de 1 día
      const result = await db.asyncRun(
        "DELETE FROM streaming_tokens WHERE expires_at < datetime('now', '-1 day')"
      );

      if (result.changes > 0) {
        console.log(`Limpieza periódica: ${result.changes} tokens eliminados`);
      }

      return result.changes;
    } catch (error) {
      console.error("Error en limpieza periódica de tokens:", error);
      return 0;
    }
  }
}

// Crear instancia del servicio
const streamingTokenService = new StreamingTokenService();

// Exportar la instancia
module.exports = streamingTokenService;
