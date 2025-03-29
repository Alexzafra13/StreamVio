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
