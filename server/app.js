// server/app.js - Versión completada y corregida
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const os = require("os");
const settings = require("./config/settings");
const permissionsHelper = require("./utils/permissionsHelper");
require("dotenv").config();

// Importar rutas
const authRoutes = require("./routes/auth");
const librariesRoutes = require("./routes/libraries");
const mediaRoutes = require("./routes/media");
const adminRoutes = require("./routes/admin");
const transcodingRoutes = require("./routes/transcoding");
const metadataRoutes = require("./routes/metadata");
const filesystemRoutes = require("./routes/filesystem");
const streamingRoutes = require("./routes/streaming");
const setupRoutes = require("./routes/setup");

// Importar middleware de autenticación
const authMiddleware = require("./middleware/auth");

// Crear aplicación Express
const app = express();

// Configurar logger personalizado para problemas de permisos
const logPermissionIssue = permissionsHelper.logPermissionIssue;

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Desactivar CSP para permitir que el frontend funcione correctamente
    crossOriginEmbedderPolicy: false, // Permitir carga de recursos cross-origin
  })
);

// Configurar un formato de log detallado para debugging
morgan.token("user-id", (req) => req.user?.id || "no-auth");
app.use(
  morgan(
    ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms'
  )
);

app.use(express.json());

// Función para configurar la aplicación
async function setupApp() {
  // Verificar y crear directorios necesarios
  try {
    const dataDir = path.join(__dirname, "data");
    const requiredDirs = [
      dataDir,
      path.join(dataDir, "thumbnails"),
      path.join(dataDir, "transcoded"),
      path.join(dataDir, "cache"),
      path.join(dataDir, "metadata"),
    ];

    const dirResult = await permissionsHelper.createRequiredDirectories(
      requiredDirs
    );

    if (!dirResult.success) {
      console.warn(
        "⚠️ Algunos directorios no pudieron ser creados o no tienen permisos correctos:"
      );
      dirResult.failed.forEach((dir) => {
        console.warn(`  - ${dir}`);
      });
      console.warn("El sistema puede presentar problemas de funcionamiento.");
    } else {
      console.log(
        "✓ Directorios de datos creados y configurados correctamente"
      );
    }
  } catch (error) {
    console.error("Error al configurar directorios:", error);
  }

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
  } else {
    // Verificar permisos de lectura
    try {
      // Intentar leer un archivo del directorio para verificar permisos
      fs.accessSync(frontendDistPath, fs.constants.R_OK);
    } catch (error) {
      console.error(
        "⚠️ ERROR DE PERMISOS: No se puede acceder al directorio del frontend:",
        frontendDistPath
      );
      console.error(
        `⚠️ Asegúrate de que el usuario que ejecuta el servicio tenga permisos de lectura`
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

  // Rutas protegidas
  app.use("/api/libraries", librariesRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/transcoding", transcodingRoutes);
  app.use("/api/metadata", metadataRoutes);
  app.use("/api/filesystem", filesystemRoutes);
  app.use("/api/streaming", streamingRoutes);

  // Ruta para verificar si un usuario es administrador
  app.get("/api/auth/verify-admin", authMiddleware, async (req, res) => {
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
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      console.error(
        `⚠️ ERROR: No se pudo crear el directorio de datos: ${error.message}`
      );
      // Intentar determinar el problema
      if (error.code === "EACCES") {
        console.error(
          "⚠️ Error de permisos. Asegúrate de que el usuario pueda escribir en el directorio padre."
        );
      }
    }
  }

  // Middleware mejorado para manejar archivos estáticos con mejor manejo de errores
  const serveStaticWithErrorHandling = (directory) => {
    return (req, res, next) => {
      // Decodificar URL para manejar caracteres especiales correctamente
      const decodedPath = decodeURIComponent(req.path);
      const filePath = path.join(directory, decodedPath);

      // Primero verificar si la ruta existe
      fs.stat(filePath, (err, stats) => {
        if (err) {
          if (err.code === "ENOENT") {
            // Si el archivo no existe, continuar con el siguiente middleware
            return next();
          } else if (err.code === "EACCES") {
            // Error de permisos
            logPermissionIssue(filePath, err);
            return res.status(403).json({
              error: "Error de permisos",
              message: "No se tiene acceso para leer el archivo solicitado",
              path: req.path,
              suggestion:
                "Ejecuta el script add-media-folder.sh para configurar los permisos",
            });
          } else {
            // Otro error
            console.error(`Error al acceder a ${filePath}:`, err);
            return res.status(500).json({
              error: "Error del servidor",
              message: `Error al acceder al archivo: ${err.message}`,
            });
          }
        }

        // Verificar si estamos tratando con un directorio o un archivo
        if (stats.isDirectory()) {
          // Si es un directorio, buscar un index.html en ese directorio
          const indexPath = path.join(filePath, "index.html");

          fs.access(indexPath, fs.constants.R_OK, (err) => {
            if (err) {
              // No hay un index.html, pasar al siguiente middleware
              return next();
            } else {
              // Hay un index.html, enviarlo
              res.sendFile(indexPath, (err) => {
                if (err) {
                  console.error(
                    `Error al enviar index.html ${indexPath}:`,
                    err
                  );
                  if (!res.headersSent) {
                    res.status(500).json({
                      error: "Error del servidor",
                      message: `Error al enviar el archivo: ${err.message}`,
                    });
                  }
                }
              });
            }
          });
        } else {
          // Es un archivo, enviarlo directamente
          res.sendFile(filePath, (err) => {
            if (err) {
              console.error(`Error al enviar archivo ${filePath}:`, err);
              if (!res.headersSent) {
                res.status(500).json({
                  error: "Error del servidor",
                  message: `Error al enviar el archivo: ${err.message}`,
                });
              }
            }
          });
        }
      });
    };
  };

  // Servir archivos estáticos desde el directorio data con autenticación y mejor manejo de errores
  app.use("/data", authMiddleware, serveStaticWithErrorHandling(dataDir));

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

    // Verificar si es un error de permisos
    if (data.error.includes("EACCES") || data.error.includes("permission")) {
      logPermissionIssue(data.outputPath || "ruta desconocida", {
        code: "EACCES",
        message: data.error,
      });
    }
  });

  // Inicializar servicio de streaming
  const streamingService = require("./services/streamingService");
  // Programar limpieza periódica de tokens de streaming expirados (cada 1 hora)
  setInterval(async () => {
    try {
      const tokensRemoved = await streamingService.periodicTokenCleanup();
      if (tokensRemoved > 0) {
        console.log(
          `Limpieza de tokens: ${tokensRemoved} tokens expirados eliminados`
        );
      }
    } catch (error) {
      console.error("Error en limpieza periódica de tokens:", error);
    }
  }, 60 * 60 * 1000);

  // Servir archivos estáticos del frontend compilado con mejor manejo de errores
  app.use(serveStaticWithErrorHandling(frontendDistPath));

  // Para cualquier otra ruta que no sea /api, servir el index.html del frontend
  // Esto permite que la navegación en el frontend funcione correctamente con rutas dinámicas
  app.get("*", (req, res, next) => {
    // Si la ruta comienza con /api, pasar al siguiente middleware (que será el manejador 404 para API)
    if (req.path.startsWith("/api/")) {
      return next();
    }

    // Servir el index.html para cualquier otra ruta
    const indexPath = path.join(frontendDistPath, "index.html");

    // Verificar si el archivo existe y es accesible
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
        } else {
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
      }

      // Si no hay error, servir el archivo
      res.sendFile(indexPath);
    });
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

// Función mejorada para obtener la dirección IP local IPv4
const getLocalIP = () => {
  try {
    const interfaces = os.networkInterfaces();
    // Filtrar solo interfaces IPv4 y no internas
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Filtrar solo IPv4 y no loopback
        if (iface.family === "IPv4" && !iface.internal) {
          console.log(
            `Interfaz de red detectada: ${name}, IP: ${iface.address}`
          );
          return iface.address;
        }
      }
    }
    // Si no encuentra ninguna IP válida, usar localhost
    console.warn("No se detectó ninguna IP válida, usando 0.0.0.0");
    return "0.0.0.0";
  } catch (error) {
    console.error("Error al detectar IP local:", error);
    return "0.0.0.0"; // En caso de error, usar 0.0.0.0
  }
};

// Variable para almacenar la instancia de la aplicación configurada
let configuredApp = null;

// Inicializar y configurar la aplicación
setupApp()
  .then((configuredApp) => {
    // Guardar la instancia configurada
    app.configuredApp = configuredApp;

    // Solo iniciar el servidor si este archivo se ejecuta directamente,
    // no cuando se importa para tests
    if (require.main === module) {
      // Configurar el puerto unificado
      const PORT = process.env.PORT || settings.port || 45000;
      const LOCAL_IP = getLocalIP();

      // Escuchar en todas las interfaces (0.0.0.0)
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n==============================================`);
        console.log(`Servidor StreamVio ejecutándose en el puerto ${PORT}`);
        console.log(`==============================================`);
        console.log(`Acceso local: http://localhost:${PORT}`);
        console.log(`Acceso en red: http://${LOCAL_IP}:${PORT}`);
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
