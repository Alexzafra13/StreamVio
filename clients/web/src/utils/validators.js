// src/utils/validators.js
/**
 * Utilidades para validar diferentes tipos de datos
 */

/**
 * Valida una dirección de correo electrónico
 * @param {string} email - Correo electrónico a validar
 * @returns {boolean} - true si el correo es válido
 */
export const isValidEmail = (email) => {
  if (!email) return false;

  // Expresión regular para validar correos electrónicos
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida una contraseña según criterios de seguridad
 * @param {string} password - Contraseña a validar
 * @returns {Object} - Resultado de la validación
 */
export const validatePassword = (password) => {
  if (!password) {
    return {
      isValid: false,
      score: 0,
      errors: ["La contraseña no puede estar vacía"],
    };
  }

  const errors = [];
  let score = 0;

  // Longitud mínima
  if (password.length < 6) {
    errors.push("La contraseña debe tener al menos 6 caracteres");
  } else {
    score += 1;
  }

  // Tiene letras mayúsculas
  if (!/[A-Z]/.test(password)) {
    errors.push("Debe incluir al menos una letra mayúscula");
  } else {
    score += 1;
  }

  // Tiene letras minúsculas
  if (!/[a-z]/.test(password)) {
    errors.push("Debe incluir al menos una letra minúscula");
  } else {
    score += 1;
  }

  // Tiene números
  if (!/\d/.test(password)) {
    errors.push("Debe incluir al menos un número");
  } else {
    score += 1;
  }

  // Tiene caracteres especiales
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Debe incluir al menos un carácter especial");
  } else {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    score, // 0-5 donde 5 es la máxima seguridad
    errors,
  };
};

/**
 * Valida un nombre de usuario
 * @param {string} username - Nombre de usuario a validar
 * @returns {Object} - Resultado de la validación
 */
export const validateUsername = (username) => {
  if (!username) {
    return {
      isValid: false,
      errors: ["El nombre de usuario no puede estar vacío"],
    };
  }

  const errors = [];

  // Longitud mínima
  if (username.length < 3) {
    errors.push("El nombre de usuario debe tener al menos 3 caracteres");
  }

  // Sin espacios en blanco
  if (/\s/.test(username)) {
    errors.push("El nombre de usuario no puede contener espacios");
  }

  // Solo caracteres alfanuméricos y algunos símbolos
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    errors.push(
      "El nombre de usuario solo puede contener letras, números, guiones, puntos y guiones bajos"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Valida una URL
 * @param {string} url - URL a validar
 * @returns {boolean} - true si la URL es válida
 */
export const isValidUrl = (url) => {
  if (!url) return false;

  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Valida una ruta de servidor
 * @param {string} path - Ruta a validar
 * @returns {boolean} - true si la ruta parece válida
 */
export const isValidServerPath = (path) => {
  if (!path) return false;

  // Expresión para rutas absolutas en sistemas Unix o Windows
  const unixPathRegex = /^\//;
  const windowsPathRegex = /^[a-zA-Z]:\\/;

  return unixPathRegex.test(path) || windowsPathRegex.test(path);
};

/**
 * Valida si un valor no está vacío
 * @param {any} value - Valor a validar
 * @returns {boolean} - true si el valor no está vacío
 */
export const isNotEmpty = (value) => {
  if (value === undefined || value === null) return false;

  if (typeof value === "string") return value.trim().length > 0;

  if (Array.isArray(value)) return value.length > 0;

  if (typeof value === "object") return Object.keys(value).length > 0;

  return true;
};

/**
 * Valida un formulario completo
 * @param {Object} formValues - Valores del formulario
 * @param {Object} validationRules - Reglas de validación
 * @returns {Object} - Errores de validación
 */
export const validateForm = (formValues, validationRules) => {
  const errors = {};

  Object.keys(validationRules).forEach((field) => {
    const rules = validationRules[field];
    const value = formValues[field];

    // Validación de requerido
    if (rules.required && !isNotEmpty(value)) {
      errors[field] = rules.requiredMessage || "Este campo es obligatorio";
      return;
    }

    // Validación de email
    if (rules.email && value && !isValidEmail(value)) {
      errors[field] = rules.emailMessage || "Email no válido";
      return;
    }

    // Validación de min length
    if (rules.minLength && value && value.length < rules.minLength) {
      errors[field] =
        rules.minLengthMessage ||
        `Debe tener al menos ${rules.minLength} caracteres`;
      return;
    }

    // Validación personalizada
    if (rules.custom && typeof rules.custom === "function") {
      const customError = rules.custom(value, formValues);
      if (customError) {
        errors[field] = customError;
      }
    }
  });

  return errors;
};
