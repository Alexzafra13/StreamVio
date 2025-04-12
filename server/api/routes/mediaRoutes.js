// server/api/routes/mediaRoutes.js
const express = require("express");
const { authenticate } = require("../middlewares/authMiddleware");
const {
  validateId,
  validatePagination,
  validateSchema,
} = require("../middlewares/validator");
const mediaController = require("../controllers/mediaController");

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

/**
 * @route   GET /api/media
 * @desc    Buscar elementos multimedia
 * @access  Private
 */
router.get("/", validatePagination, mediaController.searchMedia);

/**
 * @route   GET /api/media/:id
 * @desc    Obtener un elemento multimedia por ID
 * @access  Private
 */
router.get("/:id", validateId(), mediaController.getMediaById);

/**
 * @route   GET /api/media/:id/thumbnail
 * @desc    Obtener la miniatura de un elemento multimedia
 * @access  Private
 */
router.get("/:id/thumbnail", validateId(), mediaController.getThumbnail);

/**
 * @route   GET /api/media/:id/stream
 * @desc    Streaming de un elemento multimedia
 * @access  Private
 */
router.get("/:id/stream", validateId(), mediaController.streamMedia);

/**
 * @route   GET /api/media/:id/streaming-options
 * @desc    Obtener opciones de streaming disponibles
 * @access  Private
 */
router.get(
  "/:id/streaming-options",
  validateId(),
  mediaController.getStreamingOptions
);

/**
 * @route   POST /api/media/:id/progress
 * @desc    Actualizar progreso de visualización
 * @access  Private
 */
router.post(
  "/:id/progress",
  validateId(),
  validateSchema({
    required: ["position"],
    types: {
      position: "number",
      completed: "boolean",
    },
  }),
  mediaController.updateProgress
);

/**
 * @route   GET /api/media/user/history
 * @desc    Obtener historial de visualización
 * @access  Private
 */
router.get(
  "/user/history",
  validatePagination,
  mediaController.getWatchHistory
);

module.exports = router;
