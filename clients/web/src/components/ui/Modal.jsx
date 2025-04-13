import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "./Button.jsx";

/**
 * Componente Modal reutilizable
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {function} props.onClose - Función para cerrar el modal
 * @param {string} [props.title] - Título del modal
 * @param {React.ReactNode} props.children - Contenido del modal
 * @param {string} [props.size='md'] - Tamaño del modal (sm, md, lg, xl)
 * @param {boolean} [props.closeOnClickOutside=true] - Si el modal se cierra al hacer clic fuera
 * @param {boolean} [props.showCloseButton=true] - Si muestra el botón de cerrar
 * @param {React.ReactNode} [props.footer] - Contenido del footer
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnClickOutside = true,
  showCloseButton = true,
  footer,
  ...rest
}) => {
  const modalRef = useRef(null);

  // Manejar escape key para cerrar el modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (isOpen && event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);

    // Prevenir el scroll del body cuando el modal está abierto
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  // Manejar clic fuera del modal para cerrarlo
  const handleBackdropClick = (event) => {
    if (
      closeOnClickOutside &&
      modalRef.current &&
      !modalRef.current.contains(event.target)
    ) {
      onClose();
    }
  };

  // Determinar el ancho del modal según el tamaño
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
    full: "max-w-full mx-4",
  };

  // No renderizar nada si el modal no está abierto
  if (!isOpen) return null;

  // Renderizar el modal en el portal
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75 transition-opacity"
      onClick={handleBackdropClick}
      {...rest}
    >
      <div
        ref={modalRef}
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
                onClick={onClose}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close modal"
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
        <div className="px-6 py-4 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-700">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
};

// Subcomponente para el footer con botones de confirmación/cancelación
Modal.Footer = ({
  onCancel,
  onConfirm,
  cancelText = "Cancelar",
  confirmText = "Aceptar",
  isConfirmLoading = false,
  isConfirmDisabled = false,
}) => (
  <div className="flex justify-end space-x-3">
    <Button variant="ghost" onClick={onCancel}>
      {cancelText}
    </Button>
    <Button
      variant="primary"
      onClick={onConfirm}
      isLoading={isConfirmLoading}
      isDisabled={isConfirmDisabled}
    >
      {confirmText}
    </Button>
  </div>
);

export default Modal;
