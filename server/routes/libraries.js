// server/routes/libraries.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/enhancedAuth");
const mediaScanner = require("../services/mediaScanner");
const libraryAccessMiddleware = require("../middleware/libraryAccess");

// Middleware de autenticación para todas las rutas de este router
router.use(authMiddleware);

/**
 * @route   GET /api/libraries
 * @desc    Obtener todas las bibliotecas
 * @access  Private
 */
router.get("/", async (req, res) => {
  try {
    // Verificar si el usuario es administrador (admin ve todas las bibliotecas)
    const userId = req.user.id;
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);
    const isAdmin = user && user.is_admin === 1;

    let libraries;

    if (isAdmin) {
      // Obtener todas las bibliotecas para los administradores
      libraries = await db.asyncAll("SELECT * FROM libraries ORDER BY name");
    } else {
      // Para usuarios normales, solo mostrar bibliotecas a las que tienen acceso
      libraries = await db.asyncAll(
        `SELECT l.* 
         FROM libraries l
         JOIN user_library_access ula ON l.id = ula.library_id
         WHERE ula.user_id = ? AND ula.has_access = 1
         ORDER BY l.name`,
        [userId]
      );
    }

    // Para cada biblioteca, obtener el número de elementos
    for (let i = 0; i < libraries.length; i++) {
      const countResult = await db.asyncGet(
        "SELECT COUNT(*) as count FROM media_items WHERE library_id = ?",
        [libraries[i].id]
      );
      libraries[i].itemCount = countResult ? countResult.count : 0;
    }

    res.json(libraries);
  } catch (error) {
    console.error("Error al obtener bibliotecas:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener las bibliotecas",
    });
  }
});

/**
 * @route   GET /api/libraries/:id
 * @desc    Obtener una biblioteca por ID
 * @access  Private
 */
router.get("/:id", libraryAccessMiddleware, async (req, res) => {
  const libraryId = req.params.id;

  try {
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);

    if (!library) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Biblioteca no encontrada",
      });
    }

    // Obtener recuento de elementos en la biblioteca
    const countResult = await db.asyncGet(
      "SELECT COUNT(*) as count FROM media_items WHERE library_id = ?",
      [library.id]
    );

    library.itemCount = countResult ? countResult.count : 0;

    res.json(library);
  } catch (error) {
    console.error(`Error al obtener la biblioteca ${libraryId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener la biblioteca",
    });
  }
});

/**
 * @route   POST /api/libraries
 * @desc    Crear una nueva biblioteca
 * @access  Private
 */
router.post("/", async (req, res) => {
  const { name, path: libraryPath, type, scan_automatically } = req.body;

  // Validar los datos
  if (!name || !libraryPath || !type) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere nombre, ruta y tipo de biblioteca",
    });
  }

  // Validar el tipo
  const validTypes = ["movies", "series", "music", "photos"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: "Tipo inválido",
      message: `El tipo debe ser uno de: ${validTypes.join(", ")}`,
    });
  }

  // Verificar que la ruta existe
  try {
    const pathExists = fs.existsSync(libraryPath);
    if (!pathExists) {
      return res.status(400).json({
        error: "Ruta inválida",
        message: "La ruta especificada no existe",
      });
    }

    // Verificar permisos de lectura
    fs.accessSync(libraryPath, fs.constants.R_OK);
  } catch (error) {
    return res.status(400).json({
      error: "Error de acceso",
      message: "No se puede acceder a la ruta especificada",
    });
  }

  try {
    // Verificar si ya existe una biblioteca con la misma ruta
    const existingLibrary = await db.asyncGet(
      "SELECT id FROM libraries WHERE path = ?",
      [libraryPath]
    );

    if (existingLibrary) {
      return res.status(409).json({
        error: "Conflicto",
        message: "Ya existe una biblioteca con la misma ruta",
      });
    }

    // Insertar la nueva biblioteca
    const scanAutomatically =
      scan_automatically === undefined ? true : !!scan_automatically;

    const result = await db.asyncRun(
      "INSERT INTO libraries (name, path, type, scan_automatically) VALUES (?, ?, ?, ?)",
      [name, libraryPath, type, scanAutomatically ? 1 : 0]
    );

    const libraryId = result.lastID;

    // Verificar si el usuario es administrador
    const userId = req.user.id;
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    // Si no es administrador, dar acceso a la biblioteca recién creada
    if (!user || user.is_admin !== 1) {
      await db.asyncRun(
        "INSERT INTO user_library_access (user_id, library_id, has_access) VALUES (?, ?, 1)",
        [userId, libraryId]
      );
    }

    // Obtener la biblioteca recién creada
    const newLibrary = await db.asyncGet(
      "SELECT * FROM libraries WHERE id = ?",
      [libraryId]
    );

    res.status(201).json({
      message: "Biblioteca creada exitosamente",
      library: newLibrary,
    });
  } catch (error) {
    console.error("Error al crear la biblioteca:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al crear la biblioteca",
    });
  }
});

/**
 * @route   PUT /api/libraries/:id
 * @desc    Actualizar una biblioteca
 * @access  Private
 */
router.put("/:id", libraryAccessMiddleware, async (req, res) => {
  const libraryId = req.params.id;
  const { name, path: libraryPath, type, scan_automatically } = req.body;

  // Validar los datos
  if (
    !name &&
    !libraryPath &&
    type === undefined &&
    scan_automatically === undefined
  ) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "No se proporcionaron datos para actualizar",
    });
  }

  try {
    // Verificar si la biblioteca existe
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);

    if (!library) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Biblioteca no encontrada",
      });
    }

    // Preparar datos para actualización
    const updates = {};
    const params = [];

    if (name) {
      updates.name = name;
      params.push(name);
    }

    if (libraryPath) {
      // Verificar que la ruta existe
      const pathExists = fs.existsSync(libraryPath);
      if (!pathExists) {
        return res.status(400).json({
          error: "Ruta inválida",
          message: "La ruta especificada no existe",
        });
      }

      // Verificar permisos de lectura
      try {
        fs.accessSync(libraryPath, fs.constants.R_OK);
      } catch (error) {
        return res.status(400).json({
          error: "Error de acceso",
          message: "No se puede acceder a la ruta especificada",
        });
      }

      updates.path = libraryPath;
      params.push(libraryPath);
    }

    if (type !== undefined) {
      // Validar el tipo
      const validTypes = ["movies", "series", "music", "photos"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: "Tipo inválido",
          message: `El tipo debe ser uno de: ${validTypes.join(", ")}`,
        });
      }

      updates.type = type;
      params.push(type);
    }

    if (scan_automatically !== undefined) {
      updates.scan_automatically = scan_automatically ? 1 : 0;
      params.push(scan_automatically ? 1 : 0);
    }

    // Añadir updated_at
    updates.updated_at = "CURRENT_TIMESTAMP";

    // Construir la consulta SQL
    const fields = Object.keys(updates)
      .map((key) => {
        if (key === "updated_at") {
          return `${key} = ${updates[key]}`;
        }
        return `${key} = ?`;
      })
      .join(", ");

    // Añadir el ID a los parámetros
    params.push(libraryId);

    // Ejecutar la actualización
    await db.asyncRun(`UPDATE libraries SET ${fields} WHERE id = ?`, params);

    // Obtener la biblioteca actualizada
    const updatedLibrary = await db.asyncGet(
      "SELECT * FROM libraries WHERE id = ?",
      [libraryId]
    );

    res.json({
      message: "Biblioteca actualizada exitosamente",
      library: updatedLibrary,
    });
  } catch (error) {
    console.error(`Error al actualizar la biblioteca ${libraryId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al actualizar la biblioteca",
    });
  }
});

/**
 * @route   DELETE /api/libraries/:id
 * @desc    Eliminar una biblioteca
 * @access  Private
 */
router.delete("/:id", libraryAccessMiddleware, async (req, res) => {
  const libraryId = req.params.id;

  try {
    // Verificar si la biblioteca existe
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);

    if (!library) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Biblioteca no encontrada",
      });
    }

    // Eliminar los elementos de la biblioteca
    await db.asyncRun("DELETE FROM media_items WHERE library_id = ?", [
      libraryId,
    ]);

    // Eliminar los permisos de acceso asociados a esta biblioteca
    await db.asyncRun("DELETE FROM user_library_access WHERE library_id = ?", [
      libraryId,
    ]);

    // Eliminar la biblioteca
    await db.asyncRun("DELETE FROM libraries WHERE id = ?", [libraryId]);

    res.json({
      message: "Biblioteca eliminada exitosamente",
      libraryId: Number(libraryId), // Convertir a número
    });
  } catch (error) {
    console.error(`Error al eliminar la biblioteca ${libraryId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al eliminar la biblioteca",
    });
  }
});

/**
 * @route   POST /api/libraries/:id/scan
 * @desc    Escanear una biblioteca
 * @access  Private
 */
router.post("/:id/scan", libraryAccessMiddleware, async (req, res) => {
  const libraryId = req.params.id;

  try {
    // Verificar si la biblioteca existe
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);

    if (!library) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Biblioteca no encontrada",
      });
    }

    // Iniciar escaneo en segundo plano
    res.json({
      message: "Escaneo iniciado",
      libraryId,
      status: "scanning",
    });

    // Ejecutar escaneo asíncrono
    try {
      const results = await mediaScanner.scanLibrary(libraryId);

      // Actualizar la biblioteca con la fecha del último escaneo
      await db.asyncRun(
        "UPDATE libraries SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [libraryId]
      );

      console.log(`Escaneo de biblioteca ${libraryId} completado:`, results);
    } catch (error) {
      console.error(
        `Error durante el escaneo de la biblioteca ${libraryId}:`,
        error
      );
    }
  } catch (error) {
    console.error(
      `Error al iniciar el escaneo de la biblioteca ${libraryId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al iniciar el escaneo de la biblioteca",
    });
  }
});

/**
 * @route   GET /api/libraries/:id/media
 * @desc    Obtener elementos multimedia de una biblioteca
 * @access  Private
 */
router.get("/:id/media", libraryAccessMiddleware, async (req, res) => {
  const libraryId = req.params.id;
  const { page = 1, limit = 20, sort = "title", order = "asc" } = req.query;

  // Validar parámetros
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  // Validar orden
  const validSortFields = [
    "title",
    "duration",
    "size",
    "created_at",
    "updated_at",
  ];
  const sortField = validSortFields.includes(sort) ? sort : "title";

  const orderDirection = order.toLowerCase() === "desc" ? "DESC" : "ASC";

  try {
    // Verificar si la biblioteca existe
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);

    if (!library) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Biblioteca no encontrada",
      });
    }

    // Calcular offset para paginación
    const offset = (pageNum - 1) * limitNum;

    // Obtener conteo total
    const countResult = await db.asyncGet(
      "SELECT COUNT(*) as total FROM media_items WHERE library_id = ?",
      [libraryId]
    );

    const total = countResult ? countResult.total : 0;

    // Obtener elementos paginados
    const mediaItems = await db.asyncAll(
      `SELECT * FROM media_items 
       WHERE library_id = ? 
       ORDER BY ${sortField} ${orderDirection}
       LIMIT ? OFFSET ?`,
      [libraryId, limitNum, offset]
    );

    // Calcular información de paginación
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      items: mediaItems,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error(
      `Error al obtener elementos de la biblioteca ${libraryId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener elementos multimedia",
    });
  }
});

/**
 * @route   POST /api/libraries/:id/users
 * @desc    Agregar o eliminar acceso de usuario a una biblioteca
 * @access  Private (Admins)
 */
router.post("/:id/users", authMiddleware, async (req, res) => {
  const libraryId = req.params.id;
  const { userId, hasAccess } = req.body;

  // Validar datos
  if (userId === undefined) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere especificar un ID de usuario",
    });
  }

  const access = hasAccess === undefined ? true : !!hasAccess;

  try {
    // Verificar si el usuario actual es administrador
    const currentUserId = req.user.id;
    const currentUser = await db.asyncGet(
      "SELECT is_admin FROM users WHERE id = ?",
      [currentUserId]
    );

    if (!currentUser || currentUser.is_admin !== 1) {
      return res.status(403).json({
        error: "Acceso denegado",
        message:
          "Solo los administradores pueden gestionar el acceso a bibliotecas",
      });
    }

    // Verificar si la biblioteca existe
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);
    if (!library) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Biblioteca no encontrada",
      });
    }

    // Verificar si el usuario existe
    const user = await db.asyncGet("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);
    if (!user) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Usuario no encontrado",
      });
    }

    // Los administradores no necesitan permisos explícitos
    if (user.is_admin === 1) {
      return res.json({
        message:
          "Los administradores tienen acceso implícito a todas las bibliotecas",
        libraryId: Number(libraryId),
        userId: Number(userId),
        hasAccess: true,
      });
    }

    // Verificar si ya existe un registro para este usuario y biblioteca
    const existingAccess = await db.asyncGet(
      "SELECT * FROM user_library_access WHERE user_id = ? AND library_id = ?",
      [userId, libraryId]
    );

    if (existingAccess) {
      if (access) {
        // Actualizar a acceso permitido
        await db.asyncRun(
          "UPDATE user_library_access SET has_access = 1 WHERE user_id = ? AND library_id = ?",
          [userId, libraryId]
        );
      } else {
        // Eliminar acceso
        await db.asyncRun(
          "DELETE FROM user_library_access WHERE user_id = ? AND library_id = ?",
          [userId, libraryId]
        );
      }
    } else if (access) {
      // Crear nuevo acceso si se está otorgando
      await db.asyncRun(
        "INSERT INTO user_library_access (user_id, library_id, has_access) VALUES (?, ?, 1)",
        [userId, libraryId]
      );
    }

    res.json({
      message: access
        ? "Acceso a biblioteca otorgado correctamente"
        : "Acceso a biblioteca eliminado correctamente",
      libraryId: Number(libraryId),
      userId: Number(userId),
      hasAccess: access,
    });
  } catch (error) {
    console.error(
      `Error al gestionar acceso a biblioteca ${libraryId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al gestionar acceso a biblioteca",
    });
  }
});

/**
 * @route   GET /api/libraries/:id/users
 * @desc    Obtener usuarios con acceso a una biblioteca
 * @access  Private (Admins)
 */
router.get("/:id/users", authMiddleware, async (req, res) => {
  const libraryId = req.params.id;

  try {
    // Verificar si el usuario actual es administrador
    const currentUserId = req.user.id;
    const currentUser = await db.asyncGet(
      "SELECT is_admin FROM users WHERE id = ?",
      [currentUserId]
    );

    if (!currentUser || currentUser.is_admin !== 1) {
      return res.status(403).json({
        error: "Acceso denegado",
        message:
          "Solo los administradores pueden ver los permisos de una biblioteca",
      });
    }

    // Verificar si la biblioteca existe
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);
    if (!library) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Biblioteca no encontrada",
      });
    }

    // Obtener usuarios con acceso explícito
    const usersWithAccess = await db.asyncAll(
      `SELECT u.id, u.username, u.email, u.is_admin, ula.has_access, ula.created_at as access_granted_at
       FROM users u
       LEFT JOIN user_library_access ula ON u.id = ula.user_id AND ula.library_id = ?
       ORDER BY u.username`,
      [libraryId]
    );

    // Formatear respuesta para indicar explícitamente quién tiene acceso
    // (los administradores tienen acceso implícito)
    const formattedUsers = usersWithAccess.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin === 1,
      hasAccess: user.is_admin === 1 || user.has_access === 1,
      accessType:
        user.is_admin === 1
          ? "admin"
          : user.has_access === 1
          ? "explicit"
          : "none",
      accessGrantedAt: user.access_granted_at || null,
    }));

    res.json({
      libraryId: Number(libraryId),
      users: formattedUsers,
    });
  } catch (error) {
    console.error(
      `Error al obtener usuarios con acceso a biblioteca ${libraryId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener usuarios con acceso a biblioteca",
    });
  }
});

module.exports = router;
