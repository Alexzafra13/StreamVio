// shared/types/Settings.ts

/**
 * Representación de una configuración en el sistema
 */
export interface Setting {
  key: string;
  value: any;
  defaultValue?: any;
  description?: string;
  category: SettingCategory;
  type?: string;
}

/**
 * Categorías de configuración
 */
export type SettingCategory =
  | "general"
  | "system"
  | "streaming"
  | "transcoding"
  | "security"
  | "ui"
  | "libraries"
  | "metadata";

/**
 * Agrupación de configuraciones por categoría
 */
export interface GroupedSettings {
  [category: string]: Setting[];
}

/**
 * Datos para actualizar múltiples configuraciones
 */
export interface BulkSettingsUpdate {
  settings: {
    [key: string]: any;
  };
}

/**
 * Respuesta de actualización de configuración
 */
export interface SettingUpdateResponse {
  key: string;
  value: any;
  previousValue?: any;
  updated: boolean;
}
