// src/components/ui/ModalContainer.jsx
import React, { useContext, useEffect } from "react";
import { UIContext } from "../../context/UIContext";
import Button from "./Button";

/**
 * Contenedor para mostrar modales del sistema
 * Se controla a través del UIContext
 */
const ModalContainer = () => {
  const { modal, closeModal } = useContext(UIContext);

  const {
    isOpen,
    title,
    content,
    size = "md",
    onConfirm,
    onCancel,
    confirmText = "Aceptar",
    cancelText = "Cancelar",
    showCloseButton = true,
    closeOnClickOutside = true,
  } = modal;

  // Manejar la tecla Escape para cerrar el modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (isOpen && event.key === "Escape") {
        handleClose();
      }
    };

    // Prevenir el scroll del body cuando el modal está abierto
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.body.style.overflow = "auto";
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen]);

  // Determinar el ancho del modal según el tamaño
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
    full: "max-w-full mx-4",
  };

  // Manejar el cierre del modal
  const handleClose = () => {
    if (onCancel) {
      onCancel();
    }
    closeModal();
  };

  // Manejar la confirmación del modal
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    closeModal();
  };

  // Manejar el clic en el fondo para cerrar
  const handleBackdropClick = (e) => {
    if (closeOnClickOutside && e.target === e.currentTarget) {
      handleClose();
    }
  };

  // No renderizar nada si el modal no está abierto
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75 transition-opacity"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-background-card rounded-lg shadow-xl w-full ${
          sizeClasses[size] || sizeClasses.md
        } max-h-[90vh] flex flex-col transition-transform duration-300 scale-100`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            {title && (
              <h2 className="text-xl font-bold text-text-primary">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Cerrar modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {typeof content === "function" ? content() : content}
        </div>

        {/* Footer con botones de acción */}
        {(onConfirm || onCancel) && (
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-3">
            {onCancel && (
              <Button variant="ghost" onClick={handleClose}>
                {cancelText}
              </Button>
            )}
            {onConfirm && (
              <Button variant="primary" onClick={handleConfirm}>
                {confirmText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalContainer;
