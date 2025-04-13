// shared/types/User.ts

/**
 * Representación de un usuario en el sistema
 */
export interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  forcePasswordChange?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Datos para crear un nuevo usuario
 */
export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  isAdmin?: boolean;
}

/**
 * Datos para actualizar un usuario existente
 */
export interface UpdateUserDto {
  username?: string;
  email?: string;
  isAdmin?: boolean;
}

/**
 * Datos para registro de usuario con invitación
 */
export interface RegisterUserDto {
  username: string;
  email: string;
  password: string;
  invitationCode: string;
}

/**
 * Datos para inicio de sesión
 */
export interface LoginDto {
  email: string;
  password: string;
}

/**
 * Respuesta de una operación de autenticación exitosa
 */
export interface AuthResponse {
  token: string;
  user: User;
  requirePasswordChange?: boolean;
}

/**
 * Datos para cambio de contraseña
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * Información sobre un código de invitación
 */
export interface InvitationCode {
  id: number;
  code: string;
  created_by: number;
  used: boolean;
  used_by?: number;
  expires_at: string;
  created_at: string;
}
