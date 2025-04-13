// src/services/settingsService.js
import axios from "axios";
import authService from "./authService";

// URL base de la API
const API_URL = import.meta.env.PUBLIC_API_URL || "http://localhost:3000/api";

/**
 * Configurar los headers de autorización para las peticiones
 * @returns {Object} - Headers con el token de autorización
 */
const authHeader = () => {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Servicio para operaciones relacionadas con configuraciones del sistema
 */
const settingsService = {
  /**
   * Obtener todas las configuraciones
   * @returns {Promise<Object>} - Todas las configuraciones
   */
  async getAllSettings() {
    try {
      const response = await axios.get(`${API_URL}/settings`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener configuraciones agrupadas por categoría
   * @returns {Promise<Object>} - Configuraciones agrupadas
   */
  async getGroupedSettings() {
    try {
      const response = await axios.get(`${API_URL}/settings/grouped`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener una configuración específica
   * @param {string} key - Clave de la configuración
   * @returns {Promise<Object>} - Configuración
   */
  async getSetting(key) {
    try {
      const response = await axios.get(`${API_URL}/settings/${key}`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Actualizar una configuración
   * @param {string} key - Clave de la configuración
   * @param {any} value - Nuevo valor
   * @returns {Promise<Object>} - Configuración actualizada
   */
  async updateSetting(key, value) {
    try {
      const response = await axios.put(
        `${API_URL}/settings/${key}`,
        { value },
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Actualizar múltiples configuraciones a la vez
   * @param {Object} settingsData - Objeto con configuraciones a actualizar
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async setBulkSettings(settingsData) {
    try {
      const response = await axios.post(
        `${API_URL}/settings/bulk`,
        settingsData,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Restablecer una configuración a su valor por defecto
   * @param {string} key - Clave de la configuración
   * @returns {Promise<Object>} - Configuración restablecida
   */
  async resetSetting(key) {
    try {
      const response = await axios.post(
        `${API_URL}/settings/${key}/reset`,
        {},
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Restablecer todas las configuraciones a sus valores por defecto
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async resetAllSettings() {
    try {
      const response = await axios.post(
        `${API_URL}/settings/reset-all`,
        {},
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener todas las configuraciones en una categoría específica
   * @param {string} category - Nombre de la categoría
   * @returns {Promise<Array>} - Configuraciones de la categoría
   */
  async getCategorySettings(category) {
    try {
      const response = await axios.get(
        `${API_URL}/settings/category/${category}`,
        {
          headers: authHeader(),
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default settingsService;
