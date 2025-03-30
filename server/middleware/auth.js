const jwt = require("jsonwebtoken");
const db = require("../config/database");

/**
 * Middleware de autenticación para verificar tokens JWT
 */
const authMiddleware = async (req, res, next) => {
  // Obtener el token del header Authorization
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Acceso no autorizado",
      message: "Se requiere token de autenticación",
    });
  }

  // Extraer el token de la cabecera
  const token = authHeader.split(" ")[1];

  try {
    // Verificar y decodificar el token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "streamvio_secret_key"
    );

    // Agregar la información del usuario al objeto request
    req.user = decoded;

    // Verificar si el usuario debe cambiar su contraseña
    // Excluimos la propia ruta de cambio de contraseña y la verificación
    if (
      req.path !== "/api/auth/change-password" &&
      req.path !== "/api/auth/check-password-change"
    ) {
      const user = await db.asyncGet(
        "SELECT force_password_change FROM users WHERE id = ?",
        [decoded.id]
      );

      if (user && user.force_password_change === 1) {
        return res.status(403).json({
          error: "Cambio de contraseña requerido",
          message: "Debes cambiar tu contraseña antes de continuar",
          requirePasswordChange: true,
        });
      }
    }

    // Continuar con la siguiente función en la cadena de middleware
    next();
  } catch (error) {
    console.error("Error al verificar token:", error);

    return res.status(401).json({
      error: "Token inválido",
      message: "El token de autenticación ha expirado o es inválido",
    });
  }
};

module.exports = authMiddleware;
