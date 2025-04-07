// server/routes/filesystem.js - Versión simplificada y más robusta
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/enhancedAuth");
const filesystemService = require("../services/filesystemService");

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

/**
 * @route   GET /api/filesystem/browse
 * @desc    Explorar el contenido de un directorio
 * @access  Private
 */
router.get("/browse", async (req, res) => {
  try {
    const { path: dirPath } = req.query;
    const result = await filesystemService.browseDirectory(dirPath);
    res.json(result);
  } catch (error) {
    console.error("Error en /browse:", error);
    res.status(error.status || 500).json({
      error: error.error || "Error del servidor",
      message: error.message || "Error al explorar directorio",
      details: error.details,
    });
  }
});

/**
 * @route   GET /api/filesystem/roots
 * @desc    Obtener las unidades/raíces disponibles
 * @access  Private
 */
router.get("/roots", async (req, res) => {
  try {
    const rootDirectories = await filesystemService.getRootDirectories();
    res.json(rootDirectories);
  } catch (error) {
    console.error("Error en /roots:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener directorios raíz",
      details: error.message,
    });
  }
});

/**
 * @route   POST /api/filesystem/create-directory
 * @desc    Crear un nuevo directorio
 * @access  Private
 */
router.post("/create-directory", async (req, res) => {
  try {
    const { path: dirPath } = req.body;
    const result = await filesystemService.createDirectory(dirPath);
    res.json(result);
  } catch (error) {
    console.error("Error en /create-directory:", error);
    res.status(error.status || 500).json({
      error: error.error || "Error del servidor",
      message: error.message || "Error al crear directorio",
      suggestion: error.suggestion,
    });
  }
});

/**
 * @route   POST /api/filesystem/check-permissions
 * @desc    Verificar permisos de una carpeta
 * @access  Private
 */
router.post("/check-permissions", async (req, res) => {
  try {
    const { path: folderPath } = req.body;
    const result = await filesystemService.checkFolderPermissions(folderPath);
    res.json(result);
  } catch (error) {
    console.error("Error en /check-permissions:", error);
    res.status(error.status || 500).json({
      error: error.error || "Error del servidor",
      message: error.message || "Error al verificar permisos",
      details: error.details,
    });
  }
});

/**
 * @route   POST /api/filesystem/fix-permissions
 * @desc    Reparar permisos de una carpeta
 * @access  Private
 */
router.post("/fix-permissions", async (req, res) => {
  try {
    const { path: folderPath } = req.body;
    const result = await filesystemService.fixFolderPermissions(folderPath);
    res.json(result);
  } catch (error) {
    console.error("Error en /fix-permissions:", error);
    res.status(error.status || 500).json({
      error: error.error || "Error del servidor",
      message: error.message || "Error al reparar permisos",
      details: error.details,
      suggestedCommand: error.suggestedCommand,
    });
  }
});

/**
 * @route   GET /api/filesystem/suggest-paths
 * @desc    Sugerir ubicaciones con buen acceso para bibliotecas
 * @access  Private
 */
router.get("/suggest-paths", async (req, res) => {
  try {
    const result = await filesystemService.suggestMediaPaths();
    res.json(result);
  } catch (error) {
    console.error("Error en /suggest-paths:", error);
    res.status(error.status || 500).json({
      error: error.error || "Error del servidor",
      message: error.message || "Error al sugerir rutas",
      details: error.details,
    });
  }
});

module.exports = router;
