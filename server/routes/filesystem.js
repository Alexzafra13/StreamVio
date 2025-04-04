// server/routes/filesystem.js - Versión corregida
const express = require("express");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { execSync } = require("child_process");
const os = require("os");
const authMiddleware = require("../middleware/auth");
const db = require("../config/database"); // Añadido import necesario

const router = express.Router();

// Promisificar las funciones de fs
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);

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

  // Verificar patrones peligrosos
  return (
    normalized.includes("../") || // Navegación a directorios superiores
    normalized.includes("..\\") ||
    normalized.includes("/etc/") || // Directorios sensibles en Unix
    normalized.includes("/var/") ||
    normalized.includes("/proc/") ||
    normalized.includes("C:\\Windows\\") || // Directorios sensibles en Windows
    normalized.includes("C:\\Program Files\\") ||
    normalized.includes("C:\\Users\\") ||
    normalized.startsWith("~")
  ); // Directorio home
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
    await mkdir(normalizedPath, { recursive: true });

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
    try {
      fs.accessSync(normalizedPath, fs.constants.F_OK);
    } catch (error) {
      if (error.code === "ENOENT") {
        return res.status(404).json({
          hasAccess: false,
          message: "La carpeta no existe",
          error: error.code,
          canCreate: true,
        });
      }

      throw error;
    }

    // 2. Verificar permisos de lectura
    try {
      fs.accessSync(normalizedPath, fs.constants.R_OK);
    } catch (error) {
      if (error.code === "EACCES") {
        return res.json({
          hasAccess: false,
          message: "No se tiene permiso de lectura para esta carpeta",
          error: error.code,
          details:
            "El usuario del servicio no puede leer el contenido de esta carpeta",
        });
      }

      throw error;
    }

    // 3. Verificar permisos de escritura
    try {
      fs.accessSync(normalizedPath, fs.constants.W_OK);
    } catch (error) {
      if (error.code === "EACCES") {
        return res.json({
          hasAccess: false,
          message: "No se tiene permiso de escritura para esta carpeta",
          error: error.code,
          details: "El usuario del servicio no puede escribir en esta carpeta",
        });
      }

      throw error;
    }

    // 4. Intentar crear un archivo temporal para verificar escritura efectiva
    const testFilePath = path.join(
      normalizedPath,
      ".streamvio-test-" + Date.now()
    );

    try {
      // Intentar escribir un archivo temporal
      fs.writeFileSync(testFilePath, "test");
      // Si llega aquí, la escritura fue exitosa, eliminar el archivo
      fs.unlinkSync(testFilePath);
    } catch (error) {
      return res.json({
        hasAccess: false,
        message: "No se pudo escribir en la carpeta",
        error: error.code,
        details: `Error al intentar crear un archivo de prueba: ${error.message}`,
      });
    }

    // Si llegamos aquí, todo está bien
    res.json({
      hasAccess: true,
      message: "Permisos correctos",
      path: normalizedPath,
    });
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
 * @desc    Reparar permisos de una carpeta
 * @access  Private (Admin)
 */
router.post("/fix-permissions", authMiddleware, async (req, res) => {
  const { path: folderPath } = req.body;

  // Verificar que el usuario es administrador
  try {
    const userId = req.user.id;
    const isAdmin = await db.asyncGet(
      "SELECT is_admin FROM users WHERE id = ?",
      [userId]
    );

    if (!isAdmin || isAdmin.is_admin !== 1) {
      return res.status(403).json({
        error: "Acceso denegado",
        message:
          "Se requieren privilegios de administrador para esta operación",
      });
    }
  } catch (error) {
    console.error("Error al verificar privilegios de administrador:", error);
    return res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar privilegios de administrador",
    });
  }

  if (!folderPath) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere una ruta de carpeta",
    });
  }

  // Verificar si la ruta es potencialmente peligrosa
  if (isDangerousPath(folderPath)) {
    return res.status(403).json({
      error: "Ruta peligrosa",
      message:
        "No se permite modificar permisos en esta ubicación por seguridad",
    });
  }

  try {
    // Normalizar la ruta
    const normalizedPath = normalizePath(folderPath);

    // 1. Verificar si la carpeta existe
    if (!fs.existsSync(normalizedPath)) {
      // Intentar crear la carpeta
      try {
        fs.mkdirSync(normalizedPath, { recursive: true, mode: 0o775 });
        console.log(`Carpeta creada: ${normalizedPath}`);
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "No se pudo crear la carpeta",
          error: error.message,
        });
      }
    }

    // Configurar el usuario y grupo del servicio
    const serviceUser = process.env.SERVICE_USER || "streamvio";
    const serviceGroup = process.env.SERVICE_GROUP || "streamvio";

    let fixCommand;

    // 2. Intentar reparar permisos según el sistema operativo
    if (process.platform === "win32") {
      // En Windows, usar icacls para dar permisos
      fixCommand = `icacls "${normalizedPath}" /grant:r "${
        os.userInfo().username
      }":(OI)(CI)F /Q`;
    } else {
      // En Linux/Unix, usar chown y chmod
      // Primero intentamos con comando específico para el usuario del servicio
      try {
        if (process.getuid && process.getuid() === 0) {
          // Si estamos ejecutando como root, podemos cambiar el propietario
          execSync(
            `chown -R ${serviceUser}:${serviceGroup} "${normalizedPath}"`
          );
          execSync(`chmod -R 775 "${normalizedPath}"`);

          // Opcional: Establecer el bit SGID para heredar el grupo
          execSync(`find "${normalizedPath}" -type d -exec chmod g+s {} \\;`);

          return res.json({
            success: true,
            message: "Permisos reparados correctamente como root",
            details: `Se cambió el propietario a ${serviceUser}:${serviceGroup} y se establecieron permisos 775`,
          });
        }
      } catch (error) {
        console.error("Error al reparar permisos como root:", error);
        // Continuar con alternativa si falla
      }

      // Alternativa: usar chmod para dar permisos a todos
      try {
        execSync(`chmod -R 777 "${normalizedPath}"`);
        return res.json({
          success: true,
          message: "Permisos reparados correctamente (modo permisivo)",
          details:
            "Se establecieron permisos 777 en la carpeta. Es recomendable ajustar a permisos más restrictivos manualmente.",
          warning:
            "Los permisos actuales son muy permisivos. Considera ejecutar el script add-media-folder.sh como root para configurar permisos más seguros.",
        });
      } catch (error) {
        console.error("Error al reparar permisos con chmod:", error);
        // Si también falla, intentar sugerir un comando sudo

        return res.status(500).json({
          success: false,
          message: "No se pudieron reparar los permisos automáticamente",
          error: error.message,
          suggestedCommand: `sudo chown -R ${serviceUser}:${serviceGroup} "${normalizedPath}" && sudo chmod -R 775 "${normalizedPath}"`,
          details:
            "Ejecuta el comando sugerido en una terminal con permisos de administrador",
        });
      }
    }
  } catch (error) {
    console.error(`Error al reparar permisos para ${folderPath}:`, error);

    res.status(500).json({
      success: false,
      message: "Error al reparar permisos",
      error: error.message,
    });
  }
});

module.exports = router;
