// server/routes/transcoding.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const db = require("../config/database");
const enhancedTranscoder = require("../services/enhancedTranscoderService");
const path = require("path");
const fs = require("fs");

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

/**
 * @route   GET /api/transcoding/jobs
 * @desc    Obtener todos los trabajos de transcodificación
 * @access  Private
 */
router.get("/jobs", async (req, res) => {
  try {
    const jobs = await db.asyncAll(
      `SELECT tj.*, mi.title as media_title, mi.type as media_type
       FROM transcoding_jobs tj
       LEFT JOIN media_items mi ON tj.media_id = mi.id
       ORDER BY tj.started_at DESC
       LIMIT 100`
    );

    res.json(jobs);
  } catch (error) {
    console.error("Error al obtener trabajos de transcodificación:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener los trabajos de transcodificación",
    });
  }
});

/**
 * @route   GET /api/transcoding/jobs/:id
 * @desc    Obtener detalles de un trabajo de transcodificación
 * @access  Private
 */
router.get("/jobs/:id", async (req, res) => {
  const jobId = req.params.id;

  try {
    // Primero intentar obtener estado de trabajo activo
    try {
      const jobStatus = await enhancedTranscoder.getTranscodeJobStatus(jobId);
      return res.json(jobStatus);
    } catch (error) {
      // Si no está activo, buscar en la base de datos
      const job = await db.asyncGet(
        `SELECT tj.*, mi.title as media_title, mi.type as media_type
         FROM transcoding_jobs tj
         LEFT JOIN media_items mi ON tj.media_id = mi.id
         WHERE tj.id = ?`,
        [jobId]
      );

      if (!job) {
        return res.status(404).json({
          error: "No encontrado",
          message: "Trabajo de transcodificación no encontrado",
        });
      }

      res.json(job);
    }
  } catch (error) {
    console.error(
      `Error al obtener trabajo de transcodificación ${jobId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener el trabajo de transcodificación",
    });
  }
});

/**
 * @route   POST /api/transcoding/jobs/:id/cancel
 * @desc    Cancelar un trabajo de transcodificación
 * @access  Private
 */
router.post("/jobs/:id/cancel", async (req, res) => {
  const jobId = req.params.id;

  try {
    const result = await enhancedTranscoder.cancelTranscodeJob(jobId);
    res.json({
      message: "Trabajo de transcodificación cancelado exitosamente",
      ...result,
    });
  } catch (error) {
    console.error(
      `Error al cancelar trabajo de transcodificación ${jobId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message:
        error.message || "Error al cancelar el trabajo de transcodificación",
    });
  }
});

/**
 * @route   POST /api/transcoding/media/:id
 * @desc    Iniciar transcodificación para un elemento multimedia
 * @access  Private
 */
router.post("/media/:id", async (req, res) => {
  const mediaId = req.params.id;
  const { profile, forceRegenerate } = req.body;

  try {
    // Obtener información del elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Verificar que es un tipo de archivo que se puede transcodificar
    if (!["movie", "episode", "music"].includes(mediaItem.type)) {
      return res.status(400).json({
        error: "Tipo no soportado",
        message: `No se puede transcodificar elementos de tipo ${mediaItem.type}`,
      });
    }

    // Verificar que el archivo existe
    if (!mediaItem.file_path || !fs.existsSync(mediaItem.file_path)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo multimedia no existe en el sistema",
      });
    }

    // Configurar opciones de transcodificación
    const options = {
      profile: profile || "standard",
      forceRegenerate: forceRegenerate === true,
    };

    // Iniciar transcodificación
    const job = await enhancedTranscoder.startTranscodeJob(
      mediaId,
      mediaItem.file_path,
      options
    );

    res.json({
      message: "Transcodificación iniciada exitosamente",
      ...job,
    });
  } catch (error) {
    console.error(`Error al iniciar transcodificación para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: error.message || "Error al iniciar la transcodificación",
    });
  }
});

/**
 * @route   POST /api/transcoding/media/:id/hls
 * @desc    Crear streaming HLS para un elemento multimedia
 * @access  Private
 */
router.post("/media/:id/hls", async (req, res) => {
  const mediaId = req.params.id;
  const { maxHeight, forceRegenerate } = req.body;

  try {
    // Obtener información del elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Verificar que es un tipo de archivo que se puede convertir a HLS
    if (!["movie", "episode"].includes(mediaItem.type)) {
      return res.status(400).json({
        error: "Tipo no soportado",
        message: `No se puede crear streaming HLS para elementos de tipo ${mediaItem.type}`,
      });
    }

    // Verificar que el archivo existe
    if (!mediaItem.file_path || !fs.existsSync(mediaItem.file_path)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo multimedia no existe en el sistema",
      });
    }

    // Configurar opciones de HLS
    const options = {
      maxHeight: maxHeight ? parseInt(maxHeight) : undefined,
      forceRegenerate: forceRegenerate === true,
    };

    // Iniciar proceso de HLS de forma asíncrona
    const job = await enhancedTranscoder.createHLSStream(
      mediaId,
      mediaItem.file_path,
      options
    );

    res.json({
      message: "Generación de streaming HLS iniciada exitosamente",
      ...job,
    });
  } catch (error) {
    console.error(`Error al crear streaming HLS para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: error.message || "Error al crear streaming HLS",
    });
  }
});

/**
 * @route   GET /api/transcoding/media/:id/thumbnail
 * @desc    Generar o recuperar una miniatura para un elemento multimedia
 * @access  Private
 */
router.get("/media/:id/thumbnail", async (req, res) => {
  const mediaId = req.params.id;
  const { timeOffset, regenerate } = req.query;

  try {
    // Obtener información del elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Si ya tiene una miniatura y no se pide regenerar, devolverla
    if (
      mediaItem.thumbnail_path &&
      fs.existsSync(mediaItem.thumbnail_path) &&
      regenerate !== "true"
    ) {
      return res.sendFile(mediaItem.thumbnail_path);
    }

    // Verificar que es un tipo de archivo que puede tener miniatura
    if (!["movie", "episode", "photo"].includes(mediaItem.type)) {
      return res.status(400).json({
        error: "Tipo no soportado",
        message: `No se puede generar miniatura para elementos de tipo ${mediaItem.type}`,
      });
    }

    // Verificar que el archivo existe
    if (!mediaItem.file_path || !fs.existsSync(mediaItem.file_path)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo multimedia no existe en el sistema",
      });
    }

    // Generar miniatura
    const offset = timeOffset ? parseInt(timeOffset) : 5;
    const thumbnailPath = await enhancedTranscoder.generateThumbnail(
      mediaItem.file_path,
      offset
    );

    // Actualizar el elemento multimedia con la ruta de la miniatura
    await db.asyncRun(
      "UPDATE media_items SET thumbnail_path = ? WHERE id = ?",
      [thumbnailPath, mediaId]
    );

    // Devolver la miniatura
    res.sendFile(thumbnailPath);
  } catch (error) {
    console.error(`Error al generar miniatura para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: error.message || "Error al generar la miniatura",
    });
  }
});

/**
 * @route   GET /api/transcoding/media/:id/storyboard
 * @desc    Generar o recuperar un storyboard para un elemento multimedia
 * @access  Private
 */
router.get("/media/:id/storyboard", async (req, res) => {
  const mediaId = req.params.id;
  const { count, regenerate } = req.query;

  try {
    // Obtener información del elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Verificar que es un video
    if (!["movie", "episode"].includes(mediaItem.type)) {
      return res.status(400).json({
        error: "Tipo no soportado",
        message: `No se puede generar storyboard para elementos de tipo ${mediaItem.type}`,
      });
    }

    // Verificar que el archivo existe
    if (!mediaItem.file_path || !fs.existsSync(mediaItem.file_path)) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo multimedia no existe en el sistema",
      });
    }

    // Comprobar si ya existe un storyboard
    const fileName = path.basename(
      mediaItem.file_path,
      path.extname(mediaItem.file_path)
    );
    const storyboardDir = path.join(
      enhancedTranscoder.thumbnailsDir,
      `${fileName}_storyboard`
    );

    if (fs.existsSync(storyboardDir) && regenerate !== "true") {
      // Leer las miniaturas existentes
      const files = fs.readdirSync(storyboardDir);
      const thumbnails = files
        .filter((f) => f.endsWith(".jpg"))
        .map((f) => {
          const matches = f.match(/_thumb_(\d+)\.jpg$/);
          const index = matches ? parseInt(matches[1]) : 0;

          return {
            path: path.join(storyboardDir, f),
            index,
            url: `/api/transcoding/storyboard/${mediaId}/${index}`,
          };
        })
        .sort((a, b) => a.index - b.index);

      return res.json({
        mediaId,
        thumbnails,
        count: thumbnails.length,
      });
    }

    // Generar storyboard
    const numThumbnails = count ? parseInt(count) : 10;
    const storyboard = await enhancedTranscoder.generatePreviewStoryboard(
      mediaItem.file_path,
      numThumbnails
    );

    // Preparar respuesta
    const thumbnails = storyboard.thumbnails.map((thumb) => ({
      ...thumb,
      url: `/api/transcoding/storyboard/${mediaId}/${thumb.index}`,
    }));

    res.json({
      mediaId,
      thumbnails,
      count: thumbnails.length,
    });
  } catch (error) {
    console.error(`Error al generar storyboard para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: error.message || "Error al generar el storyboard",
    });
  }
});

/**
 * @route   GET /api/transcoding/storyboard/:id/:index
 * @desc    Obtener una miniatura específica del storyboard
 * @access  Private
 */
router.get("/storyboard/:id/:index", async (req, res) => {
  const mediaId = req.params.id;
  const index = parseInt(req.params.index);

  try {
    // Obtener información del elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Construir la ruta de la miniatura
    const fileName = path.basename(
      mediaItem.file_path,
      path.extname(mediaItem.file_path)
    );
    const storyboardDir = path.join(
      enhancedTranscoder.thumbnailsDir,
      `${fileName}_storyboard`
    );
    const thumbnailPath = path.join(
      storyboardDir,
      `${fileName}_thumb_${index}.jpg`
    );

    // Verificar que la miniatura existe
    if (!fs.existsSync(thumbnailPath)) {
      return res.status(404).json({
        error: "No encontrada",
        message: "Miniatura no encontrada",
      });
    }

    // Devolver la miniatura
    res.sendFile(thumbnailPath);
  } catch (error) {
    console.error(
      `Error al obtener miniatura de storyboard para ${mediaId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: error.message || "Error al obtener la miniatura",
    });
  }
});

/**
 * @route   GET /api/transcoding/profiles
 * @desc    Obtener perfiles de transcodificación disponibles
 * @access  Private
 */
router.get("/profiles", (req, res) => {
  // Obtener perfiles del servicio
  const profiles = enhancedTranscoder.profiles || {
    "mobile-low": { description: "Baja calidad para datos móviles" },
    "mobile-high": { description: "Alta calidad para dispositivos móviles" },
    standard: { description: "Calidad estándar para computadoras y TV" },
    high: { description: "Alta calidad para TV Full HD" },
    ultra: { description: "Máxima calidad para TV 4K" },
    "audio-only": { description: "Solo audio, sin video" },
  };

  // Añadir descripciones amigables
  const profilesWithDescriptions = Object.entries(profiles).map(
    ([key, profile]) => {
      const description = profile.description || "Perfil de transcodificación";

      return {
        id: key,
        name: formatProfileName(key),
        description,
        ...profile,
      };
    }
  );

  res.json(profilesWithDescriptions);
});

// Función auxiliar para formatear nombres de perfiles
function formatProfileName(profileId) {
  switch (profileId) {
    case "mobile-low":
      return "Móvil (Datos)";
    case "mobile-high":
      return "Móvil (WiFi)";
    case "standard":
      return "Estándar (720p)";
    case "high":
      return "Alta (1080p)";
    case "ultra":
      return "Ultra (4K)";
    case "audio-only":
      return "Solo Audio";
    default:
      return (
        profileId.charAt(0).toUpperCase() +
        profileId.slice(1).replace(/-/g, " ")
      );
  }
}

module.exports = router;
