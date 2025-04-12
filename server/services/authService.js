// server/services/authService.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const db = require("../config/database");
const settings = require("../config/settings");

/**
 * Servicio para manejar la autenticación y permisos
 */
class AuthService {
  constructor() {
    this.jwtSecret =
      process.env.JWT_SECRET || settings.jwtSecret || "streamvio_secret_key";
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d"; // 7 días por defecto
  }

  /**
   * Genera un token JWT para un usuario
   * @param {Object} user - Datos del usuario
   * @returns {string} Token JWT generado
   */
  generateToken(user) {
    // Datos que se incluirán en el token
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin === 1,
    };

    // Generar y firmar el token
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  /**
   * Verifica un token JWT
   * @param {string} token - Token a verificar
   * @returns {Object} Datos decodificados del token o null si es inválido
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      console.error("Error al verificar token JWT:", error);
      return null;
    }
  }

  /**
   * Verifica las credenciales de un usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object>} Datos del usuario si las credenciales son válidas
   */
  async verifyCredentials(email, password) {
    try {
      // Buscar usuario por email
      const user = await db.asyncGet(
        "SELECT id, username, email, password, is_admin, force_password_change FROM users WHERE email = ?",
        [email]
      );

      if (!user) {
        throw new Error("Credenciales inválidas");
      }

      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error("Credenciales inválidas");
      }

      // Eliminar la contraseña hash del objeto usuario
      delete user.password;

      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Inicia sesión de un usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object>} Datos de sesión y usuario
   */
  async login(email, password) {
    try {
      // Verificar credenciales
      const user = await this.verifyCredentials(email, password);

      // Generar token JWT
      const token = this.generateToken(user);

      try {
        // Registrar sesión en la base de datos
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7); // Sesión válida por 7 días

        await db.asyncRun(
          `INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [user.id, token, "Web Client", "N/A", expiryDate.toISOString()]
        );
      } catch (sessionError) {
        console.error("Error al registrar sesión:", sessionError);
        // No impedir el login si falla la inserción de la sesión
      }

      try {
        // Registrar inicio de sesión en historial
        await db.asyncRun(
          `INSERT INTO user_history (user_id, media_id, action_type) 
           VALUES (?, NULL, 'login')`,
          [user.id]
        );
      } catch (historyError) {
        console.error("Error al registrar historial:", historyError);
        // No impedir el login si falla el registro de historial
      }

      return {
        token,
        userId: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1,
        forcePasswordChange: user.force_password_change === 1,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Registra un nuevo usuario
   * @param {Object} userData - Datos del nuevo usuario
   * @returns {Promise<Object>} Datos del usuario creado
   */
  async register(userData) {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await db.asyncGet(
        "SELECT id FROM users WHERE username = ? OR email = ?",
        [userData.username, userData.email]
      );

      if (existingUser) {
        throw new Error("El nombre de usuario o email ya está en uso");
      }

      // Hash de la contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Insertar el nuevo usuario
      const result = await db.asyncRun(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [userData.username, userData.email, hashedPassword]
      );

      // Obtener el ID del usuario creado
      const userId = result.lastID;

      // Generar token JWT
      const token = this.generateToken({
        id: userId,
        username: userData.username,
        email: userData.email,
        is_admin: 0,
      });

      try {
        // Registrar sesión
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        await db.asyncRun(
          `INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [userId, token, "Web Client", "N/A", expiryDate.toISOString()]
        );
      } catch (sessionError) {
        console.error("Error al registrar sesión:", sessionError);
        // No impedir el registro si falla la inserción de la sesión
      }

      return {
        token,
        userId,
        username: userData.username,
        email: userData.email,
        isAdmin: false,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cierra la sesión de un usuario
   * @param {number} userId - ID del usuario
   */
  async logout(userId) {
    try {
      try {
        // Registrar cierre de sesión
        await db.asyncRun(
          `INSERT INTO user_history (user_id, media_id, action_type) 
           VALUES (?, NULL, 'logout')`,
          [userId]
        );
      } catch (historyError) {
        console.error("Error al registrar historial de logout:", historyError);
      }

      try {
        // Invalidar todas las sesiones del usuario
        await db.asyncRun(
          "UPDATE sessions SET expires_at = datetime('now', '-1 minute') WHERE user_id = ?",
          [userId]
        );
      } catch (sessionError) {
        console.error("Error al invalidar sesiones:", sessionError);
      }

      return { success: true };
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cambia la contraseña de un usuario
   * @param {number} userId - ID del usuario
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<Object>} Resultado de la operación
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Obtener datos del usuario
      const user = await db.asyncGet(
        "SELECT password, username, email, is_admin FROM users WHERE id = ?",
        [userId]
      );

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // Verificar contraseña actual (excepto para administradores en su primer inicio de sesión)
      const isAdmin = user.is_admin === 1;
      const needsCheck = !(isAdmin && currentPassword === "admin");

      if (needsCheck) {
        const isPasswordValid = await bcrypt.compare(
          currentPassword,
          user.password
        );
        if (!isPasswordValid) {
          throw new Error("La contraseña actual es incorrecta");
        }
      }

      // Hash de la nueva contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Actualizar contraseña y quitar flag de cambio forzado
      await db.asyncRun(
        "UPDATE users SET password = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [hashedPassword, userId]
      );

      // Generar nuevo token con fecha de expiración actualizada
      const newToken = this.generateToken({
        id: userId,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
      });

      try {
        // Invalidar todas las sesiones anteriores
        await db.asyncRun(
          "UPDATE sessions SET expires_at = datetime('now', '-1 minute') WHERE user_id = ? AND token <> ?",
          [userId, newToken]
        );

        // Crear nueva sesión
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        await db.asyncRun(
          `INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [userId, newToken, "Web Client", "N/A", expiryDate.toISOString()]
        );
      } catch (sessionError) {
        console.error(
          "Error al gestionar sesiones para cambio de contraseña:",
          sessionError
        );
      }

      return {
        success: true,
        message: "Contraseña actualizada correctamente",
        token: newToken,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verifica si un usuario tiene acceso a una biblioteca
   * @param {number} userId - ID del usuario
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<boolean>} true si tiene acceso, false si no
   */
  async hasLibraryAccess(userId, libraryId) {
    try {
      // Verificar si el usuario es administrador
      const user = await db.asyncGet(
        "SELECT is_admin FROM users WHERE id = ?",
        [userId]
      );

      // Los administradores tienen acceso a todas las bibliotecas
      if (user && user.is_admin === 1) {
        return true;
      }

      // Verificar acceso específico a la biblioteca
      const access = await db.asyncGet(
        "SELECT has_access FROM user_library_access WHERE user_id = ? AND library_id = ?",
        [userId, libraryId]
      );

      return access && access.has_access === 1;
    } catch (error) {
      console.error("Error al verificar acceso a biblioteca:", error);
      return false;
    }
  }
}

// Exportar una instancia del servicio
const authService = new AuthService();
module.exports = authService;
