// server/api/middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const environment = require("../../config/environment");
const { createUnauthorizedError } = require("./errorMiddleware");
const userRepository = require("../../data/repositories/userRepository");

/**
 * Middleware para autenticación basada en JWT
 */
const authenticate = async (req, res, next) => {
  try {
    // Extraer token de todos los lugares posibles
    let token = null;

    // 1. Header de Authorization (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    // 2. Query parameter 'auth' o 'token'
    if (!token && (req.query.auth || req.query.token)) {
      token = req.query.auth || req.query.token;
    }

    // 3. Cookies
    if (!token && req.cookies && req.cookies.streamvio_token) {
      token = req.cookies.streamvio_token;
    }

    // Si no hay token, rechazar la solicitud
    if (!token) {
      throw createUnauthorizedError(
        "Se requiere autenticación",
        "TOKEN_REQUIRED"
      );
    }

    // Verificar el token
    const decoded = jwt.verify(token, environment.JWT_SECRET);

    // Verificar que el usuario existe en la base de datos
    const user = await userRepository.findById(decoded.id);

    if (!user) {
      throw createUnauthorizedError("Usuario no encontrado", "INVALID_USER");
    }

    // Añadir información del usuario al request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin === 1,
    };

    next();
  } catch (error) {
    // Manejar errores específicos de JWT
    if (error.name === "JsonWebTokenError") {
      next(createUnauthorizedError("Token inválido", "INVALID_TOKEN"));
    } else if (error.name === "TokenExpiredError") {
      next(createUnauthorizedError("Token expirado", "TOKEN_EXPIRED"));
    } else {
      next(error);
    }
  }
};

/**
 * Middleware para verificar si el usuario es administrador
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return next(
      createUnauthorizedError("Se requiere autenticación", "AUTH_REQUIRED")
    );
  }

  if (!req.user.isAdmin) {
    return next(
      createUnauthorizedError(
        "Se requieren privilegios de administrador",
        "ADMIN_REQUIRED"
      )
    );
  }

  next();
};

module.exports = {
  authenticate,
  isAdmin,
};
