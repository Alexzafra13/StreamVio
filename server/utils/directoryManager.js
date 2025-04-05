// server/utils/directoryManager.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");

// Promisificar funciones
const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);
const stat = promisify(fs.stat);
const execAsync = promisify(exec);

/**
 * Crea directorios necesarios con los permisos correctos
 * @param {Array<string>} directories - Lista de directorios a crear/verificar
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function ensureDirectories(directories, options = {}) {
  const result = {
    success: true,
    created: [],
    failed: [],
    details: [],
  };

  const defaultOptions = {
    permissions: 0o775, // rwxrwxr-x por defecto
    recursive: true,
    fixPermissions: true,
  };

  const opts = { ...defaultOptions, ...options };

  for (const dir of directories) {
    try {
      // Normalizar ruta (reemplazar \ por / para consistencia)
      const normalizedPath = dir.replace(/\\/g, "/");

      // Verificar si el directorio existe
      let exists = false;
      try {
        const stats = await stat(normalizedPath);
        exists = stats.isDirectory();
      } catch (error) {
        // Si el error es diferente a "no existe", registrarlo
        if (error.code !== "ENOENT") {
          console.error(
            `Error al verificar directorio ${normalizedPath}:`,
            error
          );
        }
      }

      // Crear directorio si no existe
      if (!exists) {
        await mkdir(normalizedPath, { recursive: opts.recursive });

        // Establecer permisos
        await chmod(normalizedPath, opts.permissions);

        result.created.push(normalizedPath);
        result.details.push({
          path: normalizedPath,
          action: "created",
          permissions: opts.permissions.toString(8),
        });

        console.log(
          `Directorio creado: ${normalizedPath} con permisos ${opts.permissions.toString(
            8
          )}`
        );
      }
      // Si existe pero queremos verificar/arreglar permisos
      else if (opts.fixPermissions) {
        try {
          // Verificar acceso de escritura
          const testFile = path.join(normalizedPath, `.test-${Date.now()}`);
          fs.writeFileSync(testFile, "test");
          fs.unlinkSync(testFile);

          // Si llegamos aquí, tenemos permisos de escritura
          result.details.push({
            path: normalizedPath,
            action: "verified",
            status: "ok",
          });
        } catch (permError) {
          // Intentar arreglar permisos
          console.warn(
            `Problemas de permisos en ${normalizedPath}: ${permError.message}`
          );

          try {
            // Cambiar permisos
            await chmod(normalizedPath, opts.permissions);

            // Verificar de nuevo
            try {
              const testFile = path.join(normalizedPath, `.test-${Date.now()}`);
              fs.writeFileSync(testFile, "test");
              fs.unlinkSync(testFile);

              result.details.push({
                path: normalizedPath,
                action: "fixed",
                permissions: opts.permissions.toString(8),
              });

              console.log(`Permisos corregidos para: ${normalizedPath}`);
            } catch (verifyError) {
              // Si todavía no podemos escribir, intentar soluciones más agresivas
              if (process.platform !== "win32") {
                try {
                  // Intentar comando chmod recursivo
                  await execAsync(`chmod -R 775 "${normalizedPath}"`);
                  result.details.push({
                    path: normalizedPath,
                    action: "fixed-recursive",
                    permissions: "775",
                  });
                  console.log(
                    `Permisos corregidos recursivamente para: ${normalizedPath}`
                  );
                } catch (chmodError) {
                  result.failed.push(normalizedPath);
                  result.details.push({
                    path: normalizedPath,
                    action: "failed",
                    error: chmodError.message,
                  });
                  result.success = false;
                }
              } else {
                // En Windows intentar otro enfoque
                try {
                  const username = process.env.USERNAME || "Todos";
                  await execAsync(
                    `icacls "${normalizedPath}" /grant:r "${username}":(OI)(CI)F /Q`
                  );
                  result.details.push({
                    path: normalizedPath,
                    action: "fixed-windows",
                    permissions: "FullControl",
                  });
                  console.log(
                    `Permisos Windows corregidos para: ${normalizedPath}`
                  );
                } catch (icaclsError) {
                  result.failed.push(normalizedPath);
                  result.details.push({
                    path: normalizedPath,
                    action: "failed",
                    error: icaclsError.message,
                  });
                  result.success = false;
                }
              }
            }
          } catch (chmodError) {
            result.failed.push(normalizedPath);
            result.details.push({
              path: normalizedPath,
              action: "failed",
              error: chmodError.message,
            });
            result.success = false;
          }
        }
      }
    } catch (error) {
      console.error(`Error al procesar directorio ${dir}:`, error);
      result.failed.push(dir);
      result.details.push({
        path: dir,
        action: "error",
        error: error.message,
      });
      result.success = false;
    }
  }

  return result;
}

/**
 * Verifica si una ruta tiene permisos suficientes y corrige si es necesario
 * @param {string} directoryPath - Ruta del directorio
 * @returns {Promise<Object>} - Resultado de la verificación/corrección
 */
async function verifyAndFixPermissions(directoryPath) {
  return ensureDirectories([directoryPath], { fixPermissions: true });
}

module.exports = {
  ensureDirectories,
  verifyAndFixPermissions,
};
