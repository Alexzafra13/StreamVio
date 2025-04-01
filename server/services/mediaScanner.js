/**
 * MediaScanner Service
 *
 * Este servicio se encarga de escanear directorios en busca de archivos multimedia,
 * extraer metadatos básicos y guardarlos en la base de datos.
 */

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const db = require("../config/database");
const tmdbService = require("./tmdbService"); // Importamos el servicio de TMDb

// Promisify para usar async/await con fs
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const execPromise = promisify(exec);

// Extensiones de archivos multimedia soportadas
const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".m4v",
  ".webm",
  ".mpg",
  ".mpeg",
  ".3gp",
  ".flv",
];

const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".flac",
  ".aac",
  ".ogg",
  ".m4a",
  ".wma",
];

const SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
];

/**
 * Verifica si un archivo es un archivo multimedia soportado
 * @param {string} filePath - Ruta del archivo
 * @returns {boolean} - True si es un archivo multimedia soportado
 */
function isMediaFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    SUPPORTED_VIDEO_EXTENSIONS.includes(ext) ||
    SUPPORTED_AUDIO_EXTENSIONS.includes(ext) ||
    SUPPORTED_IMAGE_EXTENSIONS.includes(ext)
  );
}

/**
 * Determina el tipo de archivo multimedia
 * @param {string} filePath - Ruta del archivo
 * @returns {string} - Tipo de archivo ('movie', 'music', 'photo', 'unknown')
 */
function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
    return "movie"; // Por defecto asumimos película, luego se puede refinar con análisis de metadatos
  } else if (SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
    return "music";
  } else if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    return "photo";
  }

  return "unknown";
}

/**
 * Extrae metadatos básicos de un archivo utilizando ffprobe (para video/audio)
 * @param {string} filePath - Ruta del archivo
 * @returns {Object} - Objeto con metadatos
 */
async function extractMetadata(filePath) {
  // Metadatos por defecto
  const metadata = {
    title: path.basename(filePath, path.extname(filePath)),
    duration: null,
    size: 0,
    width: null,
    height: null,
    codec: null,
    bitrate: null,
  };

  try {
    // Obtener tamaño del archivo
    const stats = await stat(filePath);
    metadata.size = stats.size;

    const type = getMediaType(filePath);

    // Para archivos de video o audio, usar ffprobe para extraer metadatos
    if (type === "movie" || type === "music") {
      try {
        // Verificar si ffprobe está disponible
        await execPromise("ffprobe -version");

        // Extraer duración, resolución, etc.
        const { stdout } = await execPromise(
          `ffprobe -v error -select_streams v:0 -show_entries format=duration,bit_rate:stream=width,height,codec_name -of json "${filePath}"`
        );

        const probeData = JSON.parse(stdout);

        if (probeData.format) {
          metadata.duration = parseFloat(probeData.format.duration) || null;
          metadata.bitrate = probeData.format.bit_rate
            ? parseInt(probeData.format.bit_rate)
            : null;
        }

        if (probeData.streams && probeData.streams.length > 0) {
          const videoStream = probeData.streams[0];
          metadata.width = videoStream.width || null;
          metadata.height = videoStream.height || null;
          metadata.codec = videoStream.codec_name || null;
        }
      } catch (error) {
        console.warn(
          `FFprobe no disponible o error al procesar ${filePath}:`,
          error.message
        );
        // Continuar sin metadatos avanzados si ffprobe falla
      }
    }

    return metadata;
  } catch (error) {
    console.error(`Error al extraer metadatos de ${filePath}:`, error);
    return metadata;
  }
}

/**
 * Genera una miniatura para un archivo de video
 * @param {string} videoPath - Ruta del archivo de video
 * @param {string} outputDir - Directorio donde guardar la miniatura
 * @returns {string|null} - Ruta de la miniatura generada o null si falla
 */
async function generateThumbnail(videoPath, outputDir) {
  const type = getMediaType(videoPath);
  if (type !== "movie") return null;

  try {
    // Verificar si ffmpeg está disponible
    await execPromise("ffmpeg -version");

    // Crear directorio de miniaturas si no existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = path.basename(videoPath, path.extname(videoPath));
    const thumbnailPath = path.join(outputDir, `${fileName}_thumb.jpg`);

    // Generar miniatura al 20% del video
    await execPromise(
      `ffmpeg -y -i "${videoPath}" -ss 00:00:20 -vframes 1 -vf "scale=320:-1" "${thumbnailPath}"`
    );

    return thumbnailPath;
  } catch (error) {
    console.warn(
      `FFmpeg no disponible o error al generar miniatura para ${videoPath}:`,
      error.message
    );
    return null;
  }
}

/**
 * Escanea recursivamente un directorio en busca de archivos multimedia
 * @param {string} directory - Directorio a escanear
 * @param {number} libraryId - ID de la biblioteca a la que pertenecen los archivos
 * @param {string} thumbnailsDir - Directorio donde guardar las miniaturas
 * @returns {Promise<Array>} - Array de archivos encontrados con sus metadatos
 */
async function scanDirectory(directory, libraryId, thumbnailsDir) {
  const mediaFiles = [];

  try {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // Recursivamente escanear subdirectorios
        const subDirFiles = await scanDirectory(
          fullPath,
          libraryId,
          thumbnailsDir
        );
        mediaFiles.push(...subDirFiles);
      } else if (entry.isFile() && isMediaFile(fullPath)) {
        // Extraer metadatos si es un archivo multimedia
        console.log(`Escaneando archivo: ${fullPath}`);
        const metadata = await extractMetadata(fullPath);
        const type = getMediaType(fullPath);

        // Generar miniatura para videos
        let thumbnailPath = null;
        if (type === "movie") {
          thumbnailPath = await generateThumbnail(fullPath, thumbnailsDir);
        }

        mediaFiles.push({
          path: fullPath,
          type,
          libraryId,
          ...metadata,
          thumbnailPath,
        });
      }
    }

    return mediaFiles;
  } catch (error) {
    console.error(`Error al escanear directorio ${directory}:`, error);
    return mediaFiles;
  }
}

/**
 * Guarda un archivo multimedia en la base de datos
 * @param {Object} mediaFile - Información del archivo
 * @returns {Promise<number>} - ID del archivo en la base de datos
 */
async function saveMediaFileToDB(mediaFile) {
  try {
    // Verificar si el archivo ya existe en la base de datos
    const existingFile = await db.asyncGet(
      "SELECT id FROM media_items WHERE file_path = ?",
      [mediaFile.path]
    );

    let mediaId;

    if (existingFile) {
      // Actualizar el archivo existente
      await db.asyncRun(
        `UPDATE media_items SET 
         title = ?, description = ?, type = ?, duration = ?, 
         size = ?, thumbnail_path = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          mediaFile.title,
          mediaFile.description || null,
          mediaFile.type,
          mediaFile.duration,
          mediaFile.size,
          mediaFile.thumbnailPath,
          existingFile.id,
        ]
      );

      console.log(`Archivo actualizado en la base de datos: ${mediaFile.path}`);
      mediaId = existingFile.id;
    } else {
      // Insertar nuevo archivo
      const result = await db.asyncRun(
        `INSERT INTO media_items 
         (library_id, title, type, file_path, duration, size, thumbnail_path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          mediaFile.libraryId,
          mediaFile.title,
          mediaFile.type,
          mediaFile.path,
          mediaFile.duration,
          mediaFile.size,
          mediaFile.thumbnailPath,
        ]
      );

      console.log(
        `Nuevo archivo añadido a la base de datos: ${mediaFile.path}`
      );
      mediaId = result.lastID;
    }

    // Intentar obtener metadatos de TMDb si es una película y está activado en configuración
    if (
      mediaFile.type === "movie" &&
      process.env.AUTO_FETCH_METADATA === "true"
    ) {
      try {
        // Ejecutar en segundo plano para no bloquear el escaneo
        setTimeout(async () => {
          try {
            console.log(`Buscando metadatos para: ${mediaFile.title}`);
            await tmdbService.enrichMediaItem(mediaId);
          } catch (metadataError) {
            console.error(
              `Error al obtener metadatos para ${mediaId}:`,
              metadataError
            );
          }
        }, 0);
      } catch (err) {
        console.error(
          `Error al configurar búsqueda de metadatos para ${mediaFile.title}:`,
          err
        );
      }
    }

    return mediaId;
  } catch (error) {
    console.error(
      `Error al guardar archivo ${mediaFile.path} en la base de datos:`,
      error
    );
    throw error;
  }
}

/**
 * Inicia un escaneo de todas las bibliotecas configuradas
 * @returns {Promise<object>} - Resultado del escaneo
 */
async function scanAllLibraries() {
  const results = {
    totalScanned: 0,
    newFiles: 0,
    updatedFiles: 0,
    failedFiles: 0,
    librariesScanned: 0,
    startTime: new Date(),
    endTime: null,
    libraries: [],
  };

  try {
    // Obtener todas las bibliotecas de la base de datos
    const libraries = await db.asyncAll("SELECT * FROM libraries");

    if (libraries.length === 0) {
      console.log("No hay bibliotecas configuradas para escanear");
      return {
        ...results,
        error: "No hay bibliotecas configuradas",
      };
    }

    // Directorio para miniaturas
    const thumbnailsDir = path.join(__dirname, "../data/thumbnails");

    // Escanear cada biblioteca
    for (const library of libraries) {
      console.log(`Escaneando biblioteca: ${library.name} (${library.path})`);

      const libraryResult = {
        id: library.id,
        name: library.name,
        path: library.path,
        filesScanned: 0,
        newFiles: 0,
        updatedFiles: 0,
        failedFiles: 0,
      };

      try {
        if (!fs.existsSync(library.path)) {
          console.error(`La ruta de la biblioteca no existe: ${library.path}`);
          libraryResult.error = "La ruta de la biblioteca no existe";
          results.libraries.push(libraryResult);
          continue;
        }

        const mediaFiles = await scanDirectory(
          library.path,
          library.id,
          thumbnailsDir
        );

        for (const mediaFile of mediaFiles) {
          try {
            const existingCount = await db.asyncGet(
              "SELECT COUNT(*) as count FROM media_items WHERE file_path = ?",
              [mediaFile.path]
            );

            const mediaId = await saveMediaFileToDB(mediaFile);

            libraryResult.filesScanned++;
            results.totalScanned++;

            if (existingCount && existingCount.count > 0) {
              libraryResult.updatedFiles++;
              results.updatedFiles++;
            } else {
              libraryResult.newFiles++;
              results.newFiles++;
            }
          } catch (error) {
            console.error(
              `Error al procesar archivo ${mediaFile.path}:`,
              error
            );
            libraryResult.failedFiles++;
            results.failedFiles++;
          }
        }

        results.librariesScanned++;
      } catch (error) {
        console.error(`Error al escanear biblioteca ${library.name}:`, error);
        libraryResult.error = error.message;
      }

      results.libraries.push(libraryResult);
    }

    results.endTime = new Date();
    results.duration = (results.endTime - results.startTime) / 1000; // en segundos

    console.log(
      `Escaneo completo. Total archivos: ${results.totalScanned}, Nuevos: ${results.newFiles}, Actualizados: ${results.updatedFiles}, Fallidos: ${results.failedFiles}`
    );

    return results;
  } catch (error) {
    console.error("Error durante el escaneo de bibliotecas:", error);

    results.endTime = new Date();
    results.duration = (results.endTime - results.startTime) / 1000;
    results.error = error.message;

    return results;
  }
}

/**
 * Escanea una biblioteca específica
 * @param {number} libraryId - ID de la biblioteca a escanear
 * @returns {Promise<object>} - Resultado del escaneo
 */
async function scanLibrary(libraryId) {
  const results = {
    libraryId,
    totalScanned: 0,
    newFiles: 0,
    updatedFiles: 0,
    failedFiles: 0,
    startTime: new Date(),
    endTime: null,
  };

  try {
    // Obtener información de la biblioteca
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);

    if (!library) {
      return {
        ...results,
        error: `No se encontró una biblioteca con ID ${libraryId}`,
      };
    }

    console.log(`Escaneando biblioteca: ${library.name} (${library.path})`);

    // Verificar que la ruta existe
    if (!fs.existsSync(library.path)) {
      return {
        ...results,
        error: `La ruta de la biblioteca no existe: ${library.path}`,
      };
    }

    // Directorio para miniaturas
    const thumbnailsDir = path.join(__dirname, "../data/thumbnails");

    // Escanear la biblioteca
    const mediaFiles = await scanDirectory(
      library.path,
      library.id,
      thumbnailsDir
    );

    for (const mediaFile of mediaFiles) {
      try {
        const existingCount = await db.asyncGet(
          "SELECT COUNT(*) as count FROM media_items WHERE file_path = ?",
          [mediaFile.path]
        );

        await saveMediaFileToDB(mediaFile);

        results.totalScanned++;

        if (existingCount && existingCount.count > 0) {
          results.updatedFiles++;
        } else {
          results.newFiles++;
        }
      } catch (error) {
        console.error(`Error al procesar archivo ${mediaFile.path}:`, error);
        results.failedFiles++;
      }
    }

    results.endTime = new Date();
    results.duration = (results.endTime - results.startTime) / 1000; // en segundos

    console.log(
      `Escaneo de biblioteca ${library.name} completo. Total archivos: ${results.totalScanned}, Nuevos: ${results.newFiles}, Actualizados: ${results.updatedFiles}, Fallidos: ${results.failedFiles}`
    );

    return results;
  } catch (error) {
    console.error(
      `Error durante el escaneo de la biblioteca ${libraryId}:`,
      error
    );

    results.endTime = new Date();
    results.duration = (results.endTime - results.startTime) / 1000;
    results.error = error.message;

    return results;
  }
}

/**
 * Programa un escaneo automático de todas las bibliotecas
 * @param {number} intervalMinutes - Intervalo en minutos entre escaneos
 * @returns {Object} - Objeto con método para detener los escaneos automáticos
 */
function scheduleAutomaticScans(intervalMinutes = 60) {
  console.log(
    `Programando escaneos automáticos cada ${intervalMinutes} minutos`
  );

  // Convertir minutos a milisegundos
  const interval = intervalMinutes * 60 * 1000;

  // Iniciar temporizador
  const timer = setInterval(async () => {
    console.log("Iniciando escaneo automático programado...");
    try {
      await scanAllLibraries();
    } catch (error) {
      console.error("Error durante el escaneo automático:", error);
    }
  }, interval);

  // Devolver objeto con método para detener los escaneos
  return {
    stop: () => {
      clearInterval(timer);
      console.log("Escaneos automáticos detenidos");
    },
  };
}

module.exports = {
  scanAllLibraries,
  scanLibrary,
  scheduleAutomaticScans,
  isMediaFile,
  getMediaType,
  extractMetadata,
  generateThumbnail,
};
