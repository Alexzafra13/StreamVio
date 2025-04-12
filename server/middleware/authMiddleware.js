// server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const settings = require("../config/settings");
const db = require("../config/database");

/**
 * Middleware de autenticación unificado para todas las rutas API
 * - Verifica token JWT en múltiples ubicaciones (header, query params)
 * - Maneja diferentes formatos de token (Bearer, directo)
 * - Proporciona información del usuario en req.user
 */
const authMiddleware = async (req, res, next) => {
  let token = null;

  // Paso 1: Extraer token de todas las fuentes posibles con prioridad clara
  // 1. Authorization header (método preferido para API)
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    // Manejar formato Bearer y token directo
    token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;
  }
  // 2. Parámetro 'auth' en query (usado para recursos estáticos/streaming)
  else if (req.query.auth) {
    token = req.query.auth;
  }
  // 3. Parámetro 'token' en query (fallback para compatibilidad)
  else if (req.query.token) {
    token = req.query.token;
  }

  // Si no hay token, denegar acceso
  if (!token) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación para acceder a este recurso",
    });
  }

  try {
    // Verificar token con la clave secreta de la aplicación
    const jwtSecret =
      process.env.JWT_SECRET || settings.jwtSecret || "streamvio_secret_key";
    const decoded = jwt.verify(token, jwtSecret);

    // Añadir información del usuario decodificada al request
    req.user = decoded;

    // Verificar si la sesión sigue siendo válida
    try {
      const validSession = await db.asyncGet(
        "SELECT id FROM sessions WHERE user_id = ? AND expires_at > datetime('now')",
        [decoded.id]
      );

      if (!validSession) {
        // Si no hay ninguna sesión válida para este usuario, el token podría haber sido revocado
        return res.status(401).json({
          error: "Sesión inválida",
          message:
            "La sesión ha expirado o ha sido cerrada. Por favor, inicie sesión nuevamente.",
        });
      }
    } catch (dbError) {
      // Si hay un error al verificar la sesión, continuamos (para no bloquear el acceso)
      console.warn("Error al verificar sesión:", dbError);
    }

    // Continuar con la solicitud
    next();
  } catch (error) {
    // Manejar diferentes tipos de errores JWT
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        message: "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
      });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Token inválido",
        message: "El token de autenticación no es válido",
      });
    }

    // Otros errores de token
    return res.status(401).json({
      error: "Error de autenticación",
      message: error.message || "Error al validar la autenticación",
    });
  }
};

module.exports = authMiddleware;
