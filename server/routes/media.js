const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const db = require("../config/database");
const enhancedAuthMiddleware = require("../middleware/enhancedAuth"); // Usamos enhancedAuthMiddleware consistentemente
const jwt = require("jsonwebtoken"); // Añadimos JWT para decodificar tokens en query params
const libraryAccessMiddleware = require("../middleware/libraryAccess");
const settings = require("../config/settings"); // Añadimos la importación faltante de settings

// Middleware de autenticación para todas las rutas de este router
// Excepto para stream y thumbnail que necesitan manejo especial de tokens
router.use(/^(?!.*\/(stream|thumbnail)).*$/, enhancedAuthMiddleware);

/**
 * @route   GET /api/media
 * @desc    Obtener todos los elementos multimedia con filtros
 * @access  Private
 */
router.get("/", enhancedAuthMiddleware, async (req, res) => {
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
      // Continuar con el código original si tiene acceso
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
    // Si no se especifica biblioteca, verificar si es administrador
    // Si es usuario normal, filtrar solo los elementos a los que tiene acceso
    const userId = req.user.id;

    // Verificar si el usuario es administrador
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);
    const isAdmin = user && user.is_admin === 1;

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
router.get("/:id", enhancedAuthMiddleware, async (req, res) => {
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
        // Continuar si tiene acceso
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
 * @route   PUT /api/media/:id
 * @desc    Actualizar un elemento multimedia
 * @access  Private
 */
router.put("/:id", enhancedAuthMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const {
    title,
    original_title,
    description,
    year,
    genre,
    director,
    actors,
    rating,
    season_number,
    episode_number,
  } = req.body;

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
        // Preparar datos para actualización
        const updates = {};
        const params = [];

        if (title !== undefined) {
          updates.title = title;
          params.push(title);
        }

        if (original_title !== undefined) {
          updates.original_title = original_title;
          params.push(original_title);
        }

        if (description !== undefined) {
          updates.description = description;
          params.push(description);
        }

        if (year !== undefined) {
          updates.year = year;
          params.push(year);
        }

        if (genre !== undefined) {
          updates.genre = genre;
          params.push(genre);
        }

        if (director !== undefined) {
          updates.director = director;
          params.push(director);
        }

        if (actors !== undefined) {
          updates.actors = actors;
          params.push(actors);
        }

        if (rating !== undefined) {
          updates.rating = rating;
          params.push(rating);
        }

        if (season_number !== undefined && mediaItem.type === "episode") {
          updates.season_number = season_number;
          params.push(season_number);
        }

        if (episode_number !== undefined && mediaItem.type === "episode") {
          updates.episode_number = episode_number;
          params.push(episode_number);
        }

        // Añadir updated_at
        updates.updated_at = "CURRENT_TIMESTAMP";

        // Si no hay nada que actualizar
        if (Object.keys(updates).length <= 1) {
          // Solo updated_at
          return res.status(400).json({
            error: "Datos incompletos",
            message: "No se proporcionaron datos para actualizar",
          });
        }

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
        params.push(mediaId);

        // Ejecutar la actualización
        await db.asyncRun(
          `UPDATE media_items SET ${fields} WHERE id = ?`,
          params
        );

        // Obtener el elemento actualizado
        const updatedMediaItem = await db.asyncGet(
          "SELECT * FROM media_items WHERE id = ?",
          [mediaId]
        );

        res.json({
          message: "Elemento multimedia actualizado exitosamente",
          item: updatedMediaItem,
        });
      });
    } else {
      // Si no tiene biblioteca, permiso automático
      // Preparar datos para actualización
      const updates = {};
      const params = [];

      if (title !== undefined) {
        updates.title = title;
        params.push(title);
      }

      if (original_title !== undefined) {
        updates.original_title = original_title;
        params.push(original_title);
      }

      if (description !== undefined) {
        updates.description = description;
        params.push(description);
      }

      if (year !== undefined) {
        updates.year = year;
        params.push(year);
      }

      if (genre !== undefined) {
        updates.genre = genre;
        params.push(genre);
      }

      if (director !== undefined) {
        updates.director = director;
        params.push(director);
      }

      if (actors !== undefined) {
        updates.actors = actors;
        params.push(actors);
      }

      if (rating !== undefined) {
        updates.rating = rating;
        params.push(rating);
      }

      if (season_number !== undefined && mediaItem.type === "episode") {
        updates.season_number = season_number;
        params.push(season_number);
      }

      if (episode_number !== undefined && mediaItem.type === "episode") {
        updates.episode_number = episode_number;
        params.push(episode_number);
      }

      // Añadir updated_at
      updates.updated_at = "CURRENT_TIMESTAMP";

      // Si no hay nada que actualizar
      if (Object.keys(updates).length <= 1) {
        // Solo updated_at
        return res.status(400).json({
          error: "Datos incompletos",
          message: "No se proporcionaron datos para actualizar",
        });
      }

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
      params.push(mediaId);

      // Ejecutar la actualización
      await db.asyncRun(
        `UPDATE media_items SET ${fields} WHERE id = ?`,
        params
      );

      // Obtener el elemento actualizado
      const updatedMediaItem = await db.asyncGet(
        "SELECT * FROM media_items WHERE id = ?",
        [mediaId]
      );

      res.json({
        message: "Elemento multimedia actualizado exitosamente",
        item: updatedMediaItem,
      });
    }
  } catch (error) {
    console.error(
      `Error al actualizar el elemento multimedia ${mediaId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al actualizar el elemento multimedia",
    });
  }
});

/**
 * @route   DELETE /api/media/:id
 * @desc    Eliminar un elemento multimedia
 * @access  Private
 */
router.delete("/:id", enhancedAuthMiddleware, async (req, res) => {
  const mediaId = req.params.id;

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
        // Si es una serie, eliminar todos los episodios
        if (mediaItem.type === "series") {
          await db.asyncRun("DELETE FROM media_items WHERE parent_id = ?", [
            mediaId,
          ]);
        }

        // Eliminar el elemento
        await db.asyncRun("DELETE FROM media_items WHERE id = ?", [mediaId]);

        res.json({
          message: "Elemento multimedia eliminado exitosamente",
          id: mediaId,
        });
      });
    } else {
      // Si no tiene biblioteca, permiso automático
      // Si es una serie, eliminar todos los episodios
      if (mediaItem.type === "series") {
        await db.asyncRun("DELETE FROM media_items WHERE parent_id = ?", [
          mediaId,
        ]);
      }

      // Eliminar el elemento
      await db.asyncRun("DELETE FROM media_items WHERE id = ?", [mediaId]);

      res.json({
        message: "Elemento multimedia eliminado exitosamente",
        id: mediaId,
      });
    }
  } catch (error) {
    console.error(
      `Error al eliminar el elemento multimedia ${mediaId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al eliminar el elemento multimedia",
    });
  }
});

/**
 * Función para obtener y verificar token de autenticación
 * @param {Object} req - Objeto de solicitud
 * @returns {Object|null} - Token decodificado o null si no es válido
 */
const getVerifiedToken = (req) => {
  // Intentar obtener token de headers
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  // Si no hay token en headers, intentar en query params
  if (!token && req.query.auth) {
    token = req.query.auth;
  }

  if (!token) {
    return null;
  }

  // Verificar token
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "streamvio_secret_key");
  } catch (error) {
    console.error("Error al verificar token:", error);
    return null;
  }
};

/**
 * @route   GET /api/media/:id/stream
 * @desc    Transmitir un archivo multimedia
 * @access  Private (verificación manual de token)
 */
router.get("/:id/stream", async (req, res) => {
  const mediaId = req.params.id;

  // Verificar token manualmente
  const decoded = getVerifiedToken(req);
  if (!decoded) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Token no proporcionado o inválido",
    });
  }

  try {
    // Obtener el elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.file_path) {
      console.error(`Archivo no encontrado para media_id=${mediaId}`);
      return res.status(404).json({
        error: "No encontrado",
        message: "Archivo multimedia no encontrado",
      });
    }

    // Si el elemento pertenece a una biblioteca, verificar acceso
    if (mediaItem.library_id) {
      // Verificar si el usuario es administrador
      const user = await db.asyncGet(
        "SELECT is_admin FROM users WHERE id = ?",
        [decoded.id]
      );
      const isAdmin = user && user.is_admin === 1;

      if (!isAdmin) {
        // Verificar acceso específico para usuarios normales
        const access = await db.asyncGet(
          "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
          [decoded.id, mediaItem.library_id]
        );

        if (!access || access.has_access !== 1) {
          return res.status(403).json({
            error: "Acceso denegado",
            message: "No tienes permiso para acceder a este contenido",
          });
        }
      }
      // Si es admin o tiene acceso específico, continuar
    }

    // Continuar con el streaming
    const filePath = mediaItem.file_path.replace(/\\/g, "/");
    console.log(`Intentando acceder al archivo: ${filePath}`);

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      console.error(`El archivo físico no existe: ${filePath}`);
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo físico no existe en el sistema",
      });
    }

    // Obtener estadísticas del archivo
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType = getMimeType(filePath);

    // Registrar información para debug
    console.log(
      `Streaming: ${filePath}, tamaño: ${fileSize}, tipo: ${mimeType}`
    );

    // Manejar solicitudes de rango (para streaming)
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validar rango
      if (start >= fileSize) {
        res.status(416).send("Requested range not satisfiable");
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      // Registrar información para debug
      console.log(
        `Streaming con rango: ${start}-${end}/${fileSize}, tamaño chunk: ${chunksize}`
      );

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType,
      });

      file.pipe(res);
    } else {
      // Respuesta completa si no hay cabecera de rango
      // Registrar información para debug
      console.log(`Streaming completo: ${fileSize} bytes`);

      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes", // Importante para streaming
      });

      fs.createReadStream(filePath).pipe(res);
    }

    // Registrar la visualización
    try {
      const userId = decoded.id;

      // Verificar si ya existe un registro para este usuario y medio
      const existingRecord = await db.asyncGet(
        "SELECT * FROM watch_history WHERE user_id = ? AND media_id = ?",
        [userId, mediaId]
      );

      if (existingRecord) {
        // Actualizar registro existente
        await db.asyncRun(
          "UPDATE watch_history SET watched_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existingRecord.id]
        );
      } else {
        // Crear nuevo registro
        await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id) VALUES (?, ?)",
          [userId, mediaId]
        );
      }
    } catch (error) {
      // No interrumpir el streaming si hay error al registrar la visualización
      console.error("Error al registrar visualización:", error);
    }
  } catch (error) {
    console.error(`Error al transmitir el archivo ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al transmitir el archivo",
    });
  }
});

/**
 * @route   POST /api/media/:id/progress
 * @desc    Guardar el progreso de reproducción
 * @access  Private
 */
router.post("/:id/progress", enhancedAuthMiddleware, async (req, res) => {
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
router.get("/:id/progress", enhancedAuthMiddleware, async (req, res) => {
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
 * @route   GET /api/media/:id/thumbnail
 * @desc    Obtener thumbnail de un elemento multimedia
 * @access  Private (verificación manual de token)
 */
router.get("/:id/thumbnail", async (req, res) => {
  const mediaId = req.params.id;

  // Obtener token de autenticación de los headers o query params
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.auth) {
    token = req.query.auth;
  }

  if (!token) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación para acceder a este recurso",
    });
  }

  try {
    // Verificar el token JWT
    const jwtSecret =
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key";
    const decoded = jwt.verify(token, jwtSecret);

    // Si llegamos aquí, el token es válido
    const userId = decoded.id;

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
