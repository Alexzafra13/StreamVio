// server/api/controllers/migrationController.js
const migrationManager = require("../../data/migrations");
const {
  asyncHandler,
  createBadRequestError,
} = require("../middlewares/errorMiddleware");

/**
 * Obtener estado actual de las migraciones
 */
const getMigrationStatus = asyncHandler(async (req, res) => {
  const status = await migrationManager.status();
  res.json(status);
});

/**
 * Ejecutar migraciones pendientes
 */
const runMigrations = asyncHandler(async (req, res) => {
  const result = await migrationManager.migrateUp();
  res.json(result);
});

/**
 * Migrar a una versión específica
 */
const migrateToVersion = asyncHandler(async (req, res) => {
  const { version } = req.params;
  const targetVersion = parseInt(version);

  if (isNaN(targetVersion) || targetVersion < 0) {
    throw createBadRequestError("Versión no válida");
  }

  const result = await migrationManager.migrateTo(targetVersion);
  res.json(result);
});

/**
 * Revertir última migración
 */
const rollbackMigration = asyncHandler(async (req, res) => {
  const result = await migrationManager.migrateDown();
  res.json(result);
});

/**
 * Verificar si la base de datos está actualizada
 */
const checkIfUpToDate = asyncHandler(async (req, res) => {
  const isUpToDate = await migrationManager.isUpToDate();

  res.json({
    upToDate: isUpToDate,
    message: isUpToDate
      ? "La base de datos está en la versión más reciente"
      : "Hay migraciones pendientes por aplicar",
  });
});

module.exports = {
  getMigrationStatus,
  runMigrations,
  migrateToVersion,
  rollbackMigration,
  checkIfUpToDate,
};
