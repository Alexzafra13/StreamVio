// server/api/routes/authRoutes.js
const express = require("express");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");
const { validateSchema } = require("../middlewares/validator");
const authController = require("../controllers/authController");

const router = express.Router();

/**
 * @route   GET /api/auth/check-first-time
 * @desc    Verificar si es primera ejecución
 * @access  Public
 */
router.get("/check-first-time", authController.checkFirstTime);

/**
 * @route   POST /api/auth/setup-first-user
 * @desc    Configurar primer usuario administrador
 * @access  Public
 */
router.post(
  "/setup-first-user",
  validateSchema({
    required: ["username", "email", "password"],
    types: {
      username: "string",
      email: "string",
      password: "string",
    },
    custom: {
      email: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) || "El formato del email no es válido";
      },
      password: (value) => {
        return (
          value.length >= 6 || "La contraseña debe tener al menos 6 caracteres"
        );
      },
    },
  }),
  authController.setupFirstUser
);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post(
  "/login",
  validateSchema({
    required: ["email", "password"],
    types: {
      email: "string",
      password: "string",
    },
  }),
  authController.login
);

/**
 * @route   GET /api/auth/user
 * @desc    Obtener información del usuario autenticado
 * @access  Private
 */
router.get("/user", authenticate, authController.getUser);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña del usuario
 * @access  Private
 */
router.post(
  "/change-password",
  authenticate,
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
  authController.changePassword
);

/**
 * @route   POST /api/auth/create-invitation
 * @desc    Crear código de invitación
 * @access  Private (Solo Admin)
 */
router.post(
  "/create-invitation",
  authenticate,
  isAdmin,
  authController.createInvitation
);

module.exports = router;
