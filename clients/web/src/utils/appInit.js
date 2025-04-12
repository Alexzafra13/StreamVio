// clients/web/src/utils/appInit.js
import axios from "axios";
import auth from "./auth";

/**
 * Inicializa la aplicación con todas las configuraciones necesarias
 * - Configura axios para autenticación automática
 * - Mejora fetch nativo para incluir tokens de autenticación
 * - Configura eventos para detectar cambios de sesión
 */
const initializeApp = () => {
  console.log("Inicializando aplicación StreamVio...");

  // 1. Configurar axios para incluir token en todas las peticiones
  auth.setupAxios(axios);

  // 2. Mejorar fetch nativo para incluir token automáticamente
  enhanceFetch();

  // 3. Configurar listeners para eventos de autenticación
  setupAuthListeners();

  // 4. Verificar estado de autenticación inicial
  checkAuthStatus();

  console.log("Inicialización de la aplicación completada");
};

/**
 * Mejora el método fetch nativo para incluir token de autenticación
 * para peticiones a nuestra API y recursos
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
      resource.includes("/stream") ||
      resource.includes("/thumbnail") ||
      resource.includes("/data/");

    if (!isApiRequest && !isResourceRequest) {
      return originalFetch.call(this, resource, options);
    }

    // Obtener token de autenticación
    const token = auth.getToken();
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
      resource = auth.addTokenToUrl(resource);
    }

    return originalFetch.call(this, resource, options);
  };
};

/**
 * Configura listeners para detectar cambios en la autenticación
 */
const setupAuthListeners = () => {
  // Listener para cambios en localStorage (otras pestañas)
  window.addEventListener("storage", (event) => {
    if (event.key === "streamvio_token") {
      if (!event.newValue) {
        // Token eliminado en otra pestaña
        console.log("Sesión cerrada en otra pestaña");
        redirectIfProtectedPage();
      } else if (event.newValue !== event.oldValue) {
        // Token actualizado en otra pestaña
        console.log("Sesión actualizada en otra pestaña");
        auth.setupAxios(axios);
      }
    }
  });

  // Listener para evento personalizado de cambios de autenticación
  window.addEventListener("streamvio-auth-change", () => {
    console.log("Evento de cambio de autenticación detectado");

    // Si no hay token y estamos en página protegida, redirigir
    if (!auth.isLoggedIn()) {
      redirectIfProtectedPage();
    }
  });
};

/**
 * Verifica el estado de autenticación al iniciar la aplicación
 */
const checkAuthStatus = () => {
  if (!auth.isLoggedIn()) {
    console.log("Iniciando sin sesión activa");
    redirectIfProtectedPage();
    return;
  }

  console.log("Sesión activa detectada");

  // Verificar token periódicamente
  setInterval(() => {
    verifyTokenValidity();
  }, 5 * 60 * 1000); // Cada 5 minutos

  // Verificar inmediatamente
  verifyTokenValidity();
};

/**
 * Verifica si el token actual es válido
 */
const verifyTokenValidity = async () => {
  if (!auth.isLoggedIn()) return;

  try {
    await axios.get("/api/auth/user", {
      headers: auth.getAuthHeaders(),
    });
    console.log("Token válido verificado");
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.warn("Token inválido o expirado");
      auth.logout();
      redirectIfProtectedPage();
    }
  }
};

/**
 * Redirige al login si estamos en una página protegida
 */
const redirectIfProtectedPage = () => {
  // Lista de rutas públicas que no requieren autenticación
  const publicPaths = ["/", "/auth", "/login", "/register", "/about"];
  const currentPath = window.location.pathname;

  if (
    !publicPaths.includes(currentPath) &&
    !currentPath.startsWith("/public/")
  ) {
    // Guardar la URL actual para redirigir después del login
    const returnUrl = encodeURIComponent(
      window.location.pathname + window.location.search
    );
    window.location.href = `/auth?redirect=${returnUrl}`;
  }
};

export default initializeApp;
