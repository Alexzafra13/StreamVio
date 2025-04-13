// server/utils/errors.js
const { ERROR_MESSAGES } = require("../config/constants");
const logger = require("./logger");

/**
 * Clase base para errores de la aplicación
 * @extends Error
 */
class AppError extends Error {
  /**
   * @param {string} message - Mensaje de error
   * @param {string} code - Código de error interno
   * @param {number} statusCode - Código de estado HTTP
   * @param {Object} [metadata] - Metadatos adicionales del error
   */
  constructor(message, code, statusCode, metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();

    // Capturar stack trace
    Error.captureStackTrace(this, this.constructor);

    // Registrar error en los logs
    logger.debug(`Error creado: ${code} - ${message}`, {
      code,
      statusCode,
      metadata,
      stack: this.stack,
    });
  }

  /**
   * Serializa el error para respuestas API
   * @returns {Object} Representación del error para enviar al cliente
   */
  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(process.env.NODE_ENV === "development" ? { stack: this.stack } : {}),
    };
  }
}

/**
 * Error 400 - Bad Request
 */
class BadRequestError extends AppError {
  constructor(
    message = ERROR_MESSAGES.INVALID_INPUT,
    code = "BAD_REQUEST",
    metadata = {}
  ) {
    super(message, code, 400, metadata);
  }
}

/**
 * Error 401 - Unauthorized
 */
class UnauthorizedError extends AppError {
  constructor(
    message = ERROR_MESSAGES.UNAUTHORIZED,
    code = "UNAUTHORIZED",
    metadata = {}
  ) {
    super(message, code, 401, metadata);
  }
}

/**
 * Error 403 - Forbidden
 */
class ForbiddenError extends AppError {
  constructor(
    message = ERROR_MESSAGES.UNAUTHORIZED,
    code = "FORBIDDEN",
    metadata = {}
  ) {
    super(message, code, 403, metadata);
  }
}

/**
 * Error 404 - Not Found
 */
class NotFoundError extends AppError {
  constructor(
    message = ERROR_MESSAGES.NOT_FOUND,
    code = "NOT_FOUND",
    metadata = {}
  ) {
    super(message, code, 404, metadata);
  }
}

/**
 * Error 409 - Conflict
 */
class ConflictError extends AppError {
  constructor(
    message = "Conflict with current state",
    code = "CONFLICT",
    metadata = {}
  ) {
    super(message, code, 409, metadata);
  }
}

/**
 * Error 422 - Unprocessable Entity
 */
class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    code = "VALIDATION_ERROR",
    metadata = {}
  ) {
    super(message, code, 422, metadata);
  }
}

/**
 * Error 429 - Too Many Requests
 */
class RateLimitError extends AppError {
  constructor(
    message = "Too many requests",
    code = "RATE_LIMIT_EXCEEDED",
    metadata = {}
  ) {
    super(message, code, 429, metadata);
  }
}

/**
 * Error 500 - Internal Server Error
 */
class InternalServerError extends AppError {
  constructor(
    message = "Internal server error",
    code = "SERVER_ERROR",
    metadata = {}
  ) {
    super(message, code, 500, metadata);
    // Siempre registrar errores internos en nivel error
    logger.error(`Error interno del servidor: ${message}`, {
      code,
      metadata,
      stack: this.stack,
    });
  }
}

/**
 * Error 501 - Not Implemented
 */
class NotImplementedError extends AppError {
  constructor(
    message = "Feature not implemented yet",
    code = "NOT_IMPLEMENTED",
    metadata = {}
  ) {
    super(message, code, 501, metadata);
  }
}

/**
 * Error 503 - Service Unavailable
 */
class ServiceUnavailableError extends AppError {
  constructor(
    message = "Service temporarily unavailable",
    code = "SERVICE_UNAVAILABLE",
    metadata = {}
  ) {
    super(message, code, 503, metadata);
  }
}

/**
 * Error de Base de Datos
 */
class DatabaseError extends InternalServerError {
  constructor(message = ERROR_MESSAGES.DATABASE_ERROR, metadata = {}) {
    super(message, "DATABASE_ERROR", metadata);
  }
}

/**
 * Error de Transcodificación
 */
class TranscodingError extends InternalServerError {
  constructor(message = ERROR_MESSAGES.TRANSCODING_ERROR, metadata = {}) {
    super(message, "TRANSCODING_ERROR", metadata);
  }
}

/**
 * Error de Acceso a Biblioteca
 */
class LibraryAccessError extends ForbiddenError {
  constructor(message = ERROR_MESSAGES.LIBRARY_ACCESS_DENIED, metadata = {}) {
    super(message, "LIBRARY_ACCESS_DENIED", metadata);
  }
}

/**
 * Middleware para manejo de errores en Express
 */
const errorHandler = (err, req, res, next) => {
  // Si ya se enviaron encabezados, delegar al manejador por defecto de Express
  if (res.headersSent) {
    return next(err);
  }

  // Determinar el tipo de error
  let error = err;

  // Si es un error no manejado, convertirlo a AppError
  if (!(err instanceof AppError)) {
    // Mapear errores comunes de Node.js y Express
    if (err.name === "SyntaxError" && err.status === 400) {
      error = new BadRequestError("Invalid JSON", "INVALID_JSON");
    } else if (err.code === "ENOENT") {
      error = new NotFoundError("Resource not found", "RESOURCE_NOT_FOUND");
    } else if (err.code === "EACCES") {
      error = new ForbiddenError("Permission denied", "PERMISSION_DENIED");
    } else {
      // Errores no reconocidos se consideran internos
      error = new InternalServerError(
        err.message || "Internal server error",
        "UNKNOWN_ERROR",
        {
          originalError: {
            name: err.name,
            code: err.code,
            message: err.message,
          },
        }
      );

      // Registrar errores no manejados
      logger.error("Error no manejado:", {
        error: err,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });
    }
  }

  // Responder con el error serializado
  res.status(error.statusCode || 500).json(error.toJSON());
};

/**
 * Middleware para manejar rutas no encontradas
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Ruta no encontrada: ${req.originalUrl}`);
  res.status(404).json(error.toJSON());
};

// Funciones auxiliares para crear errores específicos
const createError = (ErrorClass, message, code, metadata) => {
  return new ErrorClass(message, code, metadata);
};

// Exportar clases y funciones
module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  NotImplementedError,
  ServiceUnavailableError,
  DatabaseError,
  TranscodingError,
  LibraryAccessError,

  // Middleware para Express
  errorHandler,
  notFoundHandler,

  // Funciones auxiliares
  createError,
  createBadRequestError: (message, code, metadata) =>
    createError(BadRequestError, message, code, metadata),
  createUnauthorizedError: (message, code, metadata) =>
    createError(UnauthorizedError, message, code, metadata),
  createForbiddenError: (message, code, metadata) =>
    createError(ForbiddenError, message, code, metadata),
  createNotFoundError: (message, code, metadata) =>
    createError(NotFoundError, message, code, metadata),
  createValidationError: (message, code, metadata) =>
    createError(ValidationError, message, code, metadata),
  createInternalServerError: (message, code, metadata) =>
    createError(InternalServerError, message, code, metadata),
};
