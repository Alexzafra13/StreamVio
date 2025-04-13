import React from "react";
import MediaCard from "../../ui/MediaCard.jsx";

/**
 * Componente para mostrar una cuadrícula de elementos multimedia
 *
 * @param {Object} props
 * @param {Array} props.items - Array de elementos multimedia a mostrar
 * @param {boolean} [props.loading=false] - Si está cargando
 * @param {boolean} [props.showEmpty=true] - Si muestra mensaje cuando no hay elementos
 * @param {string} [props.emptyMessage='No hay elementos para mostrar'] - Mensaje cuando no hay elementos
 * @param {string} [props.aspectRatio='2/3'] - Relación de aspecto de las tarjetas ('2/3' o '16/9')
 * @param {number} [props.columns=4] - Número de columnas en desktop (1-6)
 */
const MediaGrid = ({
  items = [],
  loading = false,
  showEmpty = true,
  emptyMessage = "No hay elementos para mostrar",
  aspectRatio = "2/3",
  columns = 4,
}) => {
  // Determinar clases según el número de columnas
  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    6: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
  };

  // Esqueletos para estado de carga
  const renderSkeletons = () => {
    return Array(8)
      .fill()
      .map((_, index) => (
        <div key={`skeleton-${index}`} className="animate-pulse">
          <div
            className="relative"
            style={{ paddingBottom: aspectRatio === "2/3" ? "150%" : "56.25%" }}
          >
            <div className="absolute inset-0 bg-background-card rounded-lg"></div>
          </div>
        </div>
      ));
  };

  // Mensaje cuando no hay elementos
  const renderEmpty = () => {
    if (!showEmpty) return null;

    return (
      <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 text-gray-600 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
        <p className="text-lg text-text-secondary">{emptyMessage}</p>
      </div>
    );
  };

  return (
    <div className={`grid ${columnClasses[columns] || columnClasses[4]} gap-6`}>
      {loading
        ? renderSkeletons()
        : items.length > 0
        ? items.map((item) => (
            <MediaCard key={item.id} media={item} aspectRatio={aspectRatio} />
          ))
        : renderEmpty()}
    </div>
  );
};

export default MediaGrid;
