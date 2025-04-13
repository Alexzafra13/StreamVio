// src/hooks/useAuth.js
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * Hook personalizado para acceder al contexto de autenticación
 * Proporciona una forma sencilla de utilizar todas las funcionalidades
 * relacionadas con la autenticación y gestión de usuarios
 *
 * @returns {Object} Funciones y estado de autenticación
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }

  return {
    // Estado de autenticación
    user: context.user,
    loading: context.loading,
    isFirstTime: context.isFirstTime,
    requirePasswordChange: context.requirePasswordChange,

    // Métodos principales
    login: context.login,
    logout: context.logout,
    register: context.register,

    // Utilitarios
    isAuthenticated: context.isAuthenticated,
    isAdmin: context.isAdmin,

    // Funciones adicionales
    setupFirstUser: context.setupFirstUser,
    changePassword: context.changePassword,
    createInvitation: context.createInvitation,
    refreshUserProfile: context.refreshUserProfile,
  };
};

export default useAuth;
