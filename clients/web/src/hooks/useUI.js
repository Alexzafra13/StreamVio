// src/hooks/useUI.js
import { useContext } from "react";
import { UIContext } from "../context/UIContext.jsx";

/**
 * Hook personalizado para acceder al contexto de interfaz de usuario
 * Proporciona una forma sencilla de gestionar notificaciones, modales
 * y otros elementos de UI compartidos
 *
 * @returns {Object} Funciones y estado para controlar elementos de UI
 */
export const useUI = () => {
  const context = useContext(UIContext);

  if (!context) {
    throw new Error("useUI debe ser usado dentro de un UIProvider");
  }

  return {
    // Notificaciones
    notifications: context.notifications,
    showSuccess: context.showSuccess,
    showError: context.showError,
    showInfo: context.showInfo,
    showWarning: context.showWarning,
    addNotification: context.addNotification,
    removeNotification: context.removeNotification,

    // Modales
    modal: context.modal,
    openModal: context.openModal,
    closeModal: context.closeModal,
    showConfirmation: context.showConfirmation,

    // Loading
    isLoading: context.isLoading,
    setIsLoading: context.setIsLoading,

    // Tema
    theme: context.theme,
    changeTheme: context.changeTheme,
    toggleTheme: context.toggleTheme,

    // Navegación móvil
    isSidebarOpen: context.isSidebarOpen,
    toggleSidebar: context.toggleSidebar,
    setIsSidebarOpen: context.setIsSidebarOpen,
  };
};

export default useUI;
