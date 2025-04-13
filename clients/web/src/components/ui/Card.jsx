import React from "react";

/**
 * Componente Card reutilizable
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Contenido de la tarjeta
 * @param {string} [props.className] - Clases adicionales
 * @param {boolean} [props.hasShadow=true] - Si la tarjeta tiene sombra
 * @param {boolean} [props.hasPadding=true] - Si la tarjeta tiene padding
 * @param {boolean} [props.isHoverable=false] - Si la tarjeta tiene efectos al pasar el mouse
 * @param {function} [props.onClick] - Función a ejecutar al hacer clic
 */
const Card = ({
  children,
  className = "",
  hasShadow = true,
  hasPadding = true,
  isHoverable = false,
  onClick,
  ...rest
}) => {
  // Base classes
  const baseClasses = "bg-background-card rounded-lg";

  // Shadow class
  const shadowClass = hasShadow ? "shadow-card" : "";

  // Padding class
  const paddingClass = hasPadding ? "p-6" : "";

  // Hoverable class
  const hoverableClass = isHoverable
    ? "transition-transform duration-200 hover:scale-[1.02]"
    : "";

  // Clickable class
  const clickableClass = onClick ? "cursor-pointer" : "";

  // Combine all classes
  const classes = [
    baseClasses,
    shadowClass,
    paddingClass,
    hoverableClass,
    clickableClass,
    className,
  ].join(" ");

  return (
    <div className={classes} onClick={onClick} {...rest}>
      {children}
    </div>
  );
};

// Subcomponentes para organización del contenido
Card.Header = ({ children, className = "", ...rest }) => (
  <div className={`mb-4 ${className}`} {...rest}>
    {children}
  </div>
);

Card.Title = ({ children, className = "", ...rest }) => (
  <h3 className={`text-lg font-bold text-text-primary ${className}`} {...rest}>
    {children}
  </h3>
);

Card.Subtitle = ({ children, className = "", ...rest }) => (
  <p className={`text-sm text-text-secondary ${className}`} {...rest}>
    {children}
  </p>
);

Card.Body = ({ children, className = "", ...rest }) => (
  <div className={`${className}`} {...rest}>
    {children}
  </div>
);

Card.Footer = ({ children, className = "", ...rest }) => (
  <div className={`mt-4 pt-4 border-t border-gray-700 ${className}`} {...rest}>
    {children}
  </div>
);

export default Card;
