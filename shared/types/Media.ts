// shared/types/Media.ts

/**
 * Tipos de elementos multimedia soportados
 */
export type MediaType =
  | "movie"
  | "series"
  | "season"
  | "episode"
  | "music"
  | "photo";

/**
 * Representación de un elemento multimedia en el sistema
 */
export interface MediaItem {
  id: number;
  library_id: number;
  title: string;
  original_title?: string;
  description?: string;
  type: MediaType;
  file_path: string;
  duration?: number;
  size?: number;
  thumbnail_path?: string;
  year?: number;
  genre?: string;
  director?: string;
  actors?: string;
  rating?: number;
  parent_id?: number;
  season_number?: number;
  episode_number?: number;
  created_at?: string;
  updated_at?: string;
  watchProgress?: WatchProgress;
}

/**
 * Información sobre el progreso de visualización
 */
export interface WatchProgress {
  id?: number;
  mediaId: number;
  position: number;
  completed: boolean;
  duration?: number;
  watched: boolean;
  lastWatched?: string;
}

/**
 * Datos para crear un nuevo elemento multimedia
 */
export interface CreateMediaDto {
  library_id: number;
  title: string;
  original_title?: string;
  description?: string;
  type: MediaType;
  file_path: string;
  duration?: number;
  size?: number;
  thumbnail_path?: string;
  year?: number;
  genre?: string;
  director?: string;
  actors?: string;
  rating?: number;
  parent_id?: number;
  season_number?: number;
  episode_number?: number;
}

/**
 * Datos para actualizar un elemento multimedia
 */
export interface UpdateMediaDto {
  title?: string;
  original_title?: string;
  description?: string;
  type?: MediaType;
  file_path?: string;
  duration?: number;
  size?: number;
  thumbnail_path?: string;
  year?: number;
  genre?: string;
  director?: string;
  actors?: string;
  rating?: number;
  parent_id?: number;
  season_number?: number;
  episode_number?: number;
}

/**
 * Datos para actualizar el progreso de visualización
 */
export interface UpdateProgressDto {
  position: number;
  completed?: boolean;
  duration?: number;
}

/**
 * Parámetros para búsqueda de elementos multimedia
 */
export interface SearchMediaParams {
  query?: string;
  library_id?: number;
  type?: MediaType;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

/**
 * Respuesta paginada para búsqueda de elementos multimedia
 */
export interface PaginatedMediaResponse {
  items: MediaItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Opciones de streaming disponibles para un elemento
 */
export interface StreamingOption {
  type: string; // 'direct', 'hls', etc.
  url: string;
  format?: string;
  quality?: string;
  bitrate?: number;
}
