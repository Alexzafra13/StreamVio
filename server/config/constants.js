// server/config/constants.js

/**
 * Constantes para la aplicación StreamVio
 * Aquí se definen valores que no cambian entre entornos
 */

// Tipos de elementos multimedia
const MEDIA_TYPES = {
  MOVIE: "movie",
  SERIES: "series",
  EPISODE: "episode",
  MUSIC: "music",
  PHOTO: "photo",
};

// Tipos de bibliotecas
const LIBRARY_TYPES = {
  MOVIES: "movies",
  SERIES: "series",
  MUSIC: "music",
  PHOTOS: "photos",
};

// Estados de trabajos de transcodificación
const TRANSCODING_JOB_STATES = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

// Formatos de transcodificación
const TRANSCODE_FORMATS = {
  MP4: "mp4",
  WEBM: "webm",
  MKV: "mkv",
  HLS: "hls",
};

// Códecs de video soportados
const VIDEO_CODECS = {
  H264: "h264",
  H265: "h265",
  VP9: "vp9",
  AV1: "av1",
  MPEG2: "mpeg2video",
};

// Códecs de audio soportados
const AUDIO_CODECS = {
  AAC: "aac",
  MP3: "mp3",
  FLAC: "flac",
  OPUS: "opus",
  VORBIS: "vorbis",
};

// Extensiones de archivo soportadas por tipo de medio
const SUPPORTED_EXTENSIONS = {
  VIDEO: [
    ".mp4",
    ".mkv",
    ".avi",
    ".mov",
    ".wmv",
    ".m4v",
    ".webm",
    ".mpg",
    ".mpeg",
    ".3gp",
    ".flv",
  ],
  AUDIO: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"],
  IMAGE: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"],
};

// Mapeo de extensiones a tipos MIME
const MIME_TYPES = {
  // Video
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".ogv": "video/ogg",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".mkv": "video/x-matroska",
  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".wma": "audio/x-ms-wma",
  // Imágenes
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  // Subtítulos
  ".srt": "application/x-subrip",
  ".vtt": "text/vtt",
  ".ass": "text/x-ssa",
  ".sub": "text/plain",
};

// Perfiles de transcodificación predefinidos
const TRANSCODE_PROFILES = {
  // Perfil de baja calidad (móvil)
  MOBILE: {
    id: "mobile",
    name: "Móvil",
    description:
      "Calidad baja, optimizada para dispositivos móviles y conexiones lentas",
    videoCodec: "libx264",
    audioCodec: "aac",
    videoBitrate: "800k",
    audioBitrate: "96k",
    resolution: "640x360",
    preset: "fast",
  },
  // Perfil estándar (calidad media)
  STANDARD: {
    id: "standard",
    name: "Estándar",
    description: "Calidad media, equilibrada para la mayoría de dispositivos",
    videoCodec: "libx264",
    audioCodec: "aac",
    videoBitrate: "2000k",
    audioBitrate: "192k",
    resolution: "1280x720",
    preset: "medium",
  },
  // Perfil de alta calidad
  HIGH: {
    id: "high",
    name: "Alta",
    description: "Calidad alta para pantallas grandes y conexiones rápidas",
    videoCodec: "libx264",
    audioCodec: "aac",
    videoBitrate: "4000k",
    audioBitrate: "320k",
    resolution: "1920x1080",
    preset: "slow",
  },
  // Audio de alta calidad
  AUDIO_HIGH: {
    id: "audio_high",
    name: "Audio Alta Calidad",
    description: "Audio de alta fidelidad",
    audioCodec: "libvorbis",
    audioBitrate: "320k",
    audioSampleRate: "48000",
  },
};

// Proveedor de metadatos
const METADATA_PROVIDERS = {
  TMDB: "tmdb",
  LOCAL: "local",
};

// Resoluciones estándar para transcodificación
const RESOLUTIONS = {
  R_360P: { width: 640, height: 360, name: "360p" },
  R_480P: { width: 854, height: 480, name: "480p" },
  R_720P: { width: 1280, height: 720, name: "720p" },
  R_1080P: { width: 1920, height: 1080, name: "1080p" },
  R_1440P: { width: 2560, height: 1440, name: "1440p" },
  R_4K: { width: 3840, height: 2160, name: "4K" },
};

// Calidades para streaming adaptativo
const STREAMING_QUALITIES = {
  LOW: { name: "Baja", bitrate: 800, resolution: "360p" },
  MEDIUM: { name: "Media", bitrate: 2000, resolution: "720p" },
  HIGH: { name: "Alta", bitrate: 4000, resolution: "1080p" },
  ULTRA: { name: "Ultra", bitrate: 8000, resolution: "1080p" },
};

// Categorías para configuraciones
const SETTING_CATEGORIES = {
  SYSTEM: "system",
  TRANSCODING: "transcoding",
  STREAMING: "streaming",
  LIBRARIES: "libraries",
  UI: "ui",
  SECURITY: "security",
};

// Mensajes de error comunes
const ERROR_MESSAGES = {
  NOT_FOUND: "El recurso solicitado no existe",
  UNAUTHORIZED: "No tienes permisos para realizar esta acción",
  INVALID_CREDENTIALS: "Credenciales no válidas",
  LIBRARY_ACCESS_DENIED: "No tienes acceso a esta biblioteca",
  DATABASE_ERROR: "Error al acceder a la base de datos",
  TRANSCODING_ERROR: "Error en el proceso de transcodificación",
  INVALID_INPUT: "Los datos proporcionados no son válidos",
};

// Roles de usuario
const USER_ROLES = {
  ADMIN: "admin",
  USER: "user",
};

// Tipos de eventos para el sistema de eventos
const EVENT_TYPES = {
  // Eventos de usuario
  USER_CREATED: "user:created",
  USER_UPDATED: "user:updated",
  USER_DELETED: "user:deleted",
  USER_LOGIN: "user:login",

  // Eventos de biblioteca
  LIBRARY_CREATED: "library:created",
  LIBRARY_UPDATED: "library:updated",
  LIBRARY_DELETED: "library:deleted",
  LIBRARY_SCANNED: "library:scanned",

  // Eventos de medios
  MEDIA_ADDED: "media:added",
  MEDIA_UPDATED: "media:updated",
  MEDIA_DELETED: "media:deleted",
  MEDIA_WATCHED: "media:watched",
  MEDIA_PROGRESS: "media:progress-updated",

  // Eventos de transcodificación
  TRANSCODE_STARTED: "transcoding:started",
  TRANSCODE_PROGRESS: "transcoding:progress",
  TRANSCODE_COMPLETED: "transcoding:completed",
  TRANSCODE_FAILED: "transcoding:failed",

  // Eventos de sistema
  SYSTEM_STARTUP: "system:startup",
  SYSTEM_SHUTDOWN: "system:shutdown",
  SYSTEM_ERROR: "system:error",
};

// Exportar todas las constantes
module.exports = {
  MEDIA_TYPES,
  LIBRARY_TYPES,
  TRANSCODING_JOB_STATES,
  TRANSCODE_FORMATS,
  VIDEO_CODECS,
  AUDIO_CODECS,
  SUPPORTED_EXTENSIONS,
  MIME_TYPES,
  TRANSCODE_PROFILES,
  METADATA_PROVIDERS,
  RESOLUTIONS,
  STREAMING_QUALITIES,
  SETTING_CATEGORIES,
  ERROR_MESSAGES,
  USER_ROLES,
  EVENT_TYPES,
};
