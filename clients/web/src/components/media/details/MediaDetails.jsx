import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../ui/Button.jsx";
import Card from "../../ui/Card";
import { MediaContext } from "../../../context/MediaContext.jsx";
import { UIContext } from "../../../context/UIContext.jsx";

/**
 * Componente para mostrar los detalles de un elemento multimedia
 *
 * @param {Object} props
 * @param {Object} props.media - Datos del elemento multimedia
 * @param {Function} props.onPlay - Función para iniciar reproducción
 */
const MediaDetails = ({ media, onPlay }) => {
  const { updateProgress } = useContext(MediaContext);
  const { showError, showSuccess } = useContext(UIContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Si no hay datos del medio, mostrar estado de carga
  if (!media) {
    return (
      <div className="animate-pulse">
        <div className="h-96 bg-background-card rounded-lg mb-6"></div>
        <div className="h-8 bg-background-card rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-background-card rounded w-1/2 mb-8"></div>
        <div className="h-4 bg-background-card rounded w-full mb-2"></div>
        <div className="h-4 bg-background-card rounded w-full mb-2"></div>
        <div className="h-4 bg-background-card rounded w-3/4"></div>
      </div>
    );
  }

  const {
    id,
    title,
    original_title,
    description,
    year,
    genre,
    director,
    actors,
    duration,
    rating,
    type,
    thumbnail_path,
    watchProgress,
  } = media;

  // Determinar si hay progreso de visualización
  const hasProgress = watchProgress && watchProgress.position > 0;
  const progressPercent =
    hasProgress && duration
      ? Math.min(Math.round((watchProgress.position / duration) * 100), 100)
      : 0;

  // Formatear duración (segundos a formato hh:mm)
  const formatDuration = (seconds) => {
    if (!seconds) return "Desconocida";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutos`;
  };

  // Manejar inicio de reproducción
  const handlePlay = async () => {
    try {
      setLoading(true);

      // Si hay progreso, preguntar si continuar donde se quedó
      if (hasProgress && !watchProgress.completed) {
        // Aquí podrías mostrar un diálogo de confirmación
        // Por ahora simplemente continuamos donde se quedó
      }

      if (onPlay) {
        onPlay(hasProgress ? watchProgress.position : 0);
      }
    } catch (error) {
      console.error("Error al iniciar reproducción:", error);
      showError("No se pudo iniciar la reproducción. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Marcar como visto
  const handleMarkAsWatched = async () => {
    try {
      setLoading(true);
      await updateProgress(id, duration || 0, true);
      showSuccess("Marcado como visto");
    } catch (error) {
      console.error("Error al marcar como visto:", error);
      showError("No se pudo actualizar el estado de visualización");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Poster/Thumbnail */}
      <div className="w-full md:w-1/3 lg:w-1/4">
        <div className="relative">
          <img
            src={thumbnail_path || "/placeholder-poster.jpg"}
            alt={title}
            className="w-full rounded-lg shadow-lg"
          />

          {rating && (
            <div className="absolute top-3 right-3 bg-background-dark/80 text-primary font-bold rounded-full w-12 h-12 flex items-center justify-center">
              {rating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="mt-4 space-y-2">
          <Button
            variant="primary"
            isFullWidth
            isLoading={loading}
            onClick={handlePlay}
          >
            {hasProgress && !watchProgress.completed
              ? `Continuar (${progressPercent}%)`
              : "Reproducir"}
          </Button>

          {!watchProgress?.completed && (
            <Button
              variant="ghost"
              isFullWidth
              isLoading={loading}
              onClick={handleMarkAsWatched}
            >
              Marcar como visto
            </Button>
          )}
        </div>
      </div>

      {/* Información del medio */}
      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-1">{title}</h1>

        {/* Información básica */}
        <div className="flex flex-wrap gap-2 text-sm text-text-secondary mb-6">
          {year && <span>{year}</span>}
          {duration && (
            <>
              <span className="mx-1">•</span>
              <span>{formatDuration(duration)}</span>
            </>
          )}
          {genre && (
            <>
              <span className="mx-1">•</span>
              <span>{genre}</span>
            </>
          )}
          {rating && (
            <>
              <span className="mx-1">•</span>
              <span>
                <span className="text-yellow-400">★</span> {rating.toFixed(1)}
              </span>
            </>
          )}
        </div>

        {/* Barra de progreso si hay */}
        {hasProgress && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-text-secondary mb-1">
              <span>Progreso</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Descripción */}
        {description && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-2">Sinopsis</h2>
            <p className="text-text-secondary">{description}</p>
          </div>
        )}

        {/* Información adicional */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {original_title && (
            <div>
              <h3 className="text-sm font-bold">Título original</h3>
              <p className="text-text-secondary">{original_title}</p>
            </div>
          )}

          {director && (
            <div>
              <h3 className="text-sm font-bold">Director</h3>
              <p className="text-text-secondary">{director}</p>
            </div>
          )}

          {actors && (
            <div className="col-span-full">
              <h3 className="text-sm font-bold">Reparto</h3>
              <p className="text-text-secondary">{actors}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaDetails;
