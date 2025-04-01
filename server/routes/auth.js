const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar usuario y obtener token
 * @access  Public
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Validar entrada
  if (!email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere email y contraseña",
    });
  }

  try {
    // Buscar usuario por email
    const user = await db.asyncGet("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!user) {
      return res.status(401).json({
        error: "Credenciales inválidas",
        message: "Email o contraseña incorrectos",
      });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Credenciales inválidas",
        message: "Email o contraseña incorrectos",
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "24h" }
    );

    // Responder con token y datos básicos del usuario
    res.json({
      message: "Login exitoso",
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      requirePasswordChange: user.force_password_change === 1,
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar el inicio de sesión",
    });
  }
});

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Public
 */
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  // Validar entrada
  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere nombre de usuario, email y contraseña",
    });
  }

  try {
    // Verificar si el email ya existe
    const existingEmail = await db.asyncGet(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingEmail) {
      return res.status(400).json({
        error: "Email en uso",
        message: "Este email ya está registrado",
      });
    }

    // Verificar si el nombre de usuario ya existe
    const existingUsername = await db.asyncGet(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    if (existingUsername) {
      return res.status(400).json({
        error: "Usuario en uso",
        message: "Este nombre de usuario ya está registrado",
      });
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar nuevo usuario
    const result = await db.asyncRun(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    // Generar token JWT
    const userId = result.lastID;
    const token = jwt.sign(
      { id: userId, username, email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "24h" }
    );

    // Responder con token y datos básicos del usuario
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      token,
      userId,
      username,
      email,
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al registrar usuario",
    });
  }
});

/**
 * @route   GET /api/auth/user
 * @desc    Obtener información del usuario actual
 * @access  Private
 */
router.get("/user", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener información del usuario desde la base de datos
    const user = await db.asyncGet(
      "SELECT id, username, email, is_admin, force_password_change FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró el usuario con el ID proporcionado",
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Error al obtener información del usuario:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener información del usuario",
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña del usuario
 * @access  Private
 */
router.post("/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Validar entrada
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere la contraseña actual y la nueva contraseña",
    });
  }

  // Validar longitud de la nueva contraseña
  if (newPassword.length < 6) {
    return res.status(400).json({
      error: "Contraseña débil",
      message: "La nueva contraseña debe tener al menos 6 caracteres",
    });
  }

  try {
    // Obtener contraseña actual del usuario
    const user = await db.asyncGet("SELECT password FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "Usuario no encontrado",
      });
    }

    // Verificar contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        error: "Contraseña incorrecta",
        message: "La contraseña actual es incorrecta",
      });
    }

    // Hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña y quitar flag de cambio forzado
    await db.asyncRun(
      "UPDATE users SET password = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [hashedPassword, userId]
    );

    res.json({
      message: "Contraseña actualizada exitosamente",
    });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al cambiar la contraseña",
    });
  }
});

/**
 * @route   GET /api/auth/check-password-change
 * @desc    Verificar si el usuario requiere cambio de contraseña
 * @access  Private
 */
router.get("/check-password-change", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener estado de force_password_change, is_admin y otros campos relevantes
    const user = await db.asyncGet(
      "SELECT username, email, is_admin, force_password_change, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró el usuario",
      });
    }

    // Determinar si es el primer inicio de sesión de admin
    const isAdminFirstLogin =
      user.username === "admin" && user.force_password_change === 1;

    res.json({
      requirePasswordChange: user.force_password_change === 1,
      isAdmin: user.username === "admin" || user.is_admin === 1,
      isAdminFirstLogin: isAdminFirstLogin,
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error("Error al verificar estado de contraseña:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar estado de contraseña",
    });
  }
});

/**
 * @route   POST /api/auth/setup-admin
 * @desc    Configura el primer inicio de sesión del administrador con email y contraseña personalizados
 * @access  Private (solo admin)
 */
router.post("/setup-admin", authMiddleware, async (req, res) => {
  const { email, newPassword, currentPassword } = req.body;
  const userId = req.user.id;

  // Validar requisitos
  if (!email || !newPassword) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere email y nueva contraseña",
    });
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      error: "Email inválido",
      message: "Por favor, proporciona un email válido",
    });
  }

  // Validar longitud de la nueva contraseña
  if (newPassword.length < 6) {
    return res.status(400).json({
      error: "Contraseña débil",
      message: "La nueva contraseña debe tener al menos 6 caracteres",
    });
  }

  try {
    // Verificar que el usuario sea admin y esté en primer inicio de sesión
    const user = await db.asyncGet(
      "SELECT * FROM users WHERE id = ? AND username = 'admin' AND force_password_change = 1",
      [userId]
    );

    if (!user) {
      return res.status(403).json({
        error: "No autorizado",
        message:
          "Esta operación solo está permitida para el administrador en su primer inicio de sesión",
      });
    }

    console.log(
      "Procesando configuración inicial de administrador para userId:",
      userId
    );

    // Verificar que el email no esté ya en uso por otro usuario
    const existingUser = await db.asyncGet(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, userId]
    );

    if (existingUser) {
      return res.status(400).json({
        error: "Email en uso",
        message: "Este email ya está registrado por otro usuario",
      });
    }

    // Por seguridad adicional, verificamos la contraseña actual del admin
    // (debería ser "admin" en este punto)
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid && currentPassword !== "admin") {
      // Permitir "admin" como contraseña default
      return res.status(401).json({
        error: "Contraseña incorrecta",
        message: "La contraseña actual es incorrecta",
      });
    }

    // Generar hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar email, contraseña y deshabilitar force_password_change
    await db.asyncRun(
      `UPDATE users 
       SET email = ?, password = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [email, hashedPassword, userId]
    );

    console.log("Administrador configurado correctamente:", userId);

    // Generar un nuevo token JWT con el nuevo email
    const token = jwt.sign(
      { id: userId, username: user.username, email: email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "24h" }
    );

    // Responder con el token actualizado y más información
    res.json({
      message: "Configuración de administrador completada exitosamente",
      email,
      token,
      userId,
      username: user.username,
      isAdmin: true,
    });
  } catch (error) {
    console.error("Error en configuración de admin:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar la configuración de administrador",
    });
  }
});

// Exportar router
module.exports = router;
