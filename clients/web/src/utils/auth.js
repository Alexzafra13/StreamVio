// clients/web/src/utils/auth.js
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Utilidad unificada para gestionar autenticación en el cliente
 */
const auth = {
  /**
   * Obtiene el token JWT del localStorage
   * @returns {string|null} Token JWT o null si no hay sesión
   */
  getToken() {
    try {
      return localStorage.getItem("streamvio_token");
    } catch (error) {
      console.error("Error al acceder a localStorage:", error);
      return null;
    }
  },

  /**
   * Verifica si hay una sesión activa
   * @returns {boolean} true si hay una sesión activa
   */
  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * Obtiene información del usuario actual
   * @returns {Object|null} Datos del usuario o null si no hay sesión
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem("streamvio_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error("Error al obtener información del usuario:", error);
      return null;
    }
  },

  /**
   * Cierra la sesión actual
   */
  logout() {
    try {
      localStorage.removeItem("streamvio_token");
      localStorage.removeItem("streamvio_user");

      // Notificar cambio de autenticación
      window.dispatchEvent(new Event("streamvio-auth-change"));
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  },

  /**
   * Añade el token de autenticación a una URL como query parameter
   * @param {string} url - URL a la que se añadirá el token
   * @returns {string} URL con el token añadido
   */
  addTokenToUrl(url) {
    if (!url) return null;

    const token = this.getToken();
    if (!token) return url;

    const hasParams = url.includes("?");
    const separator = hasParams ? "&" : "?";

    return `${url}${separator}auth=${encodeURIComponent(token)}`;
  },

  /**
   * Obtiene headers de autorización para peticiones
   * @returns {Object} Headers con el token
   */
  getAuthHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  /**
   * Configura una instancia de axios con interceptores de autenticación
   * @param {Object} axiosInstance - Instancia de axios
   */
  setupAxios(axiosInstance) {
    // Interceptor para añadir token a todas las peticiones
    axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`,
          };
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor para manejar errores de autenticación
    axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        // Redirigir al login si hay error 401 (no autorizado)
        if (error.response && error.response.status === 401) {
          console.warn("Sesión expirada o no válida");

          // Solo redirigir si estamos en una página que requiere autenticación
          const publicPaths = ["/", "/auth", "/register", "/about", "/login"];
          const currentPath = window.location.pathname;

          if (!publicPaths.includes(currentPath)) {
            this.logout();
            window.location.href = `/auth?redirect=${encodeURIComponent(
              window.location.pathname
            )}`;
          }
        }
        return Promise.reject(error);
      }
    );
  },

  /**
   * Obtiene la URL de streaming de un medio
   * @param {string|number} mediaId - ID del medio
   * @returns {string} URL de streaming con token
   */
  getStreamUrl(mediaId) {
    if (!mediaId) return null;
    const baseUrl = `${API_URL}/api/media/${mediaId}/stream`;
    return this.addTokenToUrl(baseUrl);
  },

  /**
   * Obtiene la URL de la miniatura de un medio
   * @param {string|number} mediaId - ID del medio
   * @returns {string} URL de la miniatura con token
   */
  getThumbnailUrl(mediaId) {
    if (!mediaId) return null;
    const baseUrl = `${API_URL}/api/media/${mediaId}/thumbnail`;
    return this.addTokenToUrl(baseUrl);
  },
};

export default auth;
