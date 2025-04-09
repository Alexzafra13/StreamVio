// clients/web/src/utils/streamingHelper.js - VERSIÓN CORREGIDA
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Clase helper para manejar tokens de streaming en el cliente
 * con manejo mejorado de errores y fallbacks
 */
class StreamingHelper {
  constructor() {
    // Almacén local de tokens de streaming para la sesión actual
    this.tokens = {};

    // Temporizadores para renovación de tokens
    this.renewalTimers = {};
  }

  /**
   * Obtiene un token de streaming para un medio específico
   * @param {string|number} mediaId - ID del medio
   * @returns {Promise<string>} Token de streaming o token principal como fallback
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

      // Primer intento: usando el endpoint de preparación de streaming
      try {
        console.log(
          `Solicitando token desde /api/streaming/${mediaId}/prepare`
        );
        const response = await axios.get(
          `${API_URL}/api/streaming/${mediaId}/prepare`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        // Extraer token del response (podría estar en diferentes propiedades)
        const streamToken =
          response.data.token ||
          response.data.stream_token ||
          response.data.streamToken;

        if (streamToken) {
          const tokenData = {
            token: streamToken,
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
        }

        throw new Error("No se pudo extraer el token de la respuesta");
      } catch (error) {
        console.warn(
          `Error en endpoint principal, intentando fallback: ${error.message}`
        );

        // FALLBACK 1: Usar directamente el token JWT principal
        // Este enfoque es menos seguro pero más compatible
        console.log("Usando token JWT principal como fallback para streaming");
        return authToken;
      }
    } catch (error) {
      console.error("Error al obtener token de streaming:", error);

      // Último recurso: usar el token JWT principal
      const mainToken = localStorage.getItem("streamvio_token");
      if (mainToken) {
        console.log("Usando token principal como último recurso");
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
   * Obtiene una URL de streaming con el token incluido
   * @param {string|number} mediaId - ID del medio
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<string>} URL completa para streaming
   */
  async getStreamUrl(mediaId, options = {}) {
    try {
      // Obtener un token para el medio (específico o fallback)
      let token;
      try {
        token = await this.getToken(mediaId);
      } catch (tokenError) {
        console.warn(
          "Error al obtener token específico, usando token principal como fallback:",
          tokenError
        );
        token = localStorage.getItem("streamvio_token");

        if (!token) {
          throw new Error("No hay token disponible para streaming");
        }
      }

      // Determinar la URL base según preferencias
      let baseUrl;

      // Si el usuario prefiere HLS y está disponible, usarlo
      if (options.useHls && options.hlsAvailable) {
        baseUrl = `${API_URL}/api/streaming/${mediaId}/hls`;
      } else {
        // De lo contrario, usar streaming directo
        baseUrl = `${API_URL}/api/media/${mediaId}/stream`;
      }

      // Construir URL con parámetros de autenticación
      // El parámetro depende de la ruta
      const streamUrlBase = baseUrl.includes("/streaming/")
        ? `${baseUrl}?token=${token}`
        : `${baseUrl}?auth=${token}`;

      console.log(`URL de streaming generada: ${streamUrlBase}`);
      return streamUrlBase;
    } catch (error) {
      console.error("Error al generar URL de streaming:", error);

      // URL de fallback usando token principal
      const mainToken = localStorage.getItem("streamvio_token");
      if (mainToken) {
        // Usar siempre la ruta directa como último recurso
        const fallbackUrl = `${API_URL}/api/media/${mediaId}/stream?auth=${mainToken}`;
        console.log("Usando URL de fallback:", fallbackUrl);
        return fallbackUrl;
      }

      throw error;
    }
  }
}

// Crear instancia única del helper
const streamingHelper = new StreamingHelper();

export default streamingHelper;
