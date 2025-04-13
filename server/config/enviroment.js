// server/config/environment.js
require("dotenv").config();

/**
 * Configuración del entorno para StreamVio
 * Carga las variables de entorno y proporciona valores por defecto
 */

// Capturar todas las variables de entorno con valores por defecto
const environment = {
  // Entorno de ejecución
  NODE_ENV: process.env.NODE_ENV || "development",

  // Servidor
  PORT: parseInt(process.env.PORT || "45000", 10),
  HOST: process.env.HOST || "0.0.0.0",
  BASE_URL: process.env.BASE_URL || "http://localhost:45000",
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")
    : ["*"],
  TRUST_PROXY: process.env.TRUST_PROXY === "true",

  // Base de datos
  DB_PATH: process.env.DB_PATH || null, // Si es null, se usará el valor por defecto en paths.js
  DB_LOG_QUERIES: process.env.DB_LOG_QUERIES === "true",

  // JWT y autenticación
  JWT_SECRET:
    process.env.JWT_SECRET || "streamvio_secret_key_do_not_use_in_production",
  JWT_EXPIRY: process.env.JWT_EXPIRY || "7d",
  SESSION_COOKIE: process.env.SESSION_COOKIE === "true",
  COOKIE_SECRET: process.env.COOKIE_SECRET || "streamvio_cookie_secret",
  COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
  REQUIRE_INVITATION: process.env.REQUIRE_INVITATION !== "false", // Por defecto true

  // TMDb API (The Movie Database)
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN,
  TMDB_LANGUAGE: process.env.TMDB_LANGUAGE || "es-ES",

  // Configuraciones de usuario
  MAX_USERS: parseInt(process.env.MAX_USERS || "10", 10),
  DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME || "admin",
  DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_EMAIL: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",

  // Configuración de transcodificación
  TRANSCODING_ENABLED: process.env.TRANSCODING_ENABLED !== "false", // Por defecto true
  MAX_BITRATE: parseInt(process.env.MAX_BITRATE || "8000", 10),
  TRANSCODE_THREADS: parseInt(process.env.TRANSCODE_THREADS || "2", 10),
  FFMPEG_PATH: process.env.FFMPEG_PATH || null, // Si es null, se usará el de PATH
  FFPROBE_PATH: process.env.FFPROBE_PATH || null, // Si es null, se usará el de PATH
  HW_ACCELERATION: process.env.HW_ACCELERATION || "auto", // auto, nvenc, qsv, vaapi, none
  TRANSCODE_QUEUE_SIZE: parseInt(process.env.TRANSCODE_QUEUE_SIZE || "5", 10),

  // Escaneo de bibliotecas
  AUTO_FETCH_METADATA: process.env.AUTO_FETCH_METADATA !== "false", // Por defecto true
  SCAN_INTERVAL: parseInt(process.env.SCAN_INTERVAL || "3600", 10), // En segundos
  SKIP_EXISTING_FILES: process.env.SKIP_EXISTING_FILES !== "false", // Por defecto true
  AUTO_GENERATE_THUMBNAILS: process.env.AUTO_GENERATE_THUMBNAILS !== "false", // Por defecto true

  // Streaming
  DIRECT_STREAM_ALLOWED: process.env.DIRECT_STREAM_ALLOWED !== "false", // Por defecto true
  HLS_SEGMENT_DURATION: parseInt(process.env.HLS_SEGMENT_DURATION || "2", 10), // En segundos
  MAX_STREAMING_BITRATE: parseInt(process.env.MAX_STREAMING_BITRATE || "0", 10), // 0 = sin límite

  // Configuración del servicio
  SERVICE_USER: process.env.SERVICE_USER || "streamvio",
  SERVICE_GROUP: process.env.SERVICE_GROUP || "streamvio",
  PROCESS_PRIORITY: parseInt(process.env.PROCESS_PRIORITY || "0", 10), // -20 a 19, menor = mayor prioridad

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info", // debug, info, warn, error
  LOG_TO_FILE: process.env.LOG_TO_FILE === "true",
  LOG_FILE: process.env.LOG_FILE || "streamvio.log",
  LOG_MAX_SIZE: process.env.LOG_MAX_SIZE || "10m",
  LOG_MAX_FILES: parseInt(process.env.LOG_MAX_FILES || "5", 10),

  // Seguridad
  SECURE_HEADERS: process.env.SECURE_HEADERS !== "false", // Por defecto true
  RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED !== "false", // Por defecto true
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || "15", 10), // En minutos
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || "100", 10), // Solicitudes por ventana

  // WebSockets
  WEBSOCKETS_ENABLED: process.env.WEBSOCKETS_ENABLED !== "false", // Por defecto true

  // Funciones auxiliares para verificar el entorno
  get isDevelopment() {
    return this.NODE_ENV === "development";
  },

  get isProduction() {
    return this.NODE_ENV === "production";
  },

  get isTest() {
    return this.NODE_ENV === "test";
  },

  /**
   * Verifica si una característica está habilitada
   * @param {string} feature - Nombre de la característica
   * @returns {boolean} - true si la característica está habilitada
   */
  isFeatureEnabled(feature) {
    switch (feature) {
      case "transcoding":
        return this.TRANSCODING_ENABLED;
      case "metadata":
        return !!this.TMDB_API_KEY;
      case "websockets":
        return this.WEBSOCKETS_ENABLED;
      case "hardwareAcceleration":
        return this.HW_ACCELERATION !== "none";
      case "directStreaming":
        return this.DIRECT_STREAM_ALLOWED;
      case "rateLimit":
        return this.RATE_LIMIT_ENABLED;
      case "sessionCookies":
        return this.SESSION_COOKIE;
      default:
        return false;
    }
  },

  /**
   * Obtiene configuración para una característica específica
   * @param {string} feature - Nombre de la característica
   * @returns {Object} - Configuración de la característica
   */
  getFeatureConfig(feature) {
    switch (feature) {
      case "transcoding":
        return {
          enabled: this.TRANSCODING_ENABLED,
          maxBitrate: this.MAX_BITRATE,
          threads: this.TRANSCODE_THREADS,
          hwAcceleration: this.HW_ACCELERATION,
          queueSize: this.TRANSCODE_QUEUE_SIZE,
        };
      case "metadata":
        return {
          enabled: !!this.TMDB_API_KEY,
          apiKey: this.TMDB_API_KEY,
          accessToken: this.TMDB_ACCESS_TOKEN,
          language: this.TMDB_LANGUAGE,
        };
      case "streaming":
        return {
          directStreamAllowed: this.DIRECT_STREAM_ALLOWED,
          hlsSegmentDuration: this.HLS_SEGMENT_DURATION,
          maxBitrate: this.MAX_STREAMING_BITRATE,
        };
      case "security":
        return {
          secureHeaders: this.SECURE_HEADERS,
          rateLimit: {
            enabled: this.RATE_LIMIT_ENABLED,
            window: this.RATE_LIMIT_WINDOW,
            max: this.RATE_LIMIT_MAX,
          },
          jwt: {
            expiry: this.JWT_EXPIRY,
          },
          cookies: {
            enabled: this.SESSION_COOKIE,
            secure: this.COOKIE_SECURE,
          },
        };
      default:
        return {};
    }
  },
};

module.exports = environment;
