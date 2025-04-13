// src/services/mediaService.js
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
 * Servicio para operaciones relacionadas con contenido multimedia
 */
const mediaService = {
  /**
   * Buscar elementos multimedia con filtros
   * @param {Object} searchParams - Parámetros de búsqueda
   * @returns {Promise<Object>} - Resultados de la búsqueda
   */
  async searchMedia(searchParams = {}) {
    try {
      const response = await axios.get(`${API_URL}/media`, {
        headers: authHeader(),
        params: searchParams,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener un elemento multimedia por ID
   * @param {number} id - ID del elemento multimedia
   * @returns {Promise<Object>} - Detalles del elemento multimedia
   */
  async getMediaById(id) {
    try {
      const response = await axios.get(`${API_URL}/media/${id}`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener URL de miniatura de un elemento multimedia
   * @param {number} id - ID del elemento multimedia
   * @returns {string} - URL de la miniatura
   */
  getThumbnailUrl(id) {
    const token = authService.getToken();
    return `${API_URL}/media/${id}/thumbnail${token ? `?token=${token}` : ""}`;
  },

  /**
   * Obtener opciones de streaming para un elemento multimedia
   * @param {number} id - ID del elemento multimedia
   * @returns {Promise<Object>} - Opciones de streaming
   */
  async getStreamingOptions(id) {
    try {
      const response = await axios.get(
        `${API_URL}/media/${id}/streaming-options`,
        {
          headers: authHeader(),
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener URL de streaming para un elemento multimedia
   * @param {number} id - ID del elemento multimedia
   * @param {string} [format='direct'] - Formato de streaming ('direct', 'hls')
   * @returns {string} - URL de streaming
   */
  getStreamUrl(id, format = "direct") {
    const token = authService.getToken();
    return `${API_URL}/media/${id}/stream?format=${format}${
      token ? `&token=${token}` : ""
    }`;
  },

  /**
   * Actualizar progreso de visualización
   * @param {number} mediaId - ID del elemento multimedia
   * @param {number} position - Posición actual en segundos
   * @param {boolean} [completed=false] - Si se ha completado la visualización
   * @returns {Promise<Object>} - Datos actualizados de progreso
   */
  async updateProgress(mediaId, position, completed = false) {
    try {
      const response = await axios.post(
        `${API_URL}/media/${mediaId}/progress`,
        { position, completed },
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Marcar un elemento como visto completamente
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {Promise<Object>} - Datos actualizados de progreso
   */
  async markAsWatched(mediaId) {
    try {
      const response = await axios.post(
        `${API_URL}/watch-history/${mediaId}/complete`,
        {},
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener historial de visualización
   * @param {Object} options - Opciones de consulta (limit, includeCompleted)
   * @returns {Promise<Array>} - Historial de visualización
   */
  async getWatchHistory(options = {}) {
    try {
      const response = await axios.get(`${API_URL}/media/user/history`, {
        headers: authHeader(),
        params: options,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener elementos en progreso (no completados)
   * @param {number} [limit=10] - Cantidad máxima de elementos a obtener
   * @returns {Promise<Array>} - Elementos en progreso
   */
  async getInProgress(limit = 10) {
    try {
      const response = await axios.get(`${API_URL}/watch-history/in-progress`, {
        headers: authHeader(),
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener elementos recientemente vistos
   * @param {number} [limit=10] - Cantidad máxima de elementos a obtener
   * @returns {Promise<Array>} - Elementos recientemente vistos
   */
  async getRecentlyWatched(limit = 10) {
    try {
      const response = await axios.get(`${API_URL}/watch-history/recent`, {
        headers: authHeader(),
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener elementos recomendados
   * @param {number} [limit=10] - Cantidad máxima de elementos a obtener
   * @returns {Promise<Array>} - Elementos recomendados
   */
  async getRecommendations(limit = 10) {
    try {
      const response = await axios.get(
        `${API_URL}/watch-history/recommendations`,
        {
          headers: authHeader(),
          params: { limit },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener elementos populares
   * @param {number} [limit=10] - Cantidad máxima de elementos a obtener
   * @returns {Promise<Array>} - Elementos populares
   */
  async getPopularItems(limit = 10) {
    try {
      const response = await axios.get(`${API_URL}/watch-history/popular`, {
        headers: authHeader(),
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Eliminar un registro del historial
   * @param {number} historyId - ID del registro de historial
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async deleteHistoryItem(historyId) {
    try {
      const response = await axios.delete(
        `${API_URL}/watch-history/${historyId}`,
        {
          headers: authHeader(),
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Eliminar todo el historial de visualización
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async clearWatchHistory() {
    try {
      const response = await axios.delete(`${API_URL}/watch-history`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener estadísticas de visualización
   * @returns {Promise<Object>} - Estadísticas de visualización
   */
  async getUserWatchStats() {
    try {
      const response = await axios.get(`${API_URL}/watch-history/stats`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default mediaService;
