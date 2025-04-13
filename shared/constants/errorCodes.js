// shared/constants/errorCodes.js

/**
 * Códigos de error para la aplicación
 * Estructura: CATEGORY_SPECIFIC_ERROR
 */
const ERROR_CODES = {
  // Errores de autenticación (1xx)
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS", // Credenciales inválidas
  AUTH_EXPIRED_TOKEN: "AUTH_EXPIRED_TOKEN", // Token expirado
  AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN", // Token inválido
  AUTH_MISSING_TOKEN: "AUTH_MISSING_TOKEN", // Token no proporcionado
  AUTH_INSUFFICIENT_PERMISSIONS: "AUTH_INSUFFICIENT_PERMISSIONS", // Permisos insuficientes
  AUTH_EMAIL_IN_USE: "AUTH_EMAIL_IN_USE", // Email ya registrado
  AUTH_USERNAME_IN_USE: "AUTH_USERNAME_IN_USE", // Nombre de usuario en uso
  AUTH_INVALID_INVITATION: "AUTH_INVALID_INVITATION", // Código de invitación inválido
  AUTH_EXPIRED_INVITATION: "AUTH_EXPIRED_INVITATION", // Código de invitación expirado

  // Errores de recursos (2xx)
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND", // Recurso no encontrado
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS", // Recurso ya existe
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT", // Conflicto con recurso existente

  // Errores de validación (3xx)
  VALIDATION_FAILED: "VALIDATION_FAILED", // Validación de datos fallida
  VALIDATION_REQUIRED_FIELD: "VALIDATION_REQUIRED_FIELD", // Campo requerido faltante
  VALIDATION_INVALID_FORMAT: "VALIDATION_INVALID_FORMAT", // Formato de dato inválido
  VALIDATION_INVALID_VALUE: "VALIDATION_INVALID_VALUE", // Valor inválido

  // Errores de biblioteca (4xx)
  LIBRARY_ACCESS_DENIED: "LIBRARY_ACCESS_DENIED", // Acceso a biblioteca denegado
  LIBRARY_PATH_EXISTS: "LIBRARY_PATH_EXISTS", // Ruta de biblioteca ya existe
  LIBRARY_PATH_NOT_FOUND: "LIBRARY_PATH_NOT_FOUND", // Ruta de biblioteca no encontrada
  LIBRARY_PATH_NOT_READABLE: "LIBRARY_PATH_NOT_READABLE", // Ruta de biblioteca no legible
  LIBRARY_SCAN_IN_PROGRESS: "LIBRARY_SCAN_IN_PROGRESS", // Escaneo de biblioteca en progreso

  // Errores de media (5xx)
  MEDIA_FILE_NOT_FOUND: "MEDIA_FILE_NOT_FOUND", // Archivo multimedia no encontrado
  MEDIA_UNSUPPORTED_FORMAT: "MEDIA_UNSUPPORTED_FORMAT", // Formato multimedia no soportado
  MEDIA_TRANSCODING_ERROR: "MEDIA_TRANSCODING_ERROR", // Error de transcodificación
  MEDIA_STREAMING_ERROR: "MEDIA_STREAMING_ERROR", // Error de streaming

  // Errores del sistema (9xx)
  SYSTEM_ERROR: "SYSTEM_ERROR", // Error general del sistema
  SYSTEM_DATABASE_ERROR: "SYSTEM_DATABASE_ERROR", // Error de base de datos
  SYSTEM_DISK_FULL: "SYSTEM_DISK_FULL", // Disco lleno
  SYSTEM_IO_ERROR: "SYSTEM_IO_ERROR", // Error de entrada/salida
  SYSTEM_NETWORK_ERROR: "SYSTEM_NETWORK_ERROR", // Error de red
  SYSTEM_SERVICE_UNAVAILABLE: "SYSTEM_SERVICE_UNAVAILABLE", // Servicio no disponible
};

/**
 * Mapeo de códigos de error a mensajes en español
 */
const ERROR_MESSAGES = {
  // Errores de autenticación
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: "Credenciales inválidas",
  [ERROR_CODES.AUTH_EXPIRED_TOKEN]:
    "Sesión expirada, por favor inicia sesión nuevamente",
  [ERROR_CODES.AUTH_INVALID_TOKEN]: "Token de autenticación inválido",
  [ERROR_CODES.AUTH_MISSING_TOKEN]: "Se requiere autenticación",
  [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]:
    "No tienes permisos suficientes para esta operación",
  [ERROR_CODES.AUTH_EMAIL_IN_USE]: "Este correo electrónico ya está registrado",
  [ERROR_CODES.AUTH_USERNAME_IN_USE]: "Este nombre de usuario ya está en uso",
  [ERROR_CODES.AUTH_INVALID_INVITATION]: "Código de invitación inválido",
  [ERROR_CODES.AUTH_EXPIRED_INVITATION]: "Código de invitación expirado",

  // Errores de recursos
  [ERROR_CODES.RESOURCE_NOT_FOUND]: "Recurso no encontrado",
  [ERROR_CODES.RESOURCE_ALREADY_EXISTS]: "El recurso ya existe",
  [ERROR_CODES.RESOURCE_CONFLICT]: "Conflicto con un recurso existente",

  // Errores de validación
  [ERROR_CODES.VALIDATION_FAILED]: "Error de validación",
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: "Campo requerido faltante",
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: "Formato de dato inválido",
  [ERROR_CODES.VALIDATION_INVALID_VALUE]: "Valor inválido",

  // Errores de biblioteca
  [ERROR_CODES.LIBRARY_ACCESS_DENIED]: "No tienes acceso a esta biblioteca",
  [ERROR_CODES.LIBRARY_PATH_EXISTS]: "Ya existe una biblioteca con esta ruta",
  [ERROR_CODES.LIBRARY_PATH_NOT_FOUND]: "Ruta de biblioteca no encontrada",
  [ERROR_CODES.LIBRARY_PATH_NOT_READABLE]:
    "No se puede leer la ruta de biblioteca",
  [ERROR_CODES.LIBRARY_SCAN_IN_PROGRESS]:
    "Hay un escaneo en progreso para esta biblioteca",

  // Errores de media
  [ERROR_CODES.MEDIA_FILE_NOT_FOUND]: "Archivo multimedia no encontrado",
  [ERROR_CODES.MEDIA_UNSUPPORTED_FORMAT]: "Formato de archivo no soportado",
  [ERROR_CODES.MEDIA_TRANSCODING_ERROR]:
    "Error al procesar el archivo multimedia",
  [ERROR_CODES.MEDIA_STREAMING_ERROR]: "Error durante la reproducción",

  // Errores del sistema
  [ERROR_CODES.SYSTEM_ERROR]: "Error del sistema",
  [ERROR_CODES.SYSTEM_DATABASE_ERROR]: "Error de base de datos",
  [ERROR_CODES.SYSTEM_DISK_FULL]: "Espacio de almacenamiento insuficiente",
  [ERROR_CODES.SYSTEM_IO_ERROR]: "Error de entrada/salida",
  [ERROR_CODES.SYSTEM_NETWORK_ERROR]: "Error de conexión",
  [ERROR_CODES.SYSTEM_SERVICE_UNAVAILABLE]:
    "Servicio temporalmente no disponible",
};

/**
 * Función para obtener el mensaje de error correspondiente a un código
 * @param {string} code - Código de error
 * @param {string} [defaultMessage] - Mensaje por defecto si no se encuentra el código
 * @returns {string} - Mensaje de error
 */
const getErrorMessage = (code, defaultMessage = "Error desconocido") => {
  return ERROR_MESSAGES[code] || defaultMessage;
};

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
  getErrorMessage,
};
