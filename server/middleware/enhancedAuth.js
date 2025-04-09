// server/middleware/enhancedAuth.js
const jwt = require("jsonwebtoken");
const settings = require("../config/settings");
const streamingTokenService = require("../services/streamingTokenService");

/**
 * Middleware de autenticación unificado que maneja tanto tokens JWT estándar
 * como tokens de streaming específicos
 */
const enhancedAuthMiddleware = async (req, res, next) => {
  let authToken = null;
  let streamToken = null;

  console.log("Headers recibidos:", req.headers);
  console.log("Query params:", req.query);
  console.log("Ruta solicitada:", req.path);

  // 1. Intentar obtener el token JWT de autorización
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    authToken = authHeader.split(" ")[1];
    console.log(
      "Token encontrado en header Authorization:",
      authToken.substring(0, 10) + "..."
    );
  } else if (req.query.auth) {
    authToken = req.query.auth;
    console.log(
      "Token encontrado en query param auth:",
      authToken.substring(0, 10) + "..."
    );
  }

  // 2. Intentar obtener el token de streaming
  streamToken =
    req.query.stream_token ||
    req.query.token || // Añadir 'token' como parámetro alternativo
    req.headers["x-stream-token"] ||
    req.headers["stream-token"];

  if (streamToken) {
    console.log(
      "Stream token encontrado:",
      streamToken.substring(0, 10) + "..."
    );
  }

  // 3. Si no hay ningún token, intentar opciones alternativas
  if (!authToken && !streamToken) {
    console.log("No se encontró ningún token en la solicitud");

    // SOLO PARA DEPURACIÓN: Si es una solicitud de streaming o miniatura, permitir temporalmente
    if (req.path.includes("/stream") || req.path.includes("/thumbnail")) {
      console.log(
        "ADVERTENCIA: Permitiendo acceso sin token para pruebas en:",
        req.path
      );
      req.user = { id: 1 }; // Asignar un ID de usuario por defecto
      return next();
    }

    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación para acceder a este recurso",
      code: "NO_TOKEN",
    });
  }

  try {
    // 4. Si hay un token de streaming, verificarlo primero (tiene prioridad para rutas de streaming)
    if (streamToken) {
      const verification = await streamingTokenService.verifyToken(streamToken);

      if (verification.isValid) {
        // Añadir información del token a la solicitud
        req.streamToken = verification.data;
        req.user = { id: verification.data.uid }; // Añadir información básica de usuario compatible con el flujo normal

        console.log(
          "Token de streaming verificado con éxito para usuario:",
          verification.data.uid
        );

        // Si el token está cerca de expirar, generar uno nuevo y enviarlo en la respuesta
        if (verification.needsRenewal) {
          try {
            const newToken = await streamingTokenService.renewToken(
              streamToken
            );
            res.setHeader("X-New-Stream-Token", newToken);
            console.log("Token de streaming renovado automáticamente");
          } catch (renewError) {
            console.warn("Error al renovar token de streaming:", renewError);
            // Continuamos aunque falle la renovación, ya que el token actual aún es válido
          }
        }

        return next();
      }

      // Si el token de streaming es inválido pero hay un token JWT, continuar con él
      if (!authToken) {
        console.error(
          "Token de streaming inválido y no hay token JWT:",
          verification.error
        );
        return res.status(401).json({
          error: "Token inválido",
          message: verification.error,
          code: verification.code,
        });
      }

      // Si hay un token JWT, continuamos con la verificación del mismo
      console.warn(
        "Token de streaming inválido, intentando autenticación JWT..."
      );
    }

    // 5. Verificar el token JWT si no hay token de streaming o si éste no es válido
    const jwtSecret =
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key";

    try {
      const decoded = jwt.verify(authToken, jwtSecret);

      // Añadir información del usuario a la solicitud
      req.user = decoded;
      req.token = authToken;

      console.log("Token JWT verificado con éxito para usuario:", decoded.id);

      // Registrar actividad para logging (solo en APIs principales)
      if (req.path.startsWith("/api/") && !req.path.includes("/stream")) {
        const method = req.method;
        const url = req.originalUrl;
        console.log(
          `Usuario ${decoded.id} (${
            decoded.username || "desconocido"
          }): ${method} ${url}`
        );
      }

      // Continuar con la solicitud
      return next();
    } catch (jwtError) {
      console.error("Error al verificar token JWT:", jwtError);

      // SOLO PARA DEPURACIÓN: Si es una solicitud de streaming o miniatura, permitir temporalmente
      if (req.path.includes("/stream") || req.path.includes("/thumbnail")) {
        console.log(
          "ADVERTENCIA: Permitiendo acceso sin token para pruebas en:",
          req.path
        );
        req.user = { id: 1 }; // Asignar un ID de usuario por defecto
        return next();
      }

      // Determinar el tipo de error
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Token expirado",
          message:
            "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
          code: "TOKEN_EXPIRED",
        });
      }

      // Token inválido por otras razones
      return res.status(401).json({
        error: "Token inválido",
        message: "No autorizado - token inválido",
        code: "TOKEN_INVALID",
      });
    }
  } catch (error) {
    console.error("Error general de autenticación:", error);

    // SOLO PARA DEPURACIÓN: Si es una solicitud de streaming o miniatura, permitir temporalmente
    if (req.path.includes("/stream") || req.path.includes("/thumbnail")) {
      console.log(
        "ADVERTENCIA: Permitiendo acceso sin token para pruebas tras error:",
        req.path
      );
      req.user = { id: 1 }; // Asignar un ID de usuario por defecto
      return next();
    }

    // Determinar el tipo de error
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        message: "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
        code: "TOKEN_EXPIRED",
      });
    }

    // Token inválido por otras razones
    return res.status(401).json({
      error: "Token inválido",
      message: "No autorizado - token inválido",
      code: "TOKEN_INVALID",
    });
  }
};

module.exports = enhancedAuthMiddleware;
