// src/services/userService.js
import axios from "axios";
import authService from "./authService.js";

// URL base de la API
const API_URL = import.meta.env.PUBLIC_API_URL || "http://localhost:3000/api";

/**
 * Configurar los headers de autorización para las peticiones
 * @returns {Object} - Headers con el token de autorización
 */
const authHeader = () => {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Servicio para operaciones relacionadas con usuarios
 */
const userService = {
  /**
   * Obtener todos los usuarios (solo administradores)
   * @returns {Promise<Array>} - Lista de usuarios
   */
  async getAllUsers() {
    try {
      const response = await axios.get(`${API_URL}/users`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener detalles de un usuario específico
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} - Detalles del usuario
   */
  async getUserById(userId) {
    try {
      const response = await axios.get(`${API_URL}/users/${userId}`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Crear un nuevo usuario (solo administradores)
   * @param {Object} userData - Datos del nuevo usuario
   * @returns {Promise<Object>} - Usuario creado
   */
  async createUser(userData) {
    try {
      const response = await axios.post(`${API_URL}/users`, userData, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Actualizar información de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<Object>} - Usuario actualizado
   */
  async updateUser(userId, userData) {
    try {
      const response = await axios.put(`${API_URL}/users/${userId}`, userData, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Eliminar un usuario (solo administradores)
   * @param {number} userId - ID del usuario a eliminar
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async deleteUser(userId) {
    try {
      const response = await axios.delete(`${API_URL}/users/${userId}`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Cambiar contraseña del usuario
   * @param {number} userId - ID del usuario
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const response = await axios.post(
        `${API_URL}/users/${userId}/password`,
        { currentPassword, newPassword },
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Activar/desactivar privilegios de administrador (solo administradores)
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async toggleAdmin(userId) {
    try {
      const response = await axios.post(
        `${API_URL}/users/${userId}/toggle-admin`,
        {},
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener bibliotecas accesibles para un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array>} - Lista de bibliotecas
   */
  async getUserLibraries(userId) {
    try {
      const response = await axios.get(`${API_URL}/users/${userId}/libraries`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Crear un código de invitación (solo administradores)
   * @returns {Promise<Object>} - Datos del código de invitación
   */
  async createInvitation() {
    try {
      const response = await axios.post(
        `${API_URL}/auth/create-invitation`,
        {},
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verificar si un usuario tiene permisos de administrador
   * @param {Object} user - Objeto usuario
   * @returns {boolean} - true si es administrador
   */
  isAdmin(user) {
    return user && user.isAdmin === true;
  },

  /**
   * Actualizar la información del perfil del usuario actual
   * @param {Object} profileData - Datos a actualizar
   * @returns {Promise<Object>} - Perfil actualizado
   */
  async updateProfile(profileData) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error("No hay usuario autenticado");
      }

      const response = await axios.put(
        `${API_URL}/users/${currentUser.id}`,
        profileData,
        { headers: authHeader() }
      );

      // Actualizar datos en localStorage para mantener consistencia
      const updatedUser = {
        ...currentUser,
        ...response.data.user,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener todos los códigos de invitación (solo administradores)
   * @returns {Promise<Array>} - Lista de códigos de invitación
   */
  async getInvitationCodes() {
    try {
      const response = await axios.get(`${API_URL}/auth/invitations`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default userService;
