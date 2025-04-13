// shared/utils/formatters.js

/**
 * Formatea una duración en segundos a formato legible
 * @param {number} seconds - Duración en segundos
 * @param {boolean} [includeSeconds=false] - Si se deben incluir los segundos
 * @returns {string} - Duración formateada (ej: 1h 24m o 1h 24m 35s)
 */
function formatDuration(seconds, includeSeconds = false) {
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
}

/**
 * Formatea un tamaño en bytes a formato legible
 * @param {number} bytes - Tamaño en bytes
 * @param {number} [decimals=2] - Número de decimales
 * @returns {string} - Tamaño formateado (ej: 1.5 MB)
 */
function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  if (!bytes || isNaN(bytes)) return "Desconocido";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Formatea una fecha a formato legible
 * @param {string|Date} date - Fecha a formatear
 * @param {Object} [options] - Opciones de formato
 * @returns {string} - Fecha formateada
 */
function formatDate(date, options = {}) {
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
}

/**
 * Formatea un nombre de tipo de medio a formato legible
 * @param {string} type - Tipo de medio
 * @returns {string} - Tipo formateado
 */
function formatMediaType(type) {
  const types = {
    movie: "Película",
    series: "Serie",
    season: "Temporada",
    episode: "Episodio",
    music: "Música",
    photo: "Foto",
  };

  return types[type] || type;
}

/**
 * Formatea un porcentaje
 * @param {number} value - Valor actual
 * @param {number} total - Valor total
 * @param {number} [decimals=0] - Número de decimales
 * @returns {string} - Porcentaje formateado
 */
function formatPercent(value, total, decimals = 0) {
  if (!value || !total) return "0%";

  const percent = (value / total) * 100;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Obtiene el texto para clasificación por edad
 * @param {string} rating - Clasificación (G, PG, PG-13, R, etc.)
 * @returns {string} - Texto para visualización
 */
function formatAgeRating(rating) {
  if (!rating) return "Sin clasificación";

  const ratings = {
    G: "Apto para todos los públicos",
    PG: "Guía parental sugerida",
    "PG-13": "Guía parental estricta para menores de 13 años",
    R: "Restringido a menores de 17 años sin acompañante",
    "NC-17": "Solo para adultos",
    TP: "Todos los públicos",
    7: "No recomendada para menores de 7 años",
    12: "No recomendada para menores de 12 años",
    16: "No recomendada para menores de 16 años",
    18: "No recomendada para menores de 18 años",
  };

  return ratings[rating] || rating;
}

/**
 * Formatea un nombre para hacerlo más legible
 * @param {string} name - Nombre a formatear
 * @returns {string} - Nombre formateado
 */
function formatName(name) {
  if (!name) return "";

  // Convertir camelCase o snake_case a palabras separadas
  return name
    .replace(/([A-Z])/g, " $1") // Separar camelCase
    .replace(/_/g, " ") // Reemplazar guiones bajos
    .replace(/^\w/, (c) => c.toUpperCase()) // Primera letra mayúscula
    .trim();
}

module.exports = {
  formatDuration,
  formatFileSize,
  formatDate,
  formatMediaType,
  formatPercent,
  formatAgeRating,
  formatName,
};
