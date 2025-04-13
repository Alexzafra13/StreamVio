// server/services/libraryService.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const libraryRepository = require("../data/repositories/libraryRepository");
const userRepository = require("../data/repositories/userRepository");
const mediaRepository = require("../data/repositories/mediaRepository");
const scannerService = require("./scannerService");
const eventBus = require("./eventBus");

// Promisificar operaciones de fs
const access = promisify(fs.access);
const stat = promisify(fs.stat);

/**
 * Servicio para gestión de bibliotecas
 */
class LibraryService {
  /**
   * Obtener todas las bibliotecas accesibles para un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} - Lista de bibliotecas
   */
  async getAccessibleLibraries(userId, options = {}) {
    const { includeStats = false } = options;

    try {
      // Obtener bibliotecas accesibles del repositorio
      const libraries = await libraryRepository.findAccessibleByUser(
        userId,
        true
      );

      // Si se solicitan estadísticas, obtener detalles adicionales
      if (includeStats && libraries.length > 0) {
        for (const library of libraries) {
          library.stats = await this.getLibraryStats(library.id);
        }
      }

      return libraries;
    } catch (error) {
      console.error("Error al obtener bibliotecas accesibles:", error);
      throw error;
    }
  }

  /**
   * Obtener una biblioteca por ID con verificación de acceso
   * @param {number} libraryId - ID de la biblioteca
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - Biblioteca encontrada
   */
  async getLibraryById(libraryId, userId, options = {}) {
    const { includeStats = false } = options;

    try {
      // Verificar si el usuario es administrador
      const isAdmin = await userRepository.isAdmin(userId);

      // Obtener la biblioteca
      const library = await libraryRepository.findById(libraryId);

      if (!library) {
        throw new Error("Biblioteca no encontrada");
      }

      // Si no es administrador, verificar acceso
      if (!isAdmin) {
        const hasAccess = await this.checkAccess(userId, libraryId);

        if (!hasAccess) {
          throw new Error("No tienes permiso para acceder a esta biblioteca");
        }
      }

      // Si se solicitan estadísticas, obtener detalles adicionales
      if (includeStats) {
        library.stats = await this.getLibraryStats(library.id);
      }

      return library;
    } catch (error) {
      console.error(`Error al obtener biblioteca ${libraryId}:`, error);
      throw error;
    }
  }

  /**
   * Verificar si un usuario tiene acceso a una biblioteca
   * @param {number} userId - ID del usuario
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<boolean>} - true si tiene acceso
   */
  async checkAccess(userId, libraryId) {
    try {
      // Verificar si el usuario es administrador
      const isAdmin = await userRepository.isAdmin(userId);

      // Los administradores tienen acceso a todo
      if (isAdmin) {
        return true;
      }

      // Verificar acceso específico
      const db = require("../data/db");
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

  /**
   * Obtener estadísticas de una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @returns {Promise<Object>} - Estadísticas de la biblioteca
   */
  async getLibraryStats(libraryId) {
    try {
      // Inicializar estadísticas
      const stats = {
        totalItems: 0,
        byType: {},
        recentlyAdded: [],
        lastScan: null,
        diskSpace: 0,
      };

      // Obtener recuento total
      stats.totalItems = await mediaRepository.countByLibrary(libraryId);

      // Obtener recuento por tipo
      const types = ["movie", "series", "episode", "music", "photo"];
      for (const type of types) {
        stats.byType[type] = await mediaRepository.countByLibrary(
          libraryId,
          type
        );
      }

      // Obtener elementos recientes (últimos 10)
      const recentItems = await db.asyncAll(
        "SELECT id, title, type, thumbnail_path, created_at FROM media_items WHERE library_id = ? ORDER BY created_at DESC LIMIT 10",
        [libraryId]
      );
      stats.recentlyAdded = recentItems || [];

      // Obtener fecha del último escaneo
      const library = await libraryRepository.findById(libraryId);
      stats.lastScan = library ? library.updated_at : null;

      // Obtener espacio en disco usado
      const totalSizeResult = await db.asyncGet(
        "SELECT SUM(size) as total_size FROM media_items WHERE library_id = ? AND size IS NOT NULL",
        [libraryId]
      );

      stats.diskSpace =
        totalSizeResult && totalSizeResult.total_size
          ? totalSizeResult.total_size
          : 0;

      return stats;
    } catch (error) {
      console.error(
        `Error al obtener estadísticas de biblioteca ${libraryId}:`,
        error
      );
      // Devolver estadísticas básicas en caso de error
      return {
        totalItems: 0,
        byType: {},
        recentlyAdded: [],
        lastScan: null,
        diskSpace: 0,
      };
    }
  }

  /**
   * Crear una nueva biblioteca
   * @param {Object} libraryData - Datos de la biblioteca
   * @param {number} userId - ID del usuario que crea la biblioteca
   * @returns {Promise<Object>} - Biblioteca creada
   */
  async createLibrary(libraryData, userId) {
    try {
      const {
        name,
        path: libraryPath,
        type,
        scan_automatically = true,
      } = libraryData;

      // Validar los datos
      if (!name || !libraryPath || !type) {
        throw new Error("Se requiere nombre, ruta y tipo de biblioteca");
      }

      // Validar el tipo
      const validTypes = ["movies", "series", "music", "photos"];
      if (!validTypes.includes(type)) {
        throw new Error(`El tipo debe ser uno de: ${validTypes.join(", ")}`);
      }

      // Verificar que la ruta existe
      try {
        const pathExists = fs.existsSync(libraryPath);
        if (!pathExists) {
          throw new Error("La ruta especificada no existe");
        }

        // Verificar permisos de lectura
        await access(libraryPath, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`Error de acceso: ${error.message}`);
      }

      // Verificar si ya existe una biblioteca con la misma ruta
      const existingLibrary = await libraryRepository.findByPath(libraryPath);

      if (existingLibrary) {
        throw new Error("Ya existe una biblioteca con la misma ruta");
      }

      // Crear la biblioteca
      const newLibrary = await libraryRepository.create({
        name,
        path: libraryPath,
        type,
        scan_automatically,
      });

      // Emitir evento de creación de biblioteca
      eventBus.emitEvent("library:created", {
        libraryId: newLibrary.id,
        name: newLibrary.name,
        path: newLibrary.path,
        type: newLibrary.type,
        createdBy: userId,
      });

      // Si el usuario no es administrador, darle acceso a la biblioteca recién creada
      const isAdmin = await userRepository.isAdmin(userId);
      if (!isAdmin) {
        await libraryRepository.updateUserAccess(newLibrary.id, userId, true);
      }

      // Si se configuró escaneo automático, iniciarlo en segundo plano
      if (scan_automatically) {
        setTimeout(() => {
          scannerService.scanLibrary(newLibrary.id).catch((error) => {
            console.error(
              `Error en escaneo inicial de biblioteca ${newLibrary.id}:`,
              error
            );
          });
        }, 1000); // Retrasar un poco para que la respuesta se envíe primero
      }

      return newLibrary;
    } catch (error) {
      console.error("Error al crear biblioteca:", error);
      throw error;
    }
  }

  /**
   * Actualizar una biblioteca existente
   * @param {number} libraryId - ID de la biblioteca
   * @param {Object} libraryData - Datos a actualizar
   * @param {number} userId - ID del usuario que realiza la actualización
   * @returns {Promise<Object>} - Biblioteca actualizada
   */
  async updateLibrary(libraryId, libraryData, userId) {
    try {
      // Verificar que la biblioteca existe
      const library = await libraryRepository.findById(libraryId);

      if (!library) {
        throw new Error("Biblioteca no encontrada");
      }

      // Validar datos
      const updates = {};

      if (libraryData.name) {
        updates.name = libraryData.name;
      }

      if (libraryData.path) {
        // Verificar que la ruta existe
        try {
          const pathExists = fs.existsSync(libraryData.path);
          if (!pathExists) {
            throw new Error("La ruta especificada no existe");
          }

          // Verificar permisos de lectura
          await access(libraryData.path, fs.constants.R_OK);
        } catch (error) {
          throw new Error(`Error de acceso: ${error.message}`);
        }

        updates.path = libraryData.path;
      }

      if (libraryData.type) {
        // Validar el tipo
        const validTypes = ["movies", "series", "music", "photos"];
        if (!validTypes.includes(libraryData.type)) {
          throw new Error(`El tipo debe ser uno de: ${validTypes.join(", ")}`);
        }

        updates.type = libraryData.type;
      }

      if (libraryData.scan_automatically !== undefined) {
        updates.scan_automatically = libraryData.scan_automatically;
      }

      // Actualizar la biblioteca
      const updatedLibrary = await libraryRepository.update(libraryId, updates);

      // Emitir evento de actualización
      eventBus.emitEvent("library:updated", {
        libraryId,
        updates,
        updatedBy: userId,
      });

      // Si se cambió la ruta o el tipo, sugerir un nuevo escaneo
      if (updates.path || updates.type) {
        updatedLibrary.needsScan = true;
      }

      return updatedLibrary;
    } catch (error) {
      console.error(`Error al actualizar biblioteca ${libraryId}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {number} userId - ID del usuario que realiza la eliminación
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async deleteLibrary(libraryId, userId, options = {}) {
    const { deleteFiles = false } = options;

    try {
      // Verificar que la biblioteca existe
      const library = await libraryRepository.findById(libraryId);

      if (!library) {
        throw new Error("Biblioteca no encontrada");
      }

      // Emitir evento antes de eliminar
      eventBus.emitEvent("library:deleting", {
        libraryId,
        name: library.name,
        deletedBy: userId,
        deleteFiles,
      });

      // Si se seleccionó eliminar archivos físicos, obtener lista de archivos primero
      let filesToDelete = [];

      if (deleteFiles) {
        const mediaItems = await mediaRepository.findByLibrary(libraryId, {
          limit: 1000000,
        }); // Sin límite práctico
        filesToDelete = mediaItems
          .filter((item) => item.file_path)
          .map((item) => item.file_path);
      }

      // Eliminar la biblioteca de la base de datos
      await libraryRepository.delete(libraryId);

      // Si se solicitó eliminar archivos físicos, hacerlo en segundo plano
      if (deleteFiles && filesToDelete.length > 0) {
        // Esto se ejecutará en segundo plano para no bloquear la respuesta
        setTimeout(async () => {
          console.log(
            `Eliminando ${filesToDelete.length} archivos físicos de la biblioteca ${libraryId}`
          );

          for (const filePath of filesToDelete) {
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            } catch (deleteError) {
              console.error(
                `Error al eliminar archivo ${filePath}:`,
                deleteError
              );
            }
          }

          console.log(
            `Eliminación de archivos físicos completada para biblioteca ${libraryId}`
          );
        }, 100);
      }

      // Emitir evento después de eliminar
      eventBus.emitEvent("library:deleted", {
        libraryId,
        name: library.name,
        deletedBy: userId,
        deleteFiles,
        filesToDelete: filesToDelete.length,
      });

      return true;
    } catch (error) {
      console.error(`Error al eliminar biblioteca ${libraryId}:`, error);
      throw error;
    }
  }

  /**
   * Gestionar acceso de usuarios a una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {number} userId - ID del usuario para modificar acceso
   * @param {boolean} hasAccess - Si debe tener acceso o no
   * @param {number} adminId - ID del administrador que modifica el acceso
   * @returns {Promise<boolean>} - true si se actualizó correctamente
   */
  async updateUserAccess(libraryId, userId, hasAccess, adminId) {
    try {
      // Verificar que la biblioteca existe
      const library = await libraryRepository.findById(libraryId);

      if (!library) {
        throw new Error("Biblioteca no encontrada");
      }

      // Verificar que el usuario existe
      const user = await userRepository.findById(userId);

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // Si el usuario es administrador, no necesita permisos explícitos
      if (user.is_admin === 1) {
        return true;
      }

      // Actualizar acceso
      await libraryRepository.updateUserAccess(libraryId, userId, hasAccess);

      // Emitir evento
      eventBus.emitEvent("library:access-updated", {
        libraryId,
        userId,
        hasAccess,
        updatedBy: adminId,
      });

      return true;
    } catch (error) {
      console.error(
        `Error al actualizar acceso a biblioteca ${libraryId} para usuario ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtener usuarios con acceso a una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {boolean} includeAdmins - Incluir usuarios administradores
   * @returns {Promise<Array>} - Lista de usuarios con información de acceso
   */
  async getUserAccess(libraryId, includeAdmins = true) {
    try {
      // Verificar que la biblioteca existe
      const library = await libraryRepository.findById(libraryId);

      if (!library) {
        throw new Error("Biblioteca no encontrada");
      }

      // Obtener usuarios y sus permisos
      const users = await libraryRepository.getUserAccess(libraryId);

      // Si no se solicitan administradores, filtrarlos
      if (!includeAdmins) {
        return users.filter((user) => user.is_admin !== 1);
      }

      return users;
    } catch (error) {
      console.error(
        `Error al obtener usuarios con acceso a biblioteca ${libraryId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Escanear una biblioteca
   * @param {number} libraryId - ID de la biblioteca
   * @param {number} userId - ID del usuario que inicia el escaneo
   * @returns {Promise<Object>} - Información del escaneo iniciado
   */
  async scanLibrary(libraryId, userId) {
    try {
      // Verificar que la biblioteca existe
      const library = await libraryRepository.findById(libraryId);

      if (!library) {
        throw new Error("Biblioteca no encontrada");
      }

      // Iniciar el escaneo en segundo plano (devolver inmediatamente)
      scannerService.scanLibrary(libraryId).catch((error) => {
        console.error(`Error al escanear biblioteca ${libraryId}:`, error);
      });

      return {
        libraryId,
        status: "scanning",
        message: "Escaneo iniciado",
        startedBy: userId,
        startedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `Error al iniciar escaneo de biblioteca ${libraryId}:`,
        error
      );
      throw error;
    }
  }
}
