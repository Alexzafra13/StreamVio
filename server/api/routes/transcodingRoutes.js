// server/api/routes/transcodingRoutes.js
const express = require("express");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");
const {
  validateId,
  validateSchema,
  validatePagination,
} = require("../middlewares/validator");
const transcodingController = require("../controllers/transcodingController");

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

/**
 * @route   GET /api/transcoding/jobs
 * @desc    Obtener trabajos de transcodificación
 * @access  Private
 */
router.get(
  "/jobs",
  validatePagination,
  validateSchema(
    {
      types: {
        status: "string",
      },
      allowed: {
        status: ["pending", "processing", "completed", "failed", "cancelled"],
      },
    },
    "query"
  ),
  transcodingController.getTranscodingJobs
);

/**
 * @route   GET /api/transcoding/jobs/:id
 * @desc    Obtener detalles de un trabajo
 * @access  Private
 */
router.get("/jobs/:id", transcodingController.getJobDetails);

/**
 * @route   POST /api/transcoding/jobs/:id/cancel
 * @desc    Cancelar un trabajo
 * @access  Private
 */
router.post("/jobs/:id/cancel", transcodingController.cancelJob);

/**
 * @route   POST /api/transcoding/media/:id
 * @desc    Iniciar transcodificación para un elemento multimedia
 * @access  Private
 */
router.post(
  "/media/:id",
  validateId(),
  validateSchema({
    types: {
      profile: "string",
      forceRegenerate: "boolean",
    },
  }),
  transcodingController.startTranscoding
);

/**
 * @route   POST /api/transcoding/media/:id/hls
 * @desc    Crear streaming HLS para un elemento multimedia
 * @access  Private
 */
router.post(
  "/media/:id/hls",
  validateId(),
  validateSchema({
    types: {
      maxHeight: "number",
      forceRegenerate: "boolean",
    },
  }),
  transcodingController.createHLSStream
);

/**
 * @route   GET /api/transcoding/media/:id/thumbnail
 * @desc    Generar o recuperar una miniatura
 * @access  Private
 */
router.get(
  "/media/:id/thumbnail",
  validateId(),
  validateSchema(
    {
      types: {
        timeOffset: "number",
        regenerate: "boolean",
      },
    },
    "query"
  ),
  transcodingController.generateThumbnail
);

/**
 * @route   GET /api/transcoding/profiles
 * @desc    Obtener perfiles de transcodificación disponibles
 * @access  Private
 */
router.get("/profiles", transcodingController.getProfiles);

module.exports = router;
