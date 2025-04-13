// server/api/routes/watchHistoryRoutes.js
const express = require("express");
const { authenticate } = require("../middlewares/authMiddleware");
const {
  validateId,
  validateSchema,
  validatePagination,
} = require("../middlewares/validator");
const watchHistoryController = require("../controllers/watchHistoryController");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * @route   GET /api/history
 * @desc    Obtener historial de visualización del usuario
 * @access  Private
 */
router.get("/", validatePagination, watchHistoryController.getUserHistory);

/**
 * @route   DELETE /api/history
 * @desc    Eliminar todo el historial del usuario
 * @access  Private
 */
router.delete("/", watchHistoryController.clearHistory);

/**
 * @route   GET /api/history/stats
 * @desc    Obtener estadísticas de visualización
 * @access  Private
 */
router.get("/stats", watchHistoryController.getUserStats);

/**
 * @route   GET /api/history/recent
 * @desc    Obtener elementos recientemente vistos
 * @access  Private
 */
router.get("/recent", watchHistoryController.getRecentlyWatched);

/**
 * @route   GET /api/history/in-progress
 * @desc    Obtener elementos en progreso
 * @access  Private
 */
router.get("/in-progress", watchHistoryController.getInProgress);

/**
 * @route   GET /api/history/recommendations
 * @desc    Obtener recomendaciones personalizadas
 * @access  Private
 */
router.get("/recommendations", watchHistoryController.getRecommendations);

/**
 * @route   GET /api/history/popular
 * @desc    Obtener elementos populares
 * @access  Private
 */
router.get("/popular", watchHistoryController.getPopularItems);

/**
 * @route   GET /api/history/media/:id
 * @desc    Obtener progreso de visualización de un elemento específico
 * @access  Private
 */
router.get("/media/:id", validateId(), watchHistoryController.getProgress);

/**
 * @route   POST /api/history/media/:id
 * @desc    Actualizar progreso de visualización
 * @access  Private
 */
router.post(
  "/media/:id",
  validateId(),
  validateSchema({
    required: ["position"],
    types: {
      position: "number",
      completed: "boolean",
      duration: "number",
    },
  }),
  watchHistoryController.updateProgress
);

/**
 * @route   POST /api/history/media/:id/complete
 * @desc    Marcar un elemento como completado
 * @access  Private
 */
router.post(
  "/media/:id/complete",
  validateId(),
  watchHistoryController.markAsCompleted
);

/**
 * @route   DELETE /api/history/:id
 * @desc    Eliminar un registro específico del historial
 * @access  Private
 */
router.delete("/:id", validateId(), watchHistoryController.deleteHistoryItem);

module.exports = router;
