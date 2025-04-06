// server/middleware/libraryAccess.js

const db = require("../config/database");

/**
 * Middleware para verificar si un usuario tiene acceso a una biblioteca específica
 */
module.exports = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let libraryId = req.params.libraryId || req.query.library || null;

    // Convertir libraryId a número si es una cadena
    if (libraryId && typeof libraryId === "string") {
      libraryId = parseInt(libraryId, 10);

      // Si no se puede convertir a un número válido
      if (isNaN(libraryId)) {
        libraryId = null;
      }
    }

    // Si no hay libraryId, permitir acceso (podría ser una ruta que no requiere biblioteca)
    if (!libraryId) {
      return next();
    }

    // Verificar si el usuario es administrador (tienen acceso a todo)
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    if (user && user.is_admin === 1) {
      // Los administradores tienen acceso a todas las bibliotecas
      return next();
    }

    // Verificar acceso específico para usuarios normales
    const access = await db.asyncGet(
      "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
      [userId, libraryId]
    );

    // Si no hay un registro explícito o el acceso es negado
    if (!access || access.has_access !== 1) {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "No tienes permiso para acceder a esta biblioteca",
      });
    }

    // Si llegamos aquí, el usuario tiene permiso para acceder a la biblioteca
    next();
  } catch (error) {
    console.error("Error al verificar permisos de biblioteca:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar permisos de acceso",
    });
  }
};
