// server/routes/streaming.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const authMiddleware = require("../middleware/enhancedAuth");
const db = require("../config/database");
const streamingService = require("../services/streamingService");

/**
 * Middleware para verificar tokens de streaming
 */
const verifyStreamToken = async (req, res, next) => {
  try {
    console.log("Verificando token de streaming para:", req.originalUrl);
    console.log("Headers:", req.headers);
    console.log("Query params:", req.query);

    const token = req.query.token || req.query.auth || req.query.stream_token;
    const mediaId = req.params.id;

    if (!token) {
      console.error(
        `Streaming denegado: Token no proporcionado para el medio ${mediaId}`
      );

      // SOLO PARA DEPURACIÓN: Permitir streaming sin token temporalmente
      console.log("ADVERTENCIA: Permitiendo streaming sin token para pruebas");
      req.streamingUserId = 1; // Usuario por defecto
      return next();

      // En producción, descomentar este código:
      /*
      return res.status(401).json({
        error: "No autorizado",
        message: "Token de streaming no proporcionado",
      });
      */
    }

    // Verificar token
    const tokenRecord = await streamingService.verifyStreamToken(
      token,
      mediaId
    );

    if (!tokenRecord) {
      console.error(
        `Streaming denegado: Token inválido o expirado para el medio ${mediaId}`
      );

      // SOLO PARA DEPURACIÓN: Permitir streaming sin token válido temporalmente
      console.log(
        "ADVERTENCIA: Permitiendo streaming con token inválido para pruebas"
      );
      req.streamingUserId = 1; // Usuario por defecto
      return next();

      // En producción, descomentar este código:
      /*
      return res.status(401).json({
        error: "No autorizado",
        message: "Token de streaming inválido o expirado",
      });
      */
    }

    // Añadir información del usuario a la solicitud
    req.streamingUserId = tokenRecord.user_id;
    console.log(`Token verificado para usuario ${tokenRecord.user_id}`);
    next();
  } catch (error) {
    console.error("Error en verificación de token de streaming:", error);

    // SOLO PARA DEPURACIÓN: Permitir en caso de error
    console.log(
      "ADVERTENCIA: Permitiendo streaming tras error en verificación"
    );
    req.streamingUserId = 1; // Usuario por defecto
    next();

    // En producción, descomentar este código:
    /*
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar autenticación para streaming",
    });
    */
  }
};

/**
 * @route   GET /api/streaming/:id/prepare
 * @desc    Preparar sesión de streaming y generar token
 * @access  Private
 */
router.get("/:id/prepare", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;

  try {
    console.log(
      `Preparando streaming para usuario ${userId}, medio ${mediaId}`
    );

    // Verificar que el medio existe
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      console.error(`Medio no encontrado: ${mediaId}`);
      return res.status(404).json({
        error: "No encontrado",
        message: "El elemento multimedia solicitado no existe",
      });
    }

    // Normalizar la ruta del archivo
    const filePath = mediaItem.file_path.replace(/\\/g, "/");
    console.log(`Ruta del archivo: ${filePath}`);

    // Verificar que el archivo existe
    let fileExists = true;
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      console.log(`Archivo verificado: ${filePath}`);
    } catch (fileError) {
      console.error(`Archivo físico no encontrado o sin permisos: ${filePath}`);
      console.error(fileError);

      // No interrumpimos el flujo, solo registramos el error
      fileExists = false;
    }

    if (!fileExists) {
      return res.status(404).json({
        error: "Archivo no encontrado",
        message:
          "El archivo físico no existe en el sistema o no tiene permisos suficientes",
      });
    }

    // Generar token de streaming
    const { token, expiresAt } = await streamingService.generateStreamToken(
      userId,
      mediaId
    );

    // Determinar la URL de streaming según el tipo de contenido
    const streamUrl = `/api/streaming/${mediaId}/stream?token=${token}`;

    // Verificar si existe versión HLS para este archivo
    // Extraer solo el nombre del archivo sin la ruta completa
    const fileName = path.basename(filePath, path.extname(filePath));
    const hlsDir = path.join(
      process.cwd(),
      "server/data/transcoded",
      `${fileName}_hls`
    );
    const hasHLS =
      fs.existsSync(hlsDir) && fs.existsSync(path.join(hlsDir, "master.m3u8"));

    // Devolver URLs de streaming y metadatos
    res.json({
      mediaId,
      directStreamUrl: streamUrl,
      hlsStreamUrl: hasHLS
        ? `/api/streaming/${mediaId}/hls?token=${token}`
        : null,
      hasHLS,
      token,
      expiresAt,
    });

    console.log(
      `Streaming preparado con éxito para medio ${mediaId}, token generado: ${token.substring(
        0,
        8
      )}...`
    );
  } catch (error) {
    console.error(`Error al preparar streaming para medio ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al preparar sesión de streaming",
      details: error.message,
    });
  }
});

/**
 * @route   GET /api/streaming/:id/stream
 * @desc    Streaming directo de archivo multimedia
 * @access  Private (con token de streaming)
 */
router.get("/:id/stream", verifyStreamToken, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.streamingUserId;

  try {
    console.log(
      `Solicitud de streaming para usuario ${userId}, medio ${mediaId}`
    );

    // Obtener el elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.file_path) {
      console.error(`Archivo no encontrado para media_id=${mediaId}`);
      return res.status(404).json({
        error: "No encontrado",
        message: "Archivo multimedia no encontrado",
      });
    }

    // Normalizar la ruta del archivo para asegurar compatibilidad entre sistemas
    const filePath = mediaItem.file_path.replace(/\\/g, "/");
    console.log(`Accediendo al archivo: ${filePath}`);

    // Verificar que el archivo existe
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (accessError) {
      console.error(
        `El archivo físico no existe o no es accesible: ${filePath}`
      );
      console.error(accessError);
      return res.status(404).json({
        error: "Archivo no encontrado",
        message: "El archivo físico no existe o no es accesible",
        details: accessError.message,
      });
    }

    // Obtener información del archivo
    const fileInfo = await streamingService.getFileInfo(filePath);
    const { size, mimeType } = fileInfo;

    // Registrar la visualización
    await streamingService.recordViewStart(userId, mediaId);

    // Manejar solicitudes de rango (para streaming)
    const range = req.headers.range;

    if (range) {
      // Streaming con rango
      console.log(`Streaming con rango: ${range}`);

      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

      // Validar rango
      if (start >= size) {
        return res.status(416).send("Requested range not satisfiable");
      }

      const chunksize = end - start + 1;
      console.log(
        `Enviando chunk de ${chunksize} bytes (${start}-${end}/${size})`
      );

      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });

      // Streaming
      file.pipe(res);

      // Manejo de errores durante el streaming
      file.on("error", (err) => {
        console.error(`Error durante streaming de ${filePath}:`, err);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Error de streaming",
            message: "Error al leer el archivo multimedia",
          });
        } else {
          res.end();
        }
      });
    } else {
      // Streaming completo (sin rango)
      console.log(`Streaming completo: ${size} bytes`);

      res.writeHead(200, {
        "Content-Length": size,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });

      const file = fs.createReadStream(filePath);
      file.pipe(res);

      // Manejo de errores durante el streaming
      file.on("error", (err) => {
        console.error(`Error durante streaming de ${filePath}:`, err);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Error de streaming",
            message: "Error al leer el archivo multimedia",
          });
        } else {
          res.end();
        }
      });
    }
  } catch (error) {
    console.error(
      `Error al procesar solicitud de streaming para ${mediaId}:`,
      error
    );
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar la solicitud de streaming",
      details: error.message,
    });
  }
});

/**
 * @route   GET /api/streaming/:id/debug
 * @desc    Depurar problemas de streaming
 * @access  Private
 */
router.get("/:id/debug", authMiddleware, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.user.id;

  try {
    console.log(`Depurando streaming para usuario ${userId}, medio ${mediaId}`);

    // Obtener información del medio
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem) {
      console.error(`Medio no encontrado: ${mediaId}`);
      return res.status(404).json({
        error: "No encontrado",
        message: "El elemento multimedia solicitado no existe",
      });
    }

    // Normalizar la ruta del archivo
    const filePath = mediaItem.file_path.replace(/\\/g, "/");

    // Verificar que el archivo existe
    let fileExists = false;
    let fileStats = null;
    let fileError = null;

    try {
      fileStats = fs.statSync(filePath);
      fileExists = true;
    } catch (err) {
      fileError = {
        code: err.code,
        message: err.message,
      };
    }

    // Intentar generar un token de streaming
    let streamToken = null;
    let tokenError = null;

    try {
      const tokenResult = await streamingService.generateStreamToken(
        userId,
        mediaId
      );
      streamToken = tokenResult.token;
    } catch (err) {
      tokenError = {
        message: err.message,
        stack: err.stack,
      };
    }

    // Verificar permisos de usuario para el medio
    let accessInfo = {
      hasAccess: false,
      isAdmin: false,
      details: "No verificado",
    };

    try {
      accessInfo.isAdmin = await streamingService.isUserAdmin(userId);
      accessInfo.hasAccess = await streamingService.checkUserAccessToMedia(
        userId,
        mediaId
      );
      accessInfo.details = accessInfo.isAdmin
        ? "Acceso de administrador"
        : accessInfo.hasAccess
        ? "Acceso permitido"
        : "Acceso denegado";
    } catch (accessError) {
      accessInfo.details = "Error al verificar: " + accessError.message;
    }

    // Devolver toda la información de diagnóstico
    res.json({
      mediaInfo: mediaItem,
      filePath: filePath,
      fileStatus: {
        exists: fileExists,
        error: fileError,
        stats: fileExists
          ? {
              size: fileStats.size,
              mtime: fileStats.mtime,
              isFile: fileStats.isFile(),
              mode: fileStats.mode.toString(8),
              uid: fileStats.uid,
              gid: fileStats.gid,
            }
          : null,
      },
      tokenInfo: {
        success: !!streamToken,
        token: streamToken ? streamToken.substring(0, 10) + "..." : null,
        error: tokenError,
      },
      userAccess: accessInfo,
      serverInfo: {
        uid: process.getuid ? process.getuid() : "N/A",
        gid: process.getgid ? process.getgid() : "N/A",
        cwd: process.cwd(),
        platform: process.platform,
      },
    });
  } catch (error) {
    console.error(`Error en el endpoint de depuración:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: error.message,
      stack: error.stack,
    });
  }
});

/**
 * @route   GET /api/streaming/:id/hls
 * @desc    Streaming HLS adaptativo
 * @access  Private (con token de streaming)
 */
router.get("/:id/hls", verifyStreamToken, async (req, res) => {
  const mediaId = req.params.id;
  const userId = req.streamingUserId;

  try {
    // Obtener el elemento multimedia
    const mediaItem = await db.asyncGet(
      "SELECT * FROM media_items WHERE id = ?",
      [mediaId]
    );

    if (!mediaItem || !mediaItem.file_path) {
      return res.status(404).json({
        error: "No encontrado",
        message: "Archivo multimedia no encontrado",
      });
    }

    // Determinar la ruta al directorio HLS
    const filePath = mediaItem.file_path.replace(/\\/g, "/");
    const fileName = path.basename(filePath, path.extname(filePath));
    const hlsDir = path.join(
      process.cwd(),
      "server/data/transcoded",
      `${fileName}_hls`
    );
    const masterPlaylist = path.join(hlsDir, "master.m3u8");

    // Verificar que existe el directorio HLS
    if (!fs.existsSync(hlsDir) || !fs.existsSync(masterPlaylist)) {
      return res.status(404).json({
        error: "HLS no disponible",
        message: "El streaming HLS no está disponible para este medio",
      });
    }

    // Registrar la visualización
    await streamingService.recordViewStart(userId, mediaId);

    // Devolver la ubicación donde se puede acceder al HLS
    res.json({
      mediaId,
      hlsBaseUrl: `/data/transcoded/${fileName}_hls`,
      masterPlaylist: `data/transcoded/${fileName}_hls/master.m3u8?token=${
        req.query.token || req.query.auth || ""
      }`,
    });
  } catch (error) {
    console.error(`Error al procesar solicitud HLS para ${mediaId}:`, error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar la solicitud de streaming HLS",
    });
  }
});

/**
 * @route   GET /api/streaming/:id/hls/*
 * @desc    Servir archivos HLS (segmentos, playlists)
 * @access  Private (con token de streaming)
 */
router.get("/:id/hls/*", verifyStreamToken, (req, res) => {
  const mediaId = req.params.id;
  const filePath = req.params[0];

  try {
    // Ruta base de HLS
    const baseHlsDir = path.join(process.cwd(), "server/data/transcoded");

    // Construir ruta completa
    const fullPath = path.join(baseHlsDir, `media_${mediaId}_hls`, filePath);

    // Verificar que el archivo existe
    if (!fs.existsSync(fullPath)) {
      return res.status(404).send("Archivo HLS no encontrado");
    }

    // Determinar tipo MIME
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = "application/octet-stream";

    if (ext === ".m3u8") {
      contentType = "application/vnd.apple.mpegurl";
    } else if (ext === ".ts") {
      contentType = "video/mp2t";
    }

    // Servir el archivo
    res.setHeader("Content-Type", contentType);
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    console.error(`Error al servir archivo HLS para ${mediaId}:`, error);
    res.status(500).send("Error al servir archivo HLS");
  }
});

/**
 * @route   GET /api/streaming/token/:id
 * @desc    Obtener token de streaming para un medio
 * @access  Private
 */
router.get("/token/:id", authMiddleware, async (req, res) => {
  try {
    const mediaId = req.params.id;
    const userId = req.user.id;

    console.log(
      `Solicitando token de streaming para medio ${mediaId}, usuario ${userId}`
    );

    // Generar token
    const { token, expiresAt } = await streamingService.generateStreamToken(
      userId,
      mediaId
    );

    res.json({
      stream_token: token,
      expires_at: expiresAt,
      expires_in: Math.floor((new Date(expiresAt) - new Date()) / 1000),
      media_id: mediaId,
    });
  } catch (error) {
    console.error("Error al generar token de streaming:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: error.message,
    });
  }
});

module.exports = router;
