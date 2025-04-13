// server/services/userService.js
const bcrypt = require("bcrypt");
const userRepository = require("../data/repositories/userRepository");
const libraryRepository = require("../data/repositories/libraryRepository");
const eventBus = require("./eventBus");

/**
 * Servicio para gestión de usuarios
 */
class UserService {
  /**
   * Obtener todos los usuarios
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Lista de usuarios
   */
  async getAllUsers(options = {}) {
    try {
      const { withLibraries = false } = options;

      // Obtener usuarios básicos
      const users = await userRepository.findAll(options);

      // Si se solicitan bibliotecas, obtenerlas para cada usuario
      if (withLibraries && users.length > 0) {
        for (const user of users) {
          user.libraries = await libraryRepository.findAccessibleByUser(
            user.id
          );
        }
      }

      // Eliminar campos sensibles
      return users.map((user) => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      throw error;
    }
  }

  /**
   * Obtener un usuario por su ID
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object|null>} - Usuario encontrado
   */
  async getUserById(userId, options = {}) {
    try {
      const { withLibraries = false } = options;

      // Obtener usuario
      const user = await userRepository.findById(userId);

      if (!user) {
        return null;
      }

      // Eliminar campos sensibles
      const { password, ...safeUser } = user;

      // Si se solicitan bibliotecas, obtenerlas
      if (withLibraries) {
        safeUser.libraries = await libraryRepository.findAccessibleByUser(
          userId
        );
      }

      return safeUser;
    } catch (error) {
      console.error(`Error al obtener usuario ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Crear un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - Usuario creado
   */
  async createUser(userData, options = {}) {
    try {
      const {
        username,
        email,
        password,
        isAdmin = false,
        forcePasswordChange = true,
      } = userData;

      // Validar entrada
      if (!username || !email || !password) {
        throw new Error("Se requiere nombre de usuario, email y contraseña");
      }

      // Verificar si el nombre de usuario ya existe
      const existingUsername = await userRepository.findByUsername(username);

      if (existingUsername) {
        throw new Error("Este nombre de usuario ya está en uso");
      }

      // Verificar si el email ya existe
      const existingEmail = await userRepository.findByEmail(email);

      if (existingEmail) {
        throw new Error("Este email ya está en uso");
      }

      // Hash de la contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Crear usuario
      const newUser = await userRepository.create({
        username,
        email,
        password: hashedPassword,
        isAdmin,
        forcePasswordChange,
      });

      // Eliminar campo de contraseña
      const { password: _, ...safeUser } = newUser;

      // Emitir evento de creación
      eventBus.emitEvent("user:created", {
        userId: newUser.id,
        username: newUser.username,
        isAdmin,
      });

      return safeUser;
    } catch (error) {
      console.error("Error al crear usuario:", error);
      throw error;
    }
  }

  /**
   * Actualizar un usuario existente
   * @param {number} userId - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<Object>} - Usuario actualizado
   */
  async updateUser(userId, userData) {
    try {
      // Verificar que el usuario existe
      const user = await userRepository.findById(userId);

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // Preparar datos para actualización
      const updateData = {};

      if (userData.username) {
        // Verificar si el nombre de usuario ya está en uso
        const existingUsername = await userRepository.findByUsername(
          userData.username
        );

        if (existingUsername && existingUsername.id !== userId) {
          throw new Error("Este nombre de usuario ya está en uso");
        }

        updateData.username = userData.username;
      }

      if (userData.email) {
        // Verificar si el email ya está en uso
        const existingEmail = await userRepository.findByEmail(userData.email);

        if (existingEmail && existingEmail.id !== userId) {
          throw new Error("Este email ya está en uso");
        }

        updateData.email = userData.email;
      }

      if (userData.isAdmin !== undefined) {
        updateData.isAdmin = userData.isAdmin;
      }

      if (userData.forcePasswordChange !== undefined) {
        updateData.forcePasswordChange = userData.forcePasswordChange;
      }

      // Si hay un cambio de contraseña
      if (userData.password) {
        // Hash de la contraseña
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(userData.password, salt);
      }

      // Si no hay campos para actualizar
      if (Object.keys(updateData).length === 0) {
        // Devolver usuario sin actualizar
        const { password, ...safeUser } = user;
        return safeUser;
      }

      // Actualizar usuario
      const updatedUser = await userRepository.update(userId, updateData);

      // Eliminar campo de contraseña
      const { password, ...safeUser } = updatedUser;

      // Emitir evento de actualización
      eventBus.emitEvent("user:updated", {
        userId,
        updatedFields: Object.keys(updateData),
      });

      return safeUser;
    } catch (error) {
      console.error(`Error al actualizar usuario ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Cambiar estado de administrador de un usuario
   * @param {number} userId - ID del usuario
   * @param {number} adminId - ID del administrador que realiza el cambio
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async toggleAdmin(userId, adminId) {
    try {
      // Verificar que el usuario existe
      const user = await userRepository.findById(userId);

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // No permitir cambiar sus propios privilegios
      if (userId === adminId) {
        throw new Error(
          "No puedes cambiar tus propios privilegios de administrador"
        );
      }

      // Cambiar estado de administrador
      const newAdminStatus = user.is_admin === 1 ? 0 : 1;

      await userRepository.update(userId, {
        isAdmin: !!newAdminStatus, // Convertir a booleano
      });

      // Emitir evento
      eventBus.emitEvent("user:admin-toggled", {
        userId,
        isAdmin: !!newAdminStatus,
        updatedBy: adminId,
      });

      return {
        userId,
        isAdmin: !!newAdminStatus,
        message: newAdminStatus
          ? "Privilegios de administrador activados correctamente"
          : "Privilegios de administrador desactivados correctamente",
      };
    } catch (error) {
      console.error(
        `Error al cambiar estado de administrador del usuario ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Eliminar un usuario
   * @param {number} userId - ID del usuario a eliminar
   * @param {number} adminId - ID del administrador que realiza la eliminación
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async deleteUser(userId, adminId) {
    try {
      // Verificar que el usuario existe
      const user = await userRepository.findById(userId);

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // No permitir eliminar al propio usuario administrador
      if (userId === adminId) {
        throw new Error("No puedes eliminar tu propio usuario");
      }

      // Emitir evento antes de eliminar
      eventBus.emitEvent("user:deleting", {
        userId,
        username: user.username,
        deletedBy: adminId,
      });

      // Eliminar usuario
      const result = await userRepository.delete(userId);

      if (!result) {
        throw new Error("Error al eliminar el usuario");
      }

      // Emitir evento después de eliminar
      eventBus.emitEvent("user:deleted", {
        userId,
        username: user.username,
        deletedBy: adminId,
      });

      return true;
    } catch (error) {
      console.error(`Error al eliminar usuario ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener el historial de visualización de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Historial de visualización
   */
  async getWatchHistory(userId, options = {}) {
    try {
      const { limit = 10, includeCompleted = false } = options;

      const db = require("../data/db");

      // Construir consulta para obtener historial con detalles
      const query = `
        SELECT 
          wh.id,
          wh.media_id,
          wh.position,
          wh.completed,
          wh.watched_at,
          m.title,
          m.type,
          m.duration,
          m.thumbnail_path,
          l.id as library_id,
          l.name as library_name
        FROM 
          watch_history wh
        JOIN 
          media_items m ON wh.media_id = m.id
        JOIN
          libraries l ON m.library_id = l.id
        WHERE 
          wh.user_id = ? 
          ${
            !includeCompleted
              ? "AND (wh.completed = 0 OR wh.completed IS NULL)"
              : ""
          }
        ORDER BY 
          wh.watched_at DESC
        LIMIT ?
      `;

      return db.asyncAll(query, [userId, limit]);
    } catch (error) {
      console.error(
        `Error al obtener historial de visualización para usuario ${userId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Obtener bibliotecas accesibles para un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Bibliotecas accesibles
   */
  async getAccessibleLibraries(userId, options = {}) {
    try {
      return await libraryRepository.findAccessibleByUser(
        userId,
        options.includeItemCount || false
      );
    } catch (error) {
      console.error(
        `Error al obtener bibliotecas para usuario ${userId}:`,
        error
      );
      return [];
    }
  }
}

module.exports = new UserService();
