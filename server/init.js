// server/init.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const db = require("./data/db");
const paths = require("./config/paths");

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
 * Inicializar la base de datos con el esquema básico
 */
async function initializeDatabase() {
  console.log("Inicializando esquema de base de datos...");

  try {
    // Iniciar transacción
    await db.asyncRun("BEGIN TRANSACTION");

    // Crear tabla de usuarios
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        force_password_change BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear tabla de bibliotecas
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS libraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('movies', 'series', 'music', 'photos')),
        scan_automatically BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear tabla de elementos multimedia
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS media_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id INTEGER,
        title TEXT NOT NULL,
        original_title TEXT,
        description TEXT,
        type TEXT NOT NULL CHECK(type IN ('movie', 'series', 'episode', 'music', 'photo')),
        file_path TEXT,
        duration INTEGER,
        size INTEGER,
        thumbnail_path TEXT,
        year INTEGER,
        genre TEXT,
        director TEXT,
        actors TEXT,
        rating REAL,
        parent_id INTEGER,
        season_number INTEGER,
        episode_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (library_id) REFERENCES libraries (id) ON DELETE SET NULL,
        FOREIGN KEY (parent_id) REFERENCES media_items (id) ON DELETE CASCADE
      )
    `);

    // Crear tabla de historial de visualización
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        media_id INTEGER NOT NULL,
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        position INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE,
        UNIQUE(user_id, media_id)
      )
    `);

    // Crear tabla de acceso a bibliotecas
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS user_library_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        library_id INTEGER NOT NULL,
        has_access BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (library_id) REFERENCES libraries (id) ON DELETE CASCADE,
        UNIQUE(user_id, library_id)
      )
    `);

    // Crear tabla de configuraciones
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear tabla de sesiones
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        device_info TEXT,
        ip_address TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Crear tabla de invitaciones
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS invitation_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        created_by INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT 0,
        used_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (used_by) REFERENCES users (id) ON DELETE SET NULL
      )
    `);

    // Crear índices útiles
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_library ON media_items(library_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_watch_history ON watch_history(user_id, media_id)"
    );

    // Confirmar transacción
    await db.asyncRun("COMMIT");

    console.log("✓ Base de datos inicializada correctamente");
  } catch (error) {
    // Revertir cambios en caso de error
    await db.asyncRun("ROLLBACK");
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
    const settingsCount = await db.asyncGet(
      "SELECT COUNT(*) as count FROM settings"
    );

    // Si no hay configuraciones, insertar valores por defecto
    if (settingsCount && settingsCount.count === 0) {
      await db.asyncRun(`INSERT INTO settings (key, value, description) VALUES 
        ('transcoding_enabled', '1', 'Habilitar o deshabilitar el transcodificado automático'),
        ('default_transcoding_format', 'mp4', 'Formato por defecto para transcodificación'),
        ('max_bitrate', '8000', 'Bitrate máximo para streaming en kbps'),
        ('scan_interval', '3600', 'Intervalo entre escaneos automáticos en segundos'),
        ('thumbnail_generation', '1', 'Generar miniaturas automáticamente'),
        ('metadata_language', 'es', 'Idioma preferido para metadatos'),
        ('max_users', '10', 'Número máximo de usuarios permitidos')
      `);
    }

    console.log("✓ Configuraciones por defecto aplicadas");
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
