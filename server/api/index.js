// server/api/index.js
const express = require("express");
const router = express.Router();

// Importar todas las rutas
const authRoutes = require("./routes/authRoutes");
const libraryRoutes = require("./routes/libraryRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const metadataRoutes = require("./routes/metadataRoutes");
const streamingRoutes = require("./routes/streamingRoutes");
const transcodingRoutes = require("./routes/transcodingRoutes");
const userRoutes = require("./routes/userRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const watchHistoryRoutes = require("./routes/watchHistoryRoutes");
const migrationRoutes = require("./routes/migrationRoutes");

// Ruta API básica
router.get("/", (req, res) => {
  res.json({
    name: "StreamVio API",
    version: "1.0.0",
    status: "online",
  });
});

// Ruta de estado
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Montar todas las rutas
router.use("/auth", authRoutes);
router.use("/libraries", libraryRoutes);
router.use("/media", mediaRoutes);
router.use("/metadata", metadataRoutes);
router.use("/streaming", streamingRoutes);
router.use("/transcoding", transcodingRoutes);
router.use("/users", userRoutes);
router.use("/settings", settingsRoutes);
router.use("/history", watchHistoryRoutes);
router.use("/migrations", migrationRoutes);

module.exports = router;
