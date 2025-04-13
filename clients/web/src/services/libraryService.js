// src/services/libraryService.js
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
 * Servicio para operaciones relacionadas con bibliotecas
 */
const libraryService = {
  /**
   * Obtener todas las bibliotecas accesibles para el usuario
   * @param {boolean} [includeItemCount=false] - Incluir conteo de elementos
   * @returns {Promise<Array>} - Lista de bibliotecas
   */
  async getAllLibraries(includeItemCount = false) {
    try {
      const response = await axios.get(`${API_URL}/libraries`, {
        headers: authHeader(),
        params: { count: includeItemCount },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener detalles de una biblioteca específica
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Object>} - Detalles de la biblioteca
   */
  async getLibraryById(libraryId) {
    try {
      const response = await axios.get(`${API_URL}/libraries/${libraryId}`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Crear una nueva biblioteca
   * @param {Object} libraryData - Datos de la biblioteca
   * @returns {Promise<Object>} - Biblioteca creada
   */
  async createLibrary(libraryData) {
    try {
      const response = await axios.post(`${API_URL}/libraries`, libraryData, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Actualizar una biblioteca existente
   * @param {number} libraryId - ID de la biblioteca
   * @param {Object} libraryData - Datos a actualizar
   * @returns {Promise<Object>} - Biblioteca actualizada
   */
  async updateLibrary(libraryId, libraryData) {
    try {
      const response = await axios.put(
        `${API_URL}/libraries/${libraryId}`,
        libraryData,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Eliminar una biblioteca
   * @param {number} libraryId - ID de la biblioteca a eliminar
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async deleteLibrary(libraryId) {
    try {
      const response = await axios.delete(`${API_URL}/libraries/${libraryId}`, {
        headers: authHeader(),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Iniciar un escaneo de contenido en una biblioteca
   * @param {number} libraryId - ID de la biblioteca a escanear
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async scanLibrary(libraryId) {
    try {
      const response = await axios.post(
        `${API_URL}/libraries/${libraryId}/scan`,
        {},
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Buscar metadatos para los elementos de una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async enrichLibrary(libraryId) {
    try {
      const response = await axios.post(
        `${API_URL}/libraries/${libraryId}/enrich`,
        {},
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener elementos multimedia de una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {Object} [options={}] - Opciones de paginación y filtrado
   * @returns {Promise<Object>} - Elementos y datos de paginación
   */
  async getLibraryMedia(libraryId, options = {}) {
    try {
      const response = await axios.get(
        `${API_URL}/libraries/${libraryId}/media`,
        {
          headers: authHeader(),
          params: options,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener permisos de usuarios para una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Object>} - Lista de usuarios con sus permisos
   */
  async getLibraryUsers(libraryId) {
    try {
      const response = await axios.get(
        `${API_URL}/libraries/${libraryId}/users`,
        {
          headers: authHeader(),
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Actualizar acceso de un usuario a una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {number} userId - ID del usuario
   * @param {boolean} hasAccess - Si tiene acceso
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async updateUserAccess(libraryId, userId, hasAccess) {
    try {
      const response = await axios.post(
        `${API_URL}/libraries/${libraryId}/users`,
        { userId, hasAccess },
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Buscar carpetas potenciales para bibliotecas
   * @param {string} [basePath='/'] - Ruta base para buscar
   * @returns {Promise<Array>} - Lista de carpetas encontradas
   */
  async findPotentialDirectories(basePath = "/") {
    try {
      const response = await axios.get(`${API_URL}/libraries/directories`, {
        headers: authHeader(),
        params: { path: basePath },
      });
      return response.data;
    } catch (error) {
      // Si el endpoint no está implementado, simular respuesta vacía
      console.error("Error al buscar directorios:", error);
      return [];
    }
  },

  /**
   * Obtener tipos de contenido disponibles para bibliotecas
   * @returns {Array} - Lista de tipos de biblioteca
   */
  getLibraryTypes() {
    return [
      { id: "movies", name: "Películas" },
      { id: "series", name: "Series" },
      { id: "music", name: "Música" },
      { id: "photos", name: "Fotos" },
    ];
  },

  /**
   * Obtener estadísticas de una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Object>} - Estadísticas de la biblioteca
   */
  async getLibraryStats(libraryId) {
    try {
      const response = await axios.get(
        `${API_URL}/libraries/${libraryId}/stats`,
        {
          headers: authHeader(),
        }
      );
      return response.data;
    } catch (error) {
      // Si el endpoint no está implementado, simular respuesta
      console.error("Error al obtener estadísticas:", error);
      return {
        totalItems: 0,
        recentlyAdded: 0,
        totalSize: 0,
        categories: [],
      };
    }
  },
};

export default libraryService;
