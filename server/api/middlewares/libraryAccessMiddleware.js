// server/api/middlewares/libraryAccessMiddleware.js
const db = require("../../data/db");
const {
  createForbiddenError,
  createBadRequestError,
} = require("./errorMiddleware");

/**
 * Middleware para verificar si un usuario tiene acceso a una biblioteca específica
 */
const libraryAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Buscar el ID de biblioteca en parámetros, query o body
    let libraryId = null;

    if (req.params.id) {
      libraryId = parseInt(req.params.id);
    } else if (req.params.libraryId) {
      libraryId = parseInt(req.params.libraryId);
    } else if (req.query.library || req.query.libraryId) {
      libraryId = parseInt(req.query.library || req.query.libraryId);
    } else if (req.body.libraryId || req.body.library_id) {
      libraryId = parseInt(req.body.libraryId || req.body.library_id);
    }

    // Si no se proporciona un ID de biblioteca, continuar
    // (podría ser una ruta que no requiere acceso a una biblioteca específica)
    if (!libraryId || isNaN(libraryId)) {
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

    // Verificar que la biblioteca existe
    const library = await db.asyncGet("SELECT id FROM libraries WHERE id = ?", [
      libraryId,
    ]);

    if (!library) {
      return next(
        createBadRequestError("Biblioteca no encontrada", "LIBRARY_NOT_FOUND")
      );
    }

    // Verificar acceso específico para usuarios normales
    const access = await db.asyncGet(
      "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
      [userId, libraryId]
    );

    // Si no hay un registro explícito o el acceso es negado
    if (!access || access.has_access !== 1) {
      return next(
        createForbiddenError(
          "No tienes permiso para acceder a esta biblioteca",
          "LIBRARY_ACCESS_DENIED"
        )
      );
    }

    // Si llegamos aquí, el usuario tiene permiso para acceder a la biblioteca
    next();
  } catch (error) {
    console.error("Error al verificar permisos de biblioteca:", error);
    next(error);
  }
};

/**
 * Middleware para verificar acceso a múltiples bibliotecas
 * Útil para endpoints que podrían operar sobre varias bibliotecas a la vez
 */
const multipleLibraryAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let libraryIds = [];

    // Obtener IDs de biblioteca del cuerpo o query de la solicitud
    if (req.body.libraryIds && Array.isArray(req.body.libraryIds)) {
      libraryIds = req.body.libraryIds
        .map((id) => parseInt(id))
        .filter((id) => !isNaN(id));
    } else if (req.query.libraries) {
      // Si viene como string separado por comas
      libraryIds = req.query.libraries
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
    }

    // Si no hay IDs de biblioteca, continuar
    if (libraryIds.length === 0) {
      return next();
    }

    // Verificar si el usuario es administrador
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    if (user && user.is_admin === 1) {
      // Los administradores tienen acceso a todas las bibliotecas
      return next();
    }

    // Verificar que todas las bibliotecas existan
    const existingLibraries = await db.asyncAll(
      `SELECT id FROM libraries WHERE id IN (${libraryIds
        .map(() => "?")
        .join(",")})`,
      libraryIds
    );

    if (existingLibraries.length !== libraryIds.length) {
      return next(
        createBadRequestError(
          "Una o más bibliotecas no existen",
          "LIBRARIES_NOT_FOUND"
        )
      );
    }

    // Verificar acceso a cada biblioteca
    const accessResults = await db.asyncAll(
      `SELECT library_id, has_access FROM user_library_access 
       WHERE user_id = ? AND library_id IN (${libraryIds
         .map(() => "?")
         .join(",")})`,
      [userId, ...libraryIds]
    );

    // Convertir resultados a un objeto para fácil acceso
    const accessMap = {};
    accessResults.forEach((result) => {
      accessMap[result.library_id] = result.has_access === 1;
    });

    // Verificar si hay alguna biblioteca a la que no tenga acceso
    const forbiddenLibraries = libraryIds.filter((id) => !accessMap[id]);

    if (forbiddenLibraries.length > 0) {
      return next(
        createForbiddenError(
          `No tienes permiso para acceder a ${forbiddenLibraries.length} biblioteca(s)`,
          "MULTIPLE_LIBRARY_ACCESS_DENIED"
        )
      );
    }

    // Si llegamos aquí, el usuario tiene acceso a todas las bibliotecas
    next();
  } catch (error) {
    console.error(
      "Error al verificar permisos de múltiples bibliotecas:",
      error
    );
    next(error);
  }
};

module.exports = {
  libraryAccess,
  multipleLibraryAccess,
};
