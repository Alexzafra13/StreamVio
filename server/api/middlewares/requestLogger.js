// server/api/middlewares/requestLogger.js
const environment = require("../../config/environment");

/**
 * Middleware para registrar información sobre las solicitudes HTTP
 */
const requestLogger = (req, res, next) => {
  // Obtener la hora de inicio
  const start = Date.now();

  // Obtener la IP del cliente
  const ip = req.ip || req.connection.remoteAddress;

  // Obtener el método y la ruta
  const method = req.method;
  const url = req.originalUrl || req.url;

  // Obtener el user-agent
  const userAgent = req.headers["user-agent"] || "unknown";

  // Obtener ID del usuario si está autenticado
  const userId = req.user ? req.user.id : "anonymous";

  // Función para registrar la respuesta
  const logResponse = () => {
    // Calcular tiempo de respuesta
    const responseTime = Date.now() - start;

    // Construir mensaje de log
    const status = res.statusCode;
    const statusColor =
      status >= 500
        ? "\x1b[31m" // rojo
        : status >= 400
        ? "\x1b[33m" // amarillo
        : status >= 300
        ? "\x1b[36m" // cian
        : status >= 200
        ? "\x1b[32m" // verde
        : "\x1b[0m"; // normal

    const reset = "\x1b[0m";

    // Formato del log: [TIMESTAMP] METHOD URL STATUS RESPONSE_TIME ms - USER_ID
    const log = `${statusColor}${status}${reset} ${method} ${url} - ${responseTime}ms - User: ${userId}`;

    // En desarrollo, mostrar más información
    if (environment.isDevelopment) {
      console.log(`${ip} - ${log} - ${userAgent.slice(0, 50)}`);
    } else {
      console.log(log);
    }
  };

  // Registrar cuando se completa la respuesta
  res.on("finish", logResponse);

  next();
};

module.exports = requestLogger;
