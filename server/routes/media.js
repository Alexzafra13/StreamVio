// server/routes/media.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const db = require("../config/database");
const streamingService = require("../services/streamingService");

// Usar middleware de autenticación para todas las rutas
router.use(authMiddleware);

/**
 * @route   GET /api/media/:id/stream
 * @desc    Transmitir un archivo multimedia con soporte para streaming parcial
 * @access  Private
 */
router.get("/:id/stream", async (req, res) => {
  const mediaId = req.params.id;

  // El usuario está autenticado gracias al middleware authMiddleware
  try {
    // Usar el servicio de streaming para manejar la solicitud
    await streamingService.handleStreamRequest(req, res, mediaId, req.user);
  } catch (error) {
    console.error(`Error en streaming de media ${mediaId}:`, error);

    // Solo enviar respuesta si aún no se han enviado headers
    if (!res.headersSent) {
      res.status(500).json({
        error: "Error de streaming",
        message: "Error al procesar el archivo multimedia",
      });
    }
  }
});

/**
 * @route   GET /api/media/:id/thumbnail
 * @desc    Obtener la miniatura de un elemento multimedia
 * @access  Private
 */
router.get("/:id/thumbnail", async (req, res) => {
  const mediaId = req.params.id;

  try {
    // Obtener información de la miniatura
    const mediaItem = await db.asyncGet(
      "SELECT thumbnail_path FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.thumbnail_path) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Miniatura no disponible para este elemento",
      });
    }

    // Verificar que el archivo existe
    const thumbnailPath = mediaItem.thumbnail_path;

    if (!fs.existsSync(thumbnailPath)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "La miniatura no existe en el servidor",
      });
    }

    // Determinar tipo MIME
    const ext = path.extname(thumbnailPath).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = mimeTypes[ext] || "image/jpeg";

    // Configurar cabeceras de caché para miniaturas (pueden cachearse por más tiempo)
    res.set({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400", // Cache durante 24 horas
    });

    // Enviar archivo
    res.sendFile(thumbnailPath);
  } catch (error) {
    console.error(`Error al obtener miniatura para medio ${mediaId}:`, error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Error del servidor",
        message: "Error al obtener la miniatura",
      });
    }
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

  // Validar datos
  if (position === undefined) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere la posición de reproducción",
    });
  }

  try {
    // Verificar si ya existe un registro para este usuario y medio
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
      success: true,
      position,
      completed: !!completed,
    });
  } catch (error) {
    console.error(`Error al guardar progreso para medio ${mediaId}:`, error);

    // Si hay error por tabla inexistente, intentar crearla
    if (error.message && error.message.includes("no such table")) {
      try {
        await db.asyncRun(`
          CREATE TABLE IF NOT EXISTS watch_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            position INTEGER DEFAULT 0,
            completed BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
          )
        `);

        // Intentar inserción nuevamente
        await db.asyncRun(
          "INSERT INTO watch_history (user_id, media_id, position, completed) VALUES (?, ?, ?, ?)",
          [userId, mediaId, position, completed ? 1 : 0]
        );

        return res.json({
          success: true,
          position,
          completed: !!completed,
          message: "Tabla creada y progreso guardado",
        });
      } catch (createError) {
        return res.status(500).json({
          error: "Error del servidor",
          message: `Error al crear tabla de historial: ${createError.message}`,
        });
      }
    }

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
    // Obtener progreso
    const watchRecord = await db.asyncGet(
      "SELECT position, completed, watched_at FROM watch_history WHERE user_id = ? AND media_id = ?",
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
    console.error(`Error al obtener progreso para medio ${mediaId}:`, error);

    // Error genérico - no crítico
    res.json({
      mediaId,
      position: 0,
      completed: false,
      watched: false,
      error: "No se pudo obtener el progreso",
    });
  }
});

/**
 * @route   GET /api/media
 * @desc    Obtener lista de elementos multimedia con filtros
 * @access  Private
 */
router.get("/", async (req, res) => {
  try {
    // Obtener parámetros de consulta
    const {
      type,
      library,
      search,
      page = 1,
      limit = 20,
      sort = "title",
      order = "asc",
    } = req.query;

    // Construir consulta SQL
    let query = `
      SELECT m.*, l.name as library_name 
      FROM media_items m
      LEFT JOIN libraries l ON m.library_id = l.id
      WHERE 1=1
    `;

    const params = [];

    // Filtrar por tipo
    if (type) {
      query += " AND m.type = ?";
      params.push(type);
    }

    // Filtrar por biblioteca
    if (library) {
      query += " AND m.library_id = ?";
      params.push(library);
    }

    // Búsqueda por título
    if (search) {
      query += " AND (m.title LIKE ? OR m.description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    // Ordenar resultados
    const validSorts = ["title", "created_at", "year", "type"];
    const validOrders = ["asc", "desc"];

    const sortField = validSorts.includes(sort) ? sort : "title";
    const orderDir = validOrders.includes(order.toLowerCase())
      ? order.toLowerCase()
      : "asc";

    query += ` ORDER BY m.${sortField} ${orderDir}`;

    // Paginación
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    // Consulta de conteo total para paginación
    const countQuery = query.replace(
      "m.*, l.name as library_name",
      "COUNT(*) as total"
    );

    // Añadir LIMIT y OFFSET a la consulta principal
    query += " LIMIT ? OFFSET ?";
    params.push(limitNum, offset);

    // Ejecutar consultas
    const totalResult = await db.asyncGet(countQuery, params.slice(0, -2));
    const items = await db.asyncAll(query, params);

    // Construir respuesta paginada
    res.json({
      items,
      pagination: {
        total: totalResult ? totalResult.total : 0,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil((totalResult ? totalResult.total : 0) / limitNum),
      },
    });
  } catch (error) {
    console.error("Error al obtener elementos multimedia:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener la lista de elementos multimedia",
    });
  }
});

/**
 * @route   GET /api/media/:id
 * @desc    Obtener detalles de un elemento multimedia
 * @access  Private
 */
router.get("/:id", async (req, res) => {
  const mediaId = req.params.id;

  try {
    // Consulta principal para obtener información del medio
    const mediaItem = await db.asyncGet(
      `
      SELECT m.*, l.name as library_name, l.type as library_type 
      FROM media_items m
      LEFT JOIN libraries l ON m.library_id = l.id
      WHERE m.id = ?
    `,
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Para series/temporadas, obtener episodios relacionados
    let children = [];
    if (mediaItem.type === "series" || mediaItem.type === "season") {
      children = await db.asyncAll(
        `
        SELECT * FROM media_items 
        WHERE parent_id = ? 
        ORDER BY 
          CASE 
            WHEN season_number IS NOT NULL THEN season_number 
            ELSE 9999 
          END,
          CASE 
            WHEN episode_number IS NOT NULL THEN episode_number 
            ELSE 9999 
          END
      `,
        [mediaId]
      );
    }

    // Verificar si el elemento está en favoritos para este usuario
    const userId = req.user.id;
    const isFavorite = await db.asyncGet(
      "SELECT id FROM favorites WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    // Incluir historial de visualización
    const watchHistory = await db.asyncGet(
      "SELECT position, completed, watched_at FROM watch_history WHERE user_id = ? AND media_id = ?",
      [userId, mediaId]
    );

    // Construir respuesta detallada
    const response = {
      ...mediaItem,
      isFavorite: !!isFavorite,
      watchHistory: watchHistory || { position: 0, completed: false },
      children: children || [],
    };

    res.json(response);
  } catch (error) {
    console.error(`Error al obtener detalles del medio ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener los detalles del elemento multimedia",
    });
  }
});

module.exports = router;
