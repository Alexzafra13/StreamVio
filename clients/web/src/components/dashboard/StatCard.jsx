import React from "react";
import { Link } from "react-router-dom";

/**
 * Componente para mostrar una tarjeta de estadísticas en el dashboard
 *
 * @param {Object} props
 * @param {string} props.title - Título de la estadística
 * @param {number|string} props.count - Valor numérico de la estadística
 * @param {React.ReactNode} props.icon - Icono para la tarjeta
 * @param {string} props.linkText - Texto del enlace (opcional)
 * @param {string} props.linkTo - URL del enlace (opcional)
 * @param {string} props.bgColor - Color de fondo (opcional)
 * @param {string} props.textColor - Color del texto (opcional)
 */
const StatCard = ({
  title,
  count,
  icon,
  linkText,
  linkTo,
  bgColor = "bg-primary",
  textColor = "text-white",
  onClick,
}) => {
  // Si tenemos un enlace, usar Link, de lo contrario un div
  const CardContainer = linkTo ? Link : "div";
  const containerProps = linkTo ? { to: linkTo } : { onClick };

  // Clases para el contenedor
  const baseClasses = "stat-card";

  // Clase combinada para el fondo
  const cardClass = `${baseClasses} ${bgColor}`;

  return (
    <CardContainer className={cardClass} {...containerProps}>
      {/* Icono */}
      <div className={`text-3xl mb-4 ${textColor}`}>{icon}</div>

      {/* Contenido */}
      <div className="flex flex-col">
        <h3 className={`text-lg font-bold mb-1 ${textColor}`}>{title}</h3>
        <p className={`text-4xl font-bold mb-2 ${textColor}`}>{count}</p>

        {/* Enlace inferior */}
        {linkText && (
          <div className="mt-auto pt-2">
            <span
              className={`text-sm font-medium flex items-center ${textColor} hover:underline`}
            >
              {linkText}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 ml-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </div>
        )}
      </div>
    </CardContainer>
  );
};

export default StatCard;
