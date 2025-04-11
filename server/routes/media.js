// server/routes/media.js - Versión optimizada para streaming
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const db = require("../config/database");
const enhancedAuthMiddleware = require("../middleware/enhancedAuth");
const libraryAccessMiddleware = require("../middleware/libraryAccess");
const streamingService = require("../services/streamingService");

// Middleware de autenticación para todas las rutas de este router
// IMPORTANTE: Aplicar el middleware a todas las rutas excepto las que tienen su propio manejo
router.use(enhancedAuthMiddleware);

/**
 * @route   GET /api/media
 * @desc    Obtener todos los elementos multimedia con filtros
 * @access  Private
 */
router.get("/", async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sort = "title",
    order = "asc",
    type,
    search,
    library_id,
  } = req.query;

  // Si se especifica una biblioteca, verificar acceso a ella
  if (library_id) {
    // Usar middleware de acceso a biblioteca
    return libraryAccessMiddleware(req, res, async () => {
      // Resto de la lógica original
      // ...

      // Validar parámetros
      const pageNum = parseInt(page) || 1; // Asegurar que sea un número válido
      const limitNum = parseInt(limit) || 20; // Asegurar que sea un número válido

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
        // Construir la consulta con condiciones
        let queryConditions = [];
        let queryParams = [];

        // Filtrar por tipo
        if (type) {
          queryConditions.push("type = ?");
          queryParams.push(type);
        }

        // Filtrar por biblioteca
        if (library_id) {
          queryConditions.push("library_id = ?");
          queryParams.push(library_id);
        }

        // Búsqueda por título
        if (search) {
          queryConditions.push("(title LIKE ? OR description LIKE ?)");
          queryParams.push(`%${search}%`, `%${search}%`);
        }

        // Construir la cláusula WHERE
        const whereClause =
          queryConditions.length > 0
            ? `WHERE ${queryConditions.join(" AND ")}`
            : "";

        // Calcular offset para paginación
        const offset = (pageNum - 1) * limitNum;

        // Obtener conteo total
        const countQuery = `SELECT COUNT(*) as total FROM media_items ${whereClause}`;
        const countResult = await db.asyncGet(countQuery, queryParams);

        // Asegurarse de que el conteo total es un número válido
        const total = countResult && countResult.total ? countResult.total : 0;

        // Obtener elementos paginados
        const mediaItemsQuery = `
          SELECT * FROM media_items 
          ${whereClause} 
          ORDER BY ${sortField} ${orderDirection}
          LIMIT ? OFFSET ?
        `;

        const mediaItems =
          (await db.asyncAll(mediaItemsQuery, [
            ...queryParams,
            limitNum,
            offset,
          ])) || []; // Proporcionar un array vacío como valor predeterminado

        // Calcular información de paginación
        const totalPages = Math.ceil(total / limitNum) || 1; // Asegurar que sea al menos 1

        // Estructura de respuesta completa y coherente
        const response = {
          items: mediaItems || [], // Asegurar que sea un array incluso si es nulo
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
          },
        };

        // Enviar respuesta
        res.json(response);
      } catch (error) {
        console.error("Error al obtener elementos multimedia:", error);

        // En caso de error, enviar una respuesta estructurada con array vacío y paginación básica
        res.status(500).json({
          error: "Error del servidor",
          message: "Error al obtener elementos multimedia",
          items: [], // Proporcionar un array vacío
          pagination: {
            // Proporcionar un objeto de paginación básico
            total: 0,
            page: 1,
            limit: parseInt(limit) || 20,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
    });
  } else {
    // Código original para consulta sin biblioteca específica
    // ...

    // Verificar si el usuario es administrador
    const userId = req.user.id;
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);
    const isAdmin = user && user.is_admin === 1;

    // Resto de la lógica para obtener medios sin filtro de biblioteca
    // [Código original aquí]

    // Validar parámetros
    const pageNum = parseInt(page) || 1; // Asegurar que sea un número válido
    const limitNum = parseInt(limit) || 20; // Asegurar que sea un número válido

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
      // Construir la consulta con condiciones
      let queryConditions = [];
      let queryParams = [];

      // Filtrar por tipo
      if (type) {
        queryConditions.push("type = ?");
        queryParams.push(type);
      }

      // Búsqueda por título
      if (search) {
        queryConditions.push("(title LIKE ? OR description LIKE ?)");
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      // Si no es admin, filtrar solo por bibliotecas accesibles
      if (!isAdmin) {
        // Obtener IDs de bibliotecas accesibles
        const accessibleLibraries = await db.asyncAll(
          "SELECT library_id FROM user_library_access WHERE user_id = ? AND has_access = 1",
          [userId]
        );

        if (accessibleLibraries && accessibleLibraries.length > 0) {
          const libraryIds = accessibleLibraries.map((lib) => lib.library_id);
          queryConditions.push(
            `(library_id IN (${libraryIds.join(",")}) OR library_id IS NULL)`
          );
        } else {
          // Si no tiene acceso a ninguna biblioteca, mostrar solo elementos sin biblioteca
          queryConditions.push("library_id IS NULL");
        }
      }

      // Construir la cláusula WHERE
      const whereClause =
        queryConditions.length > 0
          ? `WHERE ${queryConditions.join(" AND ")}`
          : "";

      // Calcular offset para paginación
      const offset = (pageNum - 1) * limitNum;

      // Obtener conteo total
      const countQuery = `SELECT COUNT(*) as total FROM media_items ${whereClause}`;
      const countResult = await db.asyncGet(countQuery, queryParams);

      // Asegurarse de que el conteo total es un número válido
      const total = countResult && countResult.total ? countResult.total : 0;

      // Obtener elementos paginados
      const mediaItemsQuery = `
        SELECT * FROM media_items 
        ${whereClause} 
        ORDER BY ${sortField} ${orderDirection}
        LIMIT ? OFFSET ?
      `;

      const mediaItems =
        (await db.asyncAll(mediaItemsQuery, [
          ...queryParams,
          limitNum,
          offset,
        ])) || []; // Proporcionar un array vacío como valor predeterminado

      // Calcular información de paginación
      const totalPages = Math.ceil(total / limitNum) || 1; // Asegurar que sea al menos 1

      // Estructura de respuesta completa y coherente
      const response = {
        items: mediaItems || [], // Asegurar que sea un array incluso si es nulo
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      };

      // Enviar respuesta
      res.json(response);
    } catch (error) {
      console.error("Error al obtener elementos multimedia:", error);

      // En caso de error, enviar una respuesta estructurada con array vacío y paginación básica
      res.status(500).json({
        error: "Error del servidor",
        message: "Error al obtener elementos multimedia",
        items: [], // Proporcionar un array vacío
        pagination: {
          // Proporcionar un objeto de paginación básico
          total: 0,
          page: 1,
          limit: parseInt(limit) || 20,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }
  }
});

/**
 * @route   GET /api/media/:id
 * @desc    Obtener un elemento multimedia por ID
 * @access  Private
 */
router.get("/:id", async (req, res) => {
  const mediaId = req.params.id;

  try {
    // Obtener el elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Si el elemento pertenece a una biblioteca, verificar acceso
    if (mediaItem.library_id) {
      // Asignar library_id al query para que el middleware pueda verificarlo
      req.query.library = mediaItem.library_id;

      return libraryAccessMiddleware(req, res, async () => {
        // El resto de tu código original aquí...

        // Normalizar la ruta del archivo (convertir barras invertidas a barras normales)
        if (mediaItem.file_path) {
          mediaItem.file_path = mediaItem.file_path.replace(/\\/g, "/");
        }

        if (mediaItem.thumbnail_path) {
          mediaItem.thumbnail_path = mediaItem.thumbnail_path.replace(
            /\\/g,
            "/"
          );
        }

        // Verificar que el archivo existe
        if (mediaItem.file_path && !fs.existsSync(mediaItem.file_path)) {
          console.error(`Archivo no encontrado: ${mediaItem.file_path}`);
          return res.status(404).json({
            error: "Archivo no encontrado",
            message: "El archivo físico no existe en el sistema",
          });
        }

        // Obtener información de la biblioteca
        if (mediaItem.library_id) {
          const library = await db.asyncGet(
            "SELECT name, type FROM libraries WHERE id = ?",
            [mediaItem.library_id]
          );
          if (library) {
            mediaItem.library = library;
          }
        }

        // Si es un episodio (tiene parent_id), obtener info de la serie
        if (mediaItem.parent_id) {
          const parentItem = await db.asyncGet(
            "SELECT id, title FROM media_items WHERE id = ?",
            [mediaItem.parent_id]
          );
          if (parentItem) {
            mediaItem.parent = parentItem;
          }
        }

        // Si es una serie, obtener episodios
        if (mediaItem.type === "series") {
          const episodes = await db.asyncAll(
            "SELECT * FROM media_items WHERE parent_id = ? ORDER BY season_number, episode_number",
            [mediaItem.id]
          );
          mediaItem.episodes = episodes;
        }

        res.json(mediaItem);
      });
    } else {
      // Si no tiene biblioteca, permiso automático
      // Normalizar la ruta del archivo (convertir barras invertidas a barras normales)
      if (mediaItem.file_path) {
        mediaItem.file_path = mediaItem.file_path.replace(/\\/g, "/");
      }

      if (mediaItem.thumbnail_path) {
        mediaItem.thumbnail_path = mediaItem.thumbnail_path.replace(/\\/g, "/");
      }

      // Verificar que el archivo existe
      if (mediaItem.file_path && !fs.existsSync(mediaItem.file_path)) {
        console.error(`Archivo no encontrado: ${mediaItem.file_path}`);
        return res.status(404).json({
          error: "Archivo no encontrado",
          message: "El archivo físico no existe en el sistema",
        });
      }

      // Obtener información de la biblioteca
      if (mediaItem.library_id) {
        const library = await db.asyncGet(
          "SELECT name, type FROM libraries WHERE id = ?",
          [mediaItem.library_id]
        );
        if (library) {
          mediaItem.library = library;
        }
      }

      // Si es un episodio (tiene parent_id), obtener info de la serie
      if (mediaItem.parent_id) {
        const parentItem = await db.asyncGet(
          "SELECT id, title FROM media_items WHERE id = ?",
          [mediaItem.parent_id]
        );
        if (parentItem) {
          mediaItem.parent = parentItem;
        }
      }

      // Si es una serie, obtener episodios
      if (mediaItem.type === "series") {
        const episodes = await db.asyncAll(
          "SELECT * FROM media_items WHERE parent_id = ? ORDER BY season_number, episode_number",
          [mediaItem.id]
        );
        mediaItem.episodes = episodes;
      }

      res.json(mediaItem);
    }
  } catch (error) {
    console.error(`Error al obtener el elemento multimedia ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener el elemento multimedia",
    });
  }
});

/**
 * @route   GET /api/media/:id/stream
 * @desc    Transmitir un archivo multimedia
 * @access  Private (usa enhancedAuthMiddleware)
 */
router.get("/:id/stream", async (req, res) => {
  const mediaId = req.params.id;
  const userData = req.user; // El middleware ya proporciona el usuario

  try {
    console.log(
      `Procesando solicitud de streaming para medio ${mediaId} por usuario ${userData.id}`
    );

    // Delegar el procesamiento al servicio de streaming
    await streamingService.handleStreamRequest(req, res, mediaId, userData);
  } catch (error) {
    console.error(
      `Error al procesar solicitud de streaming para ${mediaId}:`,
      error
    );

    // Si aún no se ha enviado respuesta, enviar error
    if (!res.headersSent) {
      res.status(500).json({
        error: "Error del servidor",
        message: "Error al procesar la solicitud de streaming",
      });
    }
  }
});

/**
 * @route   GET /api/media/:id/thumbnail
 * @desc    Obtener thumbnail de un elemento multimedia
 * @access  Private (usa enhancedAuthMiddleware)
 */
router.get("/:id/thumbnail", async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id; // El middleware ya proporciona el usuario

  try {
    // Obtener el elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT thumbnail_path, library_id FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).send("Elemento multimedia no encontrado");
    }

    if (!mediaItem.thumbnail_path) {
      return res
        .status(404)
        .send("La miniatura no está disponible para este elemento");
    }

    // Si el elemento pertenece a una biblioteca, verificar acceso
    if (mediaItem.library_id) {
      // Verificar si el usuario es administrador
      const user = await db.asyncGet(
        "SELECT is_admin FROM users WHERE id = ?",
        [userId]
      );
      const isAdmin = user && user.is_admin === 1;

      // Si no es admin, verificar acceso específico a la biblioteca
      if (!isAdmin) {
        const access = await db.asyncGet(
          "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
          [userId, mediaItem.library_id]
        );

        if (!access || access.has_access !== 1) {
          return res.status(403).json({
            error: "Acceso denegado",
            message: "No tienes permiso para acceder a este contenido",
          });
        }
      }
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(mediaItem.thumbnail_path)) {
      return res.status(404).send("Archivo de miniatura no encontrado");
    }

    // Enviar el archivo de miniatura
    res.sendFile(mediaItem.thumbnail_path);
  } catch (error) {
    console.error(`Error al obtener thumbnail para ${mediaId}:`, error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado",
        message: "La sesión ha expirado. Por favor, inicie sesión nuevamente.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Token inválido",
        message: "Token de autenticación inválido",
      });
    }

    res.status(500).send("Error del servidor al procesar la solicitud");
  }
});

/**
 * @route   POST /api/media/:id/progress
 * @desc    Guardar el progreso de reproducción
 * @access  Private
 */
router.post("/:id/progress", async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;
  const { position, completed } = req.body;

  if (position === undefined) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere la posición actual de reproducción",
    });
  }

  try {
    // Verificar si el elemento existe
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Si el elemento pertenece a una biblioteca, verificar acceso
    if (mediaItem.library_id) {
      // Asignar library_id al query para que el middleware pueda verificarlo
      req.query.library = mediaItem.library_id;
      return libraryAccessMiddleware(req, res, async () => {
        // Continuar si tiene acceso
        // Verificar si ya existe un registro
        const existing = await db.asyncGet(
          "SELECT id FROM watch_history WHERE user_id = ? AND media_id = ?",
          [userId, mediaId]
        );

        if (existing) {
          // Actualizar registro existente
          await db.asyncRun(
            "UPDATE watch_history SET position = ?, completed = ?, watched_at = CURRENT_TIMESTAMP WHERE id = ?",
            [position, completed ? 1 : 0, existing.id]
          );
        } else {
          // Crear nuevo registro
          await db.asyncRun(
            "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, ?, ?)",
            [userId, mediaId, position, completed ? 1 : 0]
          );
        }

        res.json({
          message: "Progreso guardado correctamente",
          mediaId,
          position,
          completed: !!completed,
        });
      });
    } else {
      // Si no tiene biblioteca, permiso automático
      // Verificar si ya existe un registro para este usuario y medio
      const existingRecord = await db.asyncGet(
        "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
        [userId, mediaId]
      );

      if (existingRecord) {
        // Actualizar registro existente
        await db.asyncRun(
          "UPDATE watch_history SET position = ?, completed = ?, watched_at = CURRENT_TIMESTAMP WHERE id = ?",
          [position, completed ? 1 : 0, existingRecord.id]
        );
      } else {
        // Crear nuevo registro
        await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, ?, ?)",
          [userId, mediaId, position, completed ? 1 : 0]
        );
      }

      res.json({
        message: "Progreso guardado correctamente",
        mediaId,
        position,
        completed: !!completed,
      });
    }
  } catch (error) {
    console.error(`Error al guardar progreso para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al guardar el progreso de reproducción",
    });
  }
});

/**
 * @route   GET /api/media/:id/progress
 * @desc    Obtener el progreso de reproducción
 * @access  Private
 */
router.get("/:id/progress", async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;

  try {
    // Obtener el elemento multimedia para verificar acceso
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Si el elemento pertenece a una biblioteca, verificar acceso
    if (mediaItem.library_id) {
      // Asignar library_id al query para que el middleware pueda verificarlo
      req.query.library = mediaItem.library_id;
      return libraryAccessMiddleware(req, res, async () => {
        // Continuar si tiene acceso
        // Obtener el registro de visualización
        const watchRecord = await db.asyncGet(
          "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
          [userId, mediaId]
        );

        if (!watchRecord) {
          return res.json({
            mediaId,
            position: 0,
            completed: false,
            watched: false,
          });
        }

        res.json({
          mediaId,
          position: watchRecord.position || 0,
          completed: !!watchRecord.completed,
          watched: true,
          lastWatched: watchRecord.watched_at,
        });
      });
    } else {
      // Si no tiene biblioteca, permiso automático
      // Obtener el registro de visualización
      const watchRecord = await db.asyncGet(
        "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
        [userId, mediaId]
      );

      if (!watchRecord) {
        return res.json({
          mediaId,
          position: 0,
          completed: false,
          watched: false,
        });
      }

      res.json({
        mediaId,
        position: watchRecord.position || 0,
        completed: !!watchRecord.completed,
        watched: true,
        lastWatched: watchRecord.watched_at,
      });
    }
  } catch (error) {
    console.error(`Error al obtener progreso para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener el progreso de reproducción",
    });
  }
});

/**
 * Función para determinar el MIME type basado en la extensión del archivo
 * @param {string} filePath - Ruta del archivo
 * @returns {string} - MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".ogv": "video/ogg",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv",
    ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

module.exports = router;
