// clients/web/src/components/MediaViewer.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import ImprovedVideoPlayer from "./ImprovedVideoPlayer";

const API_URL = apiConfig.API_URL;

/**
 * Componente para visualizar diferentes tipos de medios (video, imágenes, etc.)
 */
function MediaViewer({ mediaId }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar información del medio
  useEffect(() => {
    const fetchMedia = async () => {
      if (!mediaId) return;

      try {
        setLoading(true);
        setError(null);

        // Obtener token de autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          throw new Error("No hay sesión activa");
        }

        // Obtener información del medio
        const response = await axios.get(`${API_URL}/api/media/${mediaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setMedia(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error al cargar medio:", err);
        setError(err.response?.data?.message || "Error al cargar el medio");
        setLoading(false);
      }
    };

    fetchMedia();
  }, [mediaId]);

  // Renderizado condicional para estado de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96 bg-gray-800 rounded-lg">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Renderizado condicional para estado de error
  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 rounded-lg p-8 text-center">
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Recargar
        </button>
      </div>
    );
  }

  // Renderizado condicional si no hay medio
  if (!media) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No se ha podido cargar el contenido</p>
      </div>
    );
  }

  // Renderizado según el tipo de medio
  const renderContent = () => {
    switch (media.type) {
      case "movie":
      case "episode":
        return <ImprovedVideoPlayer videoId={mediaId} />;

      case "photo":
        // Renderizar imagen
        return (
          <div className="bg-black rounded-lg flex items-center justify-center">
            <img
              src={`${API_URL}/api/media/${mediaId}/stream?auth=${localStorage.getItem(
                "streamvio_token"
              )}`}
              alt={media.title || "Imagen"}
              className="max-w-full max-h-[80vh] object-contain"
              onError={(e) => {
                e.target.src = "/assets/default-photo.jpg";
              }}
            />
          </div>
        );

      case "music":
        // Renderizar reproductor de audio
        return (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                <img
                  src={`${API_URL}/api/media/${mediaId}/thumbnail?auth=${localStorage.getItem(
                    "streamvio_token"
                  )}`}
                  alt={media.title || "Portada"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = "/assets/default-music.jpg";
                  }}
                />
              </div>

              <h3 className="text-xl font-semibold mb-2">{media.title}</h3>
              {media.artist && (
                <p className="text-gray-400 mb-4">{media.artist}</p>
              )}

              <audio
                controls
                className="w-full mt-4"
                src={`${API_URL}/api/media/${mediaId}/stream?auth=${localStorage.getItem(
                  "streamvio_token"
                )}`}
              >
                Tu navegador no soporta el elemento de audio.
              </audio>
            </div>
          </div>
        );

      default:
        // Tipo de medio no compatible o desconocido
        return (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">
              Este tipo de contenido ({media.type}) no puede ser visualizado
              directamente.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {renderContent()}
    </div>
  );
}

export default MediaViewer;
