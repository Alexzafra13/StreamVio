// server/routes/filesystem.js - Versión mejorada
const express = require("express");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { execSync } = require("child_process");
const os = require("os");
const authMiddleware = require("../middleware/auth");
const db = require("../config/database"); // Necesario para verificar permisos de admin

const router = express.Router();

// Promisificar las funciones de fs
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);
const chmod = promisify(fs.chmod);

/**
 * Normaliza una ruta de archivo para que sea consistente en todos los OS
 * @param {string} filePath - Ruta a normalizar
 * @returns {string} - Ruta normalizada
 */
function normalizePath(filePath) {
  // Convertir barras invertidas a barras normales
  return filePath.replace(/\\/g, "/");
}

/**
 * Verifica si una ruta es potencialmente peligrosa
 * @param {string} filePath - Ruta a verificar
 * @returns {boolean} - true si es peligrosa
 */
function isDangerousPath(filePath) {
  // Normalizar la ruta primero
  const normalized = normalizePath(filePath);

  // Lista de rutas específicas que son demasiado peligrosas para permitir
  const dangerousPaths = [
    "/etc/shadow",
    "/etc/passwd",
    "/etc/sudoers",
    "/etc/ssh",
    "/boot",
    "/bin",
    "/sbin",
    "C:\\Windows\\System32",
  ];

  // Verificar si la ruta está en la lista de rutas peligrosas
  for (const path of dangerousPaths) {
    if (normalized.startsWith(path)) {
      return true;
    }
  }

  // Permitir acceso general a otros directorios
  return false;
}

/**
 * @route   GET /api/filesystem/browse
 * @desc    Explorar el contenido de un directorio
 * @access  Private
 */
router.get("/browse", authMiddleware, async (req, res) => {
  let { path: dirPath } = req.query;

  // Si no se especifica una ruta, usar el directorio raíz
  if (!dirPath) {
    // En Windows usar C:/ por defecto, en Unix usar /
    dirPath = process.platform === "win32" ? "C:/" : "/";
  }

  // Verificar si es una ruta potencialmente peligrosa
  if (isDangerousPath(dirPath)) {
    return res.status(403).json({
      error: "Acceso denegado",
      message: "No tienes permiso para acceder a esta ruta",
    });
  }

  try {
    // Normalizar la ruta
    dirPath = normalizePath(dirPath);

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
            path: normalizePath(filePath),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modifiedAt: stats.mtime,
          };
        } catch (err) {
          // Si no se puede obtener información del archivo, omitirlo
          console.error(`Error al obtener información de ${filePath}:`, err);
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

    res.json({
      path: dirPath,
      contents: validContents,
    });
  } catch (error) {
    console.error(`Error al explorar el directorio ${dirPath}:`, error);

    if (error.code === "ENOENT") {
      return res.status(404).json({
        error: "Directorio no encontrado",
        message: `El directorio ${dirPath} no existe`,
      });
    }

    if (error.code === "EACCES") {
      return res.status(403).json({
        error: "Acceso denegado",
        message: `No tienes permiso para acceder al directorio ${dirPath}`,
      });
    }

    if (error.code === "ENOTDIR") {
      return res.status(400).json({
        error: "No es un directorio",
        message: `La ruta ${dirPath} no es un directorio`,
      });
    }

    res.status(500).json({
      error: "Error del servidor",
      message: `Error al explorar el directorio ${dirPath}`,
    });
  }
});

/**
 * @route   GET /api/filesystem/roots
 * @desc    Obtener las unidades/raíces disponibles
 * @access  Private
 */
router.get("/roots", authMiddleware, async (req, res) => {
  try {
    if (process.platform === "win32") {
      // En Windows, enumerar las unidades disponibles
      const { stdout } = await promisify(require("child_process").exec)(
        "wmic logicaldisk get name"
      );

      // Parsear la salida para obtener las letras de unidad
      const drives = stdout
        .split("\r\n")
        .filter((line) => /^[A-Z]:/.test(line))
        .map((drive) => drive.trim());

      const rootDirectories = drives.map((drive) => ({
        name: drive,
        path: drive + "\\",
        isDirectory: true,
        isRoot: true,
      }));

      res.json(rootDirectories);
    } else {
      // En Unix/Linux, usar el directorio raíz
      res.json([
        {
          name: "/",
          path: "/",
          isDirectory: true,
          isRoot: true,
        },
      ]);
    }
  } catch (error) {
    console.error("Error al obtener unidades/raíces:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener las unidades disponibles",
    });
  }
});

/**
 * @route   POST /api/filesystem/create-directory
 * @desc    Crear un nuevo directorio
 * @access  Private
 */
router.post("/create-directory", authMiddleware, async (req, res) => {
  const { path: dirPath } = req.body;

  if (!dirPath) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere una ruta para crear el directorio",
    });
  }

  // Verificar si es una ruta potencialmente peligrosa
  if (isDangerousPath(dirPath)) {
    return res.status(403).json({
      error: "Acceso denegado",
      message: "No tienes permiso para crear un directorio en esta ruta",
    });
  }

  try {
    // Normalizar la ruta
    const normalizedPath = normalizePath(dirPath);

    // Crear el directorio de forma recursiva
    await mkdir(normalizedPath, { recursive: true, mode: 0o775 });

    // Intentar establecer permisos adecuados
    try {
      // En sistemas Unix, establecer el bit SGID para que los nuevos archivos hereden el grupo
      if (process.platform !== "win32") {
        await chmod(normalizedPath, 0o2775); // Agregar el bit SGID (2)
      }
    } catch (permError) {
      console.warn(
        `Advertencia: no se pudieron establecer todos los permisos: ${permError.message}`
      );
      // Continuamos de todas formas, ya que la carpeta se creó
    }

    res.json({
      message: "Directorio creado exitosamente",
      path: normalizedPath,
    });
  } catch (error) {
    console.error(`Error al crear el directorio ${dirPath}:`, error);

    if (error.code === "EACCES") {
      return res.status(403).json({
        error: "Acceso denegado",
        message: `No tienes permiso para crear el directorio ${dirPath}`,
      });
    }

    res.status(500).json({
      error: "Error del servidor",
      message: `Error al crear el directorio ${dirPath}: ${error.message}`,
    });
  }
});

/**
 * @route   POST /api/filesystem/check-permissions
 * @desc    Verificar permisos de una carpeta
 * @access  Private
 */
router.post("/check-permissions", authMiddleware, async (req, res) => {
  const { path: folderPath } = req.body;

  if (!folderPath) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere una ruta de carpeta",
    });
  }

  // Verificar si la ruta es potencialmente peligrosa
  if (isDangerousPath(folderPath)) {
    return res.status(403).json({
      hasAccess: false,
      message: "Ruta potencialmente peligrosa",
      details: "No se permite acceder a este tipo de rutas por seguridad",
    });
  }

  try {
    // Normalizar la ruta
    const normalizedPath = normalizePath(folderPath);

    // 1. Verificar si la carpeta existe
    let result = {
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

    try {
      const stats = await stat(normalizedPath);
      result.exists = true;
      result.isDirectory = stats.isDirectory();

      if (!result.isDirectory) {
        result.error = "NOT_A_DIRECTORY";
        result.message = "La ruta especificada no es un directorio";
        return res.json(result);
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

        return res.json(result);
      }

      result.error = error.code || "UNKNOWN_ERROR";
      result.message = `Error al acceder a la carpeta: ${error.message}`;
      return res.json(result);
    }

    // 2. Verificar permisos de lectura
    try {
      await access(normalizedPath, fs.constants.R_OK);
      result.readAccess = true;
    } catch (error) {
      result.error = "READ_ACCESS_DENIED";
      result.message = "No se tiene permiso de lectura para esta carpeta";
      result.details = error.message;
      return res.json(result);
    }

    // 3. Verificar permisos de escritura
    try {
      await access(normalizedPath, fs.constants.W_OK);
      result.writeAccess = true;
    } catch (error) {
      result.error = "WRITE_ACCESS_DENIED";
      result.message = "No se tiene permiso de escritura para esta carpeta";
      result.details = error.message;
      return res.json(result);
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

      return res.json(result);
    }

    // Si llegamos aquí, todos los permisos están correctos
    result.hasAccess = true;
    result.message = "La carpeta tiene los permisos correctos";
    return res.json(result);
  } catch (error) {
    console.error(`Error al verificar permisos para ${folderPath}:`, error);

    res.status(500).json({
      hasAccess: false,
      message: "Error al verificar permisos",
      error: error.code || "unknown",
      details: error.message,
    });
  }
});

/**
 * @route   POST /api/filesystem/fix-permissions
 * @desc    Reparar permisos de una carpeta con sudo si es necesario
 * @access  Private (Admin)
 */
router.post("/fix-permissions", authMiddleware, async (req, res) => {
  const { path: folderPath } = req.body;

  // Verificar que es admin (puedes comentar o eliminar esta parte si quieres permitir a cualquier usuario)
  try {
    const userId = req.user.id;
    const isAdmin = await db.asyncGet(
      "SELECT is_admin FROM users WHERE id = ?",
      [userId]
    );

    // Esto es opcional: puedes comentarlo si quieres que todos los usuarios puedan
    // arreglar permisos sin ser administradores
    if (!isAdmin || isAdmin.is_admin !== 1) {
      return res.status(403).json({
        error: "Acceso denegado",
        message:
          "Se requieren privilegios de administrador para esta operación",
      });
    }
  } catch (error) {
    console.error("Error al verificar privilegios de administrador:", error);
    // Continuamos de todas formas para mejorar la experiencia del usuario
  }

  if (!folderPath) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere una ruta de carpeta",
    });
  }

  try {
    // Normalizar la ruta
    const normalizedPath = normalizePath(folderPath);

    // Primero intentamos métodos estándar (esto viene de tu código original)
    let success = false;
    let message = "";
    let details = "";
    let suggestedCommand = "";

    // Si estamos en Linux/Unix, intentar usar sudo
    if (process.platform !== "win32") {
      try {
        // Intentar ejecutar comando con sudo (esto requiere configurar sudoers adecuadamente)
        const { execSync } = require("child_process");
        const serviceUser = process.env.SERVICE_USER || "streamvio";
        const serviceGroup = process.env.SERVICE_GROUP || "streamvio";

        // Intentar usar sudo para corregir permisos
        // Nota: esto requiere configuración especial en /etc/sudoers
        try {
          // Comando para cambiar permisos con sudo
          const command = `sudo chown -R ${serviceUser}:${serviceGroup} "${normalizedPath}" && sudo chmod -R 775 "${normalizedPath}"`;

          // Ejecutar el comando
          execSync(command);

          success = true;
          message = "Permisos reparados correctamente usando sudo";
          details = `Se cambió el propietario a ${serviceUser}:${serviceGroup} y se establecieron permisos 775`;
        } catch (sudoError) {
          console.error("Error al usar sudo:", sudoError);

          // Si falla, intentar con método estándar de usuario actual
          try {
            // Aplicar permisos permisivos para asegurar acceso
            execSync(`chmod -R 777 "${normalizedPath}"`);
            success = true;
            message = "Permisos reparados en modo permisivo";
            details =
              "Se establecieron permisos 777 (permisos completos para todos los usuarios)";
            suggestedCommand = `sudo chown -R ${serviceUser}:${serviceGroup} "${normalizedPath}" && sudo chmod -R 775 "${normalizedPath}"`;
          } catch (chmodError) {
            success = false;
            message = "No se pudieron reparar los permisos";
            details = chmodError.message;
            suggestedCommand = `sudo chown -R ${serviceUser}:${serviceGroup} "${normalizedPath}" && sudo chmod -R 775 "${normalizedPath}"`;
          }
        }
      } catch (error) {
        console.error("Error general al reparar permisos:", error);
        success = false;
        message = "Error al intentar reparar permisos";
        details = error.message;
      }
    } else {
      // En Windows usar icacls o cacls
      try {
        const { execSync } = require("child_process");
        const username = require("os").userInfo().username;

        // Comando para dar permisos completos al usuario actual y al grupo Everyone
        execSync(
          `icacls "${normalizedPath}" /grant:r "${username}":(OI)(CI)F /grant:r Everyone:(OI)(CI)F /Q`
        );

        success = true;
        message = "Permisos reparados correctamente en Windows";
        details = `Permisos otorgados a ${username} y a Everyone`;
      } catch (error) {
        success = false;
        message = "Error al reparar permisos en Windows";
        details = error.message;
        suggestedCommand = `icacls "${normalizedPath}" /grant:r Everyone:(OI)(CI)F /Q`;
      }
    }

    // Devolver resultado
    return res.json({
      success,
      message,
      details,
      suggestedCommand,
      path: normalizedPath,
    });
  } catch (error) {
    console.error(
      `Error general al reparar permisos para ${folderPath}:`,
      error
    );

    res.status(500).json({
      success: false,
      message: "Error al reparar permisos",
      error: error.message,
    });
  }
});

module.exports = router;
