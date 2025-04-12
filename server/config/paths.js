// server/config/paths.js
const path = require("path");

// Ruta raíz del proyecto
const ROOT_DIR = path.resolve(__dirname, "../..");

// Rutas del servidor
const SERVER_DIR = path.resolve(ROOT_DIR, "server");
const DATA_DIR = path.resolve(SERVER_DIR, "data-storage");

// Rutas para almacenamiento de datos
const THUMBNAILS_DIR = path.resolve(DATA_DIR, "thumbnails");
const TRANSCODED_DIR = path.resolve(DATA_DIR, "transcoded");
const METADATA_DIR = path.resolve(DATA_DIR, "metadata");
const CACHE_DIR = path.resolve(DATA_DIR, "cache");

// Rutas para el frontend
const CLIENT_DIR = path.resolve(ROOT_DIR, "client");
const FRONTEND_DIST_DIR = path.resolve(CLIENT_DIR, "dist");

// Rutas para el core de transcodificación
const CORE_DIR = path.resolve(ROOT_DIR, "core");

module.exports = {
  ROOT_DIR,
  SERVER_DIR,
  DATA_DIR,
  THUMBNAILS_DIR,
  TRANSCODED_DIR,
  METADATA_DIR,
  CACHE_DIR,
  CLIENT_DIR,
  FRONTEND_DIST_DIR,
  CORE_DIR,
};
