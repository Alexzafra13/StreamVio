// shared/constants/mediaTypes.js

/**
 * Tipos de elementos multimedia
 */
const MEDIA_TYPES = {
  MOVIE: "movie",
  SERIES: "series",
  SEASON: "season",
  EPISODE: "episode",
  MUSIC: "music",
  PHOTO: "photo",
};

/**
 * Tipos de bibliotecas
 */
const LIBRARY_TYPES = {
  MOVIES: "movies",
  SERIES: "series",
  MUSIC: "music",
  PHOTOS: "photos",
};

/**
 * Formatos de vídeo soportados
 */
const VIDEO_FORMATS = {
  MP4: "mp4",
  MKV: "mkv",
  AVI: "avi",
  MOV: "mov",
  WMV: "wmv",
  FLV: "flv",
  WEBM: "webm",
  TS: "ts",
  M4V: "m4v",
};

/**
 * Formatos de audio soportados
 */
const AUDIO_FORMATS = {
  MP3: "mp3",
  WAV: "wav",
  FLAC: "flac",
  AAC: "aac",
  OGG: "ogg",
  M4A: "m4a",
};

/**
 * Formatos de imagen soportados
 */
const IMAGE_FORMATS = {
  JPG: "jpg",
  JPEG: "jpeg",
  PNG: "png",
  GIF: "gif",
  BMP: "bmp",
  WEBP: "webp",
  SVG: "svg",
};

/**
 * Extensiones de archivo por tipo de contenido
 */
const FILE_EXTENSIONS = {
  VIDEO: Object.values(VIDEO_FORMATS),
  AUDIO: Object.values(AUDIO_FORMATS),
  IMAGE: Object.values(IMAGE_FORMATS),
};

/**
 * Opciones de calidad de streaming
 */
const STREAMING_QUALITIES = {
  AUTO: "auto",
  LOW: "low", // 480p
  MEDIUM: "medium", // 720p
  HIGH: "high", // 1080p
  ULTRA: "ultra", // 4K
};

/**
 * Protocolos de streaming soportados
 */
const STREAMING_PROTOCOLS = {
  DIRECT: "direct", // Descarga directa
  HLS: "hls", // HTTP Live Streaming
  DASH: "dash", // MPEG-DASH
};

module.exports = {
  MEDIA_TYPES,
  LIBRARY_TYPES,
  VIDEO_FORMATS,
  AUDIO_FORMATS,
  IMAGE_FORMATS,
  FILE_EXTENSIONS,
  STREAMING_QUALITIES,
  STREAMING_PROTOCOLS,
};
