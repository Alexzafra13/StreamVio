// clients/web/src/utils/authInit.js
import axios from "axios";
import authUrlHelper from "./authUrlHelper";

/**
 * Inicializa la configuración de autenticación para toda la aplicación
 * - Configura axios para incluir el token en todas las solicitudes
 * - Sobrescribe fetch() nativo para incluir el token cuando sea necesario
 * - Configura interceptores para manejar errores de autenticación
 */
const initAuth = () => {
  console.log("Inicializando sistema de autenticación...");

  // 1. Configurar axios para incluir el token en todas las peticiones
  authUrlHelper.setupAxiosAuth(axios);

  // 2. Sobrescribir fetch nativo para incluir el token
  const originalFetch = window.fetch;
  window.fetch = function (resource, options = {}) {
    // Solo modificar solicitudes a nuestra API
    const token = localStorage.getItem("streamvio_token");

    if (
      token &&
      typeof resource === "string" &&
      (resource.startsWith("/api/") || resource.includes("/data/"))
    ) {
      // Si no hay headers, inicializar
      options.headers = options.headers || {};

      // Si no existe Authorization header, y existe token, añadirlo
      if (!options.headers.Authorization && !options.headers.authorization) {
        options.headers.Authorization = `Bearer ${token}`;
      }

      // Para recursos que no aceptan encabezados (como medios o miniaturas)
      // Añadir el token como parámetro de consulta
      if (
        resource.includes("/stream") ||
        resource.includes("/thumbnail") ||
        resource.includes("/data/")
      ) {
        // Verificar si ya hay parámetros en la URL
        const hasParams = resource.includes("?");
        const separator = hasParams ? "&" : "?";

        // Añadir el token como parámetro
        resource = `${resource}${separator}auth=${token}`;
      }
    }

    // Continuar con el fetch original
    return originalFetch.call(this, resource, options);
  };

  // 3. Agregar un listener para eventos de autenticación
  window.addEventListener("streamvio-auth-change", (event) => {
    const hasToken = !!localStorage.getItem("streamvio_token");

    // Si el token ha cambiado (login/logout), actualizar la configuración
    authUrlHelper.setupAxiosAuth(axios);

    console.log(
      `Estado de autenticación actualizado: ${
        hasToken ? "autenticado" : "no autenticado"
      }`
    );
  });

  // 4. Verificar si hay token al iniciar y programar renovación si es necesario
  const token = localStorage.getItem("streamvio_token");
  if (token) {
    // Programar verificación periódica del token (cada 15 minutos)
    setInterval(() => {
      verifyTokenValidity();
    }, 15 * 60 * 1000);

    // Verificar inmediatamente
    verifyTokenValidity();
  }

  console.log("Inicialización de autenticación completada");
};

/**
 * Verifica si el token actual es válido
 */
const verifyTokenValidity = async () => {
  const token = localStorage.getItem("streamvio_token");
  if (!token) return;

  try {
    // Realizar una petición simple para verificar el token
    await axios.get("/api/auth/user", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Si llegamos aquí, el token es válido
    console.log("Token verificado: válido");
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.warn("Token inválido o expirado");

      // Opcionalmente, podríamos intentar renovar el token aquí
      // Por ahora, solo limpiar el token y redirigir al login
      localStorage.removeItem("streamvio_token");
      localStorage.removeItem("streamvio_user");

      // Notificar el cambio
      window.dispatchEvent(new Event("streamvio-auth-change"));

      // Redirigir al login solo si estamos en una página que requiere autenticación
      const protectedPaths = [
        "/media",
        "/bibliotecas",
        "/perfil",
        "/admin",
        "/favoritos",
      ];
      if (
        protectedPaths.some((path) => window.location.pathname.startsWith(path))
      ) {
        window.location.href = "/auth";
      }
    }
  }
};

export default initAuth;
