/**
 * Script unificado para inicializar la base de datos de StreamVio
 * Este script:
 * 1. Crea todas las tablas necesarias si no existen
 * 2. Verifica e inserta configuraciones por defecto
 * 3. Crea tablas complementarias (streaming_tokens)
 * 4. Crea directorios necesarios con permisos correctos
 */
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
require("dotenv").config();

// Crear promesas para operaciones asíncronas de fs
const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);
const chown = promisify(fs.chown);
const stat = promisify(fs.stat);

// Definir colores para la salida
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

// Definir la ruta de la base de datos
const dbDir = path.resolve(__dirname, "../data");
const dbPath = path.resolve(dbDir, "streamvio.db");

// Definir directorios necesarios
const directories = [
  "../data",
  "../data/thumbnails",
  "../data/transcoded",
  "../data/cache",
  "../data/metadata",
];

// Asegurarse de que los directorios necesarios existen
async function createDirectories() {
  console.log(`${colors.blue}Creando directorios necesarios...${colors.reset}`);

  for (const dir of directories) {
    const fullPath = path.resolve(__dirname, dir);

    try {
      if (!fs.existsSync(fullPath)) {
        await mkdir(fullPath, { recursive: true });
        console.log(
          `${colors.green}✓ Directorio creado: ${fullPath}${colors.reset}`
        );
      } else {
        console.log(
          `${colors.yellow}i Directorio ya existe: ${fullPath}${colors.reset}`
        );
      }

      // Establecer permisos adecuados (rwxrwxr-x = 0775)
      await chmod(fullPath, 0o775);

      // Intentar cambiar el propietario si se ejecuta como root
      if (process.getuid && process.getuid() === 0) {
        try {
          // Obtener usuario y grupo del servicio
          const serviceUser = process.env.SERVICE_USER || "streamvio";
          const serviceGroup = process.env.SERVICE_GROUP || "streamvio";

          // Intentar obtener UID/GID
          const uid =
            parseInt(process.env.SERVICE_UID) ||
            (serviceUser === "streamvio" ? 1000 : null);
          const gid =
            parseInt(process.env.SERVICE_GID) ||
            (serviceGroup === "streamvio" ? 1000 : null);

          if (uid && gid) {
            await chown(fullPath, uid, gid);
            console.log(
              `${colors.green}✓ Permisos ajustados: ${serviceUser}:${serviceGroup} (${uid}:${gid})${colors.reset}`
            );
          }
        } catch (error) {
          console.warn(
            `${colors.yellow}⚠ No se pudo cambiar el propietario: ${error.message}${colors.reset}`
          );
        }
      }
    } catch (error) {
      console.error(
        `${colors.red}✗ Error al crear directorio ${fullPath}: ${error.message}${colors.reset}`
      );
      throw error;
    }
  }
}

// Verificar si la base de datos ya existe
const dbExists = fs.existsSync(dbPath);

// Función para cerrar la conexión de manera segura y finalizar el proceso
function finalizeDB(db, exitCode = 0) {
  try {
    db.close();
    console.log(
      `${colors.green}Base de datos cerrada correctamente${colors.reset}`
    );
  } catch (err) {
    console.error(
      `${colors.red}Error al cerrar la base de datos: ${err.message}${colors.reset}`
    );
  }

  // Usamos setTimeout para dar tiempo al event loop
  setTimeout(() => {
    if (exitCode === 0) {
      console.log(
        `${colors.green}Inicialización completada con éxito${colors.reset}`
      );
    } else {
      console.error(
        `${colors.red}Inicialización finalizada con errores${colors.reset}`
      );
    }
    process.exit(exitCode);
  }, 500);
}

// Promisificar las operaciones de base de datos
function promisifyDB(db) {
  db.asyncRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  db.asyncGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  };

  db.asyncAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  };

  return db;
}

// Iniciar el proceso de inicialización
async function initialize() {
  console.log(
    `${colors.blue}==============================================${colors.reset}`
  );
  console.log(
    `${colors.blue}  StreamVio - Inicialización de Base de Datos  ${colors.reset}`
  );
  console.log(
    `${colors.blue}==============================================${colors.reset}\n`
  );

  // Crear directorios necesarios primero
  await createDirectories();

  // Conectar a la base de datos
  console.log(
    `${colors.blue}Conectando a la base de datos: ${dbPath}${colors.reset}`
  );
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(
        `${colors.red}Error al conectar a la base de datos: ${err.message}${colors.reset}`
      );
      process.exit(1);
    }
  });

  // Promisificar operaciones de DB
  const dbAsync = promisifyDB(db);

  try {
    // Activar foreign keys
    await dbAsync.asyncRun("PRAGMA foreign_keys = ON");

    // Iniciar transacción
    await dbAsync.asyncRun("BEGIN TRANSACTION");

    console.log(
      `${colors.yellow}Creando estructura de la base de datos...${colors.reset}`
    );

    // Tabla de usuarios
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT 0,
      force_password_change BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log(`${colors.green}✓ Tabla users${colors.reset}`);

    // Tabla de configuraciones globales
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log(`${colors.green}✓ Tabla settings${colors.reset}`);

    // Tabla de configuraciones por usuario
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, key)
    )`);
    console.log(`${colors.green}✓ Tabla user_settings${colors.reset}`);

    // Tabla de bibliotecas multimedia
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('movies', 'series', 'music', 'photos')),
      scan_automatically BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log(`${colors.green}✓ Tabla libraries${colors.reset}`);

    // Tabla de elementos multimedia
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS media_items (
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
    )`);
    console.log(`${colors.green}✓ Tabla media_items${colors.reset}`);

    // Tabla de historial de visualización
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      media_id INTEGER NOT NULL,
      watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      position INTEGER DEFAULT 0,
      completed BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
    )`);
    console.log(`${colors.green}✓ Tabla watch_history${colors.reset}`);

    // Tabla de favoritos
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      media_id INTEGER NOT NULL,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE,
      UNIQUE(user_id, media_id)
    )`);
    console.log(`${colors.green}✓ Tabla favorites${colors.reset}`);

    // Tabla de tareas de transcoding
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS transcoding_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      target_format TEXT NOT NULL,
      target_resolution TEXT,
      output_path TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
    )`);
    console.log(`${colors.green}✓ Tabla transcoding_jobs${colors.reset}`);

    // Tabla para sesiones/tokens
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      device_info TEXT,
      ip_address TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);
    console.log(`${colors.green}✓ Tabla sessions${colors.reset}`);

    // Tabla para códigos de invitación
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS invitation_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT 0,
      used_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (used_by) REFERENCES users (id) ON DELETE SET NULL
    )`);
    console.log(`${colors.green}✓ Tabla invitation_codes${colors.reset}`);

    // Tabla para tokens de streaming
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS streaming_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      media_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
    )`);
    console.log(`${colors.green}✓ Tabla streaming_tokens${colors.reset}`);

    // Tabla para permisos de acceso a bibliotecas por usuario
    await dbAsync.asyncRun(`CREATE TABLE IF NOT EXISTS user_library_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      library_id INTEGER NOT NULL,
      has_access BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (library_id) REFERENCES libraries (id) ON DELETE CASCADE,
      UNIQUE(user_id, library_id)
    )`);
    console.log(`${colors.green}✓ Tabla user_library_access${colors.reset}`);

    // Crear índices útiles para búsquedas frecuentes
    await dbAsync.asyncRun(
      `CREATE INDEX IF NOT EXISTS idx_media_items_library ON media_items(library_id)`
    );
    await dbAsync.asyncRun(
      `CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type)`
    );
    await dbAsync.asyncRun(
      `CREATE INDEX IF NOT EXISTS idx_streaming_tokens_token ON streaming_tokens(token)`
    );
    await dbAsync.asyncRun(
      `CREATE INDEX IF NOT EXISTS idx_media_items_parent ON media_items(parent_id)`
    );
    await dbAsync.asyncRun(
      `CREATE INDEX IF NOT EXISTS idx_user_library_access_user ON user_library_access(user_id)`
    );
    await dbAsync.asyncRun(
      `CREATE INDEX IF NOT EXISTS idx_user_library_access_library ON user_library_access(library_id)`
    );
    console.log(`${colors.green}✓ Índices creados${colors.reset}`);

    // Si es una base de datos nueva, insertar configuraciones por defecto
    if (!dbExists) {
      console.log(
        `${colors.yellow}Base de datos nueva detectada. Insertando configuraciones por defecto...${colors.reset}`
      );

      // Insertar configuraciones
      await dbAsync.asyncRun(`INSERT INTO settings (key, value, description) VALUES 
        ('transcoding_enabled', '1', 'Habilitar o deshabilitar el transcodificado automático'),
        ('default_transcoding_format', 'mp4', 'Formato por defecto para transcodificación'),
        ('max_bitrate', '8000', 'Bitrate máximo para streaming en kbps'),
        ('scan_interval', '3600', 'Intervalo entre escaneos automáticos en segundos'),
        ('thumbnail_generation', '1', 'Generar miniaturas automáticamente'),
        ('metadata_language', 'es', 'Idioma preferido para metadatos'),
        ('max_users', '10', 'Número máximo de usuarios permitidos')
      `);
      console.log(
        `${colors.green}✓ Configuraciones por defecto insertadas${colors.reset}`
      );
    }

    // Confirmar transacción
    await dbAsync.asyncRun("COMMIT");
    console.log(
      `${colors.green}✓ Transacción completada exitosamente${colors.reset}`
    );

    // Establecer permisos adecuados para la base de datos
    try {
      await chmod(dbPath, 0o664); // rw-rw-r--
      console.log(
        `${colors.green}✓ Permisos de base de datos configurados${colors.reset}`
      );
    } catch (error) {
      console.warn(
        `${colors.yellow}⚠ No se pudieron establecer permisos en la base de datos: ${error.message}${colors.reset}`
      );
    }

    // Verificar que la base de datos se creó correctamente
    const dbStat = await stat(dbPath);
    console.log(
      `${colors.blue}Base de datos inicializada: ${dbPath} (${(
        dbStat.size / 1024
      ).toFixed(2)} KB)${colors.reset}`
    );

    // Verificar si hay usuarios en la base de datos
    const userCount = await dbAsync.asyncGet(
      "SELECT COUNT(*) as count FROM users"
    );
    if (userCount && userCount.count > 0) {
      console.log(
        `${colors.blue}La base de datos contiene ${userCount.count} usuario(s)${colors.reset}`
      );
    } else {
      console.log(
        `${colors.yellow}No hay usuarios configurados. Se requerirá configuración inicial a través de la interfaz web.${colors.reset}`
      );
    }

    finalizeDB(db, 0);
  } catch (error) {
    console.error(
      `${colors.red}Error al configurar la base de datos: ${
        error.stack || error.message
      }${colors.reset}`
    );

    // Intentar hacer rollback de la transacción
    try {
      await dbAsync.asyncRun("ROLLBACK");
      console.log(
        `${colors.yellow}Rollback de transacción ejecutado${colors.reset}`
      );
    } catch (rollbackError) {
      console.error(
        `${colors.red}Error durante rollback: ${rollbackError.message}${colors.reset}`
      );
    }

    finalizeDB(db, 1);
  }
}

// Manejar señales de interrupción de manera adecuada
process.on("SIGINT", () => {
  console.log(
    `${colors.yellow}Recibida señal de interrupción. Finalizando...${colors.reset}`
  );
  process.exit(0);
});

// Ejecutar el proceso de inicialización
initialize().catch((error) => {
  console.error(
    `${colors.red}Error fatal durante la inicialización: ${
      error.stack || error.message
    }${colors.reset}`
  );
  process.exit(1);
});
