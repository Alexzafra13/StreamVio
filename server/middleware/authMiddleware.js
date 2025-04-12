// server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const settings = require("../config/settings");

/**
 * Middleware de autenticación unificado y simplificado
 * Verifica la autenticación a través de token JWT en diferentes fuentes
 */
const authMiddleware = (req, res, next) => {
  let token = null;

  // 1. Extraer token de todas las fuentes posibles
  // Prioridad: Authorization header > Query params
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.auth) {
    token = req.query.auth;
  } else if (req.query.token) {
    token = req.query.token;
  }

  // 2. Si no hay token, devolver error de autenticación
  if (!token) {
    console.log(
      `Autenticación fallida: No se proporcionó token para ${req.originalUrl}`
    );
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación para acceder a este recurso",
    });
  }

  try {
    // 3. Verificar el token con la clave secreta
    const jwtSecret =
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key";
    const decoded = jwt.verify(token, jwtSecret);

    // 4. Añadir información del usuario al request para uso en controladores
    req.user = decoded;
    req.token = token;

    // Registrar actividad (excepto streaming/thumbnails para no saturar logs)
    if (!req.path.includes("/stream") && !req.path.includes("/thumbnail")) {
      console.log(
        `Usuario ${decoded.id} (${decoded.username || "N/A"}): ${req.method} ${
          req.originalUrl
        }`
      );
    }

    // 5. Continuar con la solicitud
    next();
  } catch (error) {
    console.error(
      `Error de autenticación para ${req.originalUrl}:`,
      error.message
    );

    // Manejar diferentes tipos de errores de token
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        message: "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
      });
    }

    return res.status(401).json({
      error: "Token inválido",
      message: "No autorizado - token inválido o malformado",
    });
  }
};

module.exports = authMiddleware;
