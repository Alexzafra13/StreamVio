// server/utils/logger.js
const winston = require("winston");
const path = require("path");
const environment = require("../config/environment");
const { LOGS_DIR } = require("../config/paths");

// Formateo personalizado para los logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS",
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    // Formatear meta datos adicionales si existen
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      metaStr = ` ${JSON.stringify(meta)}`;
    }

    // Incluir stack trace si existe
    const stackStr = stack ? `\n${stack}` : "";

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}${stackStr}`;
  })
);

// Colores para los diferentes niveles de log
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

// Añadir colores a Winston
winston.addColors(colors);

// Configuración de los transportes
const transports = [
  // Logs en consola con colores
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      customFormat
    ),
  }),
];

// Añadir transporte de archivo si está configurado
if (environment.LOG_TO_FILE) {
  const logFilePath = path.isAbsolute(environment.LOG_FILE)
    ? environment.LOG_FILE
    : path.join(LOGS_DIR, environment.LOG_FILE);

  transports.push(
    new winston.transports.File({
      filename: logFilePath,
      maxsize: environment.LOG_MAX_SIZE, // Tamaño máximo en bytes
      maxFiles: environment.LOG_MAX_FILES,
      tailable: true,
      format: customFormat,
    })
  );
}

// Crear el logger
const logger = winston.createLogger({
  level: environment.LOG_LEVEL || "info",
  levels: winston.config.npm.levels,
  format: customFormat,
  transports,
});

// Middleware para Express que registra las solicitudes HTTP
const httpLogger = (req, res, next) => {
  // No registrar rutas de recursos estáticos
  if (req.path.startsWith("/assets/") || req.path.startsWith("/static/")) {
    return next();
  }

  const start = Date.now();

  // Cuando la respuesta termine
  res.on("finish", () => {
    const duration = Date.now() - start;
    const userAgent = req.headers["user-agent"] || "unknown";
    const userId = req.user ? req.user.id : "anonymous";

    logger.http(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${userId} - ${userAgent}`
    );
  });

  next();
};

// Función para obtener un logger específico para un módulo
function getModuleLogger(moduleName) {
  return {
    error: (message, meta) => logger.error(`[${moduleName}] ${message}`, meta),
    warn: (message, meta) => logger.warn(`[${moduleName}] ${message}`, meta),
    info: (message, meta) => logger.info(`[${moduleName}] ${message}`, meta),
    http: (message, meta) => logger.http(`[${moduleName}] ${message}`, meta),
    debug: (message, meta) => logger.debug(`[${moduleName}] ${message}`, meta),
    child: (metadata) => {
      return getModuleLogger(moduleName);
    },
  };
}

// Función para registrar eventos del sistema
function logEvent(eventType, data) {
  logger.info(`EVENT: ${eventType}`, data);
}

// Función para registrar inicio/fin de operaciones y su duración
function logOperation(operation, fn) {
  return async (...args) => {
    const start = Date.now();
    logger.debug(`Starting operation: ${operation}`);

    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      logger.debug(`Completed operation: ${operation} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Failed operation: ${operation} (${duration}ms)`, { error });
      throw error;
    }
  };
}

// Configurar manejo de errores no capturados
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
});

// Exportar funcionalidades del módulo
module.exports = {
  logger,
  httpLogger,
  getModuleLogger,
  logEvent,
  logOperation,

  // Método abreviados para el logger principal
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  http: logger.http.bind(logger),
  debug: logger.debug.bind(logger),

  // Stream para Morgan (si se usa)
  stream: {
    write: (message) => {
      logger.http(message.trim());
    },
  },
};
