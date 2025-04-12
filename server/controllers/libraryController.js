// server/api/controllers/libraryController.js
const fs = require("fs");
const libraryRepository = require("../../data/repositories/libraryRepository");
const scannerService = require("../../services/scannerService");
const metadataService = require("../../services/metadataService");
const {
  asyncHandler,
  createBadRequestError,
  createNotFoundError,
  createForbiddenError,
} = require("../middlewares/errorMiddleware");
const eventBus = require("../../services/eventBus");

/**
 * Obtener todas las bibliotecas accesibles para el usuario
 */
const getLibraries = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const includeItemCount = req.query.count === "true";

  const libraries = await libraryRepository.findAccessibleByUser(
    userId,
    includeItemCount
  );

  res.json(libraries);
});

/**
 * Obtener una biblioteca por ID
 */
const getLibraryById = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);

  if (isNaN(libraryId)) {
    throw createBadRequestError("ID de biblioteca no válido");
  }

  const library = await libraryRepository.findById(libraryId);

  if (!library) {
    throw createNotFoundError("Biblioteca no encontrada");
  }

  // Obtener recuento de elementos
  const mediaRepository = require("../../data/repositories/mediaRepository");
  const itemCount = await mediaRepository.countByLibrary(libraryId);

  res.json({
    ...library,
    itemCount,
  });
});

/**
 * Crear una nueva biblioteca
 */
const createLibrary = asyncHandler(async (req, res) => {
  const { name, path: libraryPath, type, scan_automatically } = req.body;
  const userId = req.user.id;

  // Validar los datos
  if (!name || !libraryPath || !type) {
    throw createBadRequestError(
      "Se requiere nombre, ruta y tipo de biblioteca"
    );
  }

  // Validar el tipo
  const validTypes = ["movies", "series", "music", "photos"];
  if (!validTypes.includes(type)) {
    throw createBadRequestError(
      `El tipo debe ser uno de: ${validTypes.join(", ")}`
    );
  }

  // Verificar que la ruta existe
  try {
    const pathExists = fs.existsSync(libraryPath);
    if (!pathExists) {
      throw createBadRequestError("La ruta especificada no existe");
    }

    // Verificar permisos de lectura
    fs.accessSync(libraryPath, fs.constants.R_OK);
  } catch (error) {
    throw createBadRequestError(`Error de acceso: ${error.message}`);
  }

  // Verificar si ya existe una biblioteca con la misma ruta
  const existingLibrary = await libraryRepository.findByPath(libraryPath);

  if (existingLibrary) {
    throw createBadRequestError(
      "Ya existe una biblioteca con la misma ruta",
      "PATH_EXISTS"
    );
  }

  // Crear la biblioteca
  const newLibrary = await libraryRepository.create({
    name,
    path: libraryPath,
    type,
    scan_automatically,
  });

  // Emitir evento de creación de biblioteca
  eventBus.emitEvent("library:created", {
    libraryId: newLibrary.id,
    name: newLibrary.name,
    path: newLibrary.path,
    type: newLibrary.type,
    createdBy: userId,
  });

  // Si el usuario no es administrador, darle acceso a la biblioteca recién creada
  if (!req.user.isAdmin) {
    await libraryRepository.updateUserAccess(newLibrary.id, userId, true);
  }

  res.status(201).json({
    message: "Biblioteca creada exitosamente",
    library: newLibrary,
  });
});

/**
 * Actualizar una biblioteca existente
 */
const updateLibrary = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);
  const { name, path: libraryPath, type, scan_automatically } = req.body;

  if (isNaN(libraryId)) {
    throw createBadRequestError("ID de biblioteca no válido");
  }

  // Verificar que la biblioteca existe
  const library = await libraryRepository.findById(libraryId);

  if (!library) {
    throw createNotFoundError("Biblioteca no encontrada");
  }

  // Validar datos
  const updates = {};

  if (name) {
    updates.name = name;
  }

  if (libraryPath) {
    // Verificar que la ruta existe
    try {
      const pathExists = fs.existsSync(libraryPath);
      if (!pathExists) {
        throw createBadRequestError("La ruta especificada no existe");
      }

      // Verificar permisos de lectura
      fs.accessSync(libraryPath, fs.constants.R_OK);
    } catch (error) {
      throw createBadRequestError(`Error de acceso: ${error.message}`);
    }

    updates.path = libraryPath;
  }

  if (type) {
    // Validar el tipo
    const validTypes = ["movies", "series", "music", "photos"];
    if (!validTypes.includes(type)) {
      throw createBadRequestError(
        `El tipo debe ser uno de: ${validTypes.join(", ")}`
      );
    }

    updates.type = type;
  }

  if (scan_automatically !== undefined) {
    updates.scan_automatically = scan_automatically;
  }

  // Actualizar la biblioteca
  const updatedLibrary = await libraryRepository.update(libraryId, updates);

  // Emitir evento de actualización
  eventBus.emitEvent("library:updated", {
    libraryId,
    updates,
    updatedBy: req.user.id,
  });

  res.json({
    message: "Biblioteca actualizada exitosamente",
    library: updatedLibrary,
  });
});

/**
 * Eliminar una biblioteca
 */
const deleteLibrary = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);

  if (isNaN(libraryId)) {
    throw createBadRequestError("ID de biblioteca no válido");
  }

  // Verificar que la biblioteca existe
  const library = await libraryRepository.findById(libraryId);

  if (!library) {
    throw createNotFoundError("Biblioteca no encontrada");
  }

  // Emitir evento antes de eliminar
  eventBus.emitEvent("library:deleting", {
    libraryId,
    name: library.name,
    deletedBy: req.user.id,
  });

  // Eliminar la biblioteca
  await libraryRepository.delete(libraryId);

  // Emitir evento después de eliminar
  eventBus.emitEvent("library:deleted", {
    libraryId,
    name: library.name,
    deletedBy: req.user.id,
  });

  res.json({
    message: "Biblioteca eliminada exitosamente",
    libraryId,
  });
});

/**
 * Escanear una biblioteca
 */
const scanLibrary = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);

  if (isNaN(libraryId)) {
    throw createBadRequestError("ID de biblioteca no válido");
  }

  // Verificar que la biblioteca existe
  const library = await libraryRepository.findById(libraryId);

  if (!library) {
    throw createNotFoundError("Biblioteca no encontrada");
  }

  // Responder inmediatamente que el proceso ha iniciado
  res.json({
    message: "Escaneo iniciado",
    libraryId,
    status: "scanning",
  });

  // Ejecutar el escaneo en segundo plano
  scannerService.scanLibrary(libraryId).catch((error) => {
    console.error(`Error al escanear biblioteca ${libraryId}:`, error);
  });
});

/**
 * Buscar metadatos para todos los elementos de una biblioteca
 */
const enrichLibrary = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);

  if (isNaN(libraryId)) {
    throw createBadRequestError("ID de biblioteca no válido");
  }

  // Verificar que la biblioteca existe
  const library = await libraryRepository.findById(libraryId);

  if (!library) {
    throw createNotFoundError("Biblioteca no encontrada");
  }

  // Responder inmediatamente que el proceso ha iniciado
  res.json({
    message: "Búsqueda de metadatos iniciada",
    libraryId,
    status: "processing",
  });

  // Ejecutar enriquecimiento en segundo plano
  metadataService.enrichLibrary(libraryId).catch((error) => {
    console.error(
      `Error al buscar metadatos para biblioteca ${libraryId}:`,
      error
    );
  });
});

/**
 * Obtener los elementos multimedia de una biblioteca
 */
const getLibraryMedia = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);
  const {
    page = 1,
    limit = 20,
    sort = "title",
    order = "asc",
    type,
  } = req.query;

  if (isNaN(libraryId)) {
    throw createBadRequestError("ID de biblioteca no válido");
  }

  // Verificar que la biblioteca existe
  const library = await libraryRepository.findById(libraryId);

  if (!library) {
    throw createNotFoundError("Biblioteca no encontrada");
  }

  // Obtener elementos paginados
  const mediaRepository = require("../../data/repositories/mediaRepository");

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort,
    order,
    type,
  };

  const items = await mediaRepository.findByLibrary(libraryId, {
    limit: options.limit,
    offset: (options.page - 1) * options.limit,
    sort: options.sort,
    order: options.order,
    type: options.type,
  });

  // Obtener total para paginación
  const total = await mediaRepository.countByLibrary(libraryId, type);
  const totalPages = Math.ceil(total / options.limit);

  res.json({
    items,
    pagination: {
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPrevPage: options.page > 1,
    },
  });
});

/**
 * Obtener permisos de usuarios para una biblioteca
 */
const getLibraryUsers = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);

  if (isNaN(libraryId)) {
    throw createBadRequestError("ID de biblioteca no válido");
  }

  // Verificar que el usuario es administrador
  if (!req.user.isAdmin) {
    throw createForbiddenError(
      "Solo los administradores pueden ver los permisos de una biblioteca"
    );
  }

  // Verificar que la biblioteca existe
  const library = await libraryRepository.findById(libraryId);

  if (!library) {
    throw createNotFoundError("Biblioteca no encontrada");
  }

  // Obtener usuarios con acceso
  const users = await libraryRepository.getUserAccess(libraryId);

  res.json({
    libraryId,
    users,
  });
});

/**
 * Actualizar acceso de usuario a una biblioteca
 */
const updateUserAccess = asyncHandler(async (req, res) => {
  const libraryId = parseInt(req.params.id);
  const { userId, hasAccess } = req.body;

  if (isNaN(libraryId) || !userId) {
    throw createBadRequestError("ID de biblioteca o usuario no válido");
  }

  // Verificar que el usuario es administrador
  if (!req.user.isAdmin) {
    throw createForbiddenError(
      "Solo los administradores pueden modificar los permisos de una biblioteca"
    );
  }

  // Verificar que la biblioteca existe
  const library = await libraryRepository.findById(libraryId);

  if (!library) {
    throw createNotFoundError("Biblioteca no encontrada");
  }

  // Verificar que el usuario existe
  const userRepository = require("../../data/repositories/userRepository");
  const user = await userRepository.findById(userId);

  if (!user) {
    throw createNotFoundError("Usuario no encontrado");
  }

  // Si el usuario es administrador, no necesita permisos explícitos
  if (user.is_admin === 1) {
    return res.json({
      message:
        "Los administradores tienen acceso implícito a todas las bibliotecas",
      libraryId,
      userId,
      hasAccess: true,
    });
  }

  // Actualizar acceso
  await libraryRepository.updateUserAccess(libraryId, userId, hasAccess);

  // Emitir evento
  eventBus.emitEvent("library:access-updated", {
    libraryId,
    userId,
    hasAccess,
    updatedBy: req.user.id,
  });

  res.json({
    message: hasAccess
      ? "Acceso a biblioteca otorgado correctamente"
      : "Acceso a biblioteca eliminado correctamente",
    libraryId,
    userId,
    hasAccess,
  });
});

module.exports = {
  getLibraries,
  getLibraryById,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  scanLibrary,
  enrichLibrary,
  getLibraryMedia,
  getLibraryUsers,
  updateUserAccess,
};
