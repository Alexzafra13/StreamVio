// server/app.js (modificar las rutas de videos)
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const db = require("./config/database");
require("dotenv").config();

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
  });
});

// Ruta para obtener lista de videos
app.get("/api/videos", (req, res) => {
  db.all("SELECT * FROM videos", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al consultar la base de datos" });
    }
    res.json(rows);
  });
});

// Ruta para obtener un video por su ID
app.get("/api/videos/:id", (req, res) => {
  const videoId = parseInt(req.params.id);
  
  db.get("SELECT * FROM videos WHERE id = ?", [videoId], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al consultar la base de datos" });
    }
    
    if (!row) {
      return res.status(404).json({ message: "Video no encontrado" });
    }
    
    res.json(row);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor StreamVio ejecutándose en el puerto ${PORT}`);
});