// server/routes/filesystem.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const authMiddleware = require("../middleware/auth");

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

module.exports = router;
