// server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const settings = require("../config/settings");
const db = require("../config/database");

/**
 * Middleware de autenticación mejorado
 * - Verifica tokens JWT en múltiples ubicaciones
 * - Manejo más robusto de errores
 * - Soporte de logs detallados para depuración
 */
const authMiddleware = async (req, res, next) => {
  let token = null;
  const requestPath = req.originalUrl || req.url;

  // Registrar la ruta solicitada (para depuración)
  console.log(`Verificando autenticación para: ${req.method} ${requestPath}`);

  // 1. Extraer token de todas las fuentes posibles con prioridad
  // 1.1. Authorization header (método estándar)
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    // Manejar formato "Bearer <token>" y token directo
    token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;
    console.log("Token encontrado en Authorization header");
  }
  // 1.2. Parámetro 'auth' en query (usado para streaming/thumbnails)
  else if (req.query.auth) {
    token = req.query.auth;
    console.log("Token encontrado en parámetro auth");
  }
  // 1.3. Parámetro 'token' en query (fallback)
  else if (req.query.token) {
    token = req.query.token;
    console.log("Token encontrado en parámetro token");
  }
  // 1.4. Cookies (soporte adicional)
  else if (req.cookies && req.cookies.streamvio_token) {
    token = req.cookies.streamvio_token;
    console.log("Token encontrado en cookies");
  }

  // Si no hay token, denegar acceso
  if (!token) {
    console.log("No se encontró token de autenticación");
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación para acceder a este recurso",
    });
  }

  try {
    // Verificar token con la clave secreta
    const jwtSecret =
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key";

    // Registrar la clave para depuración (solo en desarrollo, sin mostrar la clave completa)
    if (process.env.NODE_ENV === "development") {
      console.log(
        `Usando clave JWT (primeros 4 caracteres): ${jwtSecret.substring(
          0,
          4
        )}...`
      );
    }

    const decoded = jwt.verify(token, jwtSecret);
    console.log(`Token verificado exitosamente para usuario ID: ${decoded.id}`);

    // Añadir información del usuario decodificada al request
    req.user = decoded;

    // Verificar si el usuario existe en la base de datos
    try {
      const userExists = await db.asyncGet(
        "SELECT id FROM users WHERE id = ?",
        [decoded.id]
      );

      if (!userExists) {
        console.log(
          `Error: Usuario ID ${decoded.id} no existe en la base de datos`
        );
        return res.status(401).json({
          error: "Usuario inválido",
          message: "El usuario asociado al token no existe",
        });
      }
    } catch (dbError) {
      // Solo advertir, no bloquear la solicitud (por si hay problemas temporales de BD)
      console.warn(
        `Advertencia: No se pudo verificar la existencia del usuario: ${dbError.message}`
      );
    }

    // Verificar si la sesión sigue siendo válida (opcional para rendimiento)
    // Solo hacer esta verificación para rutas críticas o sensibles
    const isSecurePath =
      requestPath.includes("/admin/") ||
      requestPath.includes("/auth/change-password");

    if (isSecurePath) {
      try {
        const validSession = await db.asyncGet(
          "SELECT id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
          [token]
        );

        if (!validSession) {
          console.log(
            `Sesión no encontrada o expirada para token: ${token.substring(
              0,
              10
            )}...`
          );

          // Intenta crear una sesión para este token (opcional)
          try {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7); // 7 días de validez

            await db.asyncRun(
              `
              INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at) 
              VALUES (?, ?, ?, ?, ?)
            `,
              [
                decoded.id,
                token,
                req.headers["user-agent"] || "Unknown",
                req.ip || "Unknown",
                expiryDate.toISOString(),
              ]
            );

            console.log("Sesión creada automáticamente para token existente");
          } catch (insertError) {
            console.warn(`No se pudo crear la sesión: ${insertError.message}`);
          }
        }
      } catch (sessionError) {
        console.warn(`Error al verificar sesión: ${sessionError.message}`);
      }
    }

    // Continuar con la solicitud
    next();
  } catch (error) {
    // Manejar diferentes tipos de errores JWT
    console.error(
      `Error de verificación de token: ${error.name} - ${error.message}`
    );

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        message: "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
        code: "TOKEN_EXPIRED",
      });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Token inválido",
        message: "El token de autenticación no es válido",
        code: "INVALID_TOKEN",
      });
    } else if (error.name === "NotBeforeError") {
      return res.status(401).json({
        error: "Token aún no válido",
        message: "El token no es válido todavía",
        code: "TOKEN_NOT_ACTIVE",
      });
    }

    // Otros errores no específicos
    return res.status(401).json({
      error: "Error de autenticación",
      message: error.message || "Error al validar la autenticación",
      code: "AUTH_ERROR",
    });
  }
};

module.exports = authMiddleware;
