import React from "react";

/**
 * Componente Button reutilizable
 *
 * @param {Object} props
 * @param {string} [props.variant='primary'] - Variante del botón (primary, secondary, success, danger, ghost)
 * @param {string} [props.size='md'] - Tamaño del botón (sm, md, lg)
 * @param {boolean} [props.isFullWidth=false] - Si el botón debe ocupar todo el ancho disponible
 * @param {boolean} [props.isLoading=false] - Si el botón está en estado de carga
 * @param {boolean} [props.isDisabled=false] - Si el botón está deshabilitado
 * @param {function} [props.onClick] - Función a ejecutar al hacer clic
 * @param {React.ReactNode} props.children - Contenido del botón
 * @param {string} [props.className] - Clases adicionales
 */
const Button = ({
  variant = "primary",
  size = "md",
  isFullWidth = false,
  isLoading = false,
  isDisabled = false,
  onClick,
  children,
  className = "",
  ...rest
}) => {
  // Base classes
  const baseClasses =
    "inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

  // Variant classes
  const variantClasses = {
    primary: "bg-primary text-white hover:bg-primary-hover focus:ring-primary",
    secondary:
      "bg-secondary text-white hover:bg-secondary-hover focus:ring-secondary",
    success: "bg-success text-white hover:bg-success-hover focus:ring-success",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost:
      "bg-transparent text-text-primary hover:bg-background-card focus:ring-primary",
  };

  // Size classes
  const sizeClasses = {
    sm: "text-xs px-2.5 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-6 py-3",
  };

  // Width class
  const widthClass = isFullWidth ? "w-full" : "";

  // Disabled and loading states
  const stateClasses =
    isDisabled || isLoading
      ? "opacity-70 cursor-not-allowed"
      : "cursor-pointer";

  // Combine all classes
  const classes = [
    baseClasses,
    variantClasses[variant] || variantClasses.primary,
    sizeClasses[size] || sizeClasses.md,
    widthClass,
    stateClasses,
    className,
  ].join(" ");

  return (
    <button
      className={classes}
      disabled={isDisabled || isLoading}
      onClick={onClick}
      {...rest}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
