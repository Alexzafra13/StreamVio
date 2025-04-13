// server/data/models/Setting.js
const db = require("../db");

/**
 * Modelo para configuraciones del sistema
 */
class Setting {
  /**
   * Obtener el valor de una configuración
   * @param {string} key - Clave de la configuración
   * @param {any} defaultValue - Valor por defecto si no existe
   * @returns {Promise<any>} - Valor de la configuración
   */
  static async get(key, defaultValue = null) {
    const setting = await db.asyncGet(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );

    if (!setting) {
      return defaultValue;
    }

    // Intentar convertir a tipos de datos apropiados
    try {
      // Si es un número
      if (!isNaN(setting.value) && setting.value !== "") {
        if (setting.value.includes(".")) {
          return parseFloat(setting.value);
        } else {
          return parseInt(setting.value, 10);
        }
      }

      // Si es un booleano
      if (setting.value === "true") return true;
      if (setting.value === "false") return false;

      // Si es un objeto JSON
      if (setting.value.startsWith("{") || setting.value.startsWith("[")) {
        return JSON.parse(setting.value);
      }

      // Si no es ninguno de los anteriores, devolver como string
      return setting.value;
    } catch (error) {
      // En caso de error, devolver el valor sin procesar
      return setting.value;
    }
  }

  /**
   * Establecer una configuración
   * @param {string} key - Clave de la configuración
   * @param {any} value - Valor a establecer
   * @param {string} description - Descripción de la configuración (opcional)
   * @returns {Promise<boolean>} - true si se estableció correctamente
   */
  static async set(key, value, description = null) {
    // Convertir valor a string para almacenamiento
    let stringValue;

    if (value === null || value === undefined) {
      stringValue = "";
    } else if (typeof value === "object") {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    // Verificar si la configuración ya existe
    const existing = await db.asyncGet(
      "SELECT id FROM settings WHERE key = ?",
      [key]
    );

    if (existing) {
      // Actualizar configuración existente
      const result = await db.asyncRun(
        "UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
        [stringValue, key]
      );

      return result && result.changes > 0;
    } else {
      // Crear nueva configuración
      const result = await db.asyncRun(
        "INSERT INTO settings (key, value, description) VALUES (?, ?, ?)",
        [key, stringValue, description]
      );

      return result && result.lastID > 0;
    }
  }

  /**
   * Eliminar una configuración
   * @param {string} key - Clave de la configuración
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  static async delete(key) {
    const result = await db.asyncRun("DELETE FROM settings WHERE key = ?", [
      key,
    ]);
    return result && result.changes > 0;
  }

  /**
   * Obtener todas las configuraciones
   * @returns {Promise<Array>} - Lista de configuraciones
   */
  static async getAll() {
    return db.asyncAll("SELECT * FROM settings ORDER BY key ASC");
  }

  /**
   * Obtener configuraciones por prefijo
   * @param {string} prefix - Prefijo de las claves a buscar
   * @returns {Promise<Array>} - Lista de configuraciones que coinciden con el prefijo
   */
  static async getByPrefix(prefix) {
    return db.asyncAll(
      "SELECT * FROM settings WHERE key LIKE ? ORDER BY key ASC",
      [`${prefix}%`]
    );
  }

  /**
   * Establecer múltiples configuraciones a la vez
   * @param {Object} settings - Objeto con pares clave-valor
   * @returns {Promise<boolean>} - true si todas se establecieron correctamente
   */
  static async setBulk(settings) {
    // Iniciar transacción
    await db.asyncRun("BEGIN TRANSACTION");

    try {
      for (const [key, value] of Object.entries(settings)) {
        // Si es un objeto con valor y descripción
        if (value && typeof value === "object" && "value" in value) {
          await this.set(key, value.value, value.description);
        } else {
          // Si es solo un valor
          await this.set(key, value);
        }
      }

      // Confirmar transacción
      await db.asyncRun("COMMIT");
      return true;
    } catch (error) {
      // Revertir cambios en caso de error
      await db.asyncRun("ROLLBACK");
      throw error;
    }
  }

  /**
   * Cargar los valores por defecto
   * @returns {Promise<boolean>} - true si se cargaron correctamente
   */
  static async loadDefaults() {
    const defaults = {
      transcoding_enabled: {
        value: true,
        description: "Habilitar o deshabilitar el transcodificado automático",
      },
      default_transcoding_format: {
        value: "mp4",
        description: "Formato por defecto para transcodificación",
      },
      max_bitrate: {
        value: 8000,
        description: "Bitrate máximo para streaming en kbps",
      },
      scan_interval: {
        value: 3600,
        description: "Intervalo entre escaneos automáticos en segundos",
      },
      thumbnail_generation: {
        value: true,
        description: "Generar miniaturas automáticamente",
      },
      metadata_language: {
        value: "es",
        description: "Idioma preferido para metadatos",
      },
      max_users: {
        value: 10,
        description: "Número máximo de usuarios permitidos",
      },
      enable_logs: {
        value: true,
        description: "Habilitar registro de eventos",
      },
      theme: {
        value: "dark",
        description: "Tema visual por defecto",
      },
      session_expiry: {
        value: "7d",
        description: "Tiempo de expiración de sesiones",
      },
      allow_registration: {
        value: false,
        description: "Permitir registro público (sin invitación)",
      },
      app_name: {
        value: "StreamVio",
        description: "Nombre de la aplicación",
      },
    };

    return this.setBulk(defaults);
  }

  /**
   * Verificar si una configuración existe
   * @param {string} key - Clave de la configuración
   * @returns {Promise<boolean>} - true si existe
   */
  static async exists(key) {
    const result = await db.asyncGet("SELECT 1 FROM settings WHERE key = ?", [
      key,
    ]);
    return !!result;
  }

  /**
   * Reiniciar una configuración a su valor por defecto
   * @param {string} key - Clave de la configuración
   * @returns {Promise<boolean>} - true si se reinició correctamente
   */
  static async reset(key) {
    // Determinar el valor por defecto según la clave
    const defaults = {
      transcoding_enabled: true,
      default_transcoding_format: "mp4",
      max_bitrate: 8000,
      scan_interval: 3600,
      thumbnail_generation: true,
      metadata_language: "es",
      max_users: 10,
      enable_logs: true,
      theme: "dark",
      session_expiry: "7d",
      allow_registration: false,
      app_name: "StreamVio",
    };

    // Si la clave no tiene un valor por defecto conocido, eliminarla
    if (!(key in defaults)) {
      return this.delete(key);
    }

    // Establecer el valor por defecto
    return this.set(key, defaults[key]);
  }
}

module.exports = Setting;
