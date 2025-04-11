// clients/web/src/utils/authUrlHelper.js - Versión optimizada
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Añade el token de autenticación a una URL
 * @param {string} url - La URL base a la que añadir el token
 * @returns {string} URL con token de autenticación añadido
 */
export const addAuthToken = (url) => {
  // Obtener token del localStorage
  const token = localStorage.getItem("streamvio_token");
  if (!token) {
    console.warn("No se encontró token de autenticación para añadir a URL");
    return url;
  }

  // Determinar si la URL ya tiene parámetros
  const hasParams = url.includes("?");
  const separator = hasParams ? "&" : "?";

  // Añadir el token como parámetro de consulta
  return `${url}${separator}auth=${encodeURIComponent(token)}`;
};

/**
 * Obtiene la URL de streaming para un medio con el token de autenticación
 * @param {number} mediaId - ID del medio
 * @param {string} streamType - Tipo de streaming ('direct' o 'hls')
 * @returns {string} URL de streaming con autenticación
 */
export const getStreamUrl = (mediaId) => {
  if (!mediaId) {
    console.error("MediaID no proporcionado a getStreamUrl");
    return null;
  }

  const token = localStorage.getItem("streamvio_token");
  if (!token) {
    console.error("No se encontró token de autenticación en localStorage");
    return null;
  }

  // URL para streaming directo con token en query param
  return addAuthToken(`${API_URL}/api/media/${mediaId}/stream`);
};

/**
 * Obtiene la URL de miniatura para un medio con el token de autenticación
 * @param {number} mediaId - ID del medio
 * @returns {string} URL de miniatura con autenticación
 */
export const getThumbnailUrl = (mediaId) => {
  if (!mediaId) return "/assets/default-media.jpg";

  const token = localStorage.getItem("streamvio_token");
  if (!token) return "/assets/default-media.jpg";

  return addAuthToken(`${API_URL}/api/media/${mediaId}/thumbnail`);
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
  } else {
    console.warn("No se encontró token para configurar axios");
    // Limpiar token si no hay ninguno
    delete axiosInstance.defaults.headers.common["Authorization"];
  }

  // Interceptor para renovar el token si es necesario
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Si el error es 401 (No autorizado), podemos redirigir al login
      if (error.response && error.response.status === 401) {
        console.warn("Token expirado o inválido. Redirigiendo a login...");
        // Si estamos en el navegador, redirigir al login
        if (typeof window !== "undefined") {
          window.location.href = "/auth";
        }
      }
      return Promise.reject(error);
    }
  );
};

export default {
  addAuthToken,
  getStreamUrl,
  getThumbnailUrl,
  setupAxiosAuth,
};
