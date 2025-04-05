// server/middleware/auth.js - Versión mejorada
const jwt = require("jsonwebtoken");
const settings = require("../config/settings");

/**
 * Middleware para autenticación de usuario
 * Verifica el token JWT en las cabeceras de la solicitud o como parámetro de consulta
 */
module.exports = (req, res, next) => {
  // Obtener el token de la cabecera de autorización o del parámetro de consulta
  let token;

  // Comprobar primero en la cabecera
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Verificar formato del token (Bearer [token])
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  // Si no hay token en la cabecera, verificar en los parámetros de consulta
  if (!token && req.query.auth) {
    token = req.query.auth;
  }

  // Si no hay token en ningún lado, responder con error
  if (!token) {
    // Para APIs REST devolvemos JSON con error
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token no proporcionado",
      });
    }
    // Para rutas de archivos estáticos, redirigir a la pantalla de login
    else if (req.path.startsWith("/data/")) {
      return res.redirect(
        "/auth?redirect=" + encodeURIComponent(req.originalUrl)
      );
    }
    // Por defecto, continuar con el siguiente middleware (para rutas públicas)
    else {
      return next();
    }
  }

  try {
    // Verificar y decodificar el token
    const jwtSecret =
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key";
    const decoded = jwt.verify(token, jwtSecret);

    // Agregar información del usuario a la solicitud
    req.user = decoded;

    // También agregar el token para uso en otras partes del código
    req.token = token;

    // Registrar qué usuario está haciendo la solicitud para logging (solo en APIs)
    if (req.path.startsWith("/api/")) {
      const method = req.method;
      const url = req.originalUrl;
      console.log(
        `Usuario ${decoded.id} (${decoded.username}): ${method} ${url}`
      );
    }

    // Continuar con la siguiente función de middleware
    return next();
  } catch (error) {
    console.error("Error al verificar token:", error);

    // Determinar el tipo de error
    if (error.name === "TokenExpiredError") {
      // Para APIs REST devolvemos JSON con error
      if (req.path.startsWith("/api/")) {
        return res.status(401).json({
          error: "Token expirado",
          message:
            "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
          code: "TOKEN_EXPIRED",
        });
      } else {
        // Para otras rutas, redirigir a login con mensaje
        return res.redirect(
          "/auth?expired=true&redirect=" + encodeURIComponent(req.originalUrl)
        );
      }
    }

    // Token inválido por otras razones
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({
        error: "Token inválido",
        message: "No autorizado - token inválido",
        code: "TOKEN_INVALID",
      });
    } else {
      return res.redirect(
        "/auth?invalid=true&redirect=" + encodeURIComponent(req.originalUrl)
      );
    }
  }
};
