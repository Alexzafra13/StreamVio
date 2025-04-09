// server/middleware/enhancedAuth.js - VERSIÓN CORREGIDA
const jwt = require("jsonwebtoken");
const settings = require("../config/settings");
const db = require("../config/database");

/**
 * Middleware de autenticación unificado que maneja tanto tokens JWT estándar
 * como tokens de streaming específicos para acceso a medios
 */
const enhancedAuthMiddleware = async (req, res, next) => {
  let token = null;
  let tokenType = null;
  let streamingMediaId = null;

  // 1. Extraer token de todas las fuentes posibles
  // Prioridad: Headers > Query params > Cookies
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
    tokenType = "bearer";
  } else if (req.query.auth) {
    token = req.query.auth;
    tokenType = "query";
  } else if (req.query.token) {
    token = req.query.token;
    tokenType = "stream";

    // Intentar extraer el ID del medio de la URL para streaming
    const mediaIdMatch = req.path.match(
      /\/media\/(\d+)\/stream|\/streaming\/(\d+)/
    );
    if (mediaIdMatch) {
      streamingMediaId = mediaIdMatch[1] || mediaIdMatch[2];
    }
  } else if (req.headers["x-stream-token"] || req.headers["stream-token"]) {
    token = req.headers["x-stream-token"] || req.headers["stream-token"];
    tokenType = "stream";
  }

  // 2. Si no hay ningún token, devolver error de autenticación
  if (!token) {
    console.log(
      `Autenticación fallida: No se proporcionó token para ${req.path}`
    );
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación para acceder a este recurso",
      code: "NO_TOKEN",
    });
  }

  try {
    console.log(
      `Token encontrado en ${tokenType}: ${token.substring(0, 10)}...`
    );

    // 3. Verificar el token con la clave secreta del sistema
    const jwtSecret =
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key";
    const decoded = jwt.verify(token, jwtSecret);

    // 4. Añadir información del usuario al request para uso en controladores
    req.user = decoded;
    req.token = token;

    // 5. Registrar actividad (sólo para APIs principales, no para streaming/thumbnails)
    if (
      req.path.startsWith("/api/") &&
      !req.path.includes("/stream") &&
      !req.path.includes("/thumbnail")
    ) {
      console.log(
        `Usuario ${decoded.id} (${decoded.username || "anónimo"}): ${
          req.method
        } ${req.originalUrl}`
      );
    }

    // 6. Si es una petición específica de streaming y tenemos el ID del medio,
    // verificar explícitamente los permisos del usuario para este medio
    if (tokenType === "stream" && streamingMediaId) {
      try {
        // Verificar si el usuario tiene acceso a este medio específico
        const hasAccess = await verifyMediaAccess(decoded.id, streamingMediaId);
        if (!hasAccess) {
          console.error(
            `Acceso denegado: Usuario ${decoded.id} no tiene permisos para el medio ${streamingMediaId}`
          );
          return res.status(403).json({
            error: "Acceso denegado",
            message: "No tienes permisos para acceder a este contenido",
            code: "MEDIA_ACCESS_DENIED",
          });
        }
      } catch (accessError) {
        console.error(
          `Error al verificar acceso al medio: ${accessError.message}`
        );
        // Continuamos aunque haya un error en la verificación para mantener compatibilidad
      }
    }

    // Continuar con la solicitud
    return next();
  } catch (error) {
    console.error("Error de autenticación:", error.message);

    // Manejar diferentes tipos de errores de token
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        message: "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
        code: "TOKEN_EXPIRED",
      });
    }

    // Token inválido por otras razones
    return res.status(401).json({
      error: "Token inválido",
      message: "No autorizado - token inválido",
      code: "TOKEN_INVALID",
    });
  }
};

/**
 * Verifica si un usuario tiene acceso a un medio específico
 * @param {number} userId - ID del usuario
 * @param {number} mediaId - ID del medio
 * @returns {Promise<boolean>} - true si tiene acceso, false en caso contrario
 */
async function verifyMediaAccess(userId, mediaId) {
  try {
    // Primero verificar si el usuario es administrador (tienen acceso a todo)
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);
    if (user && user.is_admin === 1) {
      return true; // Los administradores tienen acceso a todas los medios
    }

    // Obtener información del medio
    const mediaItem = await db.asyncGet(
      "SELECT library_id FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      console.error(`Medio no encontrado: ${mediaId}`);
      return false; // El medio no existe
    }

    // Verificar si el usuario tiene acceso a la biblioteca del medio
    if (mediaItem.library_id) {
      const access = await db.asyncGet(
        "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
        [userId, mediaItem.library_id]
      );

      // Si hay un registro explícito de acceso, comprobar su valor
      if (access) {
        return access.has_access === 1;
      }

      // Si no hay un registro explícito, permitir acceso por defecto
      // (este comportamiento se puede ajustar según los requisitos de seguridad)
      return true;
    }

    // Si el medio no pertenece a ninguna biblioteca, permitir acceso por defecto
    return true;
  } catch (error) {
    console.error(
      `Error al verificar acceso de usuario ${userId} a medio ${mediaId}:`,
      error
    );
    // En caso de error, permitir acceso para evitar bloquear contenido legítimo
    return true;
  }
}

module.exports = enhancedAuthMiddleware;
