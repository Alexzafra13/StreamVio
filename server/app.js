// server/app.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Importar configuración
const environment = require("./config/environment");
const { FRONTEND_DIST_DIR } = require("./config/paths");

// Importar middleware
const {
  errorHandler,
  notFoundHandler,
} = require("./api/middlewares/errorMiddleware");
const requestLogger = require("./api/middlewares/requestLogger");

// Importar rutas
const apiRoutes = require("./api");

// Crear aplicación Express
const app = express();

// Configurar middleware básico
app.use(
  helmet({
    contentSecurityPolicy: false, // Deshabilitar para desarrollo
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Rutas API
app.use("/api", apiRoutes);

// Servir archivos estáticos del cliente
if (fs.existsSync(FRONTEND_DIST_DIR)) {
  app.use(express.static(FRONTEND_DIST_DIR));

  // Todas las demás rutas no-API serán manejadas por el frontend
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST_DIR, "index.html"));
  });
} else {
  console.warn(
    `⚠️ Directorio de distribución del frontend no encontrado: ${FRONTEND_DIST_DIR}`
  );
  console.warn(
    'El frontend no será servido. Ejecuta "npm run build" en el directorio client.'
  );

  // Ruta de fallback cuando no hay frontend
  app.get("/", (req, res) => {
    res.send("Servidor StreamVio funcionando. Frontend no disponible.");
  });
}

// Manejadores de errores
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
