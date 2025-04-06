// server/utils/directoryManager.js (versión mejorada)
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const os = require("os");

// Promisificar funciones
const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);
const stat = promisify(fs.stat);
const access = promisify(fs.access);
const execAsync = promisify(exec);

/**
 * Normaliza una ruta para usar barras diagonales (/)
 * @param {string} filePath - Ruta a normalizar
 * @returns {string} - Ruta normalizada
 */
function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

/**
 * Verifica si una carpeta tiene los permisos correctos para StreamVio
 * @param {string} folderPath - Ruta de la carpeta a verificar
 * @returns {Promise<object>} - Resultado de la verificación
 */
async function checkFolderPermissions(folderPath) {
  try {
    // Normalizar la ruta
    const normalizedPath = normalizePath(folderPath);

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
    return {
      path: folderPath,
      exists: false,
      hasAccess: false,
      error: "UNEXPECTED_ERROR",
      message: `Error inesperado al verificar permisos: ${error.message}`,
    };
  }
}

/**
 * Intenta reparar los permisos de una carpeta para que StreamVio pueda acceder
 * @param {string} folderPath - Ruta de la carpeta a reparar
 * @returns {Promise<object>} - Resultado de la reparación
 */
async function fixFolderPermissions(folderPath) {
  try {
    // Normalizar la ruta
    const normalizedPath = normalizePath(folderPath);

    // Verificar permisos actuales
    const initialCheck = await checkFolderPermissions(normalizedPath);

    // Si la carpeta no existe, intentar crearla
    if (!initialCheck.exists) {
      try {
        await mkdir(normalizedPath, { recursive: true });
        console.log(`Carpeta creada: ${normalizedPath}`);

        // Establecer permisos amplios para asegurar acceso
        await chmod(normalizedPath, 0o775); // rwxrwxr-x

        // Verificar nuevamente
        const afterCreateCheck = await checkFolderPermissions(normalizedPath);

        if (afterCreateCheck.hasAccess) {
          return {
            success: true,
            message: "Carpeta creada con permisos correctos",
            details: "La carpeta fue creada y tiene los permisos necesarios",
            path: normalizedPath,
          };
        } else {
          // Si la creación no resolvió los problemas de permisos, continuar con las estrategias de reparación
          console.log(
            "Carpeta creada pero aún hay problemas de permisos. Intentando reparar..."
          );
        }
      } catch (error) {
        return {
          success: false,
          message: "No se pudo crear la carpeta",
          error: error.message,
          details: "Verifica que tengas permisos en el directorio padre",
          path: normalizedPath,
        };
      }
    }

    // Obtener usuario y grupo actuales
    const serviceUser = process.env.SERVICE_USER || "streamvio";
    const serviceGroup = process.env.SERVICE_GROUP || "streamvio";

    // Estrategia basada en el sistema operativo
    if (process.platform === "win32") {
      // Windows: usar icacls
      return await fixPermissionsWindows(normalizedPath);
    } else {
      // Unix/Linux: intentar varias estrategias
      return await fixPermissionsUnix(
        normalizedPath,
        serviceUser,
        serviceGroup
      );
    }
  } catch (error) {
    return {
      success: false,
      message: `Error al reparar permisos: ${error.message}`,
      path: folderPath,
    };
  }
}

/**
 * Intenta reparar permisos en sistemas Windows
 * @param {string} folderPath - Ruta de la carpeta
 * @returns {Promise<object>} - Resultado de la reparación
 */
async function fixPermissionsWindows(folderPath) {
  try {
    // En Windows usamos icacls para dar permisos completos al usuario actual
    const username = os.userInfo().username;

    // Comando para dar permisos completos incluyendo subcarpetas y archivos
    try {
      await execAsync(
        `icacls "${folderPath}" /grant:r "${username}":(OI)(CI)F /Q`
      );
    } catch (error) {
      console.error(`Error al ejecutar icacls: ${error.message}`);

      // Intentar método alternativo si icacls falla
      try {
        await chmod(folderPath, 0o777); // rwxrwxrwx - permisos amplios
      } catch (chmodError) {
        console.error(`Error también al usar chmod: ${chmodError.message}`);

        return {
          success: false,
          message: "Error al reparar permisos en Windows",
          error: error.message,
          details: "No se pudo aplicar ningún método de reparación de permisos",
          suggestedCommand: `icacls "${folderPath}" /grant:r "Todos":(OI)(CI)F /Q`,
        };
      }
    }

    // Verificar si los permisos se aplicaron correctamente
    const finalCheck = await checkFolderPermissions(folderPath);

    if (finalCheck.hasAccess) {
      return {
        success: true,
        message: "Permisos reparados correctamente en Windows",
        details: `Permisos otorgados a ${username}`,
        path: folderPath,
      };
    } else {
      return {
        success: false,
        message: "No se pudieron reparar completamente los permisos",
        details:
          "Los permisos se asignaron pero sigue habiendo problemas de acceso",
        path: folderPath,
        suggestedCommand: `icacls "${folderPath}" /grant:r "Todos":(OI)(CI)F /Q`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Error al reparar permisos en Windows",
      error: error.message,
      path: folderPath,
      suggestedCommand: `icacls "${folderPath}" /grant:r "Todos":(OI)(CI)F /Q`,
    };
  }
}

/**
 * Intenta reparar permisos en sistemas Unix/Linux
 * @param {string} folderPath - Ruta de la carpeta
 * @param {string} serviceUser - Usuario del servicio
 * @param {string} serviceGroup - Grupo del servicio
 * @returns {Promise<object>} - Resultado de la reparación
 */
async function fixPermissionsUnix(folderPath, serviceUser, serviceGroup) {
  // Si estamos ejecutando como root, usamos chown
  if (process.getuid && process.getuid() === 0) {
    try {
      // Intentar cambiar el propietario al usuario del servicio
      await execAsync(
        `chown -R ${serviceUser}:${serviceGroup} "${folderPath}"`
      );

      // Aplicar permisos 775 (rwxrwxr-x)
      await execAsync(`chmod -R 775 "${folderPath}"`);

      // Establecer el bit SGID para heredar el grupo
      await execAsync(`find "${folderPath}" -type d -exec chmod g+s {} \\;`);

      // Verificar si se aplicaron correctamente
      const finalCheck = await checkFolderPermissions(folderPath);

      if (finalCheck.hasAccess) {
        return {
          success: true,
          message: "Permisos reparados correctamente como root",
          details: `Se cambió el propietario a ${serviceUser}:${serviceGroup} y se establecieron permisos 775`,
          path: folderPath,
        };
      } else {
        return {
          success: false,
          message: "No se pudieron reparar completamente los permisos",
          details:
            "Los permisos se asignaron pero sigue habiendo problemas de acceso",
          path: folderPath,
        };
      }
    } catch (error) {
      console.error("Error al reparar permisos como root:", error);
      // Continuar con alternativa
    }
  }

  // Si no somos root o falló el método anterior, intentamos con chmod
  try {
    // Aplicar permisos 777 (permisivos para todos)
    await execAsync(`chmod -R 777 "${folderPath}"`);

    // Verificar si se aplicaron correctamente
    const finalCheck = await checkFolderPermissions(folderPath);

    if (finalCheck.hasAccess) {
      return {
        success: true,
        message: "Permisos reparados correctamente (modo permisivo)",
        details:
          "Se establecieron permisos 777 en la carpeta. Es recomendable ajustar a permisos más restrictivos manualmente.",
        warning:
          "Los permisos actuales son muy permisivos. Considera ejecutar el script add-media-folder.sh como root para configurar permisos más seguros.",
        path: folderPath,
      };
    }
  } catch (error) {
    console.error("Error al reparar permisos con chmod:", error);
  }

  // Si todo lo anterior falló, sugerir comando para ejecutar manualmente
  return {
    success: false,
    message: "No se pudieron reparar los permisos automáticamente",
    suggestedCommand: `sudo chown -R ${serviceUser}:${serviceGroup} "${folderPath}" && sudo chmod -R 775 "${folderPath}"`,
    details:
      "Ejecuta el comando sugerido en una terminal con permisos de administrador",
    path: folderPath,
  };
}

/**
 * Crea directorios necesarios con los permisos correctos
 * @param {string[]} directories - Lista de rutas de directorios a crear
 * @param {object} options - Opciones adicionales
 * @returns {Promise<object>} - Resultado de la operación
 */
async function createRequiredDirectories(directories, options = {}) {
  const results = {
    success: true,
    created: [],
    failed: [],
    details: [],
  };

  const defaultOptions = {
    mode: 0o775, // rwxrwxr-x
    setGid: true, // Establecer el bit SGID para heredar el grupo
    recursive: true,
  };

  const opts = { ...defaultOptions, ...options };

  for (const dir of directories) {
    try {
      const normalizedPath = normalizePath(dir);

      // Verificar si ya existe
      let exists = false;
      try {
        await access(normalizedPath, fs.constants.F_OK);
        exists = true;
      } catch (err) {
        // La carpeta no existe, continuamos con la creación
      }

      if (!exists) {
        // Crear el directorio con los permisos especificados
        await mkdir(normalizedPath, {
          recursive: opts.recursive,
          mode: opts.mode,
        });

        // Establecer el bit SGID si se solicita
        if (opts.setGid && process.platform !== "win32") {
          try {
            await execAsync(`chmod g+s "${normalizedPath}"`);
          } catch (err) {
            console.warn(
              `No se pudo establecer el bit SGID en ${normalizedPath}: ${err.message}`
            );
          }
        }

        results.created.push(normalizedPath);
        results.details.push({
          path: normalizedPath,
          status: "created",
          mode: opts.mode.toString(8),
        });
      } else {
        // Si ya existe, verificar permisos
        const check = await checkFolderPermissions(normalizedPath);

        if (!check.hasAccess) {
          // Intentar reparar permisos
          const fixed = await fixFolderPermissions(normalizedPath);

          if (fixed.success) {
            results.details.push({
              path: normalizedPath,
              status: "fixed",
              message: fixed.message,
            });
          } else {
            results.details.push({
              path: normalizedPath,
              status: "permission_error",
              message: fixed.message,
              error: fixed.error,
            });

            results.failed.push(normalizedPath);
            results.success = false;
          }
        } else {
          results.details.push({
            path: normalizedPath,
            status: "already_exists",
            hasAccess: true,
          });
        }
      }
    } catch (error) {
      results.failed.push(dir);
      results.details.push({
        path: dir,
        status: "error",
        error: error.message,
      });
      results.success = false;
    }
  }

  return results;
}

module.exports = {
  checkFolderPermissions,
  fixFolderPermissions,
  createRequiredDirectories,
  normalizePath,
};
