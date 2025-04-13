// shared/constants/config.js

/**
 * Configuraciones por defecto de la aplicación
 */
const DEFAULT_CONFIG = {
  // Configuración del servidor
  SERVER: {
    PORT: 45000,
    HOST: "0.0.0.0",
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 horas en ms
    CORS_ORIGINS: ["http://localhost:45000", "http://127.0.0.1:45000"],
    API_PREFIX: "/api",
  },

  // Configuración de autenticación
  AUTH: {
    JWT_SECRET: "streamvio_secret_key",
    JWT_EXPIRY: "7d", // 7 días
    PASSWORD_MIN_LENGTH: 6,
    INVITATION_EXPIRY: 24, // 24 horas
    BCRYPT_ROUNDS: 10,
  },

  // Configuración de streaming
  STREAMING: {
    CHUNK_SIZE: 1024 * 1024, // 1MB
    BUFFER_SIZE: 10 * 1024 * 1024, // 10MB
    DEFAULT_QUALITY: "auto",
    MAX_BITRATE: 8000000, // 8Mbps
    SEGMENT_DURATION: 10, // 10 segundos por segmento HLS
    PLAYLIST_SIZE: 5, // Número de segmentos en la playlist
  },

  // Configuración de transcodificación
  TRANSCODING: {
    PRESET_LOW: {
      resolution: "480p",
      videoBitrate: "1000k",
      audioBitrate: "128k",
    },
    PRESET_MEDIUM: {
      resolution: "720p",
      videoBitrate: "2500k",
      audioBitrate: "192k",
    },
    PRESET_HIGH: {
      resolution: "1080p",
      videoBitrate: "5000k",
      audioBitrate: "320k",
    },
    THREADS: 2,
    HW_ACCELERATION: "auto", // 'auto', 'none', 'nvenc', 'qsv', 'vaapi'
  },

  // Configuración de bibliotecas
  LIBRARIES: {
    MAX_SCAN_DEPTH: 10, // Profundidad máxima de escaneo
    SCAN_BATCH_SIZE: 100, // Tamaño de lote para procesar archivos
    SCAN_INTERVAL: 24 * 60 * 60 * 1000, // 24 horas en ms
    THUMBNAIL_WIDTH: 320,
    THUMBNAIL_HEIGHT: 480,
  },

  // Configuración del sistema
  SYSTEM: {
    TEMP_DIR: "./data-storage/temp",
    THUMBNAILS_DIR: "./data-storage/thumbnails",
    TRANSCODED_DIR: "./data-storage/transcoded",
    METADATA_DIR: "./data-storage/metadata",
    LOG_LEVEL: "info",
    MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_LOG_FILES: 5,
  },

  // Configuración de interfaz de usuario
  UI: {
    DEFAULT_THEME: "dark",
    ITEMS_PER_PAGE: 24,
    MAX_SEARCH_RESULTS: 100,
    DEFAULT_LANGUAGE: "es",
  },
};

/**
 * Expiración de varias cachés en milisegundos
 */
const CACHE_TTL = {
  MEDIA_INFO: 24 * 60 * 60 * 1000, // 24 horas
  USER_PERMISSIONS: 30 * 60 * 1000, // 30 minutos
  THUMBNAILS: 7 * 24 * 60 * 60 * 1000, // 7 días
  METADATA: 24 * 60 * 60 * 1000, // 24 horas
  DASHBOARD_STATS: 5 * 60 * 1000, // 5 minutos
};

/**
 * Expresiones regulares útiles
 */
const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/,
  USERNAME: /^[a-zA-Z0-9._-]{3,}$/,
  FILE_PATH: /^(\/[\w.-]+)+\/?$|^[a-zA-Z]:\\([\w.-]+\\)*[\w.-]*$/,
};

module.exports = {
  DEFAULT_CONFIG,
  CACHE_TTL,
  REGEX,
};
