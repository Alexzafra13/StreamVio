// server/utils/security.js
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logger = require("./logger");
const environment = require("../config/environment");
const { UnauthorizedError, InternalServerError } = require("./errors");

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("Security");

/**
 * Clase para gestión de operaciones de seguridad
 */
class SecurityUtils {
  /**
   * Genera un hash para una contraseña
   * @param {string} password - Contraseña a hashear
   * @param {number} saltRounds - Rondas de salt para bcrypt (default: 10)
   * @returns {Promise<string>} - Hash de la contraseña
   */
  static async hashPassword(password, saltRounds = 10) {
    try {
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      log.error("Error al hashear contraseña:", { error });
      throw new InternalServerError(
        "Error al procesar la contraseña",
        "PASSWORD_HASH_ERROR"
      );
    }
  }

  /**
   * Verifica si una contraseña coincide con su hash
   * @param {string} password - Contraseña a verificar
   * @param {string} hash - Hash almacenado
   * @returns {Promise<boolean>} - true si coincide
   */
  static async comparePassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      log.error("Error al comparar contraseña:", { error });
      throw new InternalServerError(
        "Error al verificar la contraseña",
        "PASSWORD_VERIFY_ERROR"
      );
    }
  }

  /**
   * Genera un token JWT
   * @param {Object} payload - Datos a incluir en el token
   * @param {Object} options - Opciones para el token
   * @returns {string} - Token JWT generado
   */
  static generateJWT(payload, options = {}) {
    try {
      const { expiresIn = environment.JWT_EXPIRY } = options;
      return jwt.sign(payload, environment.JWT_SECRET, { expiresIn });
    } catch (error) {
      log.error("Error al generar token JWT:", { error });
      throw new InternalServerError(
        "Error al generar token de autenticación",
        "JWT_GENERATION_ERROR"
      );
    }
  }

  /**
   * Verifica y decodifica un token JWT
   * @param {string} token - Token JWT a verificar
   * @returns {Object} - Payload decodificado
   */
  static verifyJWT(token) {
    try {
      return jwt.verify(token, environment.JWT_SECRET);
    } catch (error) {
      log.debug("Error al verificar token JWT:", { error });

      if (error.name === "TokenExpiredError") {
        throw new UnauthorizedError("El token ha expirado", "TOKEN_EXPIRED");
      } else if (error.name === "JsonWebTokenError") {
        throw new UnauthorizedError("Token inválido", "INVALID_TOKEN");
      }

      throw new UnauthorizedError(
        "Error al verificar el token",
        "TOKEN_VERIFICATION_ERROR"
      );
    }
  }

  /**
   * Genera un string aleatorio
   * @param {number} length - Longitud del string (default: 16)
   * @returns {string} - String aleatorio
   */
  static generateRandomString(length = 16) {
    try {
      return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);
    } catch (error) {
      log.error("Error al generar string aleatorio:", { error });
      throw new InternalServerError(
        "Error al generar datos aleatorios",
        "RANDOM_GENERATION_ERROR"
      );
    }
  }

  /**
   * Genera un código de invitación
   * @param {number} length - Longitud del código (default: 8)
   * @returns {string} - Código de invitación
   */
  static generateInvitationCode(length = 8) {
    try {
      // Generar un código más legible usando solo ciertos caracteres
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";

      const randomValues = crypto.randomBytes(length);

      for (let i = 0; i < length; i++) {
        code += chars[randomValues[i] % chars.length];
      }

      return code;
    } catch (error) {
      log.error("Error al generar código de invitación:", { error });
      throw new InternalServerError(
        "Error al generar código",
        "INVITATION_CODE_ERROR"
      );
    }
  }

  /**
   * Calcula un hash md5 de una cadena
   * @param {string} input - Cadena de entrada
   * @returns {string} - Hash md5
   */
  static md5(input) {
    return crypto.createHash("md5").update(input).digest("hex");
  }

  /**
   * Calcula un hash sha256 de una cadena
   * @param {string} input - Cadena de entrada
   * @returns {string} - Hash sha256
   */
  static sha256(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
  }

  /**
   * Encripta un texto con AES-256
   * @param {string} text - Texto a encriptar
   * @param {string} key - Clave de encriptación (debe ser de 32 bytes para AES-256)
   * @returns {string} - Texto encriptado en formato hex
   */
  static encrypt(text, key) {
    try {
      // Generar un IV aleatorio
      const iv = crypto.randomBytes(16);

      // Crear cifrador
      const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key), iv);

      // Encriptar
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Devolver IV + texto encriptado
      return iv.toString("hex") + ":" + encrypted;
    } catch (error) {
      log.error("Error al encriptar datos:", { error });
      throw new InternalServerError(
        "Error al encriptar datos",
        "ENCRYPTION_ERROR"
      );
    }
  }

  /**
   * Desencripta un texto con AES-256
   * @param {string} encryptedText - Texto encriptado (formato: iv:encrypted)
   * @param {string} key - Clave de encriptación (debe ser de 32 bytes para AES-256)
   * @returns {string} - Texto desencriptado
   */
  static decrypt(encryptedText, key) {
    try {
      // Separar IV y texto encriptado
      const parts = encryptedText.split(":");
      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];

      // Crear descifrador
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        Buffer.from(key),
        iv
      );

      // Desencriptar
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      log.error("Error al desencriptar datos:", { error });
      throw new InternalServerError(
        "Error al desencriptar datos",
        "DECRYPTION_ERROR"
      );
    }
  }

  /**
   * Sanitiza una cadena para prevenir inyección
   * @param {string} input - Cadena a sanitizar
   * @returns {string} - Cadena sanitizada
   */
  static sanitizeString(input) {
    if (!input) return "";

    // Eliminar caracteres potencialmente peligrosos
    return String(input).replace(/[&<>"'`=/\\]/g, (match) => {
      const chars = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "`": "&#x60;",
        "=": "&#x3D;",
        "/": "&#x2F;",
        "\\": "&#x5C;",
      };
      return chars[match];
    });
  }

  /**
   * Valida un patrón de contraseña segura
   * @param {string} password - Contraseña a validar
   * @returns {Object} - Resultado de la validación
   */
  static validatePasswordStrength(password) {
    const result = {
      isValid: false,
      score: 0,
      errors: [],
    };

    if (!password) {
      result.errors.push("La contraseña es requerida");
      return result;
    }

    // Verificar longitud mínima
    if (password.length < 8) {
      result.errors.push("La contraseña debe tener al menos 8 caracteres");
    } else {
      result.score += 1;
    }

    // Verificar presencia de números
    if (!/\d/.test(password)) {
      result.errors.push("La contraseña debe incluir al menos un número");
    } else {
      result.score += 1;
    }

    // Verificar presencia de letras minúsculas
    if (!/[a-z]/.test(password)) {
      result.errors.push(
        "La contraseña debe incluir al menos una letra minúscula"
      );
    } else {
      result.score += 1;
    }

    // Verificar presencia de letras mayúsculas
    if (!/[A-Z]/.test(password)) {
      result.errors.push(
        "La contraseña debe incluir al menos una letra mayúscula"
      );
    } else {
      result.score += 1;
    }

    // Verificar presencia de caracteres especiales
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      result.errors.push(
        "La contraseña debe incluir al menos un carácter especial"
      );
    } else {
      result.score += 1;
    }

    // Determinar validez según puntuación
    result.isValid = result.score >= 3;

    return result;
  }

  /**
   * Genera un token seguro para restablecer contraseña
   * @returns {string} - Token para restablecimiento
   */
  static generateResetToken() {
    return this.generateRandomString(32);
  }

  /**
   * Saniza una ruta para prevenir directory traversal
   * @param {string} path - Ruta a sanitizar
   * @returns {string} - Ruta sanitizada
   */
  static sanitizePath(path) {
    if (!path) return "";

    // Eliminar caracteres peligrosos y prevenir directory traversal
    return String(path)
      .replace(/\.\./g, "") // Eliminar ..
      .replace(/\/\//g, "/") // Eliminar //
      .replace(/[<>:"|?*&]/g, ""); // Eliminar caracteres inválidos en rutas
  }
}

module.exports = SecurityUtils;
