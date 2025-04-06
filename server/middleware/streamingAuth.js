// server/middleware/streamingAuth.js
const streamingTokenService = require("../services/streamingTokenService");

/**
 * Middleware para verificar tokens de streaming
 * Este middleware maneja la autenticación específica para streaming
 * y gestiona la renovación automática de tokens
 */
const streamingAuthMiddleware = async (req, res, next) => {
  // Extraer el token de streaming de los parámetros o headers
  const streamToken =
    req.query.stream_token ||
    req.headers["x-stream-token"] ||
    req.headers["stream-token"];

  if (!streamToken) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Token de streaming no proporcionado",
      code: "STREAM_TOKEN_MISSING",
    });
  }

  try {
    // Verificar la validez del token
    const verification = await streamingTokenService.verifyToken(streamToken);

    if (!verification.isValid) {
      return res.status(401).json({
        error: "Token inválido",
        message: verification.error,
        code: verification.code,
      });
    }

    // Añadir información del token a la solicitud
    req.streamToken = verification.data;

    // Si el token está cerca de expirar, generar uno nuevo y enviarlo al cliente
    if (verification.needsRenewal) {
      try {
        const newToken = await streamingTokenService.renewToken(streamToken);

        // Añadir el nuevo token al header de respuesta para que el cliente lo actualice
        res.setHeader("X-New-Stream-Token", newToken);
        console.log(
          `Token de streaming renovado para usuario: ${verification.data.uid}, media: ${verification.data.mid}`
        );
      } catch (renewError) {
        console.warn("Error al renovar token de streaming:", renewError);
        // Continuamos aunque falle la renovación, ya que el token actual aún es válido
      }
    }

    // Continuar con la solicitud
    next();
  } catch (error) {
    console.error("Error en middleware de streaming:", error);
    res.status(500).json({
      error: "Error interno",
      message: "Error al procesar token de streaming",
    });
  }
};

module.exports = streamingAuthMiddleware;
