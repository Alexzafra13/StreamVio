// src/utils/formatters.js
/**
 * Utilidades para formatear diferentes tipos de datos
 */

/**
 * Formatea una duración en segundos a formato legible
 * @param {number} seconds - Duración en segundos
 * @param {boolean} [includeSeconds=false] - Si se deben incluir los segundos
 * @returns {string} - Duración formateada (ej: 1h 24m o 1h 24m 35s)
 */
export const formatDuration = (seconds, includeSeconds = false) => {
  if (!seconds || isNaN(seconds)) return "Desconocida";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  let result = "";

  if (hours > 0) {
    result += `${hours}h `;
  }

  if (minutes > 0 || hours > 0) {
    result += `${minutes}m`;
  }

  if (includeSeconds && secs > 0) {
    result += ` ${secs}s`;
  }

  return result.trim() || "0m";
};

/**
 * Formatea un tamaño en bytes a formato legible
 * @param {number} bytes - Tamaño en bytes
 * @param {number} [decimals=2] - Número de decimales
 * @returns {string} - Tamaño formateado (ej: 1.5 MB)
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  if (!bytes || isNaN(bytes)) return "Desconocido";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Formatea una fecha a formato legible
 * @param {string|Date} date - Fecha a formatear
 * @param {Object} [options] - Opciones de formato
 * @returns {string} - Fecha formateada
 */
export const formatDate = (date, options = {}) => {
  if (!date) return "Fecha desconocida";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "Fecha inválida";

  const defaultOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: options.includeTime ? "2-digit" : undefined,
    minute: options.includeTime ? "2-digit" : undefined,
  };

  return new Intl.DateTimeFormat("es", {
    ...defaultOptions,
    ...options,
  }).format(dateObj);
};

/**
 * Formatea un nombre de tipo de medio a formato legible
 * @param {string} type - Tipo de medio
 * @returns {string} - Tipo formateado
 */
export const formatMediaType = (type) => {
  const types = {
    movie: "Película",
    series: "Serie",
    season: "Temporada",
    episode: "Episodio",
    music: "Música",
    photo: "Foto",
  };

  return types[type] || type;
};

/**
 * Formatea un porcentaje
 * @param {number} value - Valor actual
 * @param {number} total - Valor total
 * @param {number} [decimals=0] - Número de decimales
 * @returns {string} - Porcentaje formateado
 */
export const formatPercent = (value, total, decimals = 0) => {
  if (!value || !total) return "0%";

  const percent = (value / total) * 100;
  return `${percent.toFixed(decimals)}%`;
};

/**
 * Trunca un texto si excede la longitud especificada
 * @param {string} text - Texto a truncar
 * @param {number} [length=100] - Longitud máxima
 * @returns {string} - Texto truncado
 */
export const truncateText = (text, length = 100) => {
  if (!text) return "";

  if (text.length <= length) return text;

  return text.substring(0, length) + "...";
};

/**
 * Formatea un nombre para hacerlo más legible
 * @param {string} name - Nombre a formatear
 * @returns {string} - Nombre formateado
 */
export const formatName = (name) => {
  if (!name) return "";

  // Convertir camelCase o snake_case a palabras separadas
  return name
    .replace(/([A-Z])/g, " $1") // Separar camelCase
    .replace(/_/g, " ") // Reemplazar guiones bajos
    .replace(/^\w/, (c) => c.toUpperCase()) // Primera letra mayúscula
    .trim();
};

/**
 * Formatea un número con separadores de miles
 * @param {number} number - Número a formatear
 * @returns {string} - Número formateado
 */
export const formatNumber = (number) => {
  if (number === undefined || number === null) return "";

  return new Intl.NumberFormat("es").format(number);
};
