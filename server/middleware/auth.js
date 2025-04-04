// server/middleware/auth.js - Versión mejorada
const jwt = require("jsonwebtoken");

/**
 * Middleware para autenticación de usuario
 * Verifica el token JWT en las cabeceras de la solicitud o como parámetro de consulta
 */
module.exports = (req, res, next) => {
  // Obtener el token de la cabecera de autorización o del parámetro de consulta
  let token;

  // Comprobar primero en la cabecera
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Verificar formato del token (Bearer [token])
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  // Si no hay token en la cabecera, verificar en los parámetros de consulta
  if (!token && req.query.auth) {
    token = req.query.auth;
  }

  // Si no hay token en ningún lado, responder con error
  if (!token) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Token no proporcionado",
    });
  }

  try {
    // Verificar y decodificar el token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "streamvio_secret_key"
    );

    // Agregar información del usuario a la solicitud
    req.user = decoded;

    // Registrar qué usuario está haciendo la solicitud para logging
    const method = req.method;
    const url = req.originalUrl;
    console.log(
      `Usuario ${decoded.id} (${decoded.username}): ${method} ${url}`
    );

    // Continuar con la siguiente función de middleware
    return next();
  } catch (error) {
    console.error("Error al verificar token:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        message: "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
      });
    }

    return res.status(401).json({
      error: "Token inválido",
      message: "No autorizado - token inválido",
    });
  }
};
