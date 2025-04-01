const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Rutas existentes

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
    if (!isPasswordValid) {
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

    // Generar un nuevo token JWT con el nuevo email
    const token = jwt.sign(
      { id: userId, username: user.username, email: email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "24h" }
    );

    res.json({
      message: "Configuración de administrador completada exitosamente",
      email,
      token,
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
