// server/api/routes/libraryRoutes.js
const express = require("express");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");
const { libraryAccess } = require("../middlewares/libraryAccessMiddleware");
const {
  validateSchema,
  validateId,
  validatePagination,
  schemas,
} = require("../middlewares/validator");
const libraryController = require("../controllers/libraryController");

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

/**
 * @route   GET /api/libraries
 * @desc    Obtener todas las bibliotecas accesibles para el usuario
 * @access  Private
 */
router.get("/", libraryController.getLibraries);

/**
 * @route   GET /api/libraries/:id
 * @desc    Obtener una biblioteca por ID
 * @access  Private
 */
router.get(
  "/:id",
  validateId(),
  libraryAccess,
  libraryController.getLibraryById
);

/**
 * @route   POST /api/libraries
 * @desc    Crear una nueva biblioteca
 * @access  Private
 */
router.post(
  "/",
  validateSchema(schemas.createLibrary),
  libraryController.createLibrary
);

/**
 * @route   PUT /api/libraries/:id
 * @desc    Actualizar una biblioteca existente
 * @access  Private
 */
router.put(
  "/:id",
  validateId(),
  validateSchema(schemas.updateLibrary),
  libraryAccess,
  libraryController.updateLibrary
);

/**
 * @route   DELETE /api/libraries/:id
 * @desc    Eliminar una biblioteca
 * @access  Private
 */
router.delete(
  "/:id",
  validateId(),
  libraryAccess,
  libraryController.deleteLibrary
);

/**
 * @route   POST /api/libraries/:id/scan
 * @desc    Escanear una biblioteca
 * @access  Private
 */
router.post(
  "/:id/scan",
  validateId(),
  libraryAccess,
  libraryController.scanLibrary
);

/**
 * @route   POST /api/libraries/:id/enrich
 * @desc    Buscar metadatos para todos los elementos de una biblioteca
 * @access  Private
 */
router.post(
  "/:id/enrich",
  validateId(),
  libraryAccess,
  libraryController.enrichLibrary
);

/**
 * @route   GET /api/libraries/:id/media
 * @desc    Obtener los elementos multimedia de una biblioteca
 * @access  Private
 */
router.get(
  "/:id/media",
  validateId(),
  validatePagination,
  libraryAccess,
  libraryController.getLibraryMedia
);

/**
 * @route   GET /api/libraries/:id/users
 * @desc    Obtener permisos de usuarios para una biblioteca
 * @access  Private (Admin)
 */
router.get(
  "/:id/users",
  validateId(),
  libraryAccess,
  libraryController.getLibraryUsers
);

/**
 * @route   POST /api/libraries/:id/users
 * @desc    Actualizar acceso de usuario a una biblioteca
 * @access  Private (Admin)
 */
router.post(
  "/:id/users",
  validateId(),
  isAdmin,
  validateSchema({
    required: ["userId"],
    types: {
      userId: "number",
      hasAccess: "boolean",
    },
  }),
  libraryAccess,
  libraryController.updateUserAccess
);

module.exports = router;
