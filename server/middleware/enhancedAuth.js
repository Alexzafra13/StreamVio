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

  // 1. Intentar obtener el token JWT de autorización
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    authToken = authHeader.split(" ")[1];
  } else if (req.query.auth) {
    authToken = req.query.auth;
  }

  // 2. Intentar obtener el token de streaming
  streamToken =
    req.query.stream_token ||
    req.headers["x-stream-token"] ||
    req.headers["stream-token"];

  // 3. Si no hay ningún token, devolver error de autenticación
  if (!authToken && !streamToken) {
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

        // Si el token está cerca de expirar, generar uno nuevo y enviarlo en la respuesta
        if (verification.needsRenewal) {
          try {
            const newToken = await streamingTokenService.renewToken(
              streamToken
            );
            res.setHeader("X-New-Stream-Token", newToken);
          } catch (renewError) {
            console.warn("Error al renovar token de streaming:", renewError);
            // Continuamos aunque falle la renovación, ya que el token actual aún es válido
          }
        }

        return next();
      }

      // Si el token de streaming es inválido pero hay un token JWT, continuar con él
      if (!authToken) {
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
    const decoded = jwt.verify(authToken, jwtSecret);

    // Añadir información del usuario a la solicitud
    req.user = decoded;
    req.token = authToken;

    // Registrar actividad para logging (solo en APIs principales)
    if (req.path.startsWith("/api/") && !req.path.includes("/stream")) {
      const method = req.method;
      const url = req.originalUrl;
      console.log(
        `Usuario ${decoded.id} (${decoded.username}): ${method} ${url}`
      );
    }

    // Continuar con la solicitud
    return next();
  } catch (error) {
    console.error("Error de autenticación:", error);

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
