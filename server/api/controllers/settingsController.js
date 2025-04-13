// server/api/controllers/settingsController.js
const settingRepository = require("../../data/repositories/settingRepository");
const {
  asyncHandler,
  createBadRequestError,
} = require("../middlewares/errorMiddleware");

/**
 * Obtener todas las configuraciones
 */
const getAllSettings = asyncHandler(async (req, res) => {
  const settings = await settingRepository.getAll();
  res.json(settings);
});

/**
 * Obtener configuraciones agrupadas por categoría
 */
const getGroupedSettings = asyncHandler(async (req, res) => {
  const settings = await settingRepository.getGrouped();
  res.json(settings);
});

/**
 * Obtener una configuración específica
 */
const getSetting = asyncHandler(async (req, res) => {
  const { key } = req.params;

  if (!key) {
    throw createBadRequestError("Se requiere la clave de configuración");
  }

  const value = await settingRepository.get(key);

  if (value === null) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: `Configuración '${key}' no encontrada`,
    });
  }

  res.json({
    key,
    value,
  });
});

/**
 * Establecer una configuración
 */
const setSetting = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value, description } = req.body;

  if (!key) {
    throw createBadRequestError("Se requiere la clave de configuración");
  }

  if (value === undefined) {
    throw createBadRequestError("Se requiere el valor de configuración");
  }

  await settingRepository.set(key, value, description);

  res.json({
    message: `Configuración '${key}' actualizada correctamente`,
    key,
    value,
  });
});

/**
 * Eliminar una configuración
 */
const deleteSetting = asyncHandler(async (req, res) => {
  const { key } = req.params;

  if (!key) {
    throw createBadRequestError("Se requiere la clave de configuración");
  }

  const exists = await settingRepository.exists(key);

  if (!exists) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: `Configuración '${key}' no encontrada`,
    });
  }

  await settingRepository.delete(key);

  res.json({
    message: `Configuración '${key}' eliminada correctamente`,
  });
});

/**
 * Establecer múltiples configuraciones a la vez
 */
const setBulkSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== "object") {
    throw createBadRequestError("Se requiere un objeto con configuraciones");
  }

  await settingRepository.setBulk(settings);

  res.json({
    message: "Configuraciones actualizadas correctamente",
    updatedCount: Object.keys(settings).length,
  });
});

/**
 * Resetear todos los ajustes a valores por defecto
 */
const resetAllSettings = asyncHandler(async (req, res) => {
  await settingRepository.resetAll();

  res.json({
    message:
      "Todas las configuraciones han sido restablecidas a sus valores por defecto",
  });
});

/**
 * Resetear una configuración específica a su valor por defecto
 */
const resetSetting = asyncHandler(async (req, res) => {
  const { key } = req.params;

  if (!key) {
    throw createBadRequestError("Se requiere la clave de configuración");
  }

  const exists = await settingRepository.exists(key);

  if (!exists) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: `Configuración '${key}' no encontrada`,
    });
  }

  await settingRepository.reset(key);

  const value = await settingRepository.get(key);

  res.json({
    message: `Configuración '${key}' restablecida a su valor por defecto`,
    key,
    value,
  });
});

/**
 * Obtener configuraciones del sistema
 */
const getSystemSettings = asyncHandler(async (req, res) => {
  const settings = await settingRepository.getSystemSettings();
  res.json(settings);
});

/**
 * Obtener configuraciones de interfaz de usuario
 */
const getUiSettings = asyncHandler(async (req, res) => {
  const settings = await settingRepository.getUiSettings();
  res.json(settings);
});

/**
 * Exportar configuraciones
 */
const exportSettings = asyncHandler(async (req, res) => {
  const settings = await settingRepository.export();

  res.json(settings);
});

/**
 * Importar configuraciones
 */
const importSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== "object") {
    throw createBadRequestError("Se requiere un objeto con configuraciones");
  }

  await settingRepository.import(settings);

  res.json({
    message: "Configuraciones importadas correctamente",
    importedCount: Object.keys(settings).length,
  });
});

module.exports = {
  getAllSettings,
  getGroupedSettings,
  getSetting,
  setSetting,
  deleteSetting,
  setBulkSettings,
  resetAllSettings,
  resetSetting,
  getSystemSettings,
  getUiSettings,
  exportSettings,
  importSettings,
};
