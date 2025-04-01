const jwt = require("jsonwebtoken");
const db = require("../config/database");

/**
 * Middleware de autenticación para verificar tokens JWT
 */
const authMiddleware = async (req, res, next) => {
  // Obtener el token del header Authorization
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Acceso no autorizado",
      message: "Se requiere token de autenticación",
    });
  }

  // Extraer el token de la cabecera
  const token = authHeader.split(" ")[1];

  try {
    // Verificar y decodificar el token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "streamvio_secret_key"
    );

    // Agregar la información del usuario al objeto request
    req.user = decoded;

    // Verificar si la tabla users tiene la columna force_password_change
    try {
      // Primero, verificar si el usuario existe
      const user = await db.asyncGet("SELECT * FROM users WHERE id = ?", [
        decoded.id,
      ]);

      if (user) {
        // Rutas que deberían ser accesibles incluso cuando se requiere cambio de contraseña
        const allowedPathsWithPasswordChange = [
          "/api/auth/change-password",
          "/api/auth/check-password-change",
          "/api/auth/user",
          "/api/auth/setup-admin", // Nueva ruta para configuración inicial de admin
        ];

        const currentPath = req.path;
        const isAllowedPath =
          allowedPathsWithPasswordChange.includes(currentPath);

        // Verificar si es el admin en primer inicio
        const isAdminFirstLogin =
          user.username === "admin" &&
          user.force_password_change === 1 &&
          currentPath === "/api/auth/setup-admin";

        // Permitir acceso si es la ruta de configuración inicial de admin
        if (isAdminFirstLogin) {
          return next();
        }

        // Verificar si la columna existe en el objeto user y bloquear rutas no permitidas
        if (
          user.hasOwnProperty("force_password_change") &&
          user.force_password_change === 1 &&
          !isAllowedPath
        ) {
          return res.status(403).json({
            error: "Cambio de contraseña requerido",
            message: "Debes cambiar tu contraseña antes de continuar",
            requirePasswordChange: true,
          });
        }
      }
    } catch (userCheckError) {
      // Si hay un error al verificar el usuario, simplemente continuamos
      // Esto evita problemas con la columna faltante
      console.log(
        "Aviso: Error al verificar estado de usuario:",
        userCheckError.message
      );
    }

    // Continuar con la siguiente función en la cadena de middleware
    next();
  } catch (error) {
    console.error("Error al verificar token:", error);

    return res.status(401).json({
      error: "Token inválido",
      message: "El token de autenticación ha expirado o es inválido",
    });
  }
};

module.exports = authMiddleware;
