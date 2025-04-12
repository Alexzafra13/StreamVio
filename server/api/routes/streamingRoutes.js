// server/api/routes/streamingRoutes.js
const express = require("express");
const { authenticate } = require("../middlewares/authMiddleware");
const { validateId, validateSchema } = require("../middlewares/validator");
const streamingController = require("../controllers/streamingController");

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

/**
 * @route   GET /api/streaming/:id/stream
 * @desc    Streaming directo de un elemento multimedia
 * @access  Private
 */
router.get("/:id/stream", validateId(), streamingController.streamMedia);

/**
 * @route   GET /api/streaming/:id/options
 * @desc    Obtener opciones de streaming disponibles
 * @access  Private
 */
router.get(
  "/:id/options",
  validateId(),
  streamingController.getStreamingOptions
);

/**
 * @route   GET /api/streaming/:id/hls/:playlist?
 * @desc    Streaming HLS adaptativo
 * @access  Private
 */
router.get("/:id/hls/:playlist?", validateId(), streamingController.streamHLS);

/**
 * @route   POST /api/streaming/:id/progress
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
  streamingController.updateProgress
);

/**
 * @route   GET /api/streaming/:id/progress
 * @desc    Obtener progreso de visualización
 * @access  Private
 */
router.get("/:id/progress", validateId(), streamingController.getProgress);

module.exports = router;
