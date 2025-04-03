// Modificación de app.js para servir tanto la API como los archivos frontend desde un único puerto

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const os = require("os");
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
app.use(
  helmet({
    contentSecurityPolicy: false, // Desactivar CSP para permitir que el frontend funcione correctamente
    crossOriginEmbedderPolicy: false, // Permitir carga de recursos cross-origin
  })
);
app.use(morgan("dev"));
app.use(express.json());

// Definir la ruta al directorio del frontend compilado
const frontendDistPath = path.join(__dirname, "../clients/web/dist");

// Verificar que el directorio del frontend compilado existe
if (!fs.existsSync(frontendDistPath)) {
  console.error(
    "ADVERTENCIA: El directorio del frontend compilado no existe:",
    frontendDistPath
  );
  console.error(
    "Por favor, ejecuta 'npm run build' en el directorio clients/web"
  );
}

// Rutas de API
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

// Servir archivos estáticos del frontend compilado
app.use(express.static(frontendDistPath));

// Para cualquier otra ruta que no sea /api, servir el index.html del frontend
// Esto permite que la navegación en el frontend funcione correctamente con rutas dinámicas
app.get("*", (req, res, next) => {
  // Si la ruta comienza con /api, pasar al siguiente middleware (que será el manejador 404 para API)
  if (req.path.startsWith("/api/")) {
    return next();
  }

  // Servir el index.html para cualquier otra ruta
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

// Manejar errores 404 para rutas de API
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    message: `La ruta ${req.originalUrl} no existe en este servidor`,
  });
});

// Manejar errores globales
app.use((err, req, res, next) => {
  console.error("Error en la aplicación:", err);

  // Si la URL comienza con /api, devolver un error JSON
  if (req.path.startsWith("/api/")) {
    return res.status(500).json({
      error: "Error interno del servidor",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Ocurrió un error inesperado",
    });
  }

  // Para errores en otras rutas, mostrar una página de error HTML simple
  res.status(500).send(`
    <html>
      <head>
        <title>Error - StreamVio</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; text-align: center; }
          h1 { color: #e53e3e; }
          .error-container { max-width: 600px; margin: 0 auto; }
          .back-button { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; 
                        background-color: #3b82f6; color: white; text-decoration: none; 
                        border-radius: 0.25rem; }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>¡Ups! Algo salió mal</h1>
          <p>Ocurrió un error en el servidor. Por favor, inténtalo de nuevo más tarde.</p>
          <a href="/" class="back-button">Volver al inicio</a>
        </div>
      </body>
    </html>
  `);
});

// Obtener la dirección IP local
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Omitir direcciones de loopback y no IPv4
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "0.0.0.0"; // IP predeterminada si no se encuentra ninguna
};

// IMPORTANTE: Solo iniciar el servidor si este archivo se ejecuta directamente,
// no cuando se importa para tests
if (require.main === module) {
  // Configurar el puerto unificado
  const PORT = process.env.PORT || 45000;
  const LOCAL_IP = getLocalIP();

  // Escuchar en todas las interfaces (0.0.0.0)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n==============================================`);
    console.log(`Servidor StreamVio ejecutándose en el puerto ${PORT}`);
    console.log(`==============================================`);
    console.log(`Acceso local: http://localhost:${PORT}`);
    console.log(`Acceso en red: http://${LOCAL_IP}:${PORT}`);
    console.log(`API disponible en http://${LOCAL_IP}:${PORT}/api`);
    console.log(`==============================================\n`);
  });
}

module.exports = app;
