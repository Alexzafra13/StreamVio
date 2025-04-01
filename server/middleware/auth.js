// server/middleware/auth.js
const jwt = require("jsonwebtoken");

/**
 * Middleware para autenticación de usuario
 * Verifica el token JWT en las cabeceras de la solicitud
 */
module.exports = (req, res, next) => {
  // Obtener el token de la cabecera de autorización
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Token no proporcionado",
    });
  }

  // Verificar formato del token (Bearer [token])
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error: "Error de token",
      message: "Formato de token incorrecto",
    });
  }

  const token = parts[1];

  try {
    // Verificar y decodificar el token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "streamvio_secret_key"
    );

    // Agregar información del usuario a la solicitud
    req.user = decoded;

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
