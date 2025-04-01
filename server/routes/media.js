// server/routes/media.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

// Middleware de autenticación para todas las rutas de este router
router.use(authMiddleware);

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

    const total = countResult ? countResult.total : 0;

    // Obtener elementos paginados
    const mediaItemsQuery = `
      SELECT * FROM media_items 
      ${whereClause} 
      ORDER BY ${sortField} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    const mediaItems = await db.asyncAll(mediaItemsQuery, [
      ...queryParams,
      limitNum,
      offset,
    ]);

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
    console.error("Error al obtener elementos multimedia:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener elementos multimedia",
    });
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

    if (!mediaItem || !mediaItem.file_path) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Archivo multimedia no encontrado",
      });
    }

    // Normalizar la ruta del archivo (convertir barras invertidas a barras normales)
    const filePath = mediaItem.file_path.replace(/\\/g, "/");

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
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
router.put("/:id", async (req, res) => {
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
    await db.asyncRun(`UPDATE media_items SET ${fields} WHERE id = ?`, params);

    // Obtener el elemento actualizado
    const updatedMediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    res.json({
      message: "Elemento multimedia actualizado exitosamente",
      item: updatedMediaItem,
    });
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
router.delete("/:id", async (req, res) => {
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
 * @route   GET /api/media/:id/stream
 * @desc    Transmitir un archivo multimedia
 * @access  Private
 */
router.get("/:id/stream", async (req, res) => {
  const mediaId = req.params.id;

  try {
    // Obtener el elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.file_path) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Archivo multimedia no encontrado",
      });
    }

    const filePath = mediaItem.file_path;

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo físico no existe",
      });
    }

    // Obtener estadísticas del archivo
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType = getMimeType(filePath);

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

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType,
      });

      file.pipe(res);
    } else {
      // Respuesta completa si no hay cabecera de rango
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mimeType,
      });

      fs.createReadStream(filePath).pipe(res);
    }

    // Registrar la visualización
    try {
      const userId = req.user.id;

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
 * @access  Private
 */
router.get("/:id/thumbnail", async (req, res) => {
  const mediaId = req.params.id;

  try {
    const mediaItem = await db.asyncGet(
      "SELECT thumbnail_path FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.thumbnail_path) {
      return res.status(404).send("Thumbnail not found");
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(mediaItem.thumbnail_path)) {
      return res.status(404).send("Thumbnail file not found");
    }

    res.sendFile(mediaItem.thumbnail_path);
  } catch (error) {
    console.error(`Error al obtener thumbnail para ${mediaId}:`, error);
    res.status(500).send("Server error");
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
