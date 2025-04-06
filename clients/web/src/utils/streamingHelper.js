// clients/web/src/utils/streamingHelper.js
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Clase helper para manejar tokens de streaming en el cliente
 */
class StreamingHelper {
  constructor() {
    // Almacén local de tokens de streaming para la sesión actual
    this.tokens = {};

    // Temporizadores para renovación de tokens
    this.renewalTimers = {};

    // Configurar interceptor para escuchar tokens renovados en las respuestas
    this.setupInterceptor();
  }

  /**
   * Obtiene un token de streaming para un medio específico
   * @param {string|number} mediaId - ID del medio
   * @returns {Promise<string>} Token de streaming
   */
  async getToken(mediaId) {
    // Si ya tenemos un token válido en caché, devolverlo
    if (this.tokens[mediaId] && this.isTokenValid(this.tokens[mediaId])) {
      return this.tokens[mediaId].token;
    }

    // Si no hay token o ha expirado, obtener uno nuevo
    try {
      const authToken = localStorage.getItem("streamvio_token");
      if (!authToken) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.get(
        `${API_URL}/api/streaming/token/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const tokenData = {
        token: response.data.stream_token,
        mediaId,
        expiresAt: Date.now() + response.data.expires_in * 1000,
        obtained: Date.now(),
      };

      // Guardar token en caché
      this.tokens[mediaId] = tokenData;

      // Configurar renovación automática
      this.setupTokenRenewal(mediaId, response.data.expires_in);

      return tokenData.token;
    } catch (error) {
      console.error("Error al obtener token de streaming:", error);
      throw error;
    }
  }

  /**
   * Verifica si un token está aún válido (no expirado)
   * @param {Object} tokenData - Datos del token
   * @returns {boolean} true si el token es válido
   */
  isTokenValid(tokenData) {
    // Agregar un margen de 2 minutos para evitar usar tokens muy cercanos a expirar
    const safetyMargin = 2 * 60 * 1000; // 2 minutos en milisegundos
    return tokenData && tokenData.expiresAt > Date.now() + safetyMargin;
  }

  /**
   * Configura la renovación automática de un token antes de que expire
   * @param {string|number} mediaId - ID del medio
   * @param {number} expiresInSeconds - Tiempo en segundos hasta expiración
   */
  setupTokenRenewal(mediaId, expiresInSeconds) {
    // Limpiar timer existente si lo hay
    if (this.renewalTimers[mediaId]) {
      clearTimeout(this.renewalTimers[mediaId]);
    }

    // Calcular tiempo de renovación (2 minutos antes de expirar)
    const renewalTime = Math.max((expiresInSeconds - 120) * 1000, 10000); // Al menos 10 segundos

    // Configurar temporizador para renovación
    this.renewalTimers[mediaId] = setTimeout(async () => {
      try {
        console.log(`Renovando token de streaming para medio ${mediaId}`);
        await this.getToken(mediaId); // Obtener nuevo token
      } catch (error) {
        console.warn(`Error al renovar token para medio ${mediaId}:`, error);
      }
    }, renewalTime);
  }

  /**
   * Configura un interceptor para detectar tokens renovados en las respuestas HTTP
   */
  setupInterceptor() {
    axios.interceptors.response.use(
      (response) => {
        // Verificar si hay un nuevo token de streaming en la respuesta
        const newToken = response.headers["x-new-stream-token"];
        if (newToken) {
          // Intentar determinar para qué medio es este token
          let mediaId = null;

          // Intentar extraer el ID del medio de la URL
          const urlMatch = response.config.url.match(/\/media\/(\d+)/);
          if (urlMatch && urlMatch[1]) {
            mediaId = urlMatch[1];
          }

          // Alternativamente, podríamos buscarlo en los parámetros
          if (!mediaId && response.config.params?.mediaId) {
            mediaId = response.config.params.mediaId;
          }

          if (mediaId) {
            console.log(`Token de streaming renovado para medio ${mediaId}`);

            // Actualizar token en caché (asumimos que expira en 15 minutos por defecto)
            this.tokens[mediaId] = {
              token: newToken,
              mediaId,
              expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutos
              obtained: Date.now(),
            };

            // Configurar renovación
            this.setupTokenRenewal(mediaId, 15 * 60); // 15 minutos
          }
        }

        return response;
      },
      (error) => {
        // Si hay un error de token expirado, intentar renovar
        if (
          error.response &&
          error.response.status === 401 &&
          (error.response.data.code === "TOKEN_EXPIRED" ||
            error.response.data.code === "STREAM_TOKEN_INVALID")
        ) {
          // Intentar determinar qué medio causó el error
          let mediaId = null;
          const urlMatch = error.config.url.match(/\/media\/(\d+)/);
          if (urlMatch && urlMatch[1]) {
            mediaId = urlMatch[1];
          }

          if (mediaId) {
            // Eliminar el token inválido de la caché
            delete this.tokens[mediaId];

            // No intentamos renovar automáticamente aquí, pero podríamos
            console.warn(`Token de streaming expirado para medio ${mediaId}`);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Obtiene una URL de streaming con el token incluido
   * @param {string|number} mediaId - ID del medio
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<string>} URL completa para streaming
   */
  async getStreamUrl(mediaId, options = {}) {
    try {
      const token = await this.getToken(mediaId);
      const baseUrl = `${API_URL}/api/streaming/media/${mediaId}`;

      // Construir URL con parámetros
      const params = new URLSearchParams();
      params.append("stream_token", token);

      // Añadir opciones adicionales
      if (options.type) {
        params.append("type", options.type);
      }

      if (options.quality) {
        params.append("quality", options.quality);
      }

      return `${baseUrl}?${params.toString()}`;
    } catch (error) {
      console.error("Error al generar URL de streaming:", error);
      throw error;
    }
  }

  /**
   * Actualiza el progreso de visualización en el servidor
   * @param {string|number} mediaId - ID del medio
   * @param {number} progress - Porcentaje de progreso (0-100)
   * @param {number} currentTime - Tiempo actual en segundos
   * @returns {Promise<Object>} Resultado de la operación
   */
  async updateProgress(mediaId, progress, currentTime) {
    try {
      const token = await this.getToken(mediaId);

      const response = await axios.post(
        `${API_URL}/api/streaming/progress/${mediaId}`,
        { progress, currentTime },
        {
          headers: {
            "x-stream-token": token,
          },
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
   * Revoca un token específico (útil al finalizar la reproducción)
   * @param {string|number} mediaId - ID del medio
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async revokeToken(mediaId) {
    try {
      // Si no tenemos el token en caché, no hay nada que revocar
      if (!this.tokens[mediaId]) {
        return true;
      }

      const authToken = localStorage.getItem("streamvio_token");
      if (!authToken) {
        throw new Error("No hay sesión activa");
      }

      // Obtener ID del token desde su contenido
      // Nota: en una implementación completa, habría que decodificar el JWT aquí
      // para obtener el ID del token, pero para simplificar usamos un ID genérico
      const tokenId = this.tokens[mediaId].token.split(".")[0] || "unknown";

      await axios.delete(`${API_URL}/api/streaming/token/${tokenId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // Limpiar token de la caché
      delete this.tokens[mediaId];

      // Limpiar timer de renovación
      if (this.renewalTimers[mediaId]) {
        clearTimeout(this.renewalTimers[mediaId]);
        delete this.renewalTimers[mediaId];
      }

      return true;
    } catch (error) {
      console.warn("Error al revocar token de streaming:", error);
      return false;
    }
  }

  /**
   * Limpia todos los tokens almacenados (útil al cerrar sesión)
   */
  clearAllTokens() {
    // Limpiar todos los temporizadores
    Object.keys(this.renewalTimers).forEach((mediaId) => {
      clearTimeout(this.renewalTimers[mediaId]);
    });

    // Reiniciar almacenes
    this.tokens = {};
    this.renewalTimers = {};
  }
}

// Crear instancia única del helper
const streamingHelper = new StreamingHelper();

export default streamingHelper;
