// server/routes/metadata.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const tmdbService = require("../services/tmdbService");
const db = require("../config/database");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @route   GET /api/metadata/search
 * @desc    Buscar película/serie por título
 * @access  Private
 */
router.get("/search", async (req, res) => {
  const { title, type, year } = req.query;

  if (!title) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere un título para la búsqueda",
    });
  }

  try {
    // Por ahora solo implementamos búsqueda de películas
    if (type === "movie" || !type) {
      const results = await tmdbService.searchMovie(title, year);
      return res.json(results);
    } else {
      return res.status(400).json({
        error: "Tipo no soportado",
        message: `La búsqueda de tipo "${type}" no está implementada todavía`,
      });
    }
  } catch (error) {
    console.error("Error en búsqueda de metadatos:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al buscar metadatos",
    });
  }
});

/**
 * @route   POST /api/metadata/enrich/:id
 * @desc    Enriquecer un elemento multimedia con metadatos
 * @access  Private
 */
router.post("/enrich/:id", async (req, res) => {
  const mediaId = req.params.id;

  try {
    // Verificar que el elemento existe
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Elemento multimedia no encontrado",
      });
    }

    // Intentar enriquecer el elemento
    const success = await tmdbService.enrichMediaItem(mediaId);

    if (success) {
      // Obtener el elemento actualizado
      const updatedItem = await db.asyncGet(
        "SELECT * FROM media_items WHERE id = ?",
        [mediaId]
      );

      res.json({
        message: "Metadatos aplicados con éxito",
        mediaItem: updatedItem,
      });
    } else {
      res.status(400).json({
        error: "Error en metadatos",
        message:
          "No se pudieron encontrar o aplicar metadatos para este elemento",
      });
    }
  } catch (error) {
    console.error(`Error al enriquecer elemento ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al aplicar metadatos",
    });
  }
});

/**
 * @route   POST /api/metadata/enrich-library/:id
 * @desc    Enriquecer todos los elementos de una biblioteca
 * @access  Private
 */
router.post("/enrich-library/:id", async (req, res) => {
  const libraryId = req.params.id;

  try {
    // Verificar que la biblioteca existe
    const library = await db.asyncGet("SELECT * FROM libraries WHERE id = ?", [
      libraryId,
    ]);

    if (!library) {
      return res.status(404).json({
        error: "No encontrada",
        message: "Biblioteca no encontrada",
      });
    }

    // Obtener todos los elementos de la biblioteca
    const mediaItems = await db.asyncAll(
      "SELECT id, title, type FROM media_items WHERE library_id = ?",
      [libraryId]
    );

    if (mediaItems.length === 0) {
      return res.json({
        message: "La biblioteca no contiene elementos para enriquecer",
        count: 0,
      });
    }

    // Responder inmediatamente que el proceso ha iniciado
    res.json({
      message: "Proceso de enriquecimiento iniciado",
      count: mediaItems.length,
      status: "processing",
    });

    // Procesar elementos en segundo plano
    // Nota: En producción, deberías usar una cola de trabajos real
    setTimeout(async () => {
      let enriched = 0;
      let failed = 0;

      for (const item of mediaItems) {
        // Solo procesar películas por ahora
        if (item.type === "movie") {
          const success = await tmdbService.enrichMediaItem(item.id);
          if (success) {
            enriched++;
          } else {
            failed++;
          }
          // Pequeña pausa para no sobrecargar la API de TMDb
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      console.log(
        `Proceso completado: ${enriched} enriquecidos, ${failed} fallidos`
      );
    }, 0);
  } catch (error) {
    console.error(`Error al enriquecer biblioteca ${libraryId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al iniciar el proceso de enriquecimiento",
    });
  }
});

module.exports = router;
