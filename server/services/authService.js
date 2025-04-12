// clients/web/src/services/authService.js
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Servicio para gestionar autenticación y sesiones en el cliente
 */
class AuthService {
  constructor() {
    // Configurar interceptores de Axios al instanciar el servicio
    this.setupAxiosInterceptors();

    // Validar token al inicio para evitar problemas con tokens inválidos
    this.validateCurrentToken();
  }

  /**
   * Inicia sesión de usuario
   * @param {string} email
   * @param {string} password
   * @returns {Promise} Datos del usuario y token
   */
  async login(email, password) {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });

      if (response.data.token) {
        this.setToken(response.data.token);
        this.setUserData(response.data);
      }

      return response.data;
    } catch (error) {
      console.error("Error de login:", error);
      throw error;
    }
  }

  /**
   * Registra un nuevo usuario
   * @param {Object} userData
   * @returns {Promise} Datos del usuario registrado
   */
  async register(userData) {
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/register-with-invitation`,
        userData
      );

      if (response.data.token) {
        this.setToken(response.data.token);
        this.setUserData(response.data);
      }

      return response.data;
    } catch (error) {
      console.error("Error de registro:", error);
      throw error;
    }
  }

  /**
   * Cierra la sesión del usuario actual
   */
  logout() {
    localStorage.removeItem("streamvio_token");
    localStorage.removeItem("streamvio_user");

    // Eliminar token de axios headers
    delete axios.defaults.headers.common["Authorization"];

    // Notificar cambio de autenticación
    window.dispatchEvent(new Event("streamvio-auth-change"));
  }

  /**
   * Almacena el token JWT en localStorage
   * @param {string} token
   */
  setToken(token) {
    localStorage.setItem("streamvio_token", token);

    // Configurar Axios para usar este token
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  /**
   * Almacena datos del usuario en localStorage
   * @param {Object} userData
   */
  setUserData(userData) {
    const userInfo = {
      id: userData.userId,
      username: userData.username,
      email: userData.email,
      isAdmin: userData.isAdmin === true || userData.is_admin === 1,
    };

    localStorage.setItem("streamvio_user", JSON.stringify(userInfo));

    // Disparar evento de cambio de autenticación
    window.dispatchEvent(new Event("streamvio-auth-change"));
  }

  /**
   * Obtiene el token actual del localStorage
   * @returns {string|null} Token JWT o null
   */
  getToken() {
    try {
      return localStorage.getItem("streamvio_token");
    } catch (error) {
      console.error("Error al acceder a localStorage:", error);
      return null;
    }
  }

  /**
   * Obtiene información del usuario actual
   * @returns {Object|null} Datos del usuario o null
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem("streamvio_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error("Error al obtener información de usuario:", error);
      return null;
    }
  }

  /**
   * Verifica si hay una sesión activa
   * @returns {boolean} true si hay sesión activa
   */
  isLoggedIn() {
    return !!this.getToken();
  }

  /**
   * Verifica si el usuario actual es administrador
   * @returns {boolean} true si es administrador
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user && (user.isAdmin === true || user.is_admin === 1);
  }

  /**
   * Configura interceptores de Axios para manejar autenticación en todas las peticiones
   */
  setupAxiosInterceptors() {
    // Interceptor para añadir token a todas las peticiones
    axios.interceptors.request.use(
      (config) => {
        const token = this.getToken();

        if (token) {
          // Asegurar que el formato sea "Bearer <token>"
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor para manejar errores de autenticación
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Si hay error 401, puede ser token inválido o expirado
        if (error.response && error.response.status === 401) {
          console.warn("Sesión expirada o token inválido");

          // Solo cerrar sesión automáticamente si no es en rutas de login/registro
          const isAuthRoute =
            error.config.url.includes("/api/auth/login") ||
            error.config.url.includes("/api/auth/register");

          if (!isAuthRoute) {
            this.logout();

            // Redirigir a login (solo si estamos en una página privada)
            const publicPaths = ["/", "/auth", "/register", "/login"];
            if (!publicPaths.includes(window.location.pathname)) {
              window.location.href = "/auth";
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Valida el token actual para asegurarse que sea válido
   */
  async validateCurrentToken() {
    const token = this.getToken();

    if (!token) return;

    try {
      // Configurar el token en axios para esta petición específica
      const response = await axios.get(`${API_URL}/api/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Si el token es válido, actualizar datos del usuario
      if (response.data) {
        this.setUserData({
          userId: response.data.id,
          username: response.data.username,
          email: response.data.email,
          isAdmin:
            response.data.is_admin === 1 || response.data.isAdmin === true,
        });
      }
    } catch (error) {
      console.warn("Token inválido o expirado. Cerrando sesión...");
      this.logout();
    }
  }

  /**
   * Añade el token de autenticación a una URL (para recursos estáticos)
   * @param {string} url - URL base
   * @returns {string} URL con token añadido
   */
  addTokenToUrl(url) {
    const token = this.getToken();
    if (!token || !url) return url;

    const hasParams = url.includes("?");
    return `${url}${hasParams ? "&" : "?"}auth=${encodeURIComponent(token)}`;
  }

  /**
   * Obtiene la URL para un recurso multimedia con token
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {string} URL con token
   */
  getMediaUrl(mediaId) {
    if (!mediaId) return null;
    return this.addTokenToUrl(`${API_URL}/api/media/${mediaId}/stream`);
  }

  /**
   * Obtiene la URL para una miniatura con token
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {string} URL con token
   */
  getThumbnailUrl(mediaId) {
    if (!mediaId) return null;
    return this.addTokenToUrl(`${API_URL}/api/media/${mediaId}/thumbnail`);
  }
}

// Exportar instancia única del servicio
const authService = new AuthService();
export default authService;
