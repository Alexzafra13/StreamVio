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
  });
});

// Usar rutas de autenticación
app.use("/api/auth", authRoutes);

// Rutas protegidas con autenticación
// Ejemplo de ruta protegida que requiere autenticación
app.get("/api/profile", authMiddleware, (req, res) => {
  res.json({
    user: req.user,
    message: "Datos del perfil obtenidos correctamente"
  });
});

// Ruta para obtener lista de videos (simulada por ahora)
app.get("/api/videos", (req, res) => {
  res.json([
    {
      id: 1,
      title: "Big Buck Bunny",
      description: "Video de prueba de formato abierto",
      thumbnail:
        "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg",
      duration: "09:56",
      path: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
    },
    {
      id: 2,
      title: "Elephant Dream",
      description: "Primer video abierto de Blender Foundation",
      thumbnail:
        "https://upload.wikimedia.org/wikipedia/commons/e/e8/Elephants_Dream_s5_both.jpg",
      duration: "10:54",
      path: "https://test-videos.co.uk/vids/elephantsdream/mp4/h264/720/Elephants_Dream_720_10s_1MB.mp4",
    },
  ]);
});

// Ruta para obtener un video por su ID
app.get("/api/videos/:id", (req, res) => {
  const videoId = parseInt(req.params.id);
  const videos = [
    {
      id: 1,
      title: "Big Buck Bunny",
      description: "Video de prueba de formato abierto",
      thumbnail: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg",
      duration: "09:56",
      path: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
    },
    {
      id: 2,
      title: "Elephant Dream",
      description: "Primer video abierto de Blender Foundation",
      thumbnail: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Elephants_Dream_s5_both.jpg",
      duration: "10:54",
      path: "https://test-videos.co.uk/vids/elephantsdream/mp4/h264/720/Elephants_Dream_720_10s_1MB.mp4",
    },
  ];
  
  const video = videos.find(v => v.id === videoId);
  
  if (!video) {
    return res.status(404).json({ message: "Video no encontrado" });
  }
  
  res.json(video);
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor StreamVio ejecutándose en el puerto ${PORT}`);
});