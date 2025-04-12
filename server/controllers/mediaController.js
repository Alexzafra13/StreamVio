// server/api/controllers/mediaController.js
const mediaService = require("../../services/mediaService");
const streamingService = require("../../services/streamingService");
const {
  asyncHandler,
  createBadRequestError,
  createNotFoundError,
} = require("../middlewares/errorMiddleware");

/**
 * Obtener un elemento multimedia por ID
 */
const getMediaById = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  try {
    const media = await mediaService.getMediaById(mediaId, userId);

    // Obtener progreso de visualización
    const watchProgress = await mediaService.getWatchProgress(userId, mediaId);

    // Devolver el elemento con su progreso
    res.json({
      ...media,
      watchProgress,
    });
  } catch (error) {
    if (error.message.includes("no encontrado")) {
      throw createNotFoundError("Elemento multimedia no encontrado");
    } else if (error.message.includes("No tienes permiso")) {
      throw createBadRequestError(
        "No tienes permiso para acceder a este elemento",
        "ACCESS_DENIED"
      );
    } else {
      throw error;
    }
  }
});

/**
 * Buscar elementos multimedia
 */
const searchMedia = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const searchParams = {
    query: req.query.q || req.query.query,
    libraryId: req.query.library,
    type: req.query.type,
    page: req.query.page,
    limit: req.query.limit,
    sort: req.query.sort,
    order: req.query.order,
  };

  const results = await mediaService.searchMedia(searchParams, userId);
  res.json(results);
});

/**
 * Obtener una miniatura de un elemento multimedia
 */
const getThumbnail = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Verificar acceso al elemento
  await mediaService.getMediaById(mediaId, userId);

  // Obtener ruta de la miniatura
  const thumbnailPath = await mediaService.getThumbnailPath(mediaId);

  if (!thumbnailPath) {
    throw createNotFoundError("Miniatura no disponible para este elemento");
  }

  // Configurar cabeceras de caché para miniaturas
  res.set({
    "Cache-Control": "public, max-age=86400", // Cache durante 24 horas
  });

  // Enviar archivo
  res.sendFile(thumbnailPath);
});

/**
 * Streaming de un elemento multimedia
 */
const streamMedia = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Delegar al servicio de streaming
  await streamingService.handleStreamRequest(req, res, mediaId, req.user);
});

/**
 * Actualizar progreso de visualización
 */
const updateProgress = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;
  const { position, completed } = req.body;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  if (position === undefined) {
    throw createBadRequestError("Se requiere la posición de reproducción");
  }

  const result = await mediaService.updateWatchProgress(userId, mediaId, {
    position,
    completed,
  });

  res.json(result);
});

/**
 * Obtener opciones de streaming disponibles
 */
const getStreamingOptions = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Extraer token para incluirlo en las URLs de streaming
  let token = null;

  if (req.headers.authorization) {
    token = req.headers.authorization.replace("Bearer ", "");
  } else if (req.query.auth || req.query.token) {
    token = req.query.auth || req.query.token;
  }

  const options = await streamingService.getStreamingOptions(mediaId, token);
  res.json(options);
});

/**
 * Obtener historial de visualización del usuario
 */
const getWatchHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit, includeCompleted } = req.query;

  const history = await mediaService.getWatchHistory(userId, {
    limit: parseInt(limit) || 10,
    includeCompleted: includeCompleted === "true",
  });

  res.json(history);
});

module.exports = {
  getMediaById,
  searchMedia,
  getThumbnail,
  streamMedia,
  updateProgress,
  getStreamingOptions,
  getWatchHistory,
};
