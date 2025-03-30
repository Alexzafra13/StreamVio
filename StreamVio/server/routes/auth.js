const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Public
 */
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  // Validar que se incluyan todos los campos requeridos
  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Todos los campos son obligatorios",
    });
  }

  try {
    // Verificar si el usuario ya existe
    db.get(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [email, username],
      async (err, user) => {
        if (err) {
          console.error("Error al consultar usuario:", err);
          return res.status(500).json({
            error: "Error del servidor",
            message: "Error al verificar usuario",
          });
        }

        if (user) {
          return res.status(400).json({
            error: "Usuario existente",
            message: "El email o nombre de usuario ya está registrado",
          });
        }

        // Generar hash de la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insertar el nuevo usuario
        const query =
          "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        db.run(query, [username, email, hashedPassword], function (err) {
          if (err) {
            console.error("Error al registrar usuario:", err);
            return res.status(500).json({
              error: "Error del servidor",
              message: "No se pudo completar el registro",
            });
          }

          // Generar token JWT
          const userId = this.lastID;
          const token = jwt.sign(
            { id: userId, username, email },
            process.env.JWT_SECRET || "streamvio_secret_key",
            { expiresIn: "24h" }
          );

          // Responder con el token y datos básicos del usuario
          res.status(201).json({
            message: "Usuario registrado exitosamente",
            userId,
            username,
            email,
            token,
          });
        });
      }
    );
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar el registro",
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar usuario y obtener token
 * @access  Public
 */
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Validar que se incluyan todos los campos requeridos
  if (!email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Email y contraseña son requeridos",
    });
  }

  // Buscar usuario por email
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      console.error("Error al consultar usuario:", err);
      return res.status(500).json({
        error: "Error del servidor",
        message: "Error al verificar credenciales",
      });
    }

    // Verificar si el usuario existe
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

    // Verificar si se requiere cambio de contraseña
    const requirePasswordChange = user.force_password_change === 1;

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "24h" }
    );

    // Responder con el token y datos básicos del usuario
    res.json({
      message: "Inicio de sesión exitoso",
      userId: user.id,
      username: user.username,
      email: user.email,
      token,
      requirePasswordChange,
    });
  });
});

/**
 * @route   GET /api/auth/user
 * @desc    Obtener información del usuario actual
 * @access  Private
 */
router.get("/user", authMiddleware, (req, res) => {
  // El middleware de autenticación ya ha validado el token
  // y ha agregado la información del usuario a req.user
  const { id } = req.user;

  db.get(
    "SELECT id, username, email, created_at, is_admin, force_password_change FROM users WHERE id = ?",
    [id],
    (err, user) => {
      if (err) {
        console.error("Error al obtener usuario:", err);
        return res.status(500).json({
          error: "Error del servidor",
          message: "Error al obtener información del usuario",
        });
      }

      if (!user) {
        return res.status(404).json({
          error: "No encontrado",
          message: "Usuario no encontrado",
        });
      }

      res.json(user);
    }
  );
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar la contraseña del usuario
 * @access  Private
 */
router.post("/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Validar que se incluyan todos los campos requeridos
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
    // Verificar la contraseña actual
    const user = await db.asyncGet(
      "SELECT password, force_password_change FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "El usuario no existe",
      });
    }

    // Para el usuario admin con contraseña temporal, no verificamos la contraseña actual
    // si es el primer cambio forzado
    let skipCurrentPasswordCheck = false;
    if (user.force_password_change === 1) {
      // Verificar si es el usuario admin con contraseña por defecto
      const adminCheck = await db.asyncGet(
        "SELECT username FROM users WHERE id = ? AND username = 'admin'",
        [userId]
      );
      if (adminCheck) {
        skipCurrentPasswordCheck = true;
      }
    }

    if (!skipCurrentPasswordCheck) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({
          error: "Contraseña incorrecta",
          message: "La contraseña actual es incorrecta",
        });
      }
    }

    // Generar hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar la contraseña y desactivar force_password_change
    await db.asyncRun(
      "UPDATE users SET password = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [hashedPassword, userId]
    );

    res.json({
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar el cambio de contraseña",
    });
  }
});

/**
 * @route   GET /api/auth/check-password-change
 * @desc    Verificar si el usuario necesita cambiar su contraseña
 * @access  Private
 */
router.get("/check-password-change", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await db.asyncGet(
      "SELECT force_password_change FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "El usuario no existe",
      });
    }

    res.json({
      requirePasswordChange: user.force_password_change === 1,
    });
  } catch (error) {
    console.error("Error al verificar estado de cambio de contraseña:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar estado de cambio de contraseña",
    });
  }
});

module.exports = router;
