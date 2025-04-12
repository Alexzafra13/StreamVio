// server/api/middlewares/validator.js
const { createBadRequestError } = require("./errorMiddleware");

/**
 * Middleware para validar campos en una solicitud
 * @param {Object} schema - Esquema de validación (campos requeridos, reglas, etc.)
 * @param {string} source - Fuente de los datos ('body', 'query', 'params')
 * @returns {Function} - Middleware de Express
 */
const validateSchema = (schema, source = "body") => {
  return (req, res, next) => {
    const data = req[source];
    const errors = [];

    // Validar campos requeridos
    if (schema.required) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === "") {
          errors.push(`El campo '${field}' es obligatorio`);
        }
      }
    }

    // Validar tipos de datos
    if (schema.types && Object.keys(schema.types).length > 0) {
      for (const [field, type] of Object.entries(schema.types)) {
        if (data[field] !== undefined) {
          if (type === "number" && isNaN(Number(data[field]))) {
            errors.push(`El campo '${field}' debe ser un número`);
          } else if (type === "boolean" && typeof data[field] !== "boolean") {
            // Manejar casos especiales para booleanos
            const value = data[field];
            if (
              typeof value === "string" &&
              !["true", "false", "0", "1"].includes(value.toLowerCase())
            ) {
              errors.push(`El campo '${field}' debe ser un booleano`);
            }
          } else if (type === "array" && !Array.isArray(data[field])) {
            errors.push(`El campo '${field}' debe ser un array`);
          } else if (
            type === "object" &&
            (typeof data[field] !== "object" ||
              data[field] === null ||
              Array.isArray(data[field]))
          ) {
            errors.push(`El campo '${field}' debe ser un objeto`);
          } else if (type === "string" && typeof data[field] !== "string") {
            errors.push(`El campo '${field}' debe ser una cadena de texto`);
          }
        }
      }
    }

    // Validar valores permitidos
    if (schema.allowed) {
      for (const [field, values] of Object.entries(schema.allowed)) {
        if (data[field] !== undefined && !values.includes(data[field])) {
          errors.push(
            `El valor '${
              data[field]
            }' para el campo '${field}' no es válido. Valores permitidos: ${values.join(
              ", "
            )}`
          );
        }
      }
    }

    // Validar reglas personalizadas
    if (schema.custom) {
      for (const [field, validator] of Object.entries(schema.custom)) {
        if (data[field] !== undefined) {
          const validationResult = validator(data[field], data);
          if (validationResult !== true) {
            errors.push(validationResult);
          }
        }
      }
    }

    // Si hay errores, devolver error 400
    if (errors.length > 0) {
      return next(createBadRequestError(errors.join(". "), "VALIDATION_ERROR"));
    }

    next();
  };
};

/**
 * Valida que un ID en los parámetros sea un número válido
 */
const validateId = (paramName = "id") => {
  return (req, res, next) => {
    const id = parseInt(req.params[paramName]);

    if (isNaN(id) || id <= 0) {
      return next(
        createBadRequestError(
          `El parámetro '${paramName}' debe ser un número válido mayor que 0`
        )
      );
    }

    // Convierte el ID a número en los parámetros
    req.params[paramName] = id;

    next();
  };
};

/**
 * Valida campos de paginación en consultas
 */
const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page && (isNaN(parseInt(page)) || parseInt(page) < 1)) {
    return next(
      createBadRequestError(
        "El parámetro 'page' debe ser un número válido mayor o igual a 1"
      )
    );
  }

  if (
    limit &&
    (isNaN(parseInt(limit)) || parseInt(limit) < 1 || parseInt(limit) > 100)
  ) {
    return next(
      createBadRequestError(
        "El parámetro 'limit' debe ser un número válido entre 1 y 100"
      )
    );
  }

  // Convierte a números
  if (page) req.query.page = parseInt(page);
  if (limit) req.query.limit = parseInt(limit);

  next();
};

/**
 * Esquemas predefinidos para validaciones comunes
 */
const schemas = {
  createUser: {
    required: ["username", "email", "password"],
    types: {
      username: "string",
      email: "string",
      password: "string",
      isAdmin: "boolean",
    },
    custom: {
      email: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) || "El formato del email no es válido";
      },
      password: (value) => {
        return (
          value.length >= 6 || "La contraseña debe tener al menos 6 caracteres"
        );
      },
    },
  },

  updateUser: {
    types: {
      username: "string",
      email: "string",
    },
    custom: {
      email: (value) => {
        if (!value) return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) || "El formato del email no es válido";
      },
    },
  },

  createLibrary: {
    required: ["name", "path", "type"],
    types: {
      name: "string",
      path: "string",
      type: "string",
      scan_automatically: "boolean",
    },
    allowed: {
      type: ["movies", "series", "music", "photos"],
    },
  },

  updateLibrary: {
    types: {
      name: "string",
      path: "string",
      type: "string",
      scan_automatically: "boolean",
    },
    allowed: {
      type: ["movies", "series", "music", "photos"],
    },
  },
};

module.exports = {
  validateSchema,
  validateId,
  validatePagination,
  schemas,
};
