// src/context/UIContext.jsx
import React, {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

// Crear el contexto con un valor inicial vacío
export const UIContext = createContext();

/**
 * Proveedor de contexto para UI
 * Gestiona notificaciones, modales y estados de interfaz global
 */
export const UIProvider = ({ children }) => {
  // Estado para notificaciones
  const [notifications, setNotifications] = useState([]);

  // Estado para loader global
  const [isLoading, setIsLoading] = useState(false);

  // Estado para información del modal
  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    content: null,
    size: "md",
    onConfirm: null,
    onCancel: null,
    confirmText: "Aceptar",
    cancelText: "Cancelar",
    showCloseButton: true,
    closeOnClickOutside: true,
  });

  // Estado para tema de la aplicación
  const [theme, setTheme] = useState("dark");

  // Estado para navegación móvil
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Contador para IDs de notificaciones
  const notificationIdCounter = useRef(0);

  // Efecto para inicializar el tema desde localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.className = savedTheme;
    }
  }, []);

  /**
   * Crear una nueva notificación
   * @param {Object} notification - Datos de la notificación
   */
  const addNotification = useCallback((notification) => {
    const id = notificationIdCounter.current++;
    const newNotification = {
      id,
      duration: 5000, // 5 segundos por defecto
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-eliminar después del tiempo especificado
    if (newNotification.duration !== Infinity) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  /**
   * Eliminar una notificación
   * @param {number} id - ID de la notificación
   */
  const removeNotification = useCallback((id) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  }, []);

  /**
   * Mostrar notificación de éxito
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales
   */
  const showSuccess = useCallback(
    (message, options = {}) => {
      addNotification({
        type: "success",
        message,
        ...options,
      });
    },
    [addNotification]
  );

  /**
   * Mostrar notificación de error
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales
   */
  const showError = useCallback(
    (message, options = {}) => {
      addNotification({
        type: "error",
        message,
        ...options,
      });
    },
    [addNotification]
  );

  /**
   * Mostrar notificación de información
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales
   */
  const showInfo = useCallback(
    (message, options = {}) => {
      addNotification({
        type: "info",
        message,
        ...options,
      });
    },
    [addNotification]
  );

  /**
   * Mostrar notificación de advertencia
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales
   */
  const showWarning = useCallback(
    (message, options = {}) => {
      addNotification({
        type: "warning",
        message,
        ...options,
      });
    },
    [addNotification]
  );

  /**
   * Abrir un modal
   * @param {Object} modalConfig - Configuración del modal
   */
  const openModal = useCallback(
    (modalConfig) => {
      setModal({
        ...modal,
        isOpen: true,
        ...modalConfig,
      });
    },
    [modal]
  );

  /**
   * Cerrar el modal actual
   */
  const closeModal = useCallback(() => {
    setModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  /**
   * Mostrar un modal de confirmación
   * @param {string} title - Título del modal
   * @param {string|React.ReactNode} content - Contenido del modal
   * @param {Function} onConfirm - Función a ejecutar al confirmar
   * @param {Object} options - Opciones adicionales
   */
  const showConfirmation = useCallback(
    (title, content, onConfirm, options = {}) => {
      openModal({
        title,
        content,
        onConfirm,
        ...options,
      });
    },
    [openModal]
  );

  /**
   * Cambiar el tema de la aplicación
   * @param {string} newTheme - Nuevo tema ('light' o 'dark')
   */
  const changeTheme = useCallback((newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.className = newTheme;
  }, []);

  /**
   * Alternar entre temas claro y oscuro
   */
  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    changeTheme(newTheme);
  }, [theme, changeTheme]);

  /**
   * Abrir/cerrar la barra lateral en móvil
   */
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Valor que se proporcionará al contexto
  const value = {
    // Notificaciones
    notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showInfo,
    showWarning,

    // Modal
    modal,
    openModal,
    closeModal,
    showConfirmation,

    // Loading
    isLoading,
    setIsLoading,

    // Tema
    theme,
    changeTheme,
    toggleTheme,

    // Navegación móvil
    isSidebarOpen,
    toggleSidebar,
    setIsSidebarOpen,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export default UIProvider;
