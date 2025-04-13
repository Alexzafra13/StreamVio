// server/utils/filesystem.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { createReadStream, createWriteStream } = require("fs");
const { pipeline } = require("stream");
const { createHash } = require("crypto");
const logger = require("./logger");
const { BadRequestError, InternalServerError } = require("./errors");

// Promisificar las funciones asíncronas del módulo fs
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);
const chmod = promisify(fs.chmod);
const access = promisify(fs.access);
const rm = promisify(fs.rm);
const copyFile = promisify(fs.copyFile);
const pipelineAsync = promisify(pipeline);

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("Filesystem");

/**
 * Verifica si un archivo o directorio existe
 * @param {string} filePath - Ruta del archivo o directorio
 * @returns {Promise<boolean>} - true si existe
 */
async function exists(filePath) {
  try {
    await access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Verifica si un archivo o directorio es accesible para lectura
 * @param {string} filePath - Ruta del archivo o directorio
 * @returns {Promise<boolean>} - true si se puede leer
 */
async function isReadable(filePath) {
  try {
    await access(filePath, fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Verifica si un archivo o directorio es accesible para escritura
 * @param {string} filePath - Ruta del archivo o directorio
 * @returns {Promise<boolean>} - true si se puede escribir
 */
async function isWritable(filePath) {
  try {
    await access(filePath, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Obtiene información de un archivo o directorio
 * @param {string} filePath - Ruta del archivo o directorio
 * @returns {Promise<Object>} - Información del archivo o null si no existe
 */
async function getFileInfo(filePath) {
  try {
    const stats = await stat(filePath);

    return {
      path: filePath,
      name: path.basename(filePath),
      ext: path.extname(filePath),
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      isSymbolicLink: stats.isSymbolicLink(),
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      permissions: stats.mode,
      exists: true,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return null; // No existe
    }

    log.error(`Error al obtener información de ${filePath}:`, { error });
    throw new InternalServerError(
      `Error al acceder a ${filePath}`,
      "FILESYSTEM_ERROR",
      { error }
    );
  }
}

/**
 * Calcula el hash MD5 de un archivo
 * @param {string} filePath - Ruta del archivo
 * @returns {Promise<string>} - Hash MD5 en hexadecimal
 */
async function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = createHash("md5");
      const stream = createReadStream(filePath);

      stream.on("error", (error) => {
        reject(
          new InternalServerError(
            `Error al leer archivo para hash: ${filePath}`,
            "FILE_READ_ERROR",
            { error }
          )
        );
      });

      stream.on("data", (chunk) => hash.update(chunk));

      stream.on("end", () => {
        resolve(hash.digest("hex"));
      });
    } catch (error) {
      reject(
        new InternalServerError(
          `Error al calcular hash: ${filePath}`,
          "HASH_CALCULATION_ERROR",
          { error }
        )
      );
    }
  });
}

/**
 * Crea un directorio recursivamente
 * @param {string} dirPath - Ruta del directorio a crear
 * @returns {Promise<string>} - Ruta del directorio creado
 */
async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
    return dirPath;
  } catch (error) {
    log.error(`Error al crear directorio ${dirPath}:`, { error });
    throw new InternalServerError(
      `Error al crear directorio: ${dirPath}`,
      "DIR_CREATE_ERROR",
      { error }
    );
  }
}

/**
 * Obtiene el contenido de un directorio
 * @param {string} dirPath - Ruta del directorio
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Array>} - Lista de archivos y directorios
 */
async function readDirectory(dirPath, options = {}) {
  const {
    withFileTypes = true,
    includeStats = false,
    recursive = false,
    filter = null,
  } = options;

  try {
    // Verificar que el directorio existe
    const stats = await stat(dirPath);

    if (!stats.isDirectory()) {
      throw new BadRequestError(
        `${dirPath} no es un directorio`,
        "NOT_A_DIRECTORY"
      );
    }

    // Leer contenido del directorio
    const entries = await readdir(dirPath, { withFileTypes: true });

    // Procesar los resultados
    let results = [];

    for (const entry of entries) {
      // Aplicar filtro si existe
      if (filter && !filter(entry.name, entry.isDirectory())) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);

      let item = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        isSymbolicLink: entry.isSymbolicLink(),
      };

      // Agregar estadísticas detalladas si se solicitan
      if (includeStats) {
        const fileStats = await stat(fullPath);
        item = {
          ...item,
          size: fileStats.size,
          created: fileStats.birthtime,
          modified: fileStats.mtime,
          accessed: fileStats.atime,
        };
      }

      results.push(item);

      // Recursión para directorios si está habilitada
      if (recursive && entry.isDirectory()) {
        const subResults = await readDirectory(fullPath, options);
        results = results.concat(subResults);
      }
    }

    return results;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error; // Re-lanzar errores ya manejados
    }

    log.error(`Error al leer directorio ${dirPath}:`, { error });

    if (error.code === "ENOENT") {
      throw new BadRequestError(
        `Directorio no encontrado: ${dirPath}`,
        "DIRECTORY_NOT_FOUND"
      );
    } else if (error.code === "EACCES") {
      throw new BadRequestError(
        `Sin permisos para acceder a: ${dirPath}`,
        "PERMISSION_DENIED"
      );
    }

    throw new InternalServerError(
      `Error al leer directorio: ${dirPath}`,
      "DIR_READ_ERROR",
      { error }
    );
  }
}

/**
 * Escribe datos en un archivo
 * @param {string} filePath - Ruta del archivo
 * @param {string|Buffer} data - Datos a escribir
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} - Ruta del archivo escrito
 */
async function writeToFile(filePath, data, options = {}) {
  const { encoding = "utf8", flag = "w", mode = 0o666 } = options;

  try {
    // Asegurar que el directorio existe
    await ensureDir(path.dirname(filePath));

    // Escribir el archivo
    await writeFile(filePath, data, { encoding, flag, mode });

    return filePath;
  } catch (error) {
    log.error(`Error al escribir en ${filePath}:`, { error });
    throw new InternalServerError(
      `Error al escribir archivo: ${filePath}`,
      "FILE_WRITE_ERROR",
      { error }
    );
  }
}

/**
 * Copia un archivo
 * @param {string} source - Ruta del archivo origen
 * @param {string} destination - Ruta del archivo destino
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} - Ruta del archivo destino
 */
async function copyFileAsync(source, destination, options = {}) {
  const { overwrite = false, createDir = true } = options;

  try {
    // Verificar que el archivo origen existe
    if (!(await exists(source))) {
      throw new BadRequestError(
        `Archivo origen no encontrado: ${source}`,
        "SOURCE_NOT_FOUND"
      );
    }

    // Verificar si el destino existe y si se debe sobrescribir
    if (!overwrite && (await exists(destination))) {
      throw new BadRequestError(
        `El archivo destino ya existe: ${destination}`,
        "DESTINATION_EXISTS"
      );
    }

    // Crear directorio destino si no existe
    if (createDir) {
      await ensureDir(path.dirname(destination));
    }

    // Copiar el archivo
    await copyFile(source, destination);

    return destination;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    log.error(`Error al copiar de ${source} a ${destination}:`, { error });
    throw new InternalServerError(
      `Error al copiar archivo`,
      "FILE_COPY_ERROR",
      { error, source, destination }
    );
  }
}

/**
 * Mueve un archivo
 * @param {string} source - Ruta del archivo origen
 * @param {string} destination - Ruta del archivo destino
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} - Ruta del archivo destino
 */
async function moveFile(source, destination, options = {}) {
  const { overwrite = false, createDir = true } = options;

  try {
    // Verificar que el archivo origen existe
    if (!(await exists(source))) {
      throw new BadRequestError(
        `Archivo origen no encontrado: ${source}`,
        "SOURCE_NOT_FOUND"
      );
    }

    // Verificar si el destino existe y si se debe sobrescribir
    if (!overwrite && (await exists(destination))) {
      throw new BadRequestError(
        `El archivo destino ya existe: ${destination}`,
        "DESTINATION_EXISTS"
      );
    }

    // Crear directorio destino si no existe
    if (createDir) {
      await ensureDir(path.dirname(destination));
    }

    // Mover el archivo
    await rename(source, destination);

    return destination;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    log.error(`Error al mover de ${source} a ${destination}:`, { error });
    throw new InternalServerError(`Error al mover archivo`, "FILE_MOVE_ERROR", {
      error,
      source,
      destination,
    });
  }
}

/**
 * Elimina un archivo o directorio
 * @param {string} filePath - Ruta del archivo o directorio
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
async function removeFile(filePath, options = {}) {
  const { recursive = false, force = false, onlyIfExists = true } = options;

  try {
    // Verificar si existe
    const fileExists = await exists(filePath);

    if (!fileExists) {
      if (onlyIfExists) {
        return true; // No hacer nada si no existe y onlyIfExists es true
      } else {
        throw new BadRequestError(
          `Archivo no encontrado: ${filePath}`,
          "FILE_NOT_FOUND"
        );
      }
    }

    // Verificar si es un directorio
    const fileInfo = await getFileInfo(filePath);

    if (fileInfo.isDirectory) {
      await rm(filePath, { recursive, force });
    } else {
      await unlink(filePath);
    }

    return true;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    log.error(`Error al eliminar ${filePath}:`, { error });
    throw new InternalServerError(
      `Error al eliminar archivo o directorio: ${filePath}`,
      "FILE_DELETE_ERROR",
      { error }
    );
  }
}

/**
 * Crea un archivo temporal
 * @param {string} prefix - Prefijo para el nombre del archivo
 * @param {string|Buffer} data - Datos a escribir (opcional)
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Información del archivo temporal
 */
async function createTempFile(prefix = "tmp-", data = null, options = {}) {
  const { dir = require("os").tmpdir(), ext = "", encoding = "utf8" } = options;

  try {
    // Generar nombre único
    const filename = `${prefix}${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}${ext}`;
    const filePath = path.join(dir, filename);

    // Escribir datos si se proporcionan
    if (data !== null) {
      await writeToFile(filePath, data, { encoding });
    } else {
      // Crear archivo vacío
      await writeToFile(filePath, "");
    }

    // Obtener información del archivo
    const fileInfo = await getFileInfo(filePath);

    return {
      ...fileInfo,
      isTemp: true,
    };
  } catch (error) {
    log.error("Error al crear archivo temporal:", { error });
    throw new InternalServerError(
      "Error al crear archivo temporal",
      "TEMP_FILE_ERROR",
      { error }
    );
  }
}

/**
 * Lee un archivo a texto
 * @param {string} filePath - Ruta del archivo
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} - Contenido del archivo
 */
async function readTextFile(filePath, options = {}) {
  const { encoding = "utf8" } = options;

  try {
    if (!(await exists(filePath))) {
      throw new BadRequestError(
        `Archivo no encontrado: ${filePath}`,
        "FILE_NOT_FOUND"
      );
    }

    return await readFile(filePath, { encoding });
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    log.error(`Error al leer archivo ${filePath}:`, { error });
    throw new InternalServerError(
      `Error al leer archivo: ${filePath}`,
      "FILE_READ_ERROR",
      { error }
    );
  }
}

/**
 * Lee un archivo binario
 * @param {string} filePath - Ruta del archivo
 * @returns {Promise<Buffer>} - Contenido del archivo como Buffer
 */
async function readBinaryFile(filePath) {
  try {
    if (!(await exists(filePath))) {
      throw new BadRequestError(
        `Archivo no encontrado: ${filePath}`,
        "FILE_NOT_FOUND"
      );
    }

    return await readFile(filePath);
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    log.error(`Error al leer archivo binario ${filePath}:`, { error });
    throw new InternalServerError(
      `Error al leer archivo binario: ${filePath}`,
      "BINARY_FILE_READ_ERROR",
      { error }
    );
  }
}

/**
 * Copia un archivo utilizando streams
 * @param {string} source - Ruta del archivo origen
 * @param {string} destination - Ruta del archivo destino
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} - Ruta del archivo destino
 */
async function copyFileStream(source, destination, options = {}) {
  const { overwrite = false, createDir = true } = options;

  try {
    // Verificar que el archivo origen existe
    if (!(await exists(source))) {
      throw new BadRequestError(
        `Archivo origen no encontrado: ${source}`,
        "SOURCE_NOT_FOUND"
      );
    }

    // Verificar si el destino existe y si se debe sobrescribir
    if (!overwrite && (await exists(destination))) {
      throw new BadRequestError(
        `El archivo destino ya existe: ${destination}`,
        "DESTINATION_EXISTS"
      );
    }

    // Crear directorio destino si no existe
    if (createDir) {
      await ensureDir(path.dirname(destination));
    }

    // Copiar el archivo con streams
    const sourceStream = createReadStream(source);
    const destStream = createWriteStream(destination);

    await pipelineAsync(sourceStream, destStream);

    return destination;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    log.error(`Error al copiar por stream de ${source} a ${destination}:`, {
      error,
    });
    throw new InternalServerError(
      `Error al copiar archivo por stream`,
      "STREAM_COPY_ERROR",
      { error, source, destination }
    );
  }
}

/**
 * Cambia los permisos de un archivo o directorio
 * @param {string} filePath - Ruta del archivo
 * @param {number} mode - Modo de permisos (octal)
 * @returns {Promise<boolean>} - true si se cambió correctamente
 */
async function changePermissions(filePath, mode) {
  try {
    if (!(await exists(filePath))) {
      throw new BadRequestError(
        `Archivo no encontrado: ${filePath}`,
        "FILE_NOT_FOUND"
      );
    }

    await chmod(filePath, mode);
    return true;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    log.error(`Error al cambiar permisos de ${filePath}:`, { error });
    throw new InternalServerError(
      `Error al cambiar permisos: ${filePath}`,
      "CHMOD_ERROR",
      { error }
    );
  }
}

/**
 * Normaliza una ruta de archivo
 * @param {string} filePath - Ruta a normalizar
 * @returns {string} - Ruta normalizada
 */
function normalizePath(filePath) {
  if (!filePath) return "";

  // Normalizar y usar siempre barras diagonales (/)
  return path.normalize(filePath).replace(/\\/g, "/");
}

/**
 * Determina el tipo de archivo basado en su extensión
 * @param {string} filePath - Ruta del archivo
 * @returns {string} - Tipo de archivo (video, audio, image, text, etc.)
 */
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const types = {
    // Video
    ".mp4": "video",
    ".mkv": "video",
    ".avi": "video",
    ".mov": "video",
    ".wmv": "video",
    ".flv": "video",
    ".webm": "video",

    // Audio
    ".mp3": "audio",
    ".wav": "audio",
    ".ogg": "audio",
    ".flac": "audio",
    ".aac": "audio",
    ".m4a": "audio",

    // Imagen
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".gif": "image",
    ".webp": "image",
    ".svg": "image",
    ".bmp": "image",

    // Texto
    ".txt": "text",
    ".md": "text",
    ".html": "text",
    ".css": "text",
    ".js": "text",
    ".json": "text",
    ".xml": "text",

    // Documentos
    ".pdf": "document",
    ".doc": "document",
    ".docx": "document",
    ".xls": "document",
    ".xlsx": "document",
    ".ppt": "document",
    ".pptx": "document",

    // Comprimidos
    ".zip": "archive",
    ".rar": "archive",
    ".7z": "archive",
    ".tar": "archive",
    ".gz": "archive",
  };

  return types[ext] || "unknown";
}

/**
 * Determina el tipo MIME basado en la extensión del archivo
 * @param {string} filePath - Ruta del archivo
 * @returns {string} - Tipo MIME
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    // Video
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv",
    ".webm": "video/webm",

    // Audio
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",

    // Imagen
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",

    // Texto
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".xml": "application/xml",

    // Documentos
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // Comprimidos
    ".zip": "application/zip",
    ".rar": "application/x-rar-compressed",
    ".7z": "application/x-7z-compressed",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Formatea el tamaño de archivo para visualización
 * @param {number} size - Tamaño en bytes
 * @param {number} decimals - Número de decimales a mostrar
 * @returns {string} - Tamaño formateado (ej: "1.5 MB")
 */
function formatFileSize(size, decimals = 2) {
  if (size === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(size) / Math.log(k));

  return parseFloat((size / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Exportar todas las funciones
module.exports = {
  exists,
  isReadable,
  isWritable,
  getFileInfo,
  getFileHash,
  ensureDir,
  readDirectory,
  writeToFile,
  copyFileAsync,
  moveFile,
  removeFile,
  createTempFile,
  readTextFile,
  readBinaryFile,
  copyFileStream,
  changePermissions,
  normalizePath,
  getFileType,
  getMimeType,
  formatFileSize,
};
