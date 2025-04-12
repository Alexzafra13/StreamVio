// clients/web/src/components/MediaViewer.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import VideoPlayer from "./VideoPlayer";
import auth from "../utils/auth";

/**
 * Componente para visualizar diferentes tipos de medios (video, audio, imágenes)
 * @param {Object} props - Propiedades del componente
 * @param {string|number} props.mediaId - ID del medio a visualizar
 */
function MediaViewer({ mediaId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaInfo, setMediaInfo] = useState(null);

  // Cargar información del medio
  useEffect(() => {
    if (!mediaId) {
      setError("No se ha proporcionado un ID de medio");
      setLoading(false);
      return;
    }

    const loadMediaInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // Verificar autenticación
        if (!auth.isLoggedIn()) {
          throw new Error("No hay sesión activa");
        }

        // Cargar información del medio
        const response = await axios.get(`/api/media/${mediaId}`, {
          headers: auth.getAuthHeaders(),
        });

        setMediaInfo(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error al cargar información del medio:", error);

        if (error.response?.status === 401) {
          setError("Sesión expirada. Por favor, inicia sesión nuevamente.");
        } else if (error.response?.status === 404) {
          setError("El contenido solicitado no existe o ha sido eliminado.");
        } else if (!navigator.onLine) {
          setError("No hay conexión a internet. Verifica tu red.");
        } else {
          setError(error.response?.data?.message || "Error al cargar el medio");
        }

        setLoading(false);
      }
    };

    loadMediaInfo();
  }, [mediaId]);

  // Estado de carga
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-300">Cargando contenido...</p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-20 rounded-lg p-8 text-center">
        <svg
          className="w-16 h-16 text-red-500 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-xl font-bold text-red-400 mb-2">
          Error al cargar el contenido
        </h3>
        <p className="text-gray-300 mb-4">{error}</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            Reintentar
          </button>
          <a
            href="/media"
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition"
          >
            Volver a la biblioteca
          </a>
        </div>
      </div>
    );
  }

  // Si no hay información del medio
  if (!mediaInfo) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">
          No se ha podido cargar la información del contenido
        </p>
      </div>
    );
  }

  // Renderizar según el tipo de medio
  const renderContent = () => {
    switch (mediaInfo.type) {
      case "movie":
      case "episode":
        // Para videos, usar el componente VideoPlayer
        return <VideoPlayer mediaId={mediaId} autoPlay={false} />;

      case "photo":
        // Para imágenes, mostrar con el token de autenticación
        return (
          <div className="bg-black rounded-lg flex items-center justify-center">
            <img
              src={auth.getThumbnailUrl(mediaId)}
              alt={mediaInfo.title || "Imagen"}
              className="max-w-full max-h-[80vh] object-contain"
              onError={(e) => {
                e.target.src = "/assets/default-photo.jpg";
                e.target.classList.add("opacity-50");
              }}
            />
          </div>
        );

      case "music":
        // Para audio, usar un reproductor de audio nativo
        return (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                <img
                  src={auth.getThumbnailUrl(mediaId)}
                  alt={mediaInfo.title || "Portada"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = "/assets/default-music.jpg";
                  }}
                />
              </div>

              <h3 className="text-xl font-semibold mb-2">{mediaInfo.title}</h3>
              {mediaInfo.artist && (
                <p className="text-gray-400 mb-4">{mediaInfo.artist}</p>
              )}

              <audio
                controls
                className="w-full mt-4"
                src={auth.getStreamUrl(mediaId)}
                autoPlay={false}
              >
                Tu navegador no soporta el elemento de audio.
              </audio>
            </div>
          </div>
        );

      default:
        // Tipo de medio desconocido o no soportado
        return (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">
              Este tipo de contenido ({mediaInfo.type}) no puede ser visualizado
              directamente.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {renderContent()}

      {/* Información básica del medio */}
      <div className="p-4 bg-gray-800">
        <h2 className="text-xl font-bold">{mediaInfo.title || "Sin título"}</h2>
        {mediaInfo.description && (
          <p className="text-gray-400 mt-2">{mediaInfo.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {mediaInfo.year && (
            <span className="bg-blue-900 bg-opacity-50 text-blue-200 text-xs px-2 py-1 rounded">
              {mediaInfo.year}
            </span>
          )}
          {mediaInfo.genre && (
            <span className="bg-purple-900 bg-opacity-50 text-purple-200 text-xs px-2 py-1 rounded">
              {mediaInfo.genre}
            </span>
          )}
          {mediaInfo.duration && (
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
              {formatDuration(mediaInfo.duration)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Función de utilidad para formatear duración
function formatDuration(seconds) {
  if (!seconds) return "Desconocida";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default MediaViewer;
