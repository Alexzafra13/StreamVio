// server/api/routes/migrationRoutes.js
const express = require("express");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");
const migrationController = require("../controllers/migrationController");

const router = express.Router();

// Todas las rutas requieren autenticación y privilegios de administrador
router.use(authenticate, isAdmin);

/**
 * @route   GET /api/migrations/status
 * @desc    Obtener estado actual de las migraciones
 * @access  Private (Admin)
 */
router.get("/status", migrationController.getMigrationStatus);

/**
 * @route   GET /api/migrations/check
 * @desc    Verificar si la base de datos está actualizada
 * @access  Private (Admin)
 */
router.get("/check", migrationController.checkIfUpToDate);

/**
 * @route   POST /api/migrations/run
 * @desc    Ejecutar migraciones pendientes
 * @access  Private (Admin)
 */
router.post("/run", migrationController.runMigrations);

/**
 * @route   POST /api/migrations/rollback
 * @desc    Revertir última migración
 * @access  Private (Admin)
 */
router.post("/rollback", migrationController.rollbackMigration);

/**
 * @route   POST /api/migrations/to/:version
 * @desc    Migrar a una versión específica
 * @access  Private (Admin)
 */
router.post("/to/:version", migrationController.migrateToVersion);

module.exports = router;
