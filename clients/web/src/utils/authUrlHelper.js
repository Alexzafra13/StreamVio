// clients/web/src/utils/authUrlHelper.js
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Añade el token de autenticación a una URL
 * @param {string} url - La URL base a la que añadir el token
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.forceRefresh - Si se debe forzar la regeneración del token desde localStorage
 * @returns {string} URL con token de autenticación añadido
 */
export const addAuthToken = (url, options = {}) => {
  // Obtener token del localStorage
  const token = localStorage.getItem("streamvio_token");
  if (!token) return url;

  console.log("Añadiendo token a URL:", url); // Logging para depuración

  // Determinar si la URL ya tiene parámetros
  const hasParams = url.includes("?");
  const separator = hasParams ? "&" : "?";

  // Añadir el token como parámetro de consulta
  return `${url}${separator}auth=${token}`;
};

/**
 * Obtiene la URL de streaming para un medio con el token de autenticación
 * @param {Object} media - Objeto con información del medio
 * @param {string} mediaId - ID del medio
 * @param {string} streamType - Tipo de streaming ('direct' o 'hls')
 * @param {boolean} hlsAvailable - Si está disponible el streaming HLS
 * @returns {string} URL de streaming con autenticación
 */
export const getStreamUrl = (
  media,
  mediaId,
  streamType = "direct",
  hlsAvailable = false
) => {
  if (!media) return "";

  if (streamType === "hls" && hlsAvailable && media.file_path) {
    // URL para streaming HLS
    const fileName = media.file_path
      .split(/[\/\\]/)
      .pop()
      .split(".")[0];

    const hlsUrl = `${API_URL}/data/transcoded/${fileName}_hls/master.m3u8`;
    return addAuthToken(hlsUrl);
  } else {
    // URL para streaming directo
    const directUrl = `${API_URL}/api/media/${mediaId}/stream`;
    return addAuthToken(directUrl);
  }
};

/**
 * Obtiene la URL de miniatura para un medio con el token de autenticación
 * @param {string|number} mediaId - ID del medio
 * @returns {string} URL de miniatura con autenticación
 */
export const getThumbnailUrl = (mediaId) => {
  const thumbnailUrl = `${API_URL}/api/media/${mediaId}/thumbnail`;
  return addAuthToken(thumbnailUrl);
};

/**
 * Obtiene la URL para cualquier API de StreamVio con el token de autenticación
 * @param {string} endpoint - Endpoint de la API (sin la base URL ni `/api/`)
 * @param {Object} params - Parámetros de consulta a añadir
 * @returns {string} URL completa con autenticación
 */
export const getApiUrl = (endpoint, params = {}) => {
  // Construir URL base
  let url = `${API_URL}/api/${endpoint}`;

  // Añadir parámetros de consulta
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  if (queryString) {
    url = `${url}?${queryString}`;
  }

  // Si ya hay parámetros, no usar addAuthToken para evitar doble procesamiento
  // En su lugar, añadir el token manualmente
  if (queryString) {
    const token = localStorage.getItem("streamvio_token");
    if (token) {
      url = `${url}&auth=${token}`;
    }
    return url;
  }

  // Si no hay parámetros, usar addAuthToken
  return addAuthToken(url);
};

/**
 * Configura axios para usar autenticación en todas las peticiones
 * @param {Object} axiosInstance - Instancia de axios a configurar
 */
export const setupAxiosAuth = (axiosInstance) => {
  const token = localStorage.getItem("streamvio_token");
  if (token) {
    console.log("Configurando token de autenticación para axios");
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  // Interceptor para renovar el token si es necesario
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Si el error es 401 (No autorizado), podemos intentar renovar el token
      if (error.response && error.response.status === 401) {
        console.warn("Token expirado o inválido. Redirigiendo a login...");
        // En una versión futura, aquí podríamos implementar la renovación automática del token

        // Por ahora, redirigir al login
        window.location.href = "/auth";
      }
      return Promise.reject(error);
    }
  );
};

export default {
  addAuthToken,
  getStreamUrl,
  getThumbnailUrl,
  getApiUrl,
  setupAxiosAuth,
};
