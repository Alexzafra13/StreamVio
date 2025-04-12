// clients/web/src/config/api.js
/**
 * Configuración unificada para acceso a la API
 * - Detección automática de entorno
 * - Gestión de URLs
 * - Funciones de ayuda para recursos
 */

/**
 * Determina la URL base de la API según el entorno
 * @returns {string} URL base de la API
 */
const getApiUrl = () => {
  try {
    // En el entorno de construcción, usar el valor de la variable de entorno
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.PUBLIC_API_URL
    ) {
      return import.meta.env.PUBLIC_API_URL;
    }

    // En el navegador, usar la misma base URL que la aplicación
    if (typeof window !== "undefined" && window.location) {
      // Usar el origen de la ventana actual (protocolo + dominio + puerto)
      return window.location.origin;
    }

    // Valor por defecto para entorno de servidor o SSR
    return "http://localhost:45000";
  } catch (error) {
    console.error("Error al configurar API_URL:", error);
    // Fallback seguro
    return "http://localhost:45000";
  }
};

// Obtener la URL base de la API
const API_URL = getApiUrl();

// Mostrar la URL configurada (sólo en desarrollo para depuración)
if (process.env.NODE_ENV !== "production") {
  console.log("API URL configurada:", API_URL);
}

/**
 * Configuración completa de la API
 */
const apiConfig = {
  // URL base para todas las peticiones
  API_URL,

  // Rutas específicas de la API
  endpoints: {
    auth: {
      login: "/api/auth/login",
      register: "/api/auth/register",
      registerWithInvitation: "/api/auth/register-with-invitation",
      user: "/api/auth/user",
      checkFirstTime: "/api/auth/check-first-time",
      verifyInvitation: "/api/auth/verify-invitation",
      createInvitation: "/api/auth/create-invitation",
      changePassword: "/api/auth/change-password",
      verifyAdmin: "/api/auth/verify-admin",
      refreshToken: "/api/auth/refresh-token",
      invitations: "/api/auth/invitations",
    },
    media: {
      list: "/api/media",
      details: (id) => `/api/media/${id}`,
      stream: (id) => `/api/media/${id}/stream`,
      thumbnail: (id) => `/api/media/${id}/thumbnail`,
      progress: (id) => `/api/media/${id}/progress`,
    },
    user: {
      history: "/api/user/history",
      mediaHistory: (id) => `/api/user/media/${id}/history`,
    },
    admin: {
      stats: "/api/admin/stats",
      users: "/api/admin/users",
      toggleAdmin: (id) => `/api/admin/users/${id}/toggle-admin`,
      system: "/api/admin/system",
      userCount: "/api/admin/users/count",
      userLibraries: (id) => `/api/admin/users/${id}/libraries`,
    },
    libraries: {
      list: "/api/libraries",
      create: "/api/libraries",
      details: (id) => `/api/libraries/${id}`,
    },
    system: {
      health: "/api/health",
    },
  },

  /**
   * Crea una URL completa para un endpoint de la API
   * @param {string} endpoint - Ruta del endpoint
   * @returns {string} URL completa
   */
  getUrl(endpoint) {
    return `${this.API_URL}${endpoint}`;
  },

  /**
   * Obtiene los headers básicos para peticiones a la API
   * @returns {Object} Headers básicos
   */
  getHeaders() {
    let headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Añadir token si está disponible
    try {
      const token = localStorage.getItem("streamvio_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn("No se pudo acceder a localStorage para el token");
    }

    return headers;
  },
};

export default apiConfig;
