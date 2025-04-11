// clients/web/src/utils/authUrlHelper.js - Versión optimizada para IP específica
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

// Verificar que API_URL está configurado correctamente
if (!API_URL) {
  console.error("ERROR CRÍTICO: API_URL no está configurado correctamente");
}

console.log("authUrlHelper inicializado con API_URL:", API_URL);

/**
 * Módulo para manejar URLs con autenticación
 */
const authUrlHelper = {
  /**
   * Añade el token de autenticación a una URL
   * @param {string} url - La URL base a la que añadir el token
   * @returns {string} URL con token de autenticación añadido
   */
  addAuthToken(url) {
    // Obtener token del localStorage
    const token = localStorage.getItem("streamvio_token");

    console.log(
      "Token recuperado:",
      token ? `${token.substring(0, 10)}...` : "null"
    );

    if (!token) {
      console.warn("No se encontró token de autenticación para añadir a URL");
      return url;
    }

    // Determinar si la URL ya tiene parámetros
    const hasParams = url.includes("?");
    const separator = hasParams ? "&" : "?";

    // Añadir el token como parámetro de consulta
    const finalUrl = `${url}${separator}auth=${encodeURIComponent(token)}`;
    console.log(
      "URL con token añadido:",
      finalUrl.split("auth=")[0] + "auth=***"
    );

    return finalUrl;
  },

  /**
   * Obtiene la URL de streaming para un medio con el token de autenticación
   * @param {number} mediaId - ID del medio
   * @returns {string} URL de streaming con autenticación
   */
  getStreamUrl(mediaId) {
    console.log("getStreamUrl llamado con mediaId:", mediaId);

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
    // Usar la URL completa para asegurar que sea correcta
    const baseUrl = `${API_URL}/api/media/${mediaId}/stream`;
    console.log("URL base de streaming:", baseUrl);

    const finalUrl = this.addAuthToken(baseUrl);

    // Verificar que la URL es válida
    try {
      new URL(finalUrl);
      console.log("URL de streaming válida generada");
    } catch (e) {
      console.error("URL de streaming inválida:", finalUrl, e);
    }

    return finalUrl;
  },

  /**
   * Obtiene la URL de miniatura para un medio con el token de autenticación
   * @param {number} mediaId - ID del medio
   * @returns {string} URL de miniatura con autenticación
   */
  getThumbnailUrl(mediaId) {
    if (!mediaId) return "/assets/default-media.jpg";

    const token = localStorage.getItem("streamvio_token");
    if (!token) return "/assets/default-media.jpg";

    return this.addAuthToken(`${API_URL}/api/media/${mediaId}/thumbnail`);
  },

  /**
   * Configura axios para usar autenticación en todas las peticiones
   * @param {Object} axiosInstance - Instancia de axios a configurar
   */
  setupAxiosAuth(axiosInstance) {
    const token = localStorage.getItem("streamvio_token");
    if (token) {
      console.log("Configurando token de autenticación para axios");
      axiosInstance.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${token}`;
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
  },
};

// Exportar solo el objeto por defecto
export default authUrlHelper;
