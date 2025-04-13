// server/data/seeds/defaultSettings.js
const settingRepository = require("../repositories/settingRepository");

/**
 * Script para cargar configuraciones por defecto en la base de datos
 */
async function loadDefaultSettings() {
  console.log("Cargando configuraciones por defecto...");

  // Configuración del sistema
  const systemSettings = {
    // Configuración general
    app_name: {
      value: "StreamVio",
      description: "Nombre de la aplicación",
    },
    max_users: {
      value: 10,
      description: "Número máximo de usuarios permitidos",
    },
    enable_logs: {
      value: true,
      description: "Habilitar registro de eventos",
    },
    log_level: {
      value: "info",
      description: "Nivel de detalle de los logs (debug, info, warn, error)",
    },

    // Configuración de transcodificación
    transcoding_enabled: {
      value: true,
      description: "Habilitar o deshabilitar el transcodificado automático",
    },
    default_transcoding_format: {
      value: "mp4",
      description: "Formato por defecto para transcodificación",
    },
    max_bitrate: {
      value: 8000,
      description: "Bitrate máximo para streaming en kbps",
    },
    enable_hardware_acceleration: {
      value: true,
      description:
        "Usar aceleración por hardware para transcodificación si está disponible",
    },
    transcoding_thread_count: {
      value: 2,
      description: "Número de trabajos de transcodificación simultáneos",
    },
    preferred_audio_codec: {
      value: "aac",
      description: "Códec de audio preferido para transcodificación",
    },
    preferred_video_codec: {
      value: "h264",
      description: "Códec de video preferido para transcodificación",
    },

    // Configuración de streaming
    hls_segment_duration: {
      value: 2,
      description: "Duración de cada segmento HLS en segundos",
    },
    default_streaming_quality: {
      value: "auto",
      description: "Calidad de streaming por defecto (auto, low, medium, high)",
    },
    enable_direct_play: {
      value: true,
      description:
        "Permitir reproducción directa si el dispositivo es compatible",
    },

    // Configuración de bibliotecas
    scan_interval: {
      value: 3600,
      description: "Intervalo entre escaneos automáticos en segundos",
    },
    thumbnail_generation: {
      value: true,
      description: "Generar miniaturas automáticamente",
    },
    metadata_language: {
      value: "es",
      description: "Idioma preferido para metadatos",
    },
    auto_fetch_metadata: {
      value: true,
      description: "Obtener metadatos automáticamente al añadir medios",
    },
  };

  // Configuración de interfaz de usuario
  const uiSettings = {
    theme: {
      value: "dark",
      description: "Tema visual por defecto (dark, light)",
    },
    items_per_page: {
      value: 24,
      description: "Número de elementos por página en listas",
    },
    default_view: {
      value: "grid",
      description: "Vista por defecto para las listas (grid, list)",
    },
    show_watched_progress: {
      value: true,
      description: "Mostrar indicador de progreso en elementos ya vistos",
    },
    default_player_volume: {
      value: 80,
      description: "Volumen predeterminado del reproductor (0-100)",
    },
    show_recommendations: {
      value: true,
      description: "Mostrar recomendaciones personalizadas",
    },
    allow_registration: {
      value: false,
      description: "Permitir registro público (sin invitación)",
    },
    session_expiry: {
      value: "7d",
      description: "Tiempo de expiración de sesiones",
    },
  };

  // Combinar todas las configuraciones
  const allSettings = {
    ...systemSettings,
    ...uiSettings,
  };

  // Guardar en la base de datos
  try {
    await settingRepository.setBulk(allSettings);
    console.log("Configuraciones por defecto cargadas correctamente.");
    return true;
  } catch (error) {
    console.error("Error al cargar configuraciones por defecto:", error);
    throw error;
  }
}

module.exports = { loadDefaultSettings };
