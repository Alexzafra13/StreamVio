// src/components/ui/NotificationContainer.jsx
import React, { useContext, useEffect, useState } from "react";
import { UIContext } from "../../context/UIContext";

/**
 * Componente para mostrar una notificación individual
 */
const Notification = ({ notification, onClose }) => {
  const { id, type, message, duration } = notification;

  // Determinar clases de estilo según el tipo de notificación
  const getTypeClasses = () => {
    switch (type) {
      case "success":
        return "bg-success/10 border-success text-success";
      case "error":
        return "bg-red-900/10 border-red-600 text-red-500";
      case "warning":
        return "bg-yellow-900/10 border-yellow-600 text-yellow-500";
      case "info":
      default:
        return "bg-blue-900/10 border-blue-600 text-blue-500";
    }
  };

  // Determinar icono según el tipo de notificación
  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "warning":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "info":
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  // Eliminar notificación al hacer clic en cerrar
  const handleClose = () => {
    onClose(id);
  };

  // Auto-eliminar después del tiempo especificado
  useEffect(() => {
    if (duration !== Infinity) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, id, onClose]);

  return (
    <div
      className={`flex items-start p-3 rounded-md border shadow-md ${getTypeClasses()} mb-2 transition-all duration-300 transform translate-y-0 opacity-100`}
      role="alert"
    >
      <div className="flex-shrink-0 mr-2">{getIcon()}</div>
      <div className="flex-1 mr-2">
        <p className="text-sm">{message}</p>
      </div>
      <button
        onClick={handleClose}
        className="flex-shrink-0 ml-auto focus:outline-none"
        aria-label="Cerrar notificación"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-current opacity-70 hover:opacity-100"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};

/**
 * Contenedor para mostrar notificaciones del sistema
 */
const NotificationContainer = () => {
  const { notifications, removeNotification } = useContext(UIContext);

  // Estado para manejar animaciones
  const [items, setItems] = useState([]);

  // Actualizar el estado de los items cuando cambian las notificaciones
  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full space-y-2 pointer-events-none">
      <div className="flex flex-col items-end space-y-2 pointer-events-auto">
        {items.map((notification) => (
          <Notification
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationContainer;
