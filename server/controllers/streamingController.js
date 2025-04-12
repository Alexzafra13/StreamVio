// server/api/controllers/streamingController.js
const streamingService = require("../../services/streamingService");
const mediaService = require("../../services/mediaService");
const {
  asyncHandler,
  createBadRequestError,
  createNotFoundError,
} = require("../middlewares/errorMiddleware");

/**
 * Transmitir un archivo multimedia con soporte para streaming parcial
 */
const streamMedia = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Usar el servicio de streaming para manejar la solicitud
  const result = await streamingService.handleStreamRequest(
    req,
    res,
    mediaId,
    req.user
  );

  // Si el servicio devuelve false, hubo un error que ya fue manejado
  if (result === false && !res.headersSent) {
    throw createNotFoundError("Error al procesar el streaming");
  }
});

/**
 * Obtener información de opciones de streaming disponibles
 */
const getStreamingOptions = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Extraer token para incluirlo en las URLs de streaming
  let token = null;

  if (req.headers.authorization) {
    token = req.headers.authorization.replace("Bearer ", "");
  } else if (req.query.auth || req.query.token) {
    token = req.query.auth || req.query.token;
  }

  const options = await streamingService.getStreamingOptions(mediaId, token);
  res.json(options);
});

/**
 * Servir streaming HLS (HTTP Live Streaming)
 */
const streamHLS = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const playlistPath = req.params.playlist || "master.m3u8";

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Verificar acceso al elemento
  await mediaService.getMediaById(mediaId, req.user.id);

  // Registrar la visualización en el historial
  streamingService.recordWatching(req.user.id, mediaId).catch((err) => {
    console.warn(`Error al registrar visualización HLS: ${err.message}`);
  });

  // Obtener la ruta del archivo HLS
  const hlsFilePath = await streamingService.getHLSPath(mediaId, playlistPath);

  if (!hlsFilePath) {
    throw createNotFoundError("Stream HLS no disponible para este elemento");
  }

  // Configurar cabeceras según el tipo de archivo
  if (playlistPath.endsWith(".m3u8")) {
    res.set("Content-Type", "application/vnd.apple.mpegurl");
  } else if (playlistPath.endsWith(".ts")) {
    res.set("Content-Type", "video/mp2t");
  }

  // Configurar cabeceras de cache
  res.set({
    "Cache-Control": "public, max-age=3600", // Cache durante 1 hora para segmentos
  });

  // Enviar archivo
  res.sendFile(hlsFilePath);
});

/**
 * Actualizar progreso de visualización
 */
const updateProgress = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;
  const { position, completed } = req.body;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  if (position === undefined) {
    throw createBadRequestError("Se requiere la posición de reproducción");
  }

  const result = await mediaService.updateWatchProgress(userId, mediaId, {
    position,
    completed,
  });

  res.json(result);
});

/**
 * Obtener progreso de visualización
 */
const getProgress = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  const progress = await mediaService.getWatchProgress(userId, mediaId);
  res.json(progress);
});

module.exports = {
  streamMedia,
  getStreamingOptions,
  streamHLS,
  updateProgress,
  getProgress,
};
