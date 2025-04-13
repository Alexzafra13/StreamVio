// server/api/controllers/metadataController.js
const metadataService = require("../../services/metadataService");
const mediaService = require("../../services/mediaService");
const {
  asyncHandler,
  createBadRequestError,
  createNotFoundError,
} = require("../middlewares/errorMiddleware");

/**
 * Buscar contenido multimedia en fuentes externas
 */
const searchMetadata = asyncHandler(async (req, res) => {
  const { title, type, year } = req.query;

  if (!title) {
    throw createBadRequestError("Se requiere un título para la búsqueda");
  }

  let results = [];

  // Por ahora solo implementamos búsqueda de películas
  if (type === "movie" || !type) {
    results = await metadataService.searchMovie(title, year);
  } else {
    throw createBadRequestError(
      `La búsqueda de tipo "${type}" no está implementada todavía`,
      "UNSUPPORTED_TYPE"
    );
  }

  res.json(results);
});

/**
 * Obtener detalles completos de una película desde TMDb
 */
const getMovieDetails = asyncHandler(async (req, res) => {
  const movieId = req.params.id;

  if (!movieId) {
    throw createBadRequestError("ID de película no válido");
  }

  const details = await metadataService.getMovieDetails(movieId);

  if (!details) {
    throw createNotFoundError("No se encontraron detalles para esta película");
  }

  res.json(details);
});

/**
 * Aplicar metadatos externos a un elemento multimedia
 */
const enrichMedia = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  // Verificar acceso al elemento
  const media = await mediaService.getMediaById(mediaId, req.user.id);

  // Intentar aplicar metadatos
  const success = await metadataService.enrichMediaItem(mediaId);

  if (!success) {
    throw createBadRequestError(
      "No se pudieron encontrar o aplicar metadatos para este elemento",
      "METADATA_FAILED"
    );
  }

  // Obtener el elemento actualizado
  const updatedMedia = await mediaService.getMediaById(mediaId, req.user.id);

  res.json({
    message: "Metadatos aplicados con éxito",
    media: updatedMedia,
  });
});

/**
 * Aplicar metadatos a todos los elementos de una biblioteca
 */
const enrichLibrary = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);

  if (isNaN(libraryId)) {
    throw createBadRequestError("ID de biblioteca no válido");
  }

  // La verificación de existencia de la biblioteca se hace en el servicio

  // Responder inmediatamente que el proceso ha iniciado
  res.json({
    message: "Proceso de enriquecimiento iniciado",
    libraryId,
    status: "processing",
  });

  // Ejecutar en segundo plano
  metadataService.enrichLibrary(libraryId).catch((error) => {
    console.error(`Error al enriquecer biblioteca ${libraryId}:`, error);
  });
});

/**
 * Aplicar manualmente metadatos de una búsqueda específica
 */
const applySpecificMetadata = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { externalId, source = "tmdb" } = req.body;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  if (!externalId) {
    throw createBadRequestError("Se requiere un ID externo");
  }

  // Verificar acceso al elemento
  await mediaService.getMediaById(mediaId, req.user.id);

  // Solo soportamos TMDb por ahora
  if (source !== "tmdb") {
    throw createBadRequestError("Fuente no soportada", "UNSUPPORTED_SOURCE");
  }

  // Aplicar metadatos específicos
  const success = await metadataService.applySpecificMetadata(
    mediaId,
    source,
    externalId
  );

  if (!success) {
    throw createBadRequestError("Error al aplicar metadatos");
  }

  // Obtener el elemento actualizado
  const updatedMedia = await mediaService.getMediaById(mediaId, req.user.id);

  res.json({
    message: "Metadatos específicos aplicados con éxito",
    media: updatedMedia,
  });
});

/**
 * Editar manualmente los metadatos de un elemento
 */
const updateManualMetadata = asyncHandler(async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { title, description, year, genre, director, actors, original_title } =
    req.body;

  if (isNaN(mediaId)) {
    throw createBadRequestError("ID de medio no válido");
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    throw createBadRequestError("No se proporcionaron datos para actualizar");
  }

  // Verificar acceso al elemento
  await mediaService.getMediaById(mediaId, req.user.id);

  // Preparar datos de actualización
  const updateData = {};

  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (year !== undefined) updateData.year = year;
  if (genre !== undefined) updateData.genre = genre;
  if (director !== undefined) updateData.director = director;
  if (actors !== undefined) updateData.actors = actors;
  if (original_title !== undefined) updateData.original_title = original_title;

  // Actualizar metadatos manualmente
  const updatedMedia = await mediaService.updateMediaItem(mediaId, updateData);

  res.json({
    message: "Metadatos actualizados manualmente",
    media: updatedMedia,
  });
});

module.exports = {
  searchMetadata,
  getMovieDetails,
  enrichMedia,
  enrichLibrary,
  applySpecificMetadata,
  updateManualMetadata,
};
