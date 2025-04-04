// server/routes/admin.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

// Middleware para verificar si el usuario es admin
const adminMiddleware = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await db.asyncGet("SELECT is_admin FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user || !user.is_admin) {
      return res.status(403).json({
        error: "Acceso denegado",
        message:
          "Se requieren privilegios de administrador para esta operación",
      });
    }

    next();
  } catch (error) {
    console.error("Error al verificar privilegios de administrador:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar privilegios de administrador",
    });
  }
};

// Usar middleware de autenticación y admin para todas las rutas
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @route   GET /api/admin/stats
 * @desc    Obtener estadísticas generales del sistema
 * @access  Admin
 */
router.get("/stats", async (req, res) => {
  try {
    // Obtener conteo de usuarios
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");

    // Obtener conteo de bibliotecas
    const libraryCount = await db.asyncGet(
      "SELECT COUNT(*) as count FROM libraries"
    );

    // Obtener conteo de elementos multimedia
    const mediaCount = await db.asyncGet(
      "SELECT COUNT(*) as count FROM media_items"
    );

    // Obtener actividad reciente
    const recentActivity = await db.asyncAll(`
      SELECT 
        u.username, 
        CASE
          WHEN wh.id IS NOT NULL THEN 'visualización'
          WHEN f.id IS NOT NULL THEN 'favorito'
          ELSE 'desconocido'
        END as action,
        m.title as item,
        COALESCE(wh.watched_at, f.added_at) as timestamp
      FROM (
        SELECT user_id, media_id, watched_at, NULL as added_at, 'watch' as type FROM watch_history
        UNION
        SELECT user_id, media_id, NULL as watched_at, added_at, 'favorite' as type FROM favorites
      ) as combined
      LEFT JOIN users u ON combined.user_id = u.id
      LEFT JOIN media_items m ON combined.media_id = m.id
      LEFT JOIN watch_history wh ON combined.user_id = wh.user_id AND combined.media_id = wh.media_id AND combined.type = 'watch'
      LEFT JOIN favorites f ON combined.user_id = f.user_id AND combined.media_id = f.media_id AND combined.type = 'favorite'
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    res.json({
      users: userCount ? userCount.count : 0,
      libraries: libraryCount ? libraryCount.count : 0,
      mediaItems: mediaCount ? mediaCount.count : 0,
      recentActivity: recentActivity || [],
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener estadísticas del sistema",
    });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Obtener la lista de usuarios
 * @access  Admin
 */
router.get("/users", async (req, res) => {
  try {
    const users = await db.asyncAll(
      "SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC"
    );

    res.json(users);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener la lista de usuarios",
    });
  }
});

/**
 * @route   POST /api/admin/users/:id/toggle-admin
 * @desc    Activar/desactivar privilegios de administrador
 * @access  Admin
 */
router.post("/users/:id/toggle-admin", async (req, res) => {
  const userId = req.params.id;

  try {
    // Verificar que el usuario existe
    const user = await db.asyncGet("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Usuario no encontrado",
      });
    }

    // No permitir cambiar sus propios privilegios
    if (userId == req.user.id) {
      return res.status(400).json({
        error: "Operación no permitida",
        message: "No puedes cambiar tus propios privilegios de administrador",
      });
    }

    // Cambiar estado de administrador
    const newAdminStatus = user.is_admin ? 0 : 1;

    await db.asyncRun("UPDATE users SET is_admin = ? WHERE id = ?", [
      newAdminStatus,
      userId,
    ]);

    res.json({
      message: `Privilegios de administrador ${
        newAdminStatus ? "activados" : "desactivados"
      } correctamente`,
      userId,
      isAdmin: !!newAdminStatus,
    });
  } catch (error) {
    console.error(`Error al cambiar privilegios del usuario ${userId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al cambiar privilegios de administrador",
    });
  }
});

/**
 * @route   GET /api/admin/system
 * @desc    Obtener información del sistema
 * @access  Admin
 */
router.get("/system", async (req, res) => {
  try {
    // Obtener configuraciones globales
    const settings = await db.asyncAll("SELECT * FROM settings");

    // Información sobre trabajos de transcodificación
    const transcodingStats = await db.asyncGet(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM transcoding_jobs
    `);

    res.json({
      version: "0.1.0",
      environment: process.env.NODE_ENV || "development",
      settings: settings || [],
      transcoding: transcodingStats || {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      },
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Error al obtener información del sistema:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener información del sistema",
    });
  }
});

/**
 * @route   GET /api/admin/users/count
 * @desc    Obtener el número total de usuarios
 * @access  Private (Admin)
 */
router.get(
  "/users/count",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const countResult = await db.asyncGet(
        "SELECT COUNT(*) as count FROM users"
      );

      // Obtener el límite de usuarios de la configuración
      const limitSetting = await db.asyncGet(
        "SELECT value FROM settings WHERE key = 'max_users'"
      );
      const limit = limitSetting ? parseInt(limitSetting.value) : 10; // Valor por defecto: 10

      res.json({
        count: countResult ? countResult.count : 0,
        limit: limit,
      });
    } catch (error) {
      console.error("Error al obtener conteo de usuarios:", error);
      res.status(500).json({
        error: "Error del servidor",
        message: "Error al obtener conteo de usuarios",
      });
    }
  }
);

module.exports = router;
