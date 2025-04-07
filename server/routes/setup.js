// server/routes/setup.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");

const router = express.Router();
const mkdir = promisify(fs.mkdir);

/**
 * @route   GET /api/setup/check
 * @desc    Verificar si se necesita configuración inicial
 * @access  Public
 */
router.get("/check", async (req, res) => {
  try {
    // Verificar si hay usuarios en la base de datos
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");
    const isFirstTime = !userCount || userCount.count === 0;

    // Verificar si hay directorios necesarios
    const dataDir = path.join(__dirname, "../data");
    const requiredDirs = [
      dataDir,
      path.join(dataDir, "thumbnails"),
      path.join(dataDir, "transcoded"),
      path.join(dataDir, "cache"),
      path.join(dataDir, "metadata"),
    ];

    // Verificar permisos de directorios
    const permissionsResults = [];
    let permissionsOk = true;

    for (const dir of requiredDirs) {
      try {
        // Asegurarse de que existe
        if (!fs.existsSync(dir)) {
          await mkdir(dir, { recursive: true, mode: 0o775 });
        }

        // Verificar permisos
        const check = await permissionsHelper.checkFolderPermissions(dir);
        permissionsResults.push(check);

        if (!check.hasAccess) {
          permissionsOk = false;
        }
      } catch (err) {
        permissionsResults.push({
          path: dir,
          hasAccess: false,
          error: err.message,
        });
        permissionsOk = false;
      }
    }

    // Determinar estado general
    const systemStatus = {
      needsFirstTimeSetup: isFirstTime,
      permissionsOk,
      serverReady: permissionsOk,
      databaseInitialized: true, // Asumimos que si llegamos aquí la DB está inicializada
      version: process.env.npm_package_version || "0.1.0",
      directoriesChecked: requiredDirs.length,
      directoriesOk: permissionsResults.filter((r) => r.hasAccess).length,
    };

    // Si hay problemas de permisos, añadir detalles
    if (!permissionsOk) {
      systemStatus.permissionsDetails = permissionsResults.filter(
        (r) => !r.hasAccess
      );
    }

    res.json(systemStatus);
  } catch (error) {
    console.error("Error al verificar estado de configuración:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar estado de configuración inicial",
    });
  }
});

/**
 * @route   POST /api/setup/init
 * @desc    Inicializar el sistema con el primer usuario administrador
 * @access  Public
 */
router.post("/init", async (req, res) => {
  const { username, email, password } = req.body;

  // Validar entrada
  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere nombre de usuario, email y contraseña",
    });
  }

  try {
    // Verificar que no hay usuarios existentes
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");

    if (userCount && userCount.count > 0) {
      return res.status(403).json({
        error: "Operación no permitida",
        message: "Ya existe al menos un usuario en el sistema",
      });
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar usuario administrador
    const result = await db.asyncRun(
      "INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, 1] // is_admin = 1
    );

    // Generar token JWT
    const userId = result.lastID;
    const token = jwt.sign(
      { id: userId, username, email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" }
    );

    // Verificar y arreglar permisos de directorios críticos
    const dataDir = path.join(__dirname, "../data");
    const requiredDirs = [
      dataDir,
      path.join(dataDir, "thumbnails"),
      path.join(dataDir, "transcoded"),
      path.join(dataDir, "cache"),
      path.join(dataDir, "metadata"),
    ];

    // Crear y configurar permisos de directorios necesarios
    const dirSetupResult = await permissionsHelper.createRequiredDirectories(
      requiredDirs
    );

    // Responder con token y datos básicos del usuario
    res.status(201).json({
      message: "Configuración inicial completada exitosamente",
      token,
      userId,
      username,
      email,
      isAdmin: true,
      systemSetup: {
        directoriesSetup: dirSetupResult.success,
        details: dirSetupResult.details,
      },
    });
  } catch (error) {
    console.error("Error en configuración inicial:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al configurar el primer usuario",
    });
  }
});

/**
 * @route   POST /api/setup/fix-permissions
 * @desc    Intentar arreglar permisos de directorios del sistema
 * @access  Public
 */
router.post("/fix-permissions", async (req, res) => {
  try {
    const dataDir = path.join(__dirname, "../data");
    const requiredDirs = [
      dataDir,
      path.join(dataDir, "thumbnails"),
      path.join(dataDir, "transcoded"),
      path.join(dataDir, "cache"),
      path.join(dataDir, "metadata"),
    ];

    // Crear y configurar permisos de directorios necesarios
    const fixResult = await permissionsHelper.createRequiredDirectories(
      requiredDirs
    );

    res.json({
      success: fixResult.success,
      message: fixResult.success
        ? "Permisos de directorios reparados correctamente"
        : "Algunos directorios no pudieron ser reparados",
      details: fixResult.details,
    });
  } catch (error) {
    console.error("Error al reparar permisos:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al reparar permisos de directorios",
    });
  }
});

module.exports = router;
