// clients/web/src/config/config.js
// Configuración global de la aplicación

/**
 * Rutas a imágenes predeterminadas para diferentes tipos de medios
 */
export const defaultImages = {
  // Ruta base para assets
  baseAssetPath: "/assets",

  // Imágenes por defecto para cada tipo de medio
  movie: "/assets/default-movie.jpg",
  series: "/assets/default-series.jpg",
  episode: "/assets/default-episode.jpg",
  music: "/assets/default-music.jpg",
  photo: "/assets/default-photo.jpg",

  // Imagen genérica para cualquier tipo de medio
  generic: "/assets/default-media.jpg",

  // Avatar de usuario por defecto
  userAvatar: "/assets/default-avatar.png",

  // Logo de la aplicación
  logo: "/assets/logo.svg",
};

/**
 * Configuración de la interfaz de usuario
 */
export const uiConfig = {
  // Formato de fechas predeterminado
  dateFormat: "dd/MM/yyyy",

  // Límite de elementos por página
  defaultPageSize: 20,

  // Opciones de tamaño de página
  pageSizeOptions: [12, 20, 36, 48],

  // Tiempo en ms para ocultar notificaciones
  notificationDuration: 5000,

  // Tema predeterminado
  defaultTheme: "dark",

  // Sidebar expandido por defecto en desktop
  sidebarExpandedByDefault: true,
};

/**
 * Configuración de las bibliotecas
 */
export const libraryConfig = {
  // Tipos de bibliotecas disponibles
  types: [
    { id: "movies", name: "Películas", icon: "🎬" },
    { id: "series", name: "Series", icon: "📺" },
    { id: "music", name: "Música", icon: "🎵" },
  ],

  // Extensiones de archivo soportadas por tipo
  supportedExtensions: {
    movies: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".m4v", ".webm"],
    series: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".m4v", ".webm"],
    music: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"],
  },
};

/**
 * Función para obtener una imagen por defecto según el tipo de medio
 * @param {string} mediaType - Tipo de medio (movie, series, music, etc.)
 * @returns {string} - Ruta a la imagen predeterminada
 */
export const getDefaultImage = (mediaType) => {
  if (!mediaType) return defaultImages.generic;

  // Normalizar el tipo (movie, movies -> movie)
  const normalizedType = mediaType === "movies" ? "movie" : mediaType;

  return defaultImages[normalizedType] || defaultImages.generic;
};

/**
 * Convierte bytes a un formato legible (KB, MB, GB, etc.)
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} - Tamaño formateado
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Formatea la duración de segundos a un formato más legible (hh:mm:ss)
 * @param {number} seconds - Duración en segundos
 * @returns {string} - Duración formateada
 */
export const formatDuration = (seconds) => {
  if (!seconds) return "Desconocida";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else {
    return `${minutes}m ${remainingSeconds}s`;
  }
};

// Exportar todo junto como una configuración global
export default {
  defaultImages,
  uiConfig,
  libraryConfig,
  getDefaultImage,
  formatFileSize,
  formatDuration,
};
