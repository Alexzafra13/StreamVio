// server/api/routes/userRoutes.js
const express = require("express");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");
const {
  validateSchema,
  validateId,
  schemas,
} = require("../middlewares/validator");
const userController = require("../controllers/userController");

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Obtener todos los usuarios
 * @access  Private (Admin)
 */
router.get("/", isAdmin, userController.getAllUsers);

/**
 * @route   POST /api/users
 * @desc    Crear un nuevo usuario
 * @access  Private (Admin)
 */
router.post(
  "/",
  isAdmin,
  validateSchema(schemas.createUser),
  userController.createUser
);

/**
 * @route   GET /api/users/:id
 * @desc    Obtener detalles de un usuario
 * @access  Private (Admin o propio usuario)
 */
router.get("/:id", validateId(), userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Actualizar información de un usuario
 * @access  Private (Admin o propio usuario)
 */
router.put(
  "/:id",
  validateId(),
  validateSchema(schemas.updateUser),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Eliminar un usuario
 * @access  Private (Admin)
 */
router.delete("/:id", validateId(), isAdmin, userController.deleteUser);

/**
 * @route   POST /api/users/:id/password
 * @desc    Cambiar contraseña
 * @access  Private (Solo propio usuario)
 */
router.post(
  "/:id/password",
  validateId(),
  validateSchema({
    required: ["currentPassword", "newPassword"],
    types: {
      currentPassword: "string",
      newPassword: "string",
    },
    custom: {
      newPassword: (value) => {
        return (
          value.length >= 6 ||
          "La nueva contraseña debe tener al menos 6 caracteres"
        );
      },
    },
  }),
  userController.changePassword
);

/**
 * @route   POST /api/users/:id/toggle-admin
 * @desc    Activar/desactivar privilegios de administrador
 * @access  Private (Admin)
 */
router.post(
  "/:id/toggle-admin",
  validateId(),
  isAdmin,
  userController.toggleAdmin
);

/**
 * @route   GET /api/users/:id/libraries
 * @desc    Obtener bibliotecas accesibles para un usuario
 * @access  Private (Admin o propio usuario)
 */
router.get("/:id/libraries", validateId(), userController.getUserLibraries);

module.exports = router;
