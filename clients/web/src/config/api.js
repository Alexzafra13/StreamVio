// Utilizamos una función para determinar la URL base de la API
const getApiUrl = () => {
  // En el entorno de construcción, usar el valor de la variable de entorno
  if (import.meta.env.PUBLIC_API_URL) {
    return import.meta.env.PUBLIC_API_URL;
  }

  // En el navegador, intentar inferir desde la ubicación actual
  if (typeof window !== "undefined") {
    // Obtener la base de la URL actual (protocolo + hostname)
    const baseUrl = `${window.location.protocol}//${window.location.hostname}`;
    // Añadir el puerto 8000 para la API
    return `${baseUrl}:8000`;
  }

  // Valor por defecto para entorno de servidor o SSR
  return "http://localhost:8000";
};

// Obtener la URL de la API
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
