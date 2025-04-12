// clients/web/src/utils/appInit.js
import axios from "axios";
import { setupAxiosAuth } from "./authUrl";

/**
 * Inicializa la aplicación configurando todo lo necesario
 * - Configura axios con interceptores de autenticación
 * - Configura handlers globales para errores de fetch/xhr
 * - Configura eventos para detectar cambios de autenticación
 */
const initializeApp = () => {
  console.log("Inicializando aplicación StreamVio...");

  // 1. Configurar axios para autenticación
  setupAxiosAuth(axios);

  // 2. Sobrescribir fetch nativo para añadir token cuando sea necesario
  enhanceFetch();

  // 3. Configurar listener para eventos de autenticación
  setupAuthListeners();

  // 4. Verificar estado de autenticación
  checkAuthStatus();

  console.log("Inicialización completada");
};

/**
 * Mejora fetch nativo para incluir token de autenticación
 * en solicitudes a nuestra API
 */
const enhanceFetch = () => {
  const originalFetch = window.fetch;

  window.fetch = function (resource, options = {}) {
    const token = localStorage.getItem("streamvio_token");

    // Solo modificar solicitudes a nuestra API
    if (
      token &&
      typeof resource === "string" &&
      (resource.startsWith("/api/") || resource.includes("/data/"))
    ) {
      // Inicializar headers si no existen
      options.headers = options.headers || {};

      // Añadir token si no está ya presente
      if (!options.headers.Authorization && !options.headers.authorization) {
        options.headers.Authorization = `Bearer ${token}`;
      }

      // Para recursos multimedia que no aceptan headers (streaming, thumbnails)
      if (
        resource.includes("/stream") ||
        resource.includes("/thumbnail") ||
        resource.includes("/data/")
      ) {
        // Añadir token como parámetro de consulta
        const hasParams = resource.includes("?");
        const separator = hasParams ? "&" : "?";
        resource = `${resource}${separator}auth=${token}`;
      }
    }

    // Continuar con el fetch original
    return originalFetch.call(this, resource, options);
  };
};

/**
 * Configura listeners para eventos de autenticación
 */
const setupAuthListeners = () => {
  // Escuchar eventos de almacenamiento (cambios en otras pestañas)
  window.addEventListener("storage", (event) => {
    if (event.key === "streamvio_token") {
      console.log("Token cambiado en otra pestaña");

      // Si el token fue eliminado, redirigir al login
      if (!event.newValue && window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }

      // Si se añadió un nuevo token, actualizar
      if (event.newValue) {
        setupAxiosAuth(axios);
      }
    }
  });

  // Escuchar evento personalizado para cambios de autenticación en la misma pestaña
  window.addEventListener("streamvio-auth-change", () => {
    console.log("Evento de cambio de autenticación detectado");
    setupAxiosAuth(axios);

    // Si no hay token, redirigir a login si no estamos ya ahí
    const token = localStorage.getItem("streamvio_token");
    if (!token && window.location.pathname !== "/auth") {
      window.location.href = "/auth";
    }
  });
};

/**
 * Verifica el estado actual de autenticación
 */
const checkAuthStatus = () => {
  const token = localStorage.getItem("streamvio_token");

  // Si hay token, verificar si es válido
  if (token) {
    console.log("Token encontrado en localStorage");

    // Configurar verificación periódica del token (cada 15 minutos)
    setInterval(() => {
      verifyTokenValidity();
    }, 15 * 60 * 1000);

    // Verificar inmediatamente
    verifyTokenValidity();
  } else {
    console.log("No hay token de autenticación");

    // Si estamos en una página que requiere autenticación, redirigir
    const currentPath = window.location.pathname;
    const publicPaths = ["/", "/auth", "/register", "/about"];

    if (
      !publicPaths.includes(currentPath) &&
      !currentPath.startsWith("/public/")
    ) {
      console.log("Redirigiendo a login (se requiere autenticación)");

      // Guardar la URL actual para redirigir después del login
      const returnUrl = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      window.location.href = `/auth?redirect=${returnUrl}`;
    }
  }
};

/**
 * Verifica si el token actual es válido
 */
const verifyTokenValidity = async () => {
  const token = localStorage.getItem("streamvio_token");
  if (!token) return;

  try {
    // Realizar petición para verificar el token
    await axios.get("/api/auth/user", {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("Token verificado: válido");
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.warn("Token inválido o expirado");

      // Limpiar token
      localStorage.removeItem("streamvio_token");
      localStorage.removeItem("streamvio_user");

      // Notificar cambio
      window.dispatchEvent(new Event("streamvio-auth-change"));

      // Redirigir al login solo si estamos en una página protegida
      const currentPath = window.location.pathname;
      const publicPaths = ["/", "/auth", "/register", "/about"];

      if (
        !publicPaths.includes(currentPath) &&
        !currentPath.startsWith("/public/")
      ) {
        const returnUrl = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        window.location.href = `/auth?redirect=${returnUrl}`;
      }
    }
  }
};

export default initializeApp;
