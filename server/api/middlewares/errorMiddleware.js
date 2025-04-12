// server/api/middlewares/errorMiddleware.js
const environment = require("../../config/environment");

/**
 * Clase para manejar errores específicos de la aplicación
 */
class ApiError extends Error {
  constructor(statusCode, message, code = "ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handler para 404 - Not Found
 */
const notFoundHandler = (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    const error = new ApiError(
      404,
      `Ruta no encontrada: ${req.originalUrl}`,
      "NOT_FOUND"
    );
    next(error);
  } else {
    next();
  }
};

/**
 * Middleware para manejar errores
 */
const errorHandler = (err, req, res, next) => {
  // Si la cabecera ya fue enviada, pasar al siguiente middleware
  if (res.headersSent) {
    return next(err);
  }

  // Obtener código de estado (por defecto 500)
  const statusCode = err.statusCode || 500;

  // Preparar respuesta
  const response = {
    error: err.code || "SERVER_ERROR",
    message: err.message || "Error interno del servidor",
  };

  // Incluir la traza del error en desarrollo
  if (environment.isDevelopment) {
    response.stack = err.stack;
  }

  // Si es un error interno (500), registrarlo
  if (statusCode === 500) {
    console.error("Error interno del servidor:", err);
  }

  res.status(statusCode).json(response);
};

// Funciones de utilidad para crear errores comunes
const createBadRequestError = (message, code = "BAD_REQUEST") =>
  new ApiError(400, message, code);

const createUnauthorizedError = (
  message = "No autorizado",
  code = "UNAUTHORIZED"
) => new ApiError(401, message, code);

const createForbiddenError = (
  message = "Acceso denegado",
  code = "FORBIDDEN"
) => new ApiError(403, message, code);

const createNotFoundError = (
  message = "Recurso no encontrado",
  code = "NOT_FOUND"
) => new ApiError(404, message, code);

/**
 * Wrapper para controladores asíncronos con manejo automático de errores
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  ApiError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  createBadRequestError,
  createUnauthorizedError,
  createForbiddenError,
  createNotFoundError,
};
