// shared/types/Library.ts

/**
 * Tipos de bibliotecas soportadas
 */
export type LibraryType = "movies" | "series" | "music" | "photos";

/**
 * Representación de una biblioteca en el sistema
 */
export interface Library {
  id: number;
  name: string;
  path: string;
  type: LibraryType;
  scan_automatically: boolean;
  created_at?: string;
  updated_at?: string;
  itemCount?: number;
}

/**
 * Datos para crear una nueva biblioteca
 */
export interface CreateLibraryDto {
  name: string;
  path: string;
  type: LibraryType;
  scan_automatically?: boolean;
}

/**
 * Datos para actualizar una biblioteca existente
 */
export interface UpdateLibraryDto {
  name?: string;
  path?: string;
  type?: LibraryType;
  scan_automatically?: boolean;
}

/**
 * Información sobre el acceso de un usuario a una biblioteca
 */
export interface LibraryAccess {
  userId: number;
  hasAccess: boolean;
}

/**
 * Información sobre un directorio potencial para biblioteca
 */
export interface PotentialDirectory {
  path: string;
  name?: string;
  type?: string;
  size?: number;
  files?: number;
  isAccessible: boolean;
}

/**
 * Estadísticas de una biblioteca
 */
export interface LibraryStats {
  totalItems: number;
  recentlyAdded: number;
  totalSize: number;
  categories: {
    name: string;
    count: number;
  }[];
}

/**
 * Estado de un escaneo de biblioteca
 */
export interface ScanStatus {
  libraryId: number;
  status: "scanning" | "completed" | "failed" | "idle";
  progress?: number;
  itemsFound?: number;
  itemsProcessed?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
