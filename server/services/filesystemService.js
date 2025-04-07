// server/services/filesystemService.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const os = require("os");

// Promisificar operaciones
const stat = promisify(fs.stat);
const chmod = promisify(fs.chmod);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);
const readdir = promisify(fs.readdir);
const execAsync = promisify(exec);

/**
 * Servicio unificado para gestión del sistema de archivos
 * Gestiona permisos, directorios, y validaciones
 */
class FilesystemService {
  /**
   * Normaliza una ruta para usar barras diagonales (/)
   * @param {string} filePath - Ruta a normalizar
   * @returns {string} - Ruta normalizada
   */
  normalizePath(filePath) {
    return filePath.replace(/\\/g, "/");
  }

  /**
   * Verifica si una ruta es potencialmente peligrosa - VERSIÓN MENOS RESTRICTIVA
   * @param {string} filePath - Ruta a verificar
   * @returns {boolean} - true si es peligrosa
   */
  isDangerousPath(filePath) {
    // Normalizar la ruta primero
    const normalized = this.normalizePath(filePath);

    // Lista de rutas específicas que son realmente peligrosas
    const dangerousPaths = [
      "/etc/shadow",
      "/etc/passwd",
      "/etc/sudoers",
      "/boot",
      "C:\\Windows\\System32\\config",
    ];

    // Verificar si la ruta está en la lista de rutas peligrosas
    for (const path of dangerousPaths) {
      if (normalized.startsWith(path)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Obtiene directorios raíz y ubicaciones comunes accesibles
   * @returns {Promise<Array>} - Lista de ubicaciones recomendadas
   */
  async getRootDirectories() {
    const rootDirectories = [];

    // En Windows, enumerar las unidades disponibles
    if (process.platform === "win32") {
      try {
        const { stdout } = await execAsync("wmic logicaldisk get name");

        // Parsear la salida para obtener las letras de unidad
        const drives = stdout
          .split("\r\n")
          .filter((line) => /^[A-Z]:/.test(line))
          .map((drive) => drive.trim());

        drives.forEach((drive) => {
          rootDirectories.push({
            name: drive,
            path: drive + "\\",
            isDirectory: true,
            isRoot: true,
          });
        });
      } catch (error) {
        console.warn("Error al obtener unidades en Windows:", error);
        // Fallback en caso de error: añadir al menos C:
        rootDirectories.push({
          name: "C:",
          path: "C:\\",
          isDirectory: true,
          isRoot: true,
        });
      }
    }

    // Para cualquier sistema operativo, añadir ubicaciones útiles
    const commonPaths = [];

    // Para Unix/Linux
    if (process.platform !== "win32") {
      commonPaths.push(
        { name: "/ (Raíz)", path: "/", isDirectory: true, isRoot: true },
        { name: "/home", path: "/home", isDirectory: true },
        { name: "/media", path: "/media", isDirectory: true },
        { name: "/mnt", path: "/mnt", isDirectory: true },
        { name: "/tmp", path: "/tmp", isDirectory: true },
        { name: "/var", path: "/var", isDirectory: true }
      );
    }

    // Directorio temporal (funciona en cualquier SO)
    const tempDir = os.tmpdir();
    commonPaths.push({
      name: "Temp",
      path: tempDir,
      isDirectory: true,
      description: "Directorio temporal del sistema",
    });

    // Directorio de inicio del usuario
    const homeDir = os.homedir();
    commonPaths.push({
      name: "Home",
      path: homeDir,
      isDirectory: true,
      description: "Directorio personal del usuario",
    });

    // Verificar qué directorios existen
    for (const dir of commonPaths) {
      try {
        await access(dir.path, fs.constants.R_OK);
        rootDirectories.push(dir);
      } catch (error) {
        // Omitir este directorio si no es accesible
        console.warn(`Directorio ${dir.path} no accesible:`, error.message);
      }
    }

    return rootDirectories;
  }

  /**
   * Explora el contenido de un directorio
   * @param {string} dirPath - Ruta del directorio a explorar
   * @returns {Promise<Object>} - Contenido del directorio
   */
  async browseDirectory(dirPath) {
    // Si no se especifica una ruta, usar el directorio raíz
    if (!dirPath) {
      // En Windows usar C:/ por defecto, en Unix usar /
      dirPath = process.platform === "win32" ? "C:/" : "/";
    }

    // Verificar si es una ruta potencialmente peligrosa
    if (this.isDangerousPath(dirPath)) {
      throw {
        status: 403,
        error: "Acceso denegado",
        message:
          "No tienes permiso para acceder a esta ruta por motivos de seguridad",
      };
    }

    try {
      // Normalizar la ruta
      dirPath = this.normalizePath(dirPath);

      // Listar el contenido del directorio
      const files = await readdir(dirPath);

      // Obtener información detallada de cada archivo/directorio
      const contents = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(dirPath, file);
          try {
            const stats = await stat(filePath);

            return {
              name: file,
              path: this.normalizePath(filePath),
              isDirectory: stats.isDirectory(),
              size: stats.size,
              modifiedAt: stats.mtime,
            };
          } catch (err) {
            // Si no se puede obtener información del archivo, omitirlo
            console.warn(`No se pudo acceder a ${filePath}: ${err.message}`);
            return null;
          }
        })
      );

      // Filtrar elementos nulos (archivos a los que no se pudo acceder)
      const validContents = contents.filter((item) => item !== null);

      // Ordenar: primero directorios, luego archivos, ambos ordenados alfabéticamente
      validContents.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return {
        path: dirPath,
        contents: validContents,
      };
    } catch (error) {
      let status = 500;
      let errorMessage = `Error al explorar el directorio ${dirPath}`;
      let details = error.message;

      if (error.code === "ENOENT") {
        status = 404;
        errorMessage = `El directorio ${dirPath} no existe`;
      } else if (error.code === "EACCES") {
        status = 403;
        errorMessage = `No tienes permiso para acceder al directorio ${dirPath}`;
        details =
          "Prueba con una carpeta diferente o con permisos de usuario adecuados.";
      } else if (error.code === "ENOTDIR") {
        status = 400;
        errorMessage = `La ruta ${dirPath} no es un directorio`;
      }

      throw {
        status,
        error: error.code || "ERROR",
        message: errorMessage,
        details,
      };
    }
  }

  /**
   * Crear un nuevo directorio
   * @param {string} dirPath - Ruta del directorio a crear
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async createDirectory(dirPath) {
    if (!dirPath) {
      throw {
        status: 400,
        error: "Datos incompletos",
        message: "Se requiere una ruta para crear el directorio",
      };
    }

    // Verificar si es una ruta potencialmente peligrosa
    if (this.isDangerousPath(dirPath)) {
      throw {
        status: 403,
        error: "Acceso denegado",
        message:
          "No tienes permiso para crear un directorio en esta ruta por motivos de seguridad",
      };
    }

    try {
      // Normalizar la ruta
      const normalizedPath = this.normalizePath(dirPath);

      // Crear el directorio de forma recursiva con permisos amplios
      await mkdir(normalizedPath, { recursive: true, mode: 0o777 });

      // Intentar establecer permisos aún más permisivos para asegurar el acceso
      try {
        // Usar 0o777 para dar todos los permisos a todos los usuarios
        await chmod(normalizedPath, 0o777);

        // En sistemas Unix, intentar usar chmod directamente para asegurar permisos
        if (process.platform !== "win32") {
          try {
            await execAsync(`chmod -R 777 "${normalizedPath}"`);
          } catch (chmodError) {
            console.warn(
              `Advertencia: chmod adicional falló: ${chmodError.message}`
            );
            // No es crítico, continuamos
          }
        }
      } catch (permError) {
        console.warn(
          `Advertencia: no se pudieron establecer permisos adicionales: ${permError.message}`
        );
        // Continuamos de todas formas, ya que la carpeta se creó
      }

      return {
        success: true,
        message: "Directorio creado exitosamente",
        path: normalizedPath,
      };
    } catch (error) {
      if (error.code === "EACCES") {
        throw {
          status: 403,
          error: "Acceso denegado",
          message: `No tienes permiso para crear el directorio ${dirPath}`,
          suggestion: "Prueba con una ubicación diferente, como /tmp",
        };
      }

      throw {
        status: 500,
        error: "Error del servidor",
        message: `Error al crear el directorio ${dirPath}: ${error.message}`,
        suggestion:
          "Prueba con una ubicación donde tengas permisos, como /tmp o tu directorio home",
      };
    }
  }

  /**
   * Verifica permisos de una carpeta
   * @param {string} folderPath - Ruta de la carpeta a verificar
   * @returns {Promise<Object>} - Resultado de la verificación
   */
  async checkFolderPermissions(folderPath) {
    if (!folderPath) {
      throw {
        status: 400,
        error: "Datos incompletos",
        message: "Se requiere una ruta de carpeta para verificar permisos",
      };
    }

    // Verificar si la ruta es potencialmente peligrosa
    if (this.isDangerousPath(folderPath)) {
      return {
        hasAccess: false,
        message: "Ruta potencialmente peligrosa",
        details: "No se permite acceder a este tipo de rutas por seguridad",
      };
    }

    try {
      // Normalizar la ruta
      const normalizedPath = this.normalizePath(folderPath);

      // Resultado base
      const result = {
        path: normalizedPath,
        exists: false,
        isDirectory: false,
        readAccess: false,
        writeAccess: false,
        hasAccess: false,
        message: null,
        error: null,
        details: null,
        canCreate: false,
      };

      // 1. Verificar si la carpeta existe
      try {
        const stats = await stat(normalizedPath);
        result.exists = true;
        result.isDirectory = stats.isDirectory();

        // Añadir información adicional útil
        result.owner = stats.uid;
        result.group = stats.gid;
        result.permissions = stats.mode.toString(8).slice(-3);

        // Si no es un directorio, devolver error
        if (!result.isDirectory) {
          result.error = "NOT_A_DIRECTORY";
          result.message = "La ruta especificada no es un directorio";
          return result;
        }
      } catch (error) {
        if (error.code === "ENOENT") {
          result.error = "FOLDER_NOT_FOUND";
          result.message = "La carpeta no existe";

          // Verificar si podemos crear la carpeta
          try {
            // Verificar permisos en el directorio padre
            const parentDir = path.dirname(normalizedPath);
            try {
              await access(parentDir, fs.constants.W_OK);
              result.canCreate = true;
              result.details = "Se puede crear automáticamente esta carpeta";

              // Información adicional sobre el padre
              try {
                const parentStats = await stat(parentDir);
                result.parentPermissions = parentStats.mode
                  .toString(8)
                  .slice(-3);
              } catch (err) {
                // No es crítico si esto falla
              }
            } catch (accessError) {
              result.canCreate = false;
              result.details = `No se puede crear la carpeta: ${accessError.message}`;
            }
          } catch (parentError) {
            result.canCreate = false;
            result.details = `Error al verificar directorio padre: ${parentError.message}`;
          }

          return result;
        }

        result.error = error.code || "UNKNOWN_ERROR";
        result.message = `Error al acceder a la carpeta: ${error.message}`;
        return result;
      }

      // 2. Verificar permisos de lectura
      try {
        await access(normalizedPath, fs.constants.R_OK);
        result.readAccess = true;
      } catch (error) {
        result.error = "READ_ACCESS_DENIED";
        result.message = "No se tiene permiso de lectura para esta carpeta";
        result.details = error.message;
        return result;
      }

      // 3. Verificar permisos de escritura
      try {
        await access(normalizedPath, fs.constants.W_OK);
        result.writeAccess = true;
      } catch (error) {
        result.error = "WRITE_ACCESS_DENIED";
        result.message = "No se tiene permiso de escritura para esta carpeta";
        result.details = error.message;
        return result;
      }

      // 4. Intentar crear un archivo temporal para verificar escritura efectiva
      const testFilePath = path.join(
        normalizedPath,
        `.streamvio-test-${Date.now()}`
      );
      try {
        // Intentar escribir un archivo temporal
        fs.writeFileSync(testFilePath, "test");
        // Si llega aquí, la escritura fue exitosa, eliminar el archivo
        fs.unlinkSync(testFilePath);
        result.effectiveWrite = true;
      } catch (error) {
        result.effectiveWrite = false;
        result.writeError = error.code;
        result.details = `Error al crear archivo de prueba: ${error.message}`;

        // Si no se puede escribir a pesar de tener permisos, es posible que sea un problema de ACL
        if (result.writeAccess) {
          result.error = "EFFECTIVE_WRITE_FAILED";
          result.message =
            "No se pudo escribir a pesar de tener permisos aparentes";
        }

        return result;
      }

      // Si llegamos aquí, todos los permisos están correctos
      result.hasAccess = true;
      result.message = "La carpeta tiene los permisos correctos";
      return result;
    } catch (error) {
      throw {
        status: 500,
        error: "Error del servidor",
        message: "Error al verificar permisos de la carpeta",
        details: error.message,
      };
    }
  }

  /**
   * Intenta reparar los permisos de una carpeta
   * @param {string} folderPath - Ruta de la carpeta a reparar
   * @returns {Promise<Object>} - Resultado de la reparación
   */
  async fixFolderPermissions(folderPath) {
    if (!folderPath) {
      throw {
        status: 400,
        error: "Datos incompletos",
        message: "Se requiere una ruta de carpeta para reparar permisos",
      };
    }

    try {
      // Normalizar la ruta
      const normalizedPath = this.normalizePath(folderPath);

      // Primero verificar si la carpeta existe
      let success = false;
      let message = "";
      let details = "";
      let suggestedCommand = "";

      try {
        // Intentar acceder a la carpeta
        await access(normalizedPath, fs.constants.F_OK);
      } catch (error) {
        if (error.code === "ENOENT") {
          // La carpeta no existe, intentar crearla
          try {
            await mkdir(normalizedPath, { recursive: true, mode: 0o777 });
            message = "Carpeta creada con permisos amplios";
            details =
              "Se ha creado la carpeta con permisos de lectura/escritura para todos los usuarios";
          } catch (mkdirError) {
            return {
              success: false,
              message: "No se pudo crear la carpeta",
              details: mkdirError.message,
              suggestedCommand: `mkdir -p "${normalizedPath}" && chmod 777 "${normalizedPath}"`,
            };
          }
        } else {
          return {
            success: false,
            message: "Error al acceder a la carpeta",
            details: error.message,
          };
        }
      }

      // Aplicar permisos muy amplios
      try {
        // Usar chmod 777 para dar todos los permisos
        if (process.platform === "win32") {
          // En Windows, usar icacls si está disponible
          try {
            await execAsync(`icacls "${normalizedPath}" /grant Everyone:F /T`);
            success = true;
            message = "Permisos ampliados en Windows";
            details = "Se han otorgado permisos completos a todos los usuarios";
          } catch (icaclsError) {
            // Fallback a Node.js chmod
            try {
              await chmod(normalizedPath, 0o777);
              success = true;
              message = "Permisos ampliados mediante Node.js";
              details =
                "Se han otorgado permisos amplios usando las APIs de Node.js";
            } catch (chmodError) {
              success = false;
              message = "Error al aplicar permisos en Windows";
              details = chmodError.message;
              suggestedCommand = `icacls "${normalizedPath}" /grant Everyone:F /T`;
            }
          }
        } else {
          // En Unix/Linux, aplicar chmod 777 recursivo
          try {
            await execAsync(`chmod -R 777 "${normalizedPath}"`);
            success = true;
            message = "Permisos ampliados en Unix/Linux";
            details = "Se han otorgado permisos completos (777) recursivamente";
          } catch (chmodError) {
            // Fallback a Node.js chmod
            try {
              await chmod(normalizedPath, 0o777);
              success = true;
              message = "Permisos básicos aplicados";
              details =
                "Se han aplicado permisos 777 al directorio principal (no recursivo)";
              suggestedCommand = `chmod -R 777 "${normalizedPath}"`;
            } catch (nodeChmodError) {
              success = false;
              message = "Error al aplicar permisos";
              details = nodeChmodError.message;
              suggestedCommand = `sudo chmod -R 777 "${normalizedPath}"`;
            }
          }
        }
      } catch (error) {
        console.error("Error general al cambiar permisos:", error);
        success = false;
        message = "Error al modificar permisos";
        details = error.message;
        suggestedCommand =
          process.platform === "win32"
            ? `icacls "${normalizedPath}" /grant Everyone:F /T`
            : `sudo chmod -R 777 "${normalizedPath}"`;
      }

      // Verificar permisos después de la aplicación
      if (success) {
        try {
          await access(normalizedPath, fs.constants.R_OK | fs.constants.W_OK);
          // Todo correcto
        } catch (accessError) {
          // Los permisos no se aplicaron correctamente
          success = false;
          message += " pero la verificación falló";
          details += `. Error en verificación: ${accessError.message}`;
        }
      }

      return {
        success,
        message,
        details,
        suggestedCommand: suggestedCommand || null,
        path: normalizedPath,
      };
    } catch (error) {
      throw {
        status: 500,
        error: "Error del servidor",
        message: "Error al reparar permisos",
        details: error.message,
        suggestedCommand:
          process.platform === "win32"
            ? `icacls "${folderPath}" /grant Everyone:F /T`
            : `sudo chmod -R 777 "${folderPath}"`,
      };
    }
  }

  /**
   * Sugerir ubicaciones con buen acceso para bibliotecas
   * @returns {Promise<Object>} - Lista de sugerencias
   */
  async suggestMediaPaths() {
    try {
      const suggestions = [];
      const testedPaths = [];

      // Probar varias ubicaciones comunes
      if (process.platform === "win32") {
        // Ubicaciones Windows
        testedPaths.push(
          "C:\\Users\\Public\\Media",
          "C:\\Users\\Public\\Videos",
          "C:\\Users\\Public\\Music",
          "C:\\ProgramData\\StreamVio",
          path.join(os.homedir(), "Videos"),
          path.join(os.homedir(), "Music"),
          path.join(os.homedir(), "Pictures")
        );
      } else {
        // Ubicaciones Unix/Linux
        testedPaths.push(
          "/tmp",
          "/var/media",
          "/var/lib/streamvio",
          "/media",
          "/mnt",
          path.join(os.homedir(), "Media"),
          path.join(os.homedir(), "Videos"),
          path.join(os.homedir(), "Music"),
          path.join(os.homedir(), "Pictures")
        );
      }

      // Agregar directorios que sabemos son útiles
      testedPaths.push(os.tmpdir(), os.homedir());

      // Probar cada ubicación
      for (const testPath of testedPaths) {
        try {
          // Normalizar la ruta
          const normalizedPath = this.normalizePath(testPath);

          // Verificar existencia
          let exists = false;
          try {
            await access(normalizedPath, fs.constants.F_OK);
            exists = true;
          } catch (err) {
            // No existe, intentar crear
            try {
              await mkdir(normalizedPath, { recursive: true, mode: 0o777 });
              exists = true;
            } catch (mkdirErr) {
              // No se puede crear, omitir
              continue;
            }
          }

          // Verificar permisos
          try {
            await access(normalizedPath, fs.constants.R_OK | fs.constants.W_OK);

            // Intentar crear un archivo de prueba
            const testFilePath = path.join(
              normalizedPath,
              `.streamvio-test-${Date.now()}`
            );
            try {
              fs.writeFileSync(testFilePath, "test");
              fs.unlinkSync(testFilePath);

              // Agregar a sugerencias
              suggestions.push({
                path: normalizedPath,
                exists,
                hasAccess: true,
                description: testPath.includes(os.homedir())
                  ? "Directorio personal"
                  : testPath.includes("/tmp") || testPath.includes("Temp")
                  ? "Directorio temporal"
                  : "Ubicación recomendada",
              });
            } catch (err) {
              // No se puede escribir, omitir
            }
          } catch (err) {
            // No tiene permisos, omitir
          }
        } catch (err) {
          // Error general, omitir
          console.warn(`Error al verificar ruta ${testPath}:`, err);
        }
      }

      return {
        success: true,
        suggestions: suggestions.slice(0, 5), // Limitar a 5 sugerencias
      };
    } catch (error) {
      throw {
        status: 500,
        error: "Error del servidor",
        message: "Error al generar sugerencias de rutas",
        details: error.message,
      };
    }
  }
}

module.exports = new FilesystemService();
