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

// Inicializar y limpiar entre tests (opcional)
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

  // Añadir más tablas según sea necesario...

  console.log("Base de datos de prueba inicializada");
});

afterAll(async () => {
  // Limpiar recursos
  const db = require("../config/database");

  // Cerrar conexión a la base de datos
  await new Promise((resolve) => db.close(resolve));

  console.log("Recursos de prueba liberados");
});