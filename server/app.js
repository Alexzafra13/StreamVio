// server/app.js - Versión unificada y simplificada para servir frontend y backend
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const os = require("os");
const cors = require("cors");
const settings = require("./config/settings");
require("dotenv").config();

// Importar rutas
const authRoutes = require("./routes/auth"); // Añadido: importar rutas de autenticación
const librariesRoutes = require("./routes/libraries");
const mediaRoutes = require("./routes/media");
const adminRoutes = require("./routes/admin");
const transcodingRoutes = require("./routes/transcoding");
const metadataRoutes = require("./routes/metadata");
const filesystemRoutes = require("./routes/filesystem");
// COMMENTED OUT: Ya no necesitamos esto ya que usamos el servicio en mediaRoutes
// const streamingRoutes = require("./routes/streaming");
const setupRoutes = require("./routes/setup");
const userHistoryRoutes = require("./routes/user-history");

// Importar middleware de autenticación (solo una vez)
const enhancedAuthMiddleware = require("./middleware/enhancedAuth");

// Crear aplicación Express
const app = express();

// Función para verificar y crear directorios necesarios con permisos correctos
async function setupRequiredDirectories() {
  const requiredDirs = [
    path.join(__dirname, "data"),
    path.join(__dirname, "data/thumbnails"),
    path.join(__dirname, "data/transcoded"),
    path.join(__dirname, "data/cache"),
    path.join(__dirname, "data/metadata"),
  ];

  console.log("Verificando directorios necesarios...");

  for (const dir of requiredDirs) {
    try {
      if (!fs.existsSync(dir)) {
        console.log(`Creando directorio: ${dir}`);
        fs.mkdirSync(dir, { recursive: true, mode: 0o775 });
      }

      try {
        const testFile = path.join(dir, `.test-${Date.now()}`);
        fs.writeFileSync(testFile, "test");
        fs.unlinkSync(testFile);
        console.log(`✓ Permisos correctos en: ${dir}`);
      } catch (permError) {
        console.error(`⚠️ Error de permisos en ${dir}: ${permError.message}`);
        if (process.platform !== "win32") {
          try {
            console.log(`Intentando corregir permisos para ${dir}...`);
            fs.chmodSync(dir, 0o775);
            console.log(`✓ Permisos corregidos para: ${dir}`);
          } catch (chmodError) {
            console.error(
              `⚠️ No se pudieron corregir los permisos: ${chmodError.message}`
            );
            console.error(
              "⚠️ Puede que necesites ejecutar la aplicación con permisos de administrador"
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `⚠️ Error al verificar/crear directorio ${dir}: ${error.message}`
      );
    }
  }
}

const logPermissionIssue = (filePath, error) => {
  console.error(`Error de permisos en ${filePath}:`, error);
};

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-stream-token",
      "stream-token",
    ],
    exposedHeaders: ["x-new-stream-token"],
    credentials: true,
    maxAge: 86400,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

morgan.token("user-id", (req) => req.user?.id || "no-auth");
app.use(
  morgan(
    ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms'
  )
);

app.use(express.json());

// Ejecutar migraciones de base de datos necesarias
const runDatabaseMigrations = async () => {
  try {
    console.log("Verificando migraciones de base de datos...");
    console.log("Migraciones completadas");
  } catch (error) {
    console.error("Error durante la migración de base de datos:", error);
  }
};

// Función para configurar la aplicación
async function setupApp() {
  await setupRequiredDirectories();
  await runDatabaseMigrations();

  const frontendDistPath = path.join(__dirname, "../clients/web/dist");

  if (!fs.existsSync(frontendDistPath)) {
    console.error(
      "ADVERTENCIA: El directorio del frontend compilado no existe:",
      frontendDistPath
    );
    console.error(
      "Por favor, ejecuta 'npm run build' en el directorio clients/web"
    );
  } else {
    try {
      fs.accessSync(frontendDistPath, fs.constants.R_OK);
      console.log(
        "Frontend compilado encontrado y accesible:",
        frontendDistPath
      );
    } catch (error) {
      console.error(
        "⚠️ ERROR DE PERMISOS: No se puede acceder al directorio del frontend:",
        frontendDistPath
      );
      console.error(
        "⚠️ Asegúrate de que el usuario que ejecuta el servicio tenga permisos de lectura"
      );
      console.error(`⚠️ Error: ${error.message}`);
    }
  }

  // Rutas de API
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      message: "Servidor StreamVio funcionando correctamente",
      version: "0.1.0",
      uid: process.getuid ? process.getuid() : "N/A",
      gid: process.getgid ? process.getgid() : "N/A",
      platform: process.platform,
      nodeVersion: process.version,
    });
  });

  // Usar rutas de autenticación y setup (no requieren autenticación)
  app.use("/api/auth", authRoutes);
  app.use("/api/setup", setupRoutes);

  // Rutas protegidas con enhancedAuthMiddleware
  app.use("/api/libraries", enhancedAuthMiddleware, librariesRoutes);
  app.use("/api/media", enhancedAuthMiddleware, mediaRoutes);
  app.use("/api/admin", enhancedAuthMiddleware, adminRoutes);
  app.use("/api/transcoding", enhancedAuthMiddleware, transcodingRoutes);
  app.use("/api/metadata", enhancedAuthMiddleware, metadataRoutes);
  app.use("/api/filesystem", enhancedAuthMiddleware, filesystemRoutes);
  // COMMENTED OUT: Eliminamos la ruta de streaming ya que está integrada en mediaRoutes
  // app.use("/api/streaming", enhancedAuthMiddleware, streamingRoutes);
  app.use("/api/user", enhancedAuthMiddleware, userHistoryRoutes);

  // Ruta para verificar si un usuario es administrador
  app.get(
    "/api/auth/verify-admin",
    enhancedAuthMiddleware,
    async (req, res) => {
      try {
        const userId = req.user.id;
        const db = require("./config/database");

        const user = await db.asyncGet(
          "SELECT is_admin FROM users WHERE id = ?",
          [userId]
        );

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
        console.error(
          "Error al verificar privilegios de administrador:",
          error
        );
        res.status(500).json({
          error: "Error del servidor",
          message: "Error al verificar privilegios de administrador",
        });
      }
    }
  );

  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      console.error(
        `⚠️ ERROR: No se pudo crear el directorio de datos: ${error.message}`
      );
      if (error.code === "EACCES") {
        console.error(
          "⚠️ Error de permisos. Asegúrate de que el usuario pueda escribir en el directorio padre."
        );
      }
    }
  }

  const serveStaticWithErrorHandling = (directory) => {
    return (req, res, next) => {
      const decodedPath = decodeURIComponent(req.path);
      const filePath = path.join(directory, decodedPath);

      fs.stat(filePath, (err, stats) => {
        if (err) {
          if (err.code === "ENOENT") return next();
          if (err.code === "EACCES") {
            logPermissionIssue(filePath, err);
            return res.status(403).json({
              error: "Error de permisos",
              message: "No se tiene acceso para leer el archivo solicitado",
              path: req.path,
              suggestion:
                "Ejecuta el script add-media-folder.sh para configurar los permisos",
            });
          }
          console.error(`Error al acceder a ${filePath}:`, err);
          return res.status(500).json({
            error: "Error del servidor",
            message: `Error al acceder al archivo: ${err.message}`,
          });
        }

        if (stats.isDirectory()) {
          const indexPath = path.join(filePath, "index.html");
          fs.access(indexPath, fs.constants.R_OK, (err) => {
            if (err) return next();
            res.sendFile(indexPath, (err) => {
              if (err && !res.headersSent) {
                console.error(`Error al enviar index.html ${indexPath}:`, err);
                res.status(500).json({
                  error: "Error del servidor",
                  message: `Error al enviar el archivo: ${err.message}`,
                });
              }
            });
          });
        } else {
          res.sendFile(filePath, (err) => {
            if (err && !res.headersSent) {
              console.error(`Error al enviar archivo ${filePath}:`, err);
              res.status(500).json({
                error: "Error del servidor",
                message: `Error al enviar el archivo: ${err.message}`,
              });
            }
          });
        }
      });
    };
  };

  app.use(
    "/data",
    enhancedAuthMiddleware,
    serveStaticWithErrorHandling(dataDir)
  );

  const enhancedTranscoder = require("./services/enhancedTranscoderService");

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
    if (data.error.includes("EACCES") || data.error.includes("permission")) {
      logPermissionIssue(data.outputPath || "ruta desconocida", {
        code: "EACCES",
        message: data.error,
      });
    }
  });

  app.use(serveStaticWithErrorHandling(frontendDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexPath = path.join(frontendDistPath, "index.html");
    fs.access(indexPath, fs.constants.R_OK, (err) => {
      if (err) {
        console.error(`Error al acceder a index.html: ${err.message}`);
        if (err.code === "EACCES") {
          logPermissionIssue(indexPath, err);
          return res.status(500).send(`
            <html>
              <head><title>Error de Permisos</title></head>
              <body style="font-family: Arial, sans-serif; padding: 2rem; text-align: center;">
                <h1 style="color: #e53e3e;">Error de Permisos</h1>
                <p>El servidor no puede acceder al archivo index.html debido a permisos insuficientes.</p>
                <p>Por favor, verifica los permisos del directorio: ${frontendDistPath}</p>
              </body>
            </html>
          `);
        }
        return res.status(500).send(`
          <html>
            <head><title>Error</title></head>
            <body style="font-family: Arial, sans-serif; padding: 2rem; text-align: center;">
              <h1 style="color: #e53e3e;">Error al cargar la aplicación</h1>
              <p>No se pudo acceder al archivo principal de la aplicación.</p>
              <p>Error: ${err.message}</p>
            </body>
          </html>
        `);
      }
      res.sendFile(indexPath);
    });
  });

  app.use("/api/*", (req, res) => {
    res.status(404).json({
      error: "Ruta no encontrada",
      message: `La ruta ${req.originalUrl} no existe en este servidor`,
    });
  });

  app.use((err, req, res, next) => {
    console.error("Error en la aplicación:", err);
    if (req.path.startsWith("/api/")) {
      return res.status(500).json({
        error: "Error interno del servidor",
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Ocurrió un error inesperado",
      });
    }
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
            .error-details { margin-top: 2rem; text-align: left; background-color: #f8f8f8; 
                            padding: 1rem; border-radius: 0.25rem; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>¡Ups! Algo salió mal</h1>
            <p>Ocurrió un error en el servidor. Por favor, inténtalo de nuevo más tarde.</p>
            <a href="/" class="back-button">Volver al inicio</a>
            ${
              process.env.NODE_ENV === "development"
                ? `<div class="error-details">
                  <h3>Detalles del error (solo visible en desarrollo):</h3>
                  <pre>${err.stack}</pre>
                </div>`
                : ""
            }
          </div>
        </body>
      </html>
    `);
  });

  return app;
}

const getLocalIP = () => {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          console.log(
            `Interfaz de red detectada: ${name}, IP: ${iface.address}`
          );
          return iface.address;
        }
      }
    }
    console.warn("No se detectó ninguna IP válida, usando 0.0.0.0");
    return "0.0.0.0";
  } catch (error) {
    console.error("Error al detectar IP local:", error);
    return "0.0.0.0";
  }
};

let configuredApp = null;

setupApp()
  .then((app) => {
    configuredApp = app;
    if (require.main === module) {
      const PORT = process.env.PORT || settings.port || 45000;
      const LOCAL_IP = getLocalIP();
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n==============================================`);
        console.log(`Servidor StreamVio ejecutándose en el puerto ${PORT}`);
        console.log(`==============================================`);
        console.log(`Acceso local: http://localhost:${PORT}`);
        console.log(`Acceso en red: ${LOCAL_IP}:${PORT}`);
        console.log(`API disponible en http://${LOCAL_IP}:${PORT}/api`);
        console.log(
          `Usuario actual: ${process.getuid ? process.getuid() : "desconocido"}`
        );
        console.log(
          `Grupo actual: ${process.getgid ? process.getgid() : "desconocido"}`
        );
        console.log(`==============================================\n`);
      });
    }
  })
  .catch((error) => {
    console.error("Error al configurar la aplicación:", error);
    process.exit(1);
  });

module.exports = app;
