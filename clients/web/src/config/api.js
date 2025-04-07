// Configuración unificada para API
// ya no necesitamos un puerto separado ya que todo se sirve desde el mismo origen

const getApiUrl = () => {
  try {
    // En el entorno de construcción, usar el valor de la variable de entorno
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.PUBLIC_API_URL
    ) {
      console.log("Usando PUBLIC_API_URL:", import.meta.env.PUBLIC_API_URL);
      return import.meta.env.PUBLIC_API_URL;
    }

    // En el navegador, usar la misma base URL que la aplicación
    if (typeof window !== "undefined" && window.location) {
      console.log("Usando window.location.origin:", window.location.origin);
      return window.location.origin;
    }

    // Valor por defecto para entorno de servidor o SSR
    console.log("Usando valor por defecto: http://localhost:45000");
    return "http://localhost:45000";
  } catch (error) {
    console.error("Error al configurar API_URL:", error);
    // Fallback seguro
    return "http://localhost:45000";
  }
};

// Obtener la URL base de la API
const API_URL = getApiUrl();

// Mostrar la URL configurada para depuración
console.log("API URL configurada:", API_URL);

// Exportar la configuración
const config = {
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
    librarySetup: "/api/library-setup",
    permissionsCheck: "/api/filesystem/check-permissions",
    pathSuggestions: "/api/filesystem/suggest-paths",
  },
};

// Verificar que el objeto de configuración está bien formado antes de exportarlo
if (!config || typeof config !== "object") {
  console.error("Error: La configuración no es un objeto válido", config);
  // Proporcionar un objeto de configuración predeterminado seguro
  config = {
    API_URL: "http://localhost:45000",
    endpoints: {
      // endpoints básicos
      auth: "/api/auth",
      media: "/api/media",
      libraries: "/api/libraries",
    },
  };
}

export default config;
