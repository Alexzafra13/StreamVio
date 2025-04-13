// server/config/paths.js
const path = require("path");
const fs = require("fs");
const environment = require("./environment");

// Resolver rutas absolutas

// Ruta raíz del proyecto
const ROOT_DIR = path.resolve(__dirname, "../..");

// Rutas del servidor
const SERVER_DIR = path.resolve(ROOT_DIR, "server");
const CONFIG_DIR = path.resolve(SERVER_DIR, "config");
const ROUTES_DIR = path.resolve(SERVER_DIR, "api/routes");
const CONTROLLERS_DIR = path.resolve(SERVER_DIR, "api/controllers");
const SERVICES_DIR = path.resolve(SERVER_DIR, "services");
const UTILS_DIR = path.resolve(SERVER_DIR, "utils");

// Rutas para datos y archivos generados
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(SERVER_DIR, "data-storage");

// Subdirectorios para almacenamiento de datos
const THUMBNAILS_DIR = path.resolve(DATA_DIR, "thumbnails");
const TRANSCODED_DIR = path.resolve(DATA_DIR, "transcoded");
const METADATA_DIR = path.resolve(DATA_DIR, "metadata");
const CACHE_DIR = path.resolve(DATA_DIR, "cache");
const TEMP_DIR = path.resolve(DATA_DIR, "temp");
const LOGS_DIR = path.resolve(DATA_DIR, "logs");
const BACKUPS_DIR = path.resolve(DATA_DIR, "backups");

// Rutas para la base de datos
const DB_DIR = path.resolve(DATA_DIR, "db");
const DB_FILE =
  environment.DB_PATH ||
  path.resolve(
    DB_DIR,
    environment.isDevelopment
      ? "streamvio-dev.db"
      : environment.isTest
      ? ":memory:"
      : "streamvio.db"
  );

// Rutas para el frontend
const CLIENT_DIR = path.resolve(ROOT_DIR, "client");
const FRONTEND_SRC_DIR = path.resolve(CLIENT_DIR, "src");
const FRONTEND_DIST_DIR = path.resolve(CLIENT_DIR, "dist");
const FRONTEND_PUBLIC_DIR = path.resolve(CLIENT_DIR, "public");

// Rutas para archivos específicos del proyecto
const ENV_FILE = path.resolve(ROOT_DIR, ".env");
const PACKAGE_JSON = path.resolve(ROOT_DIR, "package.json");

// Rutas para el core de transcodificación nativo
const CORE_DIR = path.resolve(ROOT_DIR, "core");
const CORE_INCLUDE_DIR = path.resolve(CORE_DIR, "include");
const CORE_SRC_DIR = path.resolve(CORE_DIR, "src");
const CORE_BUILD_DIR = path.resolve(CORE_DIR, "build");
const CORE_BINDING_DIR = path.resolve(CORE_DIR, "bindings/node");

// Función para crear directorios si no existen
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

// Asegurar que los directorios críticos existan
ensureDirectoryExists(DATA_DIR);
ensureDirectoryExists(DB_DIR);
environment.LOG_TO_FILE && ensureDirectoryExists(LOGS_DIR);

// Exportar todas las rutas
module.exports = {
  // Directorios principales
  ROOT_DIR,
  SERVER_DIR,
  CLIENT_DIR,
  DATA_DIR,
  CONFIG_DIR,

  // Directorios del servidor
  ROUTES_DIR,
  CONTROLLERS_DIR,
  SERVICES_DIR,
  UTILS_DIR,

  // Directorios de datos
  THUMBNAILS_DIR,
  TRANSCODED_DIR,
  METADATA_DIR,
  CACHE_DIR,
  TEMP_DIR,
  LOGS_DIR,
  BACKUPS_DIR,
  DB_DIR,

  // Directorios del frontend
  FRONTEND_SRC_DIR,
  FRONTEND_DIST_DIR,
  FRONTEND_PUBLIC_DIR,

  // Directorios del core
  CORE_DIR,
  CORE_INCLUDE_DIR,
  CORE_SRC_DIR,
  CORE_BUILD_DIR,
  CORE_BINDING_DIR,

  // Archivos específicos
  DB_FILE,
  ENV_FILE,
  PACKAGE_JSON,

  // Función utilitaria
  ensureDirectoryExists,
};
