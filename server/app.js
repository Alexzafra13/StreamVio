// Modificación de app.js para separar la creación de la app y el inicio del servidor

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Importar rutas
const authRoutes = require("./routes/auth");
const librariesRoutes = require("./routes/libraries");
const mediaRoutes = require("./routes/media");
const adminRoutes = require("./routes/admin");
const transcodingRoutes = require("./routes/transcoding");
const metadataRoutes = require("./routes/metadata");
const filesystemRoutes = require("./routes/filesystem");

// Importar middleware de autenticación
const authMiddleware = require("./middleware/auth");

// Crear aplicación Express
const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS || "http://localhost:4321",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(morgan("dev"));
app.use(express.json());

// Rutas básicas de API
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Servidor StreamVio funcionando correctamente",
    version: "0.1.0",
  });
});

// Usar rutas de autenticación
app.use("/api/auth", authRoutes);

// Rutas protegidas
app.use("/api/libraries", librariesRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/transcoding", transcodingRoutes);
app.use("/api/metadata", metadataRoutes);
app.use("/api/filesystem", filesystemRoutes);

// Ruta para verificar si un usuario es administrador
app.get("/api/auth/verify-admin", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = require("./config/database");

    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user || !user.is_admin) {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "El usuario no tiene privilegios de administrador",
      });
    }

    res.json({
      isAdmin: true,
      message: "El usuario tiene privilegios de administrador",
    });
  } catch (error) {
    console.error("Error al verificar privilegios de administrador:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar privilegios de administrador",
    });
  }
});

// Configurar directorio de datos para servir archivos estáticos
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Servir archivos estáticos desde el directorio data con autenticación
app.use("/data", authMiddleware, express.static(dataDir));

// Inicializar y configurar el transcodificador
const enhancedTranscoder = require("./services/enhancedTranscoderService");

// Escuchar eventos del transcodificador para logging
enhancedTranscoder.on("jobStarted", (data) => {
  console.log(
    `Trabajo de transcodificación iniciado: ${data.jobId} para media ${data.mediaId}`
  );
});

enhancedTranscoder.on("jobCompleted", (data) => {
  console.log(
    `Trabajo de transcodificación completado: ${data.jobId}, archivo: ${data.outputPath}`
  );
});

enhancedTranscoder.on("jobFailed", (data) => {
  console.error(
    `Trabajo de transcodificación fallido: ${data.jobId}, error: ${data.error}`
  );
});

// Manejar errores 404
app.use((req, res, next) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    message: `La ruta ${req.originalUrl} no existe en este servidor`,
  });
});

// Manejar errores globales
app.use((err, req, res, next) => {
  console.error("Error en la aplicación:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Ocurrió un error inesperado",
  });
});

// IMPORTANTE: Solo iniciar el servidor si este archivo se ejecuta directamente,
// no cuando se importa para tests
if (require.main === module) {
  // Configurar el puerto
  const PORT = process.env.PORT || 8000;

  // Iniciar el servidor
  app.listen(PORT, () => {
    console.log(`Servidor StreamVio ejecutándose en el puerto ${PORT}`);
    console.log(`API disponible en http://localhost:${PORT}`);
  });
}

module.exports = app;
