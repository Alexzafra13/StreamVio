// server/api/routes/settingsRoutes.js
const express = require("express");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");
const settingsController = require("../controllers/settingsController");

const router = express.Router();

// Todas las rutas requieren autenticación y privilegios de administrador
router.use(authenticate, isAdmin);

/**
 * @route   GET /api/settings
 * @desc    Obtener todas las configuraciones
 * @access  Private (Admin)
 */
router.get("/", settingsController.getAllSettings);

/**
 * @route   GET /api/settings/grouped
 * @desc    Obtener configuraciones agrupadas por categoría
 * @access  Private (Admin)
 */
router.get("/grouped", settingsController.getGroupedSettings);

/**
 * @route   GET /api/settings/system
 * @desc    Obtener configuraciones del sistema
 * @access  Private (Admin)
 */
router.get("/system", settingsController.getSystemSettings);

/**
 * @route   GET /api/settings/ui
 * @desc    Obtener configuraciones de interfaz de usuario
 * @access  Private (Admin)
 */
router.get("/ui", settingsController.getUiSettings);

/**
 * @route   GET /api/settings/export
 * @desc    Exportar todas las configuraciones
 * @access  Private (Admin)
 */
router.get("/export", settingsController.exportSettings);

/**
 * @route   POST /api/settings/import
 * @desc    Importar configuraciones
 * @access  Private (Admin)
 */
router.post("/import", settingsController.importSettings);

/**
 * @route   POST /api/settings/bulk
 * @desc    Establecer múltiples configuraciones a la vez
 * @access  Private (Admin)
 */
router.post("/bulk", settingsController.setBulkSettings);

/**
 * @route   POST /api/settings/reset-all
 * @desc    Resetear todos los ajustes a valores por defecto
 * @access  Private (Admin)
 */
router.post("/reset-all", settingsController.resetAllSettings);

/**
 * @route   GET /api/settings/:key
 * @desc    Obtener una configuración específica
 * @access  Private (Admin)
 */
router.get("/:key", settingsController.getSetting);

/**
 * @route   PUT /api/settings/:key
 * @desc    Establecer una configuración
 * @access  Private (Admin)
 */
router.put("/:key", settingsController.setSetting);

/**
 * @route   DELETE /api/settings/:key
 * @desc    Eliminar una configuración
 * @access  Private (Admin)
 */
router.delete("/:key", settingsController.deleteSetting);

/**
 * @route   POST /api/settings/:key/reset
 * @desc    Resetear una configuración a su valor por defecto
 * @access  Private (Admin)
 */
router.post("/:key/reset", settingsController.resetSetting);

module.exports = router;
