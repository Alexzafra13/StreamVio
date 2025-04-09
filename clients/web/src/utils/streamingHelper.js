// clients/web/src/utils/streamingHelper.js (Versión simplificada)
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Clase helper simplificada para trabajar con streaming en el cliente
 * Usa directamente el token JWT principal
 */
class StreamingHelper {
  /**
   * Obtiene una URL de streaming con el token principal incluido
   * @param {string|number} mediaId - ID del medio
   * @param {Object} options - Opciones adicionales
   * @returns {string} URL completa para streaming
   */
  getStreamUrl(mediaId, options = {}) {
    try {
      // Obtener token JWT principal
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay token disponible para streaming");
      }

      // Determinar si usar HLS basado en opciones
      const useHls = options.type === "hls" && options.hlsAvailable;

      // Construir URL según tipo de streaming
      let baseUrl;
      if (useHls) {
        baseUrl = `${API_URL}/api/streaming/${mediaId}/hls`;
      } else {
        baseUrl = `${API_URL}/api/streaming/${mediaId}/stream`;
      }

      // Añadir el token como parámetro auth
      return `${baseUrl}?auth=${token}`;
    } catch (error) {
      console.error("Error al generar URL de streaming:", error);
      throw error;
    }
  }

  /**
   * Obtiene la URL de miniatura para un medio
   * @param {string|number} mediaId - ID del medio
   * @returns {string} URL de la miniatura
   */
  getThumbnailUrl(mediaId) {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        return "/assets/default-media.jpg";
      }

      return `${API_URL}/api/media/${mediaId}/thumbnail?auth=${token}`;
    } catch (error) {
      console.error("Error al generar URL de miniatura:", error);
      return "/assets/default-media.jpg";
    }
  }

  /**
   * Actualiza el progreso de visualización en el servidor
   * @param {string|number} mediaId - ID del medio
   * @param {number} position - Tiempo actual en segundos
   * @param {boolean} completed - Si se ha completado la visualización
   * @returns {Promise<Object>} Resultado de la operación
   */
  async updateProgress(mediaId, position, completed = false) {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.post(
        `${API_URL}/api/streaming/${mediaId}/progress`,
        { position, completed },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return response.data;
    } catch (error) {
      console.warn("Error al actualizar progreso:", error);
      // No propagamos el error para que no interrumpa la reproducción
      return { success: false, error: error.message };
    }
  }

  /**
   * Verifica disponibilidad de HLS para un medio específico
   * @param {string|number} mediaId - ID del medio
   * @returns {Promise<boolean>} true si HLS está disponible
   */
  async checkHlsAvailability(mediaId) {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        return false;
      }

      const response = await axios.get(`${API_URL}/api/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Verificar si el medio tiene HLS disponible
      return response.data.has_hls === true;
    } catch (error) {
      console.warn("Error al verificar disponibilidad de HLS:", error);
      return false;
    }
  }
}

// Crear instancia única del helper
const streamingHelper = new StreamingHelper();

export default streamingHelper;
