// server/api/controllers/transcodingController.js
const path = require("path");
const transcodingService = require("../../services/transcodingService");
const mediaService = require("../../services/mediaService");
const {
  asyncHandler,
  createBadRequestError,
  createNotFoundError,
} = require("../middlewares/errorMiddleware");

/**
 * Obtener lista de trabajos de transcodificación
 */
const getTranscodingJobs = asyncHandler(async (req, res) => {
  const { status, limit = 20 } = req.query;
  const jobs = await transcodingService.getJobs({
    status: status,
    limit: parseInt(limit),
  });

  res.json(jobs);
});

/**
 * Obtener detalles de un trabajo específico
 */
const getJobDetails = asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  if (!jobId) {
    throw createBadRequestError("ID de trabajo no válido");
  }

  const job = await transcodingService.getJobById(jobId);

  if (!job) {
    throw createNotFoundError("Trabajo de transcodificación no encontrado");
  }

  res.json(job);
});

/**
 * Iniciar un trabajo de transcodificación para un elemento multimedia
 */
const startTranscoding = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { profile = "standard", forceRegenerate = false } = req.body;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Verificar acceso al elemento
  const media = await mediaService.getMediaById(mediaId, req.user.id);

  // Verificar si es un tipo soportado para transcodificación
  if (!["movie", "episode", "music"].includes(media.type)) {
    throw createBadRequestError(
      `No se puede transcodificar elementos de tipo ${media.type}`,
      "UNSUPPORTED_TYPE"
    );
  }

  // Verificar si el archivo original existe
  if (!media.file_path) {
    throw createNotFoundError("El archivo multimedia no existe");
  }

  // Iniciar transcodificación con las opciones especificadas
  const job = await transcodingService.startTranscodeJob(
    mediaId,
    media.file_path,
    { profile, forceRegenerate }
  );

  res.status(201).json({
    message: "Transcodificación iniciada exitosamente",
    job,
  });
});

/**
 * Generar versión HLS para un elemento multimedia
 */
const createHLSStream = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { maxHeight, forceRegenerate = false } = req.body;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Verificar acceso al elemento
  const media = await mediaService.getMediaById(mediaId, req.user.id);

  // Verificar si es un tipo soportado para HLS
  if (!["movie", "episode"].includes(media.type)) {
    throw createBadRequestError(
      `No se puede crear streaming HLS para elementos de tipo ${media.type}`,
      "UNSUPPORTED_TYPE"
    );
  }

  // Iniciar generación de HLS
  const options = {
    maxHeight: maxHeight ? parseInt(maxHeight) : undefined,
    forceRegenerate,
  };

  const job = await transcodingService.createHLSStream(
    mediaId,
    media.file_path,
    options
  );

  res.status(201).json({
    message: "Generación de streaming HLS iniciada exitosamente",
    job,
  });
});

/**
 * Generar o recuperar una miniatura para un elemento multimedia
 */
const generateThumbnail = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { timeOffset = 5, regenerate = false } = req.query;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Verificar acceso al elemento
  const media = await mediaService.getMediaById(mediaId, req.user.id);

  // Si ya tiene una miniatura y no se pide regenerar, devolverla
  if (
    media.thumbnail_path &&
    !regenerate &&
    fs.existsSync(media.thumbnail_path)
  ) {
    return res.sendFile(media.thumbnail_path);
  }

  // Verificar si es un tipo soportado para miniaturas
  if (!["movie", "episode", "photo"].includes(media.type)) {
    throw createBadRequestError(
      `No se puede generar miniatura para elementos de tipo ${media.type}`,
      "UNSUPPORTED_TYPE"
    );
  }

  // Generar miniatura
  const thumbnailPath = await transcodingService.generateThumbnail(
    media.file_path,
    parseInt(timeOffset)
  );

  if (!thumbnailPath) {
    throw createBadRequestError("No se pudo generar la miniatura");
  }

  // Actualizar ruta en la base de datos
  await mediaService.updateThumbnail(mediaId, thumbnailPath);

  // Enviar la miniatura
  res.sendFile(thumbnailPath);
});

/**
 * Cancelar un trabajo de transcodificación
 */
const cancelJob = asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  if (!jobId) {
    throw createBadRequestError("ID de trabajo no válido");
  }

  const result = await transcodingService.cancelJob(jobId);

  if (!result.success) {
    throw createBadRequestError(
      result.message || "No se pudo cancelar el trabajo"
    );
  }

  res.json({
    message: "Trabajo cancelado exitosamente",
    jobId,
  });
});

/**
 * Obtener perfiles de transcodificación disponibles
 */
const getProfiles = asyncHandler(async (req, res) => {
  const profiles = transcodingService.getAvailableProfiles();
  res.json(profiles);
});

module.exports = {
  getTranscodingJobs,
  getJobDetails,
  startTranscoding,
  createHLSStream,
  generateThumbnail,
  cancelJob,
  getProfiles,
};
