// server/init.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const db = require("./data/db");
const paths = require("./config/paths");
const migrationManager = require("./data/migrations");
const { loadDefaultSettings } = require("./data/seeds/defaultSettings");

// Promisificar operaciones de fs
const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);

/**
 * Configurar directorios necesarios para la aplicación
 */
async function setupDirectories() {
  console.log("Configurando directorios de la aplicación...");

  const directories = [
    paths.DATA_DIR,
    paths.THUMBNAILS_DIR,
    paths.TRANSCODED_DIR,
    paths.METADATA_DIR,
    paths.CACHE_DIR,
  ];

  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
        console.log(`✓ Directorio creado: ${dir}`);
      }

      // Establecer permisos (775 = rwxrwxr-x)
      await chmod(dir, 0o775);
    } catch (error) {
      console.error(`Error al configurar directorio ${dir}:`, error);
      throw error;
    }
  }

  console.log("✓ Directorios configurados correctamente");
}

/**
 * Inicializar la base de datos con el esquema
 */
async function initializeDatabase() {
  console.log("Inicializando base de datos...");

  try {
    // Verificar si hay migraciones pendientes
    const status = await migrationManager.status();

    if (status.pendingCount > 0) {
      console.log(
        `Ejecutando ${status.pendingCount} migraciones pendientes...`
      );
      const result = await migrationManager.migrateUp();
      console.log(result.message);
    } else {
      console.log("La base de datos ya está en la versión más reciente.");
    }

    console.log("✓ Base de datos inicializada correctamente");
    return true;
  } catch (error) {
    console.error("Error al inicializar la base de datos:", error);
    throw error;
  }
}

/**
 * Verificar y crear configuraciones por defecto
 */
async function setupDefaultSettings() {
  console.log("Configurando ajustes por defecto...");

  try {
    // Verificar si ya existen configuraciones
    const settingRepository = require("./data/repositories/settingRepository");
    const settings = await settingRepository.getAll();

    // Si no hay configuraciones, insertar valores por defecto
    if (settings.length === 0) {
      await loadDefaultSettings();
      console.log("✓ Configuraciones por defecto aplicadas");
    } else {
      console.log(
        "Las configuraciones ya existen, omitiendo carga por defecto"
      );
    }

    return true;
  } catch (error) {
    console.error("Error al configurar ajustes por defecto:", error);
    throw error;
  }
}

/**
 * Inicializar completamente la aplicación
 */
async function initializeApplication() {
  try {
    await setupDirectories();
    await initializeDatabase();
    await setupDefaultSettings();

    console.log("✅ Aplicación inicializada correctamente");

    return true;
  } catch (error) {
    console.error(
      "❌ Error durante la inicialización de la aplicación:",
      error
    );
    return false;
  }
}

module.exports = {
  setupDirectories,
  initializeDatabase,
  setupDefaultSettings,
  initializeApplication,
};
