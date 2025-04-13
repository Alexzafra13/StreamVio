// server/data/migrations/001_initial_schema.js
const db = require("../db");

/**
 * Migración inicial que crea el esquema básico de la base de datos
 */
const up = async () => {
  console.log("Ejecutando migración: 001_initial_schema - UP");

  // Iniciar transacción para asegurar que todas las operaciones se completan o ninguna
  await db.asyncRun("BEGIN TRANSACTION");

  try {
    // Tabla de usuarios
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

    // Tabla de bibliotecas
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

    // Tabla de elementos multimedia
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

    // Tabla de historial de visualización
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        media_id INTEGER NOT NULL,
        position INTEGER DEFAULT 0,
        duration INTEGER,
        completed BOOLEAN DEFAULT 0,
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE,
        UNIQUE(user_id, media_id)
      )
    `);

    // Tabla de acceso a bibliotecas
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

    // Tabla de configuraciones
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

    // Tabla de sesiones
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

    // Tabla de códigos de invitación
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

    // Crear índices para mejorar rendimiento
    // Índices para media_items
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_library ON media_items(library_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_year ON media_items(year)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_parent ON media_items(parent_id)"
    );

    // Índices para watch_history
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_watch_history_media ON watch_history(media_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_watch_history_completed ON watch_history(completed)"
    );

    // Índices para user_library_access
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_user_library_access_user ON user_library_access(user_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_user_library_access_library ON user_library_access(library_id)"
    );

    // Índices para sessions
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)"
    );

    // Índices para invitation_codes
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_invitation_codes_creator ON invitation_codes(created_by)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_invitation_codes_used_by ON invitation_codes(used_by)"
    );

    // Insertar configuraciones por defecto
    await db.asyncRun(`
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('transcoding_enabled', '1', 'Habilitar o deshabilitar el transcodificado automático'),
        ('default_transcoding_format', 'mp4', 'Formato por defecto para transcodificación'),
        ('max_bitrate', '8000', 'Bitrate máximo para streaming en kbps'),
        ('scan_interval', '3600', 'Intervalo entre escaneos automáticos en segundos'),
        ('thumbnail_generation', '1', 'Generar miniaturas automáticamente'),
        ('metadata_language', 'es', 'Idioma preferido para metadatos'),
        ('max_users', '10', 'Número máximo de usuarios permitidos')
    `);

    // Confirmar transacción
    await db.asyncRun("COMMIT");

    console.log("Migración 001_initial_schema completada con éxito.");
    return true;
  } catch (error) {
    // Revertir cambios en caso de error
    await db.asyncRun("ROLLBACK");
    console.error("Error en migración 001_initial_schema:", error);
    throw error;
  }
};

/**
 * Eliminar el esquema (operación inversa)
 */
const down = async () => {
  console.log("Ejecutando migración: 001_initial_schema - DOWN");

  // Iniciar transacción
  await db.asyncRun("BEGIN TRANSACTION");

  try {
    // Eliminar tablas en orden inverso para respetar restricciones de clave foránea
    await db.asyncRun("DROP TABLE IF EXISTS invitation_codes");
    await db.asyncRun("DROP TABLE IF EXISTS sessions");
    await db.asyncRun("DROP TABLE IF EXISTS settings");
    await db.asyncRun("DROP TABLE IF EXISTS user_library_access");
    await db.asyncRun("DROP TABLE IF EXISTS watch_history");
    await db.asyncRun("DROP TABLE IF EXISTS media_items");
    await db.asyncRun("DROP TABLE IF EXISTS libraries");
    await db.asyncRun("DROP TABLE IF EXISTS users");

    // Confirmar transacción
    await db.asyncRun("COMMIT");

    console.log(
      "Rollback de migración 001_initial_schema completado con éxito."
    );
    return true;
  } catch (error) {
    // Revertir cambios en caso de error
    await db.asyncRun("ROLLBACK");
    console.error("Error en rollback de migración 001_initial_schema:", error);
    throw error;
  }
};

module.exports = { up, down };
