// server/tests/setup.js

// Establecer variables de entorno para tests
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_key";
process.env.CORS_ORIGINS = "http://localhost:4321";
process.env.PORT = "3001"; // Puerto diferente para tests
process.env.DB_PATH = ":memory:"; // Usar base de datos en memoria para tests

// Ruta personalizada para archivos de test
process.env.TEST_DATA_DIR = "./tests/data";

// Configuración de tiempos de espera
jest.setTimeout(30000);

// Función global para esperar un tiempo determinado
global.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Función auxiliar para crear tokens JWT para tests
global.generateTestToken = (
  userId = 1,
  username = "testuser",
  email = "test@example.com"
) => {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ id: userId, username, email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

// Importamos el servidor para pruebas
const app = require("../app");
let server;

// Mock para servicios externos o módulos del sistema
jest.mock("../services/transcoderService", () => {
  // Implementar mock del servicio de transcodificación
  return {
    getMediaInfo: jest.fn().mockResolvedValue({
      path: "/test/path.mp4",
      duration: 3600000, // 1 hora en ms
      width: 1280,
      height: 720,
      videoCodec: "h264",
      audioBitrate: 128,
      audioCodec: "aac",
    }),

    generateThumbnail: jest.fn().mockResolvedValue("/path/to/thumbnail.jpg"),

    startTranscodeJob: jest.fn().mockResolvedValue({
      jobId: 123,
      mediaId: 1,
      status: "pending",
      outputPath: "/path/to/output.mp4",
    }),

    getTranscodeJobStatus: jest.fn().mockResolvedValue({
      jobId: 123,
      mediaId: 1,
      status: "processing",
      progress: 50,
    }),

    cancelTranscodeJob: jest
      .fn()
      .mockResolvedValue({ success: true, jobId: 123 }),

    createHLSStream: jest.fn().mockResolvedValue({
      jobId: 456,
      mediaId: 1,
      status: "pending",
      outputPath: "/path/to/hls",
      masterPlaylist: "/path/to/hls/master.m3u8",
    }),
  };
});

// Inicializar y limpiar entre tests
beforeAll(async () => {
  // Inicializar base de datos para tests
  const db = require("../config/database");

  // Crear esquema de la base de datos
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

  // Tabla de bibliotecas multimedia
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
      watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      position INTEGER DEFAULT 0,
      completed BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
    )
  `);

  // Tabla de favoritos
  await db.asyncRun(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      media_id INTEGER NOT NULL,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE,
      UNIQUE(user_id, media_id)
    )
  `);

  // Tabla de tareas de transcoding
  await db.asyncRun(`
    CREATE TABLE IF NOT EXISTS transcoding_jobs (
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
    )
  `);

  // Tabla para sesiones/tokens
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

  console.log("Base de datos de prueba inicializada");
  
  // Iniciar el servidor para pruebas - usar un puerto aleatorio para evitar conflictos
  const PORT = 0; // El 0 hace que Node.js use un puerto disponible al azar
  server = app.listen(PORT);
});

afterAll(async () => {
  // Limpiar recursos
  const db = require("../config/database");

  // Cerrar conexión a la base de datos
  await new Promise((resolve) => db.close(resolve));
  
  // Cerrar el servidor de manera segura
  await new Promise(resolve => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });

  console.log("Recursos de prueba liberados");
});