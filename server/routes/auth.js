// server/routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const authMiddleware = require("../middleware/authMiddleware");
const settings = require("../config/settings.js");
const crypto = require("crypto");

// Crear router
const router = express.Router();

/**
 * @route   GET /api/auth/check-first-time
 * @desc    Verificar si es la primera ejecución (sin usuarios)
 * @access  Public
 */
router.get("/check-first-time", async (req, res) => {
  try {
    // Verificar si hay algún usuario en la base de datos
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");

    // Si no hay usuarios, es la primera ejecución
    const isFirstTime = !userCount || userCount.count === 0;

    res.json({
      isFirstTime,
      message: isFirstTime
        ? "Primera ejecución detectada. Se requiere configuración inicial."
        : "El sistema ya está configurado.",
    });
  } catch (error) {
    console.error("Error al verificar primera ejecución:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar si es primera ejecución",
    });
  }
});

/**
 * @route   POST /api/auth/setup-first-user
 * @desc    Configurar el primer usuario administrador
 * @access  Public
 */
router.post("/setup-first-user", async (req, res) => {
  const { username, email, password } = req.body;

  // Validar entrada
  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere nombre de usuario, email y contraseña",
    });
  }

  try {
    // Verificar que no haya usuarios existentes
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

    // Insertar como usuario administrador
    const result = await db.asyncRun(
      "INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, 1] // is_admin = 1
    );

    // Generar token JWT
    const userId = result.lastID;
    const token = jwt.sign(
      { id: userId, username, email },
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" }
    );

    // Responder con token y datos básicos del usuario
    res.status(201).json({
      message: "Configuración inicial completada exitosamente",
      token,
      userId,
      username,
      email,
      isAdmin: true,
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
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" }
    );

    // Responder con token y datos básicos del usuario
    // Asegurar que isAdmin sea booleano para consistencia
    res.json({
      message: "Login exitoso",
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin === 1, // Convertir explícitamente a booleano
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
    // Verificar límite de usuarios (máximo 10 incluyendo admin)
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");
    const maxUsers = parseInt(process.env.MAX_USERS || "10");

    if (userCount && userCount.count >= maxUsers) {
      return res.status(400).json({
        error: "Límite alcanzado",
        message: `Se ha alcanzado el límite máximo de ${maxUsers} usuarios`,
      });
    }

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

    // Insertar nuevo usuario (no admin por defecto)
    const result = await db.asyncRun(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    // Generar token JWT
    const userId = result.lastID;
    const token = jwt.sign(
      { id: userId, username, email },
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" }
    );

    // Responder con token y datos básicos del usuario
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      token,
      userId,
      username,
      email,
      isAdmin: false,
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
 * @desc    Obtener información del usuario autenticado
 * @access  Private
 */
router.get("/user", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener información completa del usuario
    const user = await db.asyncGet(
      "SELECT id, username, email, is_admin, force_password_change, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró el usuario con el ID proporcionado",
      });
    }

    // Devolver usuario sin la contraseña
    // Incluir isAdmin como booleano para mayor consistencia
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin, // Mantener el valor original
      isAdmin: user.is_admin === 1, // Añadir versión booleana
      force_password_change: user.force_password_change,
      created_at: user.created_at,
    });
  } catch (error) {
    console.error("Error al obtener información de usuario:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener información del usuario",
    });
  }
});

/**
 * @route   GET /api/auth/check-password-change
 * @desc    Verificar si el usuario debe cambiar su contraseña
 * @access  Private
 */
router.get("/check-password-change", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener información del usuario
    const user = await db.asyncGet(
      "SELECT force_password_change FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró el usuario con el ID proporcionado",
      });
    }

    res.json({
      requirePasswordChange: user.force_password_change === 1,
      message:
        user.force_password_change === 1
          ? "Se requiere cambio de contraseña"
          : "No se requiere cambio de contraseña",
    });
  } catch (error) {
    console.error("Error al verificar cambio de contraseña:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar si se requiere cambio de contraseña",
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar la contraseña del usuario
 * @access  Private
 */
router.post("/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Validar entrada
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requieren las contraseñas actual y nueva",
    });
  }

  try {
    // Obtener el usuario actual
    const user = await db.asyncGet("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró el usuario con el ID proporcionado",
      });
    }

    // Para el caso de primer inicio de sesión de admin con force_password_change=1,
    // permitir cualquier contraseña actual
    let skipPasswordCheck = false;
    if (
      user.is_admin === 1 &&
      user.force_password_change === 1 &&
      user.username === "admin"
    ) {
      skipPasswordCheck = true;
    } else {
      // Verificar contraseña actual
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({
          error: "Contraseña incorrecta",
          message: "La contraseña actual es incorrecta",
        });
      }
    }

    // Hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña y quitar flag de forzar cambio
    await db.asyncRun(
      "UPDATE users SET password = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [hashedPassword, userId]
    );

    res.json({
      message: "Contraseña cambiada exitosamente",
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
 * @route   POST /api/auth/create-invitation
 * @desc    Crear un código de invitación para nuevos usuarios
 * @access  Private (Admin)
 */
router.post("/create-invitation", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Verificar si el usuario es administrador
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user || user.is_admin !== 1) {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "Solo los administradores pueden crear invitaciones",
      });
    }

    // Verificar límite de usuarios (máximo 10 incluyendo admin)
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");
    const maxUsers = parseInt(process.env.MAX_USERS || "10");

    if (userCount && userCount.count >= maxUsers) {
      return res.status(400).json({
        error: "Límite alcanzado",
        message: `Se ha alcanzado el límite máximo de ${maxUsers} usuarios`,
      });
    }

    // Generar código aleatorio
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();

    // Calcular fecha de expiración con formato explícito para SQLite (1 hora desde ahora)
    // Asegurar que estamos usando el formato correcto para SQLite
    const nowTime = Math.floor(Date.now() / 1000); // Tiempo actual en segundos
    const oneHourInSeconds = 60 * 60; // 1 hora en segundos
    const expiryTime = nowTime + oneHourInSeconds;

    // Usar timestamp directo en formato de cadena ISO para SQLite
    const expiryDate = new Date(expiryTime * 1000).toISOString();

    await db.asyncRun(
      `INSERT INTO invitation_codes (code, created_by, expires_at) 
       VALUES (?, ?, ?)`,
      [code, userId, expiryDate]
    );

    // Obtener la fecha de expiración para incluirla en la respuesta
    const invitation = await db.asyncGet(
      "SELECT code, expires_at FROM invitation_codes WHERE code = ?",
      [code]
    );

    res.status(201).json({
      message: "Código de invitación creado exitosamente",
      code,
      expiresAt: invitation.expires_at,
    });
  } catch (error) {
    console.error("Error al crear código de invitación:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al crear código de invitación",
    });
  }
});

/**
 * @route   GET /api/auth/invitations
 * @desc    Obtener todos los códigos de invitación creados por el usuario
 * @access  Private (Admin)
 */
router.get("/invitations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Verificar si el usuario es administrador
    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user || user.is_admin !== 1) {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "Solo los administradores pueden ver invitaciones",
      });
    }

    // Obtener códigos de invitación
    const invitations = await db.asyncAll(
      `SELECT i.id, i.code, i.expires_at, i.used, i.created_at, 
              u.username as used_by_username, u.email as used_by_email
       FROM invitation_codes i
       LEFT JOIN users u ON i.used_by = u.id
       WHERE i.created_by = ?
       ORDER BY i.created_at DESC`,
      [userId]
    );

    res.json(invitations);
  } catch (error) {
    console.error("Error al obtener códigos de invitación:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener códigos de invitación",
    });
  }
});

/**
 * @route   GET /api/auth/verify-invitation
 * @desc    Verificar si un código de invitación es válido
 * @access  Public
 */
router.get("/verify-invitation", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({
      valid: false,
      message: "Se requiere un código de invitación",
    });
  }

  try {
    // Verificar si el código es válido y no ha expirado usando comparación adecuada para SQLite
    const invitation = await db.asyncGet(
      `SELECT * FROM invitation_codes 
       WHERE code = ? 
       AND used = 0 
       AND datetime(expires_at) > datetime('now')`,
      [code]
    );

    if (!invitation) {
      return res.json({
        valid: false,
        message: "El código de invitación es inválido o ha expirado",
      });
    }

    res.json({
      valid: true,
      message: "Código de invitación válido",
    });
  } catch (error) {
    console.error("Error al verificar código de invitación:", error);
    res.status(500).json({
      valid: false,
      message: "Error al verificar el código de invitación",
    });
  }
});

/**
 * @route   POST /api/auth/register-with-invitation
 * @desc    Registrar un nuevo usuario con código de invitación
 * @access  Public
 */
router.post("/register-with-invitation", async (req, res) => {
  const { username, email, password, invitationCode } = req.body;

  // Validar entrada
  if (!username || !email || !password || !invitationCode) {
    return res.status(400).json({
      error: "Datos incompletos",
      message:
        "Se requiere nombre de usuario, email, contraseña y código de invitación",
    });
  }

  try {
    // Verificar límite de usuarios (máximo según configuración)
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");
    const maxUsers = parseInt(process.env.MAX_USERS || "10");

    if (userCount && userCount.count >= maxUsers) {
      return res.status(400).json({
        error: "Límite alcanzado",
        message: `Se ha alcanzado el límite máximo de ${maxUsers} usuarios`,
      });
    }

    // Verificar si el código de invitación es válido
    const invitation = await db.asyncGet(
      `SELECT * FROM invitation_codes 
       WHERE code = ? AND used = 0 AND expires_at > datetime('now')`,
      [invitationCode]
    );

    if (!invitation) {
      return res.status(400).json({
        error: "Código inválido",
        message: "El código de invitación es inválido o ha expirado",
      });
    }

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

    const userId = result.lastID;

    // Marcar el código como usado
    await db.asyncRun(
      "UPDATE invitation_codes SET used = 1, used_by = ? WHERE id = ?",
      [userId, invitation.id]
    );

    // Generar token JWT
    const token = jwt.sign(
      { id: userId, username, email },
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" }
    );

    // Responder con token y datos básicos del usuario
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      token,
      userId,
      username,
      email,
      isAdmin: false,
    });
  } catch (error) {
    console.error("Error en registro con invitación:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al registrar usuario",
    });
  }
});

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Renovar token JWT
 * @access  Private
 */
router.post("/refresh-token", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener información actualizada del usuario
    const user = await db.asyncGet(
      "SELECT id, username, email, is_admin FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró el usuario con el ID proporcionado",
      });
    }

    // Generar nuevo token JWT
    const newToken = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      settings.jwtSecret || process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Token renovado exitosamente",
      token: newToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1,
      },
    });
  } catch (error) {
    console.error("Error al renovar token:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al renovar el token",
    });
  }
});

/**
 * @route   GET /api/auth/verify-admin
 * @desc    Verificar si el usuario es administrador
 * @access  Private
 */
router.get("/verify-admin", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user || !user.is_admin) {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "El usuario no tiene privilegios de administrador",
      });
    }

    res.json({
      isAdmin: true,
      message: "El usuario tiene privilegios de administrador",
    });
  } catch (error) {
    console.error("Error al verificar privilegios de administrador:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar privilegios de administrador",
    });
  }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Eliminar un usuario
 * @access  Admin
 */
router.delete("/users/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    // Verificar que el usuario existe
    const user = await db.asyncGet("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Usuario no encontrado",
      });
    }

    // No permitir eliminar al propio usuario administrador
    if (userId == req.user.id) {
      return res.status(400).json({
        error: "Operación no permitida",
        message: "No puedes eliminar tu propio usuario",
      });
    }

    // Comenzar transacción para eliminar usuario y sus datos relacionados
    await db.asyncRun("BEGIN TRANSACTION");

    // Eliminar datos relacionados (favoritos, historial, etc.)
    await db.asyncRun("DELETE FROM favorites WHERE user_id = ?", [userId]);
    await db.asyncRun("DELETE FROM watch_history WHERE user_id = ?", [userId]);
    await db.asyncRun("DELETE FROM user_settings WHERE user_id = ?", [userId]);
    await db.asyncRun("DELETE FROM sessions WHERE user_id = ?", [userId]);

    // Finalmente eliminar el usuario
    await db.asyncRun("DELETE FROM users WHERE id = ?", [userId]);

    // Confirmar transacción
    await db.asyncRun("COMMIT");

    res.json({
      message: "Usuario eliminado correctamente",
      userId: userId,
    });
  } catch (error) {
    // Hacer rollback en caso de error
    await db.asyncRun("ROLLBACK");

    console.error(`Error al eliminar usuario ${userId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al eliminar el usuario",
    });
  }
});

/**
 * @route   GET /api/admin/users/:id/libraries
 * @desc    Obtener acceso a bibliotecas de un usuario
 * @access  Admin
 */
router.get("/users/:id/libraries", async (req, res) => {
  const userId = req.params.id;

  try {
    // Verificar que el usuario existe
    const user = await db.asyncGet("SELECT id FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Usuario no encontrado",
      });
    }

    // Obtener todas las bibliotecas
    const libraries = await db.asyncAll("SELECT id FROM libraries");

    // Obtener permisos actuales del usuario
    const userPermissions = await db.asyncAll(
      "SELECT library_id, has_access FROM user_library_access WHERE user_id = ?",
      [userId]
    );

    // Convertir a un objeto para fácil acceso
    const access = {};
    userPermissions.forEach((perm) => {
      access[perm.library_id] = perm.has_access === 1;
    });

    // Los administradores tienen acceso implícito a todas las bibliotecas
    const isAdmin = await db.asyncGet(
      "SELECT is_admin FROM users WHERE id = ?",
      [userId]
    );
    const implicitAccess = isAdmin && isAdmin.is_admin === 1;

    // Si el usuario es admin, establecer acceso a todas las bibliotecas
    if (implicitAccess) {
      libraries.forEach((library) => {
        if (access[library.id] === undefined) {
          access[library.id] = true;
        }
      });
    }

    res.json({
      userId,
      access,
      implicitAccess,
    });
  } catch (error) {
    console.error(
      `Error al obtener acceso a bibliotecas para usuario ${userId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener acceso a bibliotecas",
    });
  }
});

/**
 * @route   POST /api/admin/users/:id/libraries
 * @desc    Actualizar acceso a bibliotecas de un usuario
 * @access  Admin
 */
router.post("/users/:id/libraries", async (req, res) => {
  const userId = req.params.id;
  const { access } = req.body;

  if (!access || typeof access !== "object") {
    return res.status(400).json({
      error: "Datos inválidos",
      message: "Se requiere un objeto 'access' con los permisos",
    });
  }

  try {
    // Verificar que el usuario existe
    const user = await db.asyncGet(
      "SELECT id, is_admin FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Usuario no encontrado",
      });
    }

    // Si el usuario es administrador, no necesita permisos específicos
    if (user.is_admin === 1) {
      return res.json({
        message: "Los administradores tienen acceso a todas las bibliotecas",
        userId,
      });
    }

    // Iniciar transacción
    await db.asyncRun("BEGIN TRANSACTION");

    // Eliminar permisos actuales
    await db.asyncRun("DELETE FROM user_library_access WHERE user_id = ?", [
      userId,
    ]);

    // Insertar nuevos permisos
    for (const [libraryId, hasAccess] of Object.entries(access)) {
      if (hasAccess) {
        await db.asyncRun(
          "INSERT INTO user_library_access (user_id, library_id, has_access) VALUES (?, ?, 1)",
          [userId, libraryId]
        );
      }
    }

    // Confirmar transacción
    await db.asyncRun("COMMIT");

    res.json({
      message: "Acceso a bibliotecas actualizado correctamente",
      userId,
    });
  } catch (error) {
    // Hacer rollback en caso de error
    await db.asyncRun("ROLLBACK");

    console.error(
      `Error al actualizar permisos de biblioteca para usuario ${userId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al actualizar acceso a bibliotecas",
    });
  }
});

module.exports = router;
