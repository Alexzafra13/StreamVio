// Configuración unificada para API
// ya no necesitamos un puerto separado ya que todo se sirve desde el mismo origen

const getApiUrl = () => {
  // En el entorno de construcción, usar el valor de la variable de entorno
  if (import.meta.env.PUBLIC_API_URL) {
    return import.meta.env.PUBLIC_API_URL;
  }

  // En el navegador, usar la misma base URL que la aplicación
  if (typeof window !== "undefined") {
    // Simplemente usar el origen actual de la ventana
    return window.location.origin;
  }

  // Valor por defecto para entorno de servidor o SSR
  return "http://localhost:45000";
};

// Obtener la URL base de la API
const API_URL = getApiUrl();

// Mostrar la URL configurada para depuración
console.log("API URL configurada:", API_URL);

// Exportar la configuración
export default {
  API_URL,
  endpoints: {
    health: "/api/health",
    auth: "/api/auth",
    libraries: "/api/libraries",
    media: "/api/media",
    admin: "/api/admin",
    transcoding: "/api/transcoding",
    metadata: "/api/metadata",
    filesystem: "/api/filesystem",
  },
};
