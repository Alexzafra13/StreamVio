// clients/web/src/utils/appInit.js
import axios from "axios";
import authService from "../services/authService";

/**
 * Función para inicializar la aplicación
 * - Configura interceptores de Axios
 * - Verifica el estado de autenticación
 * - Establece listeners para eventos de autenticación
 */
const initializeApp = () => {
  console.log("🚀 Inicializando aplicación StreamVio...");

  // 1. Verificar estado de autenticación inicial
  const isAuthenticated = authService.isLoggedIn();
  console.log(
    `Estado de autenticación inicial: ${
      isAuthenticated ? "Autenticado" : "No autenticado"
    }`
  );

  // 2. Si hay un token, asegurarse de que se usa en todas las peticiones
  if (isAuthenticated) {
    const token = authService.getToken();
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    console.log("Token de autenticación configurado globalmente");
  }

  // 3. Mejorar el fetch nativo para incluir token automáticamente
  enhanceFetch();
  console.log("Fetch nativo mejorado para incluir token de autenticación");

  // 4. Verificar validez del token periódicamente
  setupTokenRefresh();
  console.log("Verificación periódica de token configurada");
};

/**
 * Mejora el método fetch nativo para incluir token de autenticación
 */
const enhanceFetch = () => {
  const originalFetch = window.fetch;

  window.fetch = function (resource, options = {}) {
    // No modificar si no es string (Request objects, etc)
    if (typeof resource !== "string") {
      return originalFetch.call(this, resource, options);
    }

    // Detectar si es una petición a nuestra API o recursos
    const isApiRequest = resource.includes("/api/");
    const isResourceRequest =
      resource.includes("/stream") || resource.includes("/thumbnail");

    if (!isApiRequest && !isResourceRequest) {
      return originalFetch.call(this, resource, options);
    }

    // Obtener token de autenticación
    const token = authService.getToken();
    if (!token) {
      return originalFetch.call(this, resource, options);
    }

    // Si es API, agregar Authorization header
    if (isApiRequest) {
      options.headers = options.headers || {};
      if (!options.headers.Authorization && !options.headers.authorization) {
        options.headers.Authorization = `Bearer ${token}`;
      }
    }

    // Si es recurso (streaming/thumbnails), agregar token como parámetro
    if (isResourceRequest) {
      const hasParams = resource.includes("?");
      resource = `${resource}${hasParams ? "&" : "?"}auth=${encodeURIComponent(
        token
      )}`;
    }

    return originalFetch.call(this, resource, options);
  };
};

/**
 * Configura la verificación y refresco periódico del token
 */
const setupTokenRefresh = () => {
  // Verificar el token cada 5 minutos
  setInterval(() => {
    if (authService.isLoggedIn()) {
      authService.validateCurrentToken().catch((error) => {
        console.warn("Error al validar token:", error);
        // Si hay error de validación, cerrar sesión
        authService.logout();
      });
    }
  }, 5 * 60 * 1000); // Cada 5 minutos
};

/**
 * Inicializa la aplicación cuando se carga la ventana
 */
window.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});

export default initializeApp;
