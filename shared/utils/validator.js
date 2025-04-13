// shared/utils/validators.js
const { REGEX } = require("../constants/config");

/**
 * Valida una dirección de correo electrónico
 * @param {string} email - Correo electrónico a validar
 * @returns {boolean} - true si el correo es válido
 */
function isValidEmail(email) {
  if (!email) return false;
  return REGEX.EMAIL.test(email);
}

/**
 * Valida una contraseña según criterios de seguridad
 * @param {string} password - Contraseña a validar
 * @returns {Object} - Resultado de la validación
 */
function validatePassword(password) {
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
}

/**
 * Valida un nombre de usuario
 * @param {string} username - Nombre de usuario a validar
 * @returns {Object} - Resultado de la validación
 */
function validateUsername(username) {
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
  if (!REGEX.USERNAME.test(username)) {
    errors.push(
      "El nombre de usuario solo puede contener letras, números, guiones, puntos y guiones bajos"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida una URL
 * @param {string} url - URL a validar
 * @returns {boolean} - true si la URL es válida
 */
function isValidUrl(url) {
  if (!url) return false;

  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Valida una ruta de servidor
 * @param {string} path - Ruta a validar
 * @returns {boolean} - true si la ruta parece válida
 */
function isValidServerPath(path) {
  if (!path) return false;
  return REGEX.FILE_PATH.test(path);
}

/**
 * Valida si un valor no está vacío
 * @param {any} value - Valor a validar
 * @returns {boolean} - true si el valor no está vacío
 */
function isNotEmpty(value) {
  if (value === undefined || value === null) return false;

  if (typeof value === "string") return value.trim().length > 0;

  if (Array.isArray(value)) return value.length > 0;

  if (typeof value === "object") return Object.keys(value).length > 0;

  return true;
}

/**
 * Valida si un valor es un número entero
 * @param {any} value - Valor a validar
 * @returns {boolean} - true si es un entero
 */
function isInteger(value) {
  if (value === undefined || value === null) return false;
  return Number.isInteger(Number(value));
}

/**
 * Valida si un valor está dentro de un rango numérico
 * @param {number} value - Valor a validar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {boolean} - true si está dentro del rango
 */
function isInRange(value, min, max) {
  if (value === undefined || value === null) return false;

  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Valida si un valor está en un conjunto de valores permitidos
 * @param {any} value - Valor a validar
 * @param {Array} allowedValues - Valores permitidos
 * @returns {boolean} - true si está en los valores permitidos
 */
function isOneOf(value, allowedValues) {
  if (!Array.isArray(allowedValues)) return false;
  return allowedValues.includes(value);
}

module.exports = {
  isValidEmail,
  validatePassword,
  validateUsername,
  isValidUrl,
  isValidServerPath,
  isNotEmpty,
  isInteger,
  isInRange,
  isOneOf,
};
