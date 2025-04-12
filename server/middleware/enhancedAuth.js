// server/middleware/enhancedAuth.js
const jwt = require("jsonwebtoken");
const settings = require("../config/settings");
const db = require("../config/database");

/**
 * Middleware de autenticación mejorado
 * - Soporte para Bearer token en headers
 * - Soporte para token en parámetro 'auth' en URL
 * - Validación que evita problemas con formatos incorrectos
 */
const enhancedAuthMiddleware = async (req, res, next) => {
  // 1. Extraer token de todas las posibles fuentes
  let token = null;

  // Prioridad: Authorization header > Query params 'auth'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.auth) {
    token = req.query.auth;
  }

  // Tratar casos donde el token viene con 'Bearer ' por error en el query param
  if (token && token.startsWith("Bearer ")) {
    token = token.substring(7);
  }

  // 2. Si no hay token, denegar acceso
  if (!token) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación para acceder a este recurso",
    });
  }

  try {
    // 3. Verificar el token
    const jwtSecret =
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key";
    const decoded = jwt.verify(token, jwtSecret);

    // 4. Añadir información del usuario al request
    req.user = decoded;
    req.token = token;

    // 5. Verificar si el usuario existe en la base de datos (opcional)
    try {
      const userId = decoded.id;
      const user = await db.asyncGet(
        "SELECT id, username, is_admin FROM users WHERE id = ?",
        [userId]
      );

      if (!user) {
        console.warn(
          `Usuario ${userId} no existe en la base de datos pero tiene token válido`
        );
        // Podemos seguir permitiendo acceso ya que el token es válido
        // O podemos denegar acceso si queremos una validación más estricta
      }
    } catch (dbError) {
      console.error("Error al verificar usuario en BD:", dbError.message);
      // No bloqueamos el acceso por errores de BD si el token es válido
    }

    // 6. Continuar con la solicitud
    next();
  } catch (error) {
    // Manejar errores específicos de JWT
    console.error(`Error de autenticación: ${error.message}`);

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

    // Error genérico
    return res.status(401).json({
      error: "Error de autenticación",
      message: "No autorizado - error de autenticación",
    });
  }
};

module.exports = enhancedAuthMiddleware;
