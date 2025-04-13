// server/api/controllers/watchHistoryController.js
const watchHistoryRepository = require("../../data/repositories/watchHistoryRepository");
const {
  asyncHandler,
  createBadRequestError,
  createNotFoundError,
} = require("../middlewares/errorMiddleware");

/**
 * Actualizar progreso de visualización
 */
const updateProgress = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;
  const { position, completed, duration } = req.body;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  if (position === undefined) {
    throw createBadRequestError("Se requiere la posición de reproducción");
  }

  const result = await watchHistoryRepository.updateProgress(userId, mediaId, {
    position,
    completed,
    duration,
  });

  res.json(result);
});

/**
 * Obtener progreso de visualización
 */
const getProgress = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  const progress = await watchHistoryRepository.getProgress(userId, mediaId);
  res.json(progress);
});

/**
 * Obtener historial de visualización del usuario
 */
const getUserHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    limit = 20,
    page = 1,
    includeCompleted = "true",
    includeDetails = "true",
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const options = {
    limit: parseInt(limit),
    offset,
    includeCompleted: includeCompleted === "true",
    includeDetails: includeDetails === "true",
  };

  const history = await watchHistoryRepository.getUserHistory(userId, options);

  res.json(history);
});

/**
 * Obtener elementos recientemente vistos
 */
const getRecentlyWatched = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;

  const recentItems = await watchHistoryRepository.getRecentlyWatched(
    userId,
    parseInt(limit)
  );

  res.json(recentItems);
});

/**
 * Obtener elementos en progreso
 */
const getInProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;

  const inProgressItems = await watchHistoryRepository.getInProgress(
    userId,
    parseInt(limit)
  );

  res.json(inProgressItems);
});

/**
 * Marcar un elemento como completado
 */
const markAsCompleted = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  const result = await watchHistoryRepository.markAsCompleted(userId, mediaId);

  res.json(result);
});

/**
 * Eliminar un registro del historial
 */
const deleteHistoryItem = asyncHandler(async (req, res) => {
  const historyId = parseInt(req.params.id);

  if (isNaN(historyId)) {
    throw createBadRequestError("ID de historial no válido");
  }

  // Verificar que el registro existe y pertenece al usuario
  const db = require("../../data/db");
  const historyItem = await db.asyncGet(
    "SELECT id FROM watch_history WHERE id = ? AND user_id = ?",
    [historyId, req.user.id]
  );

  if (!historyItem) {
    throw createNotFoundError(
      "Registro de historial no encontrado o no te pertenece"
    );
  }

  await watchHistoryRepository.delete(historyId);

  res.json({
    message: "Registro eliminado correctamente",
    id: historyId,
  });
});

/**
 * Eliminar todo el historial del usuario
 */
const clearHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await watchHistoryRepository.deleteAllForUser(userId);

  res.json({
    message: "Historial eliminado correctamente",
  });
});

/**
 * Obtener estadísticas de visualización
 */
const getUserStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const stats = await watchHistoryRepository.getUserStats(userId);

  res.json(stats);
});

/**
 * Obtener recomendaciones personalizadas
 */
const getRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;

  const recommendations = await watchHistoryRepository.getRecommendations(
    userId,
    parseInt(limit)
  );

  res.json(recommendations);
});

/**
 * Obtener elementos populares
 */
const getPopularItems = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const popularItems = await watchHistoryRepository.getPopularItems(
    parseInt(limit)
  );

  res.json(popularItems);
});

module.exports = {
  updateProgress,
  getProgress,
  getUserHistory,
  getRecentlyWatched,
  getInProgress,
  markAsCompleted,
  deleteHistoryItem,
  clearHistory,
  getUserStats,
  getRecommendations,
  getPopularItems,
};
