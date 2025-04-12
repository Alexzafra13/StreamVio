// server/api/routes/metadataRoutes.js
const express = require("express");
const { authenticate } = require("../middlewares/authMiddleware");
const { validateId, validateSchema } = require("../middlewares/validator");
const { libraryAccess } = require("../middlewares/libraryAccessMiddleware");
const metadataController = require("../controllers/metadataController");

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

/**
 * @route   GET /api/metadata/search
 * @desc    Buscar películas/series por título
 * @access  Private
 */
router.get(
  "/search",
  validateSchema(
    {
      required: ["title"],
      types: {
        title: "string",
        type: "string",
        year: "number",
      },
      allowed: {
        type: ["movie", "series", "episode", "music", "photo"],
      },
    },
    "query"
  ),
  metadataController.searchMetadata
);

/**
 * @route   GET /api/metadata/movie/:id
 * @desc    Obtener detalles de una película desde TMDb
 * @access  Private
 */
router.get("/movie/:id", metadataController.getMovieDetails);

/**
 * @route   POST /api/metadata/media/:id/enrich
 * @desc    Enriquecer un elemento multimedia con metadatos
 * @access  Private
 */
router.post("/media/:id/enrich", validateId(), metadataController.enrichMedia);

/**
 * @route   POST /api/metadata/library/:id/enrich
 * @desc    Enriquecer todos los elementos de una biblioteca
 * @access  Private
 */
router.post(
  "/library/:id/enrich",
  validateId("id"),
  libraryAccess,
  metadataController.enrichLibrary
);

/**
 * @route   POST /api/metadata/media/:id/apply
 * @desc    Aplicar metadatos específicos a un elemento
 * @access  Private
 */
router.post(
  "/media/:id/apply",
  validateId(),
  validateSchema({
    required: ["externalId"],
    types: {
      externalId: "string",
      source: "string",
    },
    allowed: {
      source: ["tmdb"],
    },
  }),
  metadataController.applySpecificMetadata
);

/**
 * @route   PUT /api/metadata/media/:id
 * @desc    Editar manualmente los metadatos de un elemento
 * @access  Private
 */
router.put(
  "/media/:id",
  validateId(),
  validateSchema({
    types: {
      title: "string",
      original_title: "string",
      description: "string",
      year: "number",
      genre: "string",
      director: "string",
      actors: "string",
    },
  }),
  metadataController.updateManualMetadata
);

module.exports = router;
