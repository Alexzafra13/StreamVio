// shared/types/index.ts

// Re-exportar todos los tipos para facilitar su importación
export * from "./User";
export * from "./Media";
export * from "./Library";
export * from "./Settings";

// Definición de respuesta API genérica
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    details?: any;
  };
}

// Definición de error de API
export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: any;
}

// Definición para paginación
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Definición para respuesta paginada
export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}
