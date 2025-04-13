// src/services/authService.js
import axios from "axios";

// URL base de la API, se puede cambiar en producción
const API_URL = import.meta.env.PUBLIC_API_URL || "http://localhost:3000/api";

// Servicio para manejar la autenticación y operaciones relacionadas con usuarios
const authService = {
  /**
   * Iniciar sesión de usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object>} - Datos del usuario y token JWT
   */
  async login(email, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      if (response.data.token) {
        // Guardar token en localStorage para persistencia de sesión
        localStorage.setItem("user", JSON.stringify(response.data));
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Cerrar sesión de usuario
   */
  async logout() {
    try {
      // Enviar solicitud para invalidar el token en el servidor
      const user = this.getCurrentUser();
      if (user && user.token) {
        await axios.post(
          `${API_URL}/auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
      }
    } catch (error) {
      console.error("Error en logout:", error);
    } finally {
      // Siempre eliminar datos locales
      localStorage.removeItem("user");
    }
  },

  /**
   * Registrar un nuevo usuario con código de invitación
   * @param {Object} userData - Datos del usuario para registro
   * @returns {Promise<Object>} - Datos del usuario registrado
   */
  async register(userData) {
    try {
      const response = await axios.post(
        `${API_URL}/auth/register-with-invitation`,
        userData
      );

      if (response.data.token) {
        localStorage.setItem("user", JSON.stringify(response.data));
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener datos del usuario autenticado
   * @returns {Promise<Object>} - Datos actualizados del usuario
   */
  async getUserProfile() {
    try {
      const user = this.getCurrentUser();

      if (!user || !user.token) {
        throw new Error("No hay usuario autenticado");
      }

      const response = await axios.get(`${API_URL}/auth/user`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Cambiar contraseña del usuario
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const user = this.getCurrentUser();

      if (!user || !user.token) {
        throw new Error("No hay usuario autenticado");
      }

      const response = await axios.post(
        `${API_URL}/auth/change-password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verificar si es la primera ejecución del sistema
   * @returns {Promise<boolean>} - true si es la primera ejecución
   */
  async checkFirstTime() {
    try {
      const response = await axios.get(`${API_URL}/auth/check-first-time`);
      return response.data.isFirstTime;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Configurar el primer usuario administrador
   * @param {Object} userData - Datos del administrador inicial
   * @returns {Promise<Object>} - Datos del usuario creado
   */
  async setupFirstUser(userData) {
    try {
      const response = await axios.post(
        `${API_URL}/auth/setup-first-user`,
        userData
      );

      if (response.data.token) {
        localStorage.setItem("user", JSON.stringify(response.data));
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Generar un código de invitación
   * @returns {Promise<Object>} - Código de invitación generado
   */
  async createInvitation() {
    try {
      const user = this.getCurrentUser();

      if (!user || !user.token) {
        throw new Error("No hay usuario autenticado");
      }

      const response = await axios.post(
        `${API_URL}/auth/create-invitation`,
        {},
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener el usuario actual del almacenamiento local
   * @returns {Object|null} - Datos del usuario o null si no está autenticado
   */
  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Verificar si el usuario actual es administrador
   * @returns {boolean} - true si el usuario es administrador
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.isAdmin === true;
  },

  /**
   * Verificar si hay un usuario autenticado
   * @returns {boolean} - true si hay un usuario autenticado
   */
  isAuthenticated() {
    return !!this.getCurrentUser();
  },

  /**
   * Obtener el token JWT del usuario actual
   * @returns {string|null} - Token JWT o null si no hay usuario autenticado
   */
  getToken() {
    const user = this.getCurrentUser();
    return user ? user.token : null;
  },
};

export default authService;
