// server/middleware/enhancedAuth.js - Versión optimizada
const jwt = require("jsonwebtoken");
const settings = require("../config/settings");
const db = require("../config/database");

/**
 * Middleware de autenticación unificado que maneja tanto tokens JWT estándar
 * como tokens en parámetros de consulta para streaming y recursos estáticos
 */
const enhancedAuthMiddleware = async (req, res, next) => {
  let token = null;
  let tokenSource = null;

  // 1. Extraer token con orden de prioridad claro
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    // Prioridad 1: Header de autorización
    token = req.headers.authorization.split(" ")[1];
    tokenSource = "header";
  } else if (req.query.auth) {
    // Prioridad 2: Parámetro de consulta 'auth'
    token = req.query.auth;
    tokenSource = "query";
  }

  // 2. Validar token
  if (!token) {
    console.log(
      `Autenticación fallida: No se proporcionó token para ${req.path}`
    );
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación para acceder a este recurso",
    });
  }

  try {
    // Verificar si el token ha sido enviado con 'Bearer ' por accidente en query param
    if (token.startsWith("Bearer ")) {
      token = token.substring(7);
    }

    // 3. Verificar el token con la clave secreta del sistema
    const jwtSecret =
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key";
    const decoded = jwt.verify(token, jwtSecret);

    // Log exitoso (pero no para rutas de streaming/thumbnails para evitar llenar logs)
    if (!req.path.includes("/stream") && !req.path.includes("/thumbnail")) {
      console.log(
        `Token válido para usuario ${decoded.id} (${
          decoded.username || "anónimo"
        }) - Fuente: ${tokenSource}`
      );
    }

    // 4. Añadir información del usuario al request para uso en controladores
    req.user = decoded;
    req.token = token;

    // 5. Si es una solicitud de streaming, verificar acceso al medio específico
    if (
      (req.path.includes("/stream") || req.path.includes("/thumbnail")) &&
      req.params.id
    ) {
      try {
        const mediaId = req.params.id;
        const hasAccess = await verifyMediaAccess(decoded.id, mediaId);
        if (!hasAccess) {
          console.warn(
            `Acceso denegado: Usuario ${decoded.id} no tiene permisos para el medio ${mediaId}`
          );
          return res.status(403).json({
            error: "Acceso denegado",
            message: "No tienes permisos para acceder a este contenido",
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
    console.error(
      `Error de autenticación para ruta ${req.path}:`,
      error.message
    );

    // Manejar diferentes tipos de errores de token
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        message: "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
      });
    }

    // Token inválido por otras razones
    return res.status(401).json({
      error: "Token inválido",
      message: "Credenciales de autenticación inválidas",
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
      return true; // Los administradores tienen acceso a todos los medios
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

    // Si el medio no pertenece a ninguna biblioteca, permitir acceso
    if (!mediaItem.library_id) {
      return true;
    }

    // Verificar si el usuario tiene acceso a la biblioteca del medio
    const access = await db.asyncGet(
      "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
      [userId, mediaItem.library_id]
    );

    // Si hay un registro explícito de acceso, comprobar su valor
    if (access) {
      return access.has_access === 1;
    }

    // Si no hay un registro explícito para el usuario, permitir acceso por defecto
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
