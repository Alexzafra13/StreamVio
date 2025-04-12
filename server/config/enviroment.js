// server/config/environment.js
require("dotenv").config();

// Capturar todas las variables de entorno con valores por defecto
const environment = {
  // Entorno de ejecución
  NODE_ENV: process.env.NODE_ENV || "development",

  // Servidor
  PORT: parseInt(process.env.PORT || "45000", 10),
  HOST: process.env.HOST || "0.0.0.0",

  // JWT y autenticación
  JWT_SECRET: process.env.JWT_SECRET || "streamvio_secret_key",
  JWT_EXPIRY: process.env.JWT_EXPIRY || "7d",

  // TMDb API
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN,

  // Configuraciones de usuario
  MAX_USERS: parseInt(process.env.MAX_USERS || "10", 10),

  // Configuración de transcodificación
  TRANSCODING_ENABLED: process.env.TRANSCODING_ENABLED !== "false",
  MAX_BITRATE: parseInt(process.env.MAX_BITRATE || "8000", 10),

  // Escaneo de bibliotecas
  AUTO_FETCH_METADATA: process.env.AUTO_FETCH_METADATA !== "false",
  SCAN_INTERVAL: parseInt(process.env.SCAN_INTERVAL || "3600", 10),

  // Configuración del servicio
  SERVICE_USER: process.env.SERVICE_USER || "streamvio",
  SERVICE_GROUP: process.env.SERVICE_GROUP || "streamvio",

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
};

module.exports = environment;
