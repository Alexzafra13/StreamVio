// server/services/authService.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const userRepository = require("../data/repositories/userRepository");
const environment = require("../config/environment");
const eventBus = require("./eventBus");

/**
 * Servicio para gestión de autenticación y autorización
 */
class AuthService {
  /**
   * Verifica si es la primera ejecución (sin usuarios)
   * @returns {Promise<boolean>} - true si no hay usuarios
   */
  async isFirstTime() {
    const userCount = await userRepository.count();
    return userCount === 0;
  }

  /**
   * Configurar el primer usuario administrador
   * @param {Object} userData - Datos del usuario (username, email, password)
   * @returns {Promise<Object>} - Usuario creado con token JWT
   */
  async setupFirstUser(userData) {
    // Verificar que no haya usuarios existentes
    const userCount = await userRepository.count();

    if (userCount > 0) {
      throw new Error("Ya existe al menos un usuario en el sistema");
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Crear usuario administrador
    const newUser = await userRepository.create({
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      isAdmin: true,
    });

    // Generar token JWT
    const token = this.generateToken(newUser);

    // Emitir evento de creación de usuario
    eventBus.emitEvent("user:created", {
      userId: newUser.id,
      username: newUser.username,
      isAdmin: true,
      isFirstUser: true,
    });

    return {
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        isAdmin: true,
      },
    };
  }

  /**
   * Iniciar sesión de usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object>} - Datos de sesión con token JWT
   */
  async login(email, password) {
    // Buscar usuario por email
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new Error("Credenciales inválidas");
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Credenciales inválidas");
    }

    // Generar token JWT
    const token = this.generateToken(user);

    // Registrar la sesión en la base de datos
    await this.createSession(user.id, token);

    // Emitir evento de inicio de sesión
    eventBus.emitEvent("user:login", {
      userId: user.id,
      username: user.username,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1,
        requirePasswordChange: user.force_password_change === 1,
      },
    };
  }

  /**
   * Generar token JWT para un usuario
   * @param {Object} user - Usuario para el que generar el token
   * @returns {string} - Token JWT
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1,
      },
      environment.JWT_SECRET,
      { expiresIn: environment.JWT_EXPIRY }
    );
  }

  /**
   * Crear registro de sesión en la base de datos
   * @param {number} userId - ID del usuario
   * @param {string} token - Token JWT
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - Sesión creada
   */
  async createSession(userId, token, options = {}) {
    const { deviceInfo, ipAddress } = options;

    // Calcular fecha de expiración
    const expiresAt = new Date();
    // Parsear el tiempo de expiración (ejemplo: '7d' -> 7 días)
    const expiryMatch = environment.JWT_EXPIRY.match(/^(\d+)([smhd])$/);

    if (expiryMatch) {
      const [, amount, unit] = expiryMatch;

      switch (unit) {
        case "s": // segundos
          expiresAt.setSeconds(expiresAt.getSeconds() + parseInt(amount));
          break;
        case "m": // minutos
          expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(amount));
          break;
        case "h": // horas
          expiresAt.setHours(expiresAt.getHours() + parseInt(amount));
          break;
        case "d": // días
          expiresAt.setDate(expiresAt.getDate() + parseInt(amount));
          break;
      }
    } else {
      // Si no se pudo parsear, usar 1 día por defecto
      expiresAt.setDate(expiresAt.getDate() + 1);
    }

    // Guardar en la base de datos
    const db = require("../data/db");

    try {
      await db.asyncRun(
        "INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)",
        [
          userId,
          token,
          deviceInfo || null,
          ipAddress || null,
          expiresAt.toISOString(),
        ]
      );
    } catch (error) {
      console.error("Error al crear sesión:", error);
      // Si falla, continuar sin problema, no es crítico
    }

    return {
      userId,
      token,
      expiresAt,
    };
  }

  /**
   * Verificar si un token es válido y no ha expirado
   * @param {string} token - Token JWT a verificar
   * @returns {Promise<Object|null>} - Datos del usuario si el token es válido
   */
  async verifyToken(token) {
    try {
      // Verificar firma del token
      const decoded = jwt.verify(token, environment.JWT_SECRET);

      // Verificar que el usuario existe en la base de datos
      const user = await userRepository.findById(decoded.id);

      if (!user) {
        return null;
      }

      // Verificar que el token no haya sido revocado
      const db = require("../data/db");
      const session = await db.asyncGet(
        "SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
        [token]
      );

      if (!session) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Cerrar sesión (invalidar token)
   * @param {string} token - Token JWT a invalidar
   * @returns {Promise<boolean>} - true si se cerró la sesión correctamente
   */
  async logout(token) {
    try {
      const db = require("../data/db");

      // Eliminar el token de la base de datos
      await db.asyncRun("DELETE FROM sessions WHERE token = ?", [token]);

      return true;
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      return false;
    }
  }

  /**
   * Cambiar contraseña del usuario
   * @param {number} userId - ID del usuario
   * @param {string} currentPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<boolean>} - true si se cambió correctamente
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Buscar usuario
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Verificar contraseña actual
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      throw new Error("Contraseña actual incorrecta");
    }

    // Hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña y quitar flag de forzar cambio
    await userRepository.update(userId, {
      password: hashedPassword,
      forcePasswordChange: false,
    });

    // Emitir evento de cambio de contraseña
    eventBus.emitEvent("user:password-changed", {
      userId,
      forcedChange: user.force_password_change === 1,
    });

    return true;
  }

  /**
   * Crear un código de invitación
   * @param {number} createdBy - ID del usuario que crea la invitación
   * @param {Object} options - Opciones adicionales (expiración)
   * @returns {Promise<Object>} - Código de invitación generado
   */
  async createInvitationCode(createdBy, options = {}) {
    const { expiresInHours = 24 } = options;

    // Generar código aleatorio
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();

    // Calcular fecha de expiración
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Guardar en la base de datos
    const db = require("../data/db");

    await db.asyncRun(
      "INSERT INTO invitation_codes (code, created_by, expires_at) VALUES (?, ?, ?)",
      [code, createdBy, expiresAt.toISOString()]
    );

    // Emitir evento de creación de invitación
    eventBus.emitEvent("invitation:created", {
      code,
      createdBy,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      code,
      createdBy,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Verificar si un código de invitación es válido
   * @param {string} code - Código de invitación
   * @returns {Promise<boolean>} - true si el código es válido
   */
  async verifyInvitationCode(code) {
    const db = require("../data/db");

    const invitation = await db.asyncGet(
      "SELECT * FROM invitation_codes WHERE code = ? AND expires_at > CURRENT_TIMESTAMP AND used = 0",
      [code]
    );

    return !!invitation;
  }

  /**
   * Registrar un nuevo usuario con un código de invitación
   * @param {Object} userData - Datos del usuario (username, email, password)
   * @param {string} invitationCode - Código de invitación
   * @returns {Promise<Object>} - Usuario creado con token JWT
   */
  async registerWithInvitation(userData, invitationCode) {
    const db = require("../data/db");

    // Verificar el código de invitación
    const invitation = await db.asyncGet(
      "SELECT * FROM invitation_codes WHERE code = ? AND expires_at > CURRENT_TIMESTAMP AND used = 0",
      [invitationCode]
    );

    if (!invitation) {
      throw new Error("Código de invitación inválido o expirado");
    }

    // Verificar si el email o username ya están en uso
    const existingEmail = await userRepository.findByEmail(userData.email);
    if (existingEmail) {
      throw new Error("Este email ya está en uso");
    }

    const existingUsername = await userRepository.findByUsername(
      userData.username
    );
    if (existingUsername) {
      throw new Error("Este nombre de usuario ya está en uso");
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Crear usuario
    const newUser = await userRepository.create({
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      isAdmin: false, // Los usuarios por invitación no son administradores por defecto
    });

    // Marcar el código de invitación como usado
    await db.asyncRun(
      "UPDATE invitation_codes SET used = 1, used_by = ? WHERE id = ?",
      [newUser.id, invitation.id]
    );

    // Generar token JWT
    const token = this.generateToken(newUser);

    // Emitir evento de registro
    eventBus.emitEvent("user:registered", {
      userId: newUser.id,
      username: newUser.username,
      invitationCode,
      invitedBy: invitation.created_by,
    });

    return {
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        isAdmin: false,
      },
    };
  }
}

module.exports = new AuthService();
