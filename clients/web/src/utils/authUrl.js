// clients/web/src/utils/authUrl.js
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Añade el token de autenticación a una URL
 * @param {string} url - URL base a la que añadir el token
 * @returns {string|null} - URL con el token añadido como parámetro, o null si no hay token
 */
export const addAuthToken = (url) => {
  try {
    // Obtener token del localStorage
    const token = localStorage.getItem("streamvio_token");
    if (!token) {
      console.warn("No se encontró token de autenticación");
      return null;
    }

    // Determinar si la URL ya tiene parámetros
    const hasParams = url.includes("?");
    const separator = hasParams ? "&" : "?";

    // Añadir el token como parámetro de consulta
    return `${url}${separator}auth=${encodeURIComponent(token)}`;
  } catch (error) {
    console.error("Error al añadir token a URL:", error);
    return url;
  }
};

/**
 * Obtiene la URL de streaming para un medio con autenticación
 * @param {number|string} mediaId - ID del medio
 * @returns {string|null} - URL de streaming con token, o null si no hay token
 */
export const getStreamUrl = (mediaId) => {
  if (!mediaId) {
    console.error("ID de medio no proporcionado a getStreamUrl");
    return null;
  }

  const baseUrl = `${API_URL}/api/media/${mediaId}/stream`;
  return addAuthToken(baseUrl);
};

/**
 * Obtiene la URL de miniatura para un medio con autenticación
 * @param {number|string} mediaId - ID del medio
 * @returns {string|null} - URL de miniatura con token, o null si no hay token
 */
export const getThumbnailUrl = (mediaId) => {
  if (!mediaId) return null;

  const baseUrl = `${API_URL}/api/media/${mediaId}/thumbnail`;
  return addAuthToken(baseUrl);
};

/**
 * Obtiene la URL para cualquier endpoint API con autenticación
 * @param {string} endpoint - Endpoint relativo (sin /api/)
 * @param {Object} params - Parámetros de consulta adicionales
 * @returns {string|null} - URL completa con autenticación
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

    // Si ya hay parámetros, añadir el token manualmente
    const token = localStorage.getItem("streamvio_token");
    if (token) {
      url = `${url}&auth=${encodeURIComponent(token)}`;
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
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  // Interceptor para renovar el token si es necesario
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Si el error es 401 (No autorizado), redirigir al login
      if (error.response && error.response.status === 401) {
        console.warn("Token expirado o inválido. Redirigiendo a login...");
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
