// server/data/repositories/settingRepository.js
const db = require("../db");
const Setting = require("../models/Setting");

/**
 * Repositorio para operaciones con configuraciones del sistema
 */
class SettingRepository {
  /**
   * Obtener el valor de una configuración
   * @param {string} key - Clave de la configuración
   * @param {any} defaultValue - Valor por defecto si no existe
   * @returns {Promise<any>} - Valor de la configuración
   */
  async get(key, defaultValue = null) {
    return Setting.get(key, defaultValue);
  }

  /**
   * Establecer una configuración
   * @param {string} key - Clave de la configuración
   * @param {any} value - Valor a establecer
   * @param {string} description - Descripción de la configuración (opcional)
   * @returns {Promise<boolean>} - true si se estableció correctamente
   */
  async set(key, value, description = null) {
    return Setting.set(key, value, description);
  }

  /**
   * Eliminar una configuración
   * @param {string} key - Clave de la configuración
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async delete(key) {
    return Setting.delete(key);
  }

  /**
   * Obtener todas las configuraciones
   * @returns {Promise<Array>} - Lista de configuraciones
   */
  async getAll() {
    const settings = await Setting.getAll();

    // Procesar valores para devolverlos en su tipo correcto
    return settings.map((setting) => {
      try {
        // Intentar convertir el valor a su tipo adecuado
        let value = setting.value;

        // Si es un número
        if (!isNaN(value) && value !== "") {
          if (value.includes(".")) {
            value = parseFloat(value);
          } else {
            value = parseInt(value, 10);
          }
        }

        // Si es un booleano
        if (value === "true") value = true;
        if (value === "false") value = false;

        // Si es un objeto JSON
        if (
          typeof value === "string" &&
          (value.startsWith("{") || value.startsWith("["))
        ) {
          value = JSON.parse(value);
        }

        return {
          ...setting,
          value,
        };
      } catch (error) {
        return setting;
      }
    });
  }

  /**
   * Obtener configuraciones por categoría o prefijo
   * @param {string} prefix - Prefijo de las claves a buscar
   * @returns {Promise<Array>} - Lista de configuraciones que coinciden con el prefijo
   */
  async getByPrefix(prefix) {
    return Setting.getByPrefix(prefix);
  }

  /**
   * Establecer múltiples configuraciones a la vez
   * @param {Object} settings - Objeto con pares clave-valor
   * @returns {Promise<boolean>} - true si todas se establecieron correctamente
   */
  async setBulk(settings) {
    return Setting.setBulk(settings);
  }

  /**
   * Cargar los valores por defecto
   * @returns {Promise<boolean>} - true si se cargaron correctamente
   */
  async loadDefaults() {
    return Setting.loadDefaults();
  }

  /**
   * Obtener la configuración agrupada por categorías
   * @returns {Promise<Object>} - Configuraciones agrupadas
   */
  async getGrouped() {
    const settings = await this.getAll();
    const grouped = {};

    // Agrupar por prefijos separados por punto o guion bajo
    for (const setting of settings) {
      const parts = setting.key.split(/[._]/);
      const category = parts[0] || "general";

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(setting);
    }

    return grouped;
  }

  /**
   * Resetear todos los ajustes a sus valores por defecto
   * @returns {Promise<boolean>} - true si se resetearon correctamente
   */
  async resetAll() {
    // Eliminar todos los ajustes actuales
    await db.asyncRun("DELETE FROM settings");

    // Cargar los valores por defecto
    return this.loadDefaults();
  }

  /**
   * Reiniciar una configuración específica a su valor por defecto
   * @param {string} key - Clave de la configuración
   * @returns {Promise<boolean>} - true si se reinició correctamente
   */
  async reset(key) {
    return Setting.reset(key);
  }

  /**
   * Exportar todas las configuraciones como un objeto
   * @returns {Promise<Object>} - Configuraciones como objeto clave-valor
   */
  async export() {
    const settings = await this.getAll();
    const result = {};

    for (const setting of settings) {
      result[setting.key] = setting.value;
    }

    return result;
  }

  /**
   * Importar configuraciones desde un objeto
   * @param {Object} data - Objeto con pares clave-valor
   * @returns {Promise<boolean>} - true si se importaron correctamente
   */
  async import(data) {
    return this.setBulk(data);
  }

  /**
   * Verificar si existe una configuración
   * @param {string} key - Clave de la configuración
   * @returns {Promise<boolean>} - true si existe
   */
  async exists(key) {
    return Setting.exists(key);
  }

  /**
   * Obtener configuraciones del sistema
   * @returns {Promise<Object>} - Configuraciones del sistema
   */
  async getSystemSettings() {
    const systemKeys = [
      "transcoding_enabled",
      "default_transcoding_format",
      "max_bitrate",
      "scan_interval",
      "thumbnail_generation",
      "metadata_language",
      "max_users",
      "enable_logs",
      "app_name",
    ];

    const result = {};

    for (const key of systemKeys) {
      result[key] = await this.get(key);
    }

    return result;
  }

  /**
   * Obtener configuraciones de interfaz de usuario
   * @returns {Promise<Object>} - Configuraciones de interfaz
   */
  async getUiSettings() {
    const uiKeys = ["theme", "allow_registration"];

    const result = {};

    for (const key of uiKeys) {
      result[key] = await this.get(key);
    }

    return result;
  }
}

module.exports = new SettingRepository();
