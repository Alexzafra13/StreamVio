// src/services/api.js
import axios from 'axios';

// Determinar URL base según el entorno
const getBaseUrl = () => {
  const url = import.meta.env.PUBLIC_API_URL;
  
  // Si es una URL absoluta, usarla directamente
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url;
  }
  
  // Si es una ruta relativa, usarla tal cual
  if (url) {
    return url;
  }
  
  // Por defecto, usar /api como ruta relativa
  return '/api';
};

// URL base de la API
const API_URL = getBaseUrl();

// Número máximo de reintentos para errores de red
const MAX_RETRIES = 2;

// Tiempo de espera para peticiones (milisegundos)
const REQUEST_TIMEOUT = 30000;

/**
 * Crear una instancia de Axios configurada
 * @returns {AxiosInstance} - Instancia de Axios configurada
 */
const createAxiosInstance = () => {
  const instance = axios.create({
    baseURL: API_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Interceptor para agregar token de autenticación a las peticiones
  instance.interceptors.request.use(
    (config) => {
      // Obtener token del localStorage
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (user && user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
      
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Interceptor para manejar respuestas y errores
  instance.interceptors.response.use(
    // Manejar respuestas exitosas
    (response) => {
      // Resetear contador de reintentos en el caso de éxito
      if (response.config._retryCount) {
        response.config._retryCount = 0;
      }
      
      // Devolver solo los datos de la respuesta para simplificar
      return response.data;
    },
    
    // Manejar errores
    async (error) => {
      const originalRequest = error.config;
      
      // Si es un error de red o timeout y no hemos alcanzado el máximo de reintentos
      if (
        (error.code === 'ECONNABORTED' || !error.response) &&
        (!originalRequest._retryCount || originalRequest._retryCount < MAX_RETRIES)
      ) {
        // Incrementar contador de reintentos
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        
        // Calcular retraso exponencial
        const delay = Math.pow(2, originalRequest._retryCount) * 1000;
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        
        // Reintentar la petición
        return instance(originalRequest);
      }
      
      // Si es un error 401 (No autorizado) y hay un token, puede ser token expirado
      if (error.response && error.response.status === 401) {
        const userStr = localStorage.getItem('user');
        
        if (userStr) {
          // Limpiar la sesión del usuario
          localStorage.removeItem('user');
          
          // Redireccionar a la página de login si es necesario
          if (window.location.pathname !== '/login') {
            window.location.href = '/login?session=expired';
          }
        }
      }
      
      // Formatear el error para uso más sencillo
      const formattedError = {
        status: error.response ? error.response.status : 0,
        statusText: error.response ? error.response.statusText : 'Network Error',
        message: error.response?.data?.message || error.message || 'Error desconocido',
        code: error.response?.data?.code || 'UNKNOWN_ERROR',
        data: error.response?.data || null,
        originalError: error,
      };
      
      return Promise.reject(formattedError);
    }
  );

  return instance;
};

// Crear instancia de API
const api = createAxiosInstance();

/**
 * Utilidad para crear un token de cancelación
 * @returns {Object} - Fuente de cancelación y token
 */
export const createCancelToken = () => {
  const controller = new AbortController();
  return {
    source: controller,
    token: controller.signal
  };
};

/**
 * Cliente HTTP con métodos para interactuar con la API
 */
const apiClient = {
  /**
   * Realizar una petición GET
   * @param {string} url - URL del endpoint
   * @param {Object} [params={}] - Parámetros de consulta
   * @param {Object} [options={}] - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  get: (url, params = {}, options = {}) => {
    return api.get(url, { params, ...options });
  },

  /**
   * Realizar una petición POST
   * @param {string} url - URL del endpoint
   * @param {Object} [data={}] - Datos a enviar
   * @param {Object} [options={}] - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  post: (url, data = {}, options = {}) => {
    return api.post(url, data, options);
  },

  /**
   * Realizar una petición PUT
   * @param {string} url - URL del endpoint
   * @param {Object} [data={}] - Datos a enviar
   * @param {Object} [options={}] - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  put: (url, data = {}, options = {}) => {
    return api.put(url, data, options);
  },

  /**
   * Realizar una petición DELETE
   * @param {string} url - URL del endpoint
   * @param {Object} [options={}] - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  delete: (url, options = {}) => {
    return api.delete(url, options);
  },

  /**
   * Realizar una petición PATCH
   * @param {string} url - URL del endpoint
   * @param {Object} [data={}] - Datos a enviar
   * @param {Object} [options={}] - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  patch: (url, data = {}, options = {}) => {
    return api.patch(url, data, options);
  },

  /**
   * Realizar varias peticiones en paralelo
   * @param {Array<Function>} requests - Array de funciones que devuelven promesas
   * @returns {Promise<Array>} - Array con los resultados de las peticiones
   */
  all: (requests) => {
    return Promise.all(requests);
  },

  /**
   * Verificar si la API está disponible
   * @returns {Promise<boolean>} - true si la API está disponible
   */
  checkHealth: async () => {
    try {
      // Intentar hacer una petición simple a la API
      await api.get('/health', { timeout: 5000 });
      return true;
    } catch (error) {
      console.error('API no disponible:', error);
      return false;
    }
  },

  /**
   * Establecer token JWT para autenticación
   * @param {string} token - Token JWT
   */
  setAuthToken: (token) => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  },

  /**
   * Obtener URL completa de la API
   * @param {string} path - Ruta relativa
   * @returns {string} - URL completa
   */
  getApiUrl: (path) => {
    return `${API_URL}${path}`;
  },

  /**
   * Acceso a la instancia de Axios para configuración avanzada
   */
  instance: api,
};

export default apiClient;