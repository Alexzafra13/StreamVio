// server/routes/libraries.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");
const mediaScanner = require("../services/mediaScanner");

// Middleware de autenticación para todas las rutas de este router
router.use(authMiddleware);

/**
 * @route   GET /api/libraries
 * @desc    Obtener todas las bibliotecas
 * @access  Private
 */
router.get("/", async (req, res) => {
  try {
    const libraries = await db.asyncAll(
      "SELECT * FROM libraries ORDER BY name"
    );

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
router.get("/:id", async (req, res) => {
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
router.put("/:id", async (req, res) => {
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
router.delete("/:id", async (req, res) => {
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
router.post("/:id/scan", async (req, res) => {
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
router.get("/:id/media", async (req, res) => {
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

module.exports = router;
