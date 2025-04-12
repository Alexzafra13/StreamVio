// clients/web/src/services/authService.js
import axios from "axios";

class AuthService {
  constructor() {
    // Determinar la URL base de la API
    this.API_URL = this.getApiUrl();
    console.log(
      "Servicio de autenticación inicializado con URL:",
      this.API_URL
    );

    // Configurar axios con interceptores para autenticación
    this.setupAxiosInterceptors();
  }

  /**
   * Obtiene la URL de la API basada en la ubicación actual
   */
  getApiUrl() {
    // En el navegador, usar la misma base URL que la aplicación
    if (typeof window !== "undefined" && window.location) {
      return window.location.origin;
    }
    // Valor por defecto
    return "http://localhost:45000";
  }

  /**
   * Configura interceptores de Axios para manejar tokens automáticamente
   */
  setupAxiosInterceptors() {
    // Interceptor para añadir token a todas las peticiones
    axios.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor para manejar errores de autenticación
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Si hay error de autenticación en una ruta distinta al login
          const isAuthRoute = error.config.url.includes("/api/auth/login");

          if (!isAuthRoute) {
            console.warn("Sesión expirada o token inválido");
            // No cerrar sesión automáticamente en rutas de auth
            this.logout();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Inicia sesión con email y contraseña
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object>} - Datos del usuario y token
   */
  async login(email, password) {
    try {
      const response = await axios.post(`${this.API_URL}/api/auth/login`, {
        email,
        password,
      });

      if (response.data && response.data.token) {
        // Guardar token y datos del usuario
        localStorage.setItem("streamvio_token", response.data.token);

        const userData = {
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
          isAdmin: response.data.isAdmin,
        };

        localStorage.setItem("streamvio_user", JSON.stringify(userData));

        // Configurar headers para solicitudes futuras
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;

        // Notificar cambio de autenticación
        this.notifyAuthChange();

        return response.data;
      } else {
        throw new Error("Respuesta de login inválida");
      }
    } catch (error) {
      console.error("Error de inicio de sesión:", error);
      throw error;
    }
  }

  /**
   * Registra un nuevo usuario con una invitación
   * @param {Object} userData - Datos del nuevo usuario
   * @returns {Promise<Object>} - Datos del usuario registrado
   */
  async registerWithInvitation(userData) {
    try {
      const response = await axios.post(
        `${this.API_URL}/api/auth/register-with-invitation`,
        userData
      );

      if (response.data && response.data.token) {
        // Guardar token y datos del usuario
        localStorage.setItem("streamvio_token", response.data.token);

        const user = {
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
          isAdmin: response.data.isAdmin || false,
        };

        localStorage.setItem("streamvio_user", JSON.stringify(user));

        // Configurar headers para solicitudes futuras
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;

        // Notificar cambio de autenticación
        this.notifyAuthChange();

        return response.data;
      } else {
        throw new Error("Respuesta de registro inválida");
      }
    } catch (error) {
      console.error("Error de registro:", error);
      throw error;
    }
  }

  /**
   * Configura el primer usuario administrador
   * @param {Object} userData - Datos del primer usuario
   * @returns {Promise<Object>} - Datos del usuario creado
   */
  async setupFirstUser(userData) {
    try {
      const response = await axios.post(
        `${this.API_URL}/api/auth/setup-first-user`,
        userData
      );

      if (response.data && response.data.token) {
        // Guardar token y datos del usuario
        localStorage.setItem("streamvio_token", response.data.token);

        const user = {
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
          isAdmin: true, // Siempre es admin en la configuración inicial
        };

        localStorage.setItem("streamvio_user", JSON.stringify(user));

        // Configurar headers para solicitudes futuras
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;

        // Notificar cambio de autenticación
        this.notifyAuthChange();

        return response.data;
      } else {
        throw new Error("Respuesta de configuración inválida");
      }
    } catch (error) {
      console.error("Error en configuración inicial:", error);
      throw error;
    }
  }

  /**
   * Cierra la sesión del usuario actual
   */
  logout() {
    localStorage.removeItem("streamvio_token");
    localStorage.removeItem("streamvio_user");

    // Eliminar token de headers
    delete axios.defaults.headers.common["Authorization"];

    // Notificar cambio de autenticación
    this.notifyAuthChange();
  }

  /**
   * Emite un evento para notificar cambio en la autenticación
   */
  notifyAuthChange() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("streamvio-auth-change"));
    }
  }

  /**
   * Obtiene el token de autenticación actual
   * @returns {string|null} - Token JWT o null
   */
  getToken() {
    try {
      return localStorage.getItem("streamvio_token");
    } catch (error) {
      console.error("Error al obtener token:", error);
      return null;
    }
  }

  /**
   * Obtiene los datos del usuario actual
   * @returns {Object|null} - Datos del usuario o null
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem("streamvio_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error("Error al obtener datos de usuario:", error);
      return null;
    }
  }

  /**
   * Verifica si hay un usuario autenticado
   * @returns {boolean} - true si hay usuario autenticado
   */
  isLoggedIn() {
    return !!this.getToken();
  }

  /**
   * Verifica si el usuario actual es administrador
   * @returns {boolean} - true si es administrador
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.isAdmin === true;
  }

  /**
   * Obtiene URL para recursos con token de autenticación
   * @param {string} url - URL base del recurso
   * @returns {string} - URL con token incluido
   */
  addTokenToUrl(url) {
    const token = this.getToken();
    if (!token) return url;

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}auth=${encodeURIComponent(token)}`;
  }

  /**
   * Obtiene la URL para una miniatura con token
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {string} - URL de la miniatura con token
   */
  getThumbnailUrl(mediaId) {
    if (!mediaId) return "/assets/default-media.jpg";
    const url = `${this.API_URL}/api/media/${mediaId}/thumbnail`;
    return this.addTokenToUrl(url);
  }

  /**
   * Obtiene la URL para streaming con token
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {string} - URL de streaming con token
   */
  getStreamUrl(mediaId) {
    if (!mediaId) return null;
    const url = `${this.API_URL}/api/media/${mediaId}/stream`;
    return this.addTokenToUrl(url);
  }

  /**
   * Verifica que un token sea válido haciendo una petición al servidor
   * @returns {Promise<boolean>} - true si el token es válido
   */
  async validateToken() {
    try {
      const token = this.getToken();
      if (!token) return false;

      const response = await axios.get(`${this.API_URL}/api/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return !!response.data;
    } catch (error) {
      console.warn("Error al validar token:", error.message);
      return false;
    }
  }

  /**
   * Cambia la contraseña del usuario actual
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await axios.post(
        `${this.API_URL}/api/auth/change-password`,
        {
          currentPassword,
          newPassword,
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
      throw error;
    }
  }
}

// Exportar una instancia única del servicio
const authService = new AuthService();
export default authService;
