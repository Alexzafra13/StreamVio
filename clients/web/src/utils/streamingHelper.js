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
    console.log(`Solicitando token para medio ${mediaId}`);

    // Si ya tenemos un token válido en caché, devolverlo
    if (this.tokens[mediaId] && this.isTokenValid(this.tokens[mediaId])) {
      console.log(`Usando token en caché para medio ${mediaId}`);
      return this.tokens[mediaId].token;
    }

    // Si no hay token o ha expirado, obtener uno nuevo
    try {
      const authToken = localStorage.getItem("streamvio_token");
      if (!authToken) {
        throw new Error("No hay sesión activa");
      }

      // Intento primero con el endpoint mejorado
      try {
        console.log(`Solicitando token desde /streaming/${mediaId}/prepare`);
        const response = await axios.get(
          `${API_URL}/api/streaming/${mediaId}/prepare`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        const tokenData = {
          token: response.data.token || response.data.stream_token,
          mediaId,
          expiresAt: Date.now() + (response.data.expires_in || 3600) * 1000,
          obtained: Date.now(),
        };

        // Guardar token en caché
        this.tokens[mediaId] = tokenData;

        // Configurar renovación automática
        this.setupTokenRenewal(mediaId, response.data.expires_in || 3600);

        console.log(`Token obtenido correctamente para medio ${mediaId}`);
        return tokenData.token;
      } catch (prepareError) {
        console.warn(
          `Error en /prepare, intentando endpoint alternativo: ${prepareError.message}`
        );

        // Si falla, intentar con el endpoint directo de token
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
          expiresAt: Date.now() + (response.data.expires_in || 3600) * 1000,
          obtained: Date.now(),
        };

        // Guardar token en caché
        this.tokens[mediaId] = tokenData;

        // Configurar renovación automática
        this.setupTokenRenewal(mediaId, response.data.expires_in || 3600);

        console.log(
          `Token obtenido desde endpoint alternativo para medio ${mediaId}`
        );
        return tokenData.token;
      }
    } catch (error) {
      console.error("Error al obtener token de streaming:", error);

      // Si todo falla, intentar usar el token principal de autenticación como fallback
      const mainToken = localStorage.getItem("streamvio_token");
      if (mainToken) {
        console.log("Usando token principal como fallback");
        return mainToken;
      }

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

    console.log(
      `Programando renovación de token para medio ${mediaId} en ${
        renewalTime / 1000
      } segundos`
    );

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

            console.warn(`Token de streaming expirado para medio ${mediaId}`);

            // Podríamos intentar recuperar automáticamente
            if (error.config && !error.config._retry) {
              error.config._retry = true; // Evitar bucle infinito

              // Intentar obtener un nuevo token y repetir la solicitud
              return this.getToken(mediaId)
                .then((newToken) => {
                  // Actualizar el token en la solicitud original
                  if (error.config.params) {
                    error.config.params.token = newToken;
                  } else {
                    error.config.params = { token: newToken };
                  }
                  return axios(error.config);
                })
                .catch((retryError) => {
                  console.error(
                    "Error en recuperación automática:",
                    retryError
                  );
                  return Promise.reject(retryError);
                });
            }
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
      let token;

      try {
        token = await this.getToken(mediaId);
      } catch (tokenError) {
        console.warn(
          "Error al obtener token específico, usando token principal:",
          tokenError
        );
        token = localStorage.getItem("streamvio_token");

        if (!token) {
          throw new Error("No hay token disponible para streaming");
        }
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

      // Construir URL con parámetros
      const params = new URLSearchParams();
      params.append("token", token);

      // Añadir opciones adicionales
      if (options.quality) {
        params.append("quality", options.quality);
      }

      return `${baseUrl}?${params.toString()}`;
    } catch (error) {
      console.error("Error al generar URL de streaming:", error);

      // URL de fallback usando token principal
      const mainToken = localStorage.getItem("streamvio_token");
      if (mainToken) {
        const fallbackUrl = `${API_URL}/api/streaming/${mediaId}/stream?token=${mainToken}`;
        console.log("Usando URL de fallback:", fallbackUrl);
        return fallbackUrl;
      }

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
      const token = localStorage.getItem("streamvio_token");

      const response = await axios.post(
        `${API_URL}/api/media/${mediaId}/progress`,
        { position: currentTime, progress },
        {
          headers: {
            Authorization: `Bearer ${token}`,
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

      // Eliminar el token de streaming
      try {
        await axios.delete(`${API_URL}/api/streaming/token/${mediaId}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      } catch (error) {
        console.warn("No se pudo revocar token explícitamente:", error);
        // No propagamos este error ya que no es crítico
      }

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

    console.log("Tokens de streaming eliminados");
  }
}

// Crear instancia única del helper
const streamingHelper = new StreamingHelper();

export default streamingHelper;
