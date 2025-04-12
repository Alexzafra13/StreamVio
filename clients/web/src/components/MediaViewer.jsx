// clients/web/src/components/MediaViewer.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import VideoPlayer from "./VideoPlayer";

const API_URL = apiConfig.API_URL;

/**
 * Componente para visualizar diferentes tipos de medios (video, audio, imágenes)
 * @param {Object} props - Propiedades del componente
 * @param {string|number} props.mediaId - ID del medio a visualizar
 */
function MediaViewer({ mediaId }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar información del medio al montar el componente
  useEffect(() => {
    if (!mediaId) {
      setError("No se ha especificado un ID de medio");
      setLoading(false);
      return;
    }

    const fetchMediaInfo = async () => {
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
      } catch (error) {
        console.error("Error al cargar información del medio:", error);

        // Manejar diferentes tipos de errores
        if (error.response?.status === 401) {
          setError(
            "Error de autenticación. Por favor, inicia sesión nuevamente."
          );
        } else if (error.response?.status === 404) {
          setError("No se encontró el contenido solicitado.");
        } else if (!navigator.onLine) {
          setError("No hay conexión a internet. Verifica tu red.");
        } else {
          setError(error.response?.data?.message || "Error al cargar el medio");
        }

        setLoading(false);
      }
    };

    fetchMediaInfo();
  }, [mediaId]);

  // Renderizado condicional para estado de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 bg-gray-800 rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Renderizado condicional para estado de error
  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 p-8 rounded-lg text-center">
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Renderizado condicional si no hay medio
  if (!media) {
    return (
      <div className="bg-gray-800 p-8 rounded-lg text-center">
        <p className="text-gray-400">No se ha podido cargar el contenido</p>
      </div>
    );
  }

  // Renderizado según el tipo de medio
  const renderContent = () => {
    const token = localStorage.getItem("streamvio_token");

    switch (media.type) {
      case "movie":
      case "episode":
        // Para videos, usar el componente VideoPlayer
        return <VideoPlayer mediaId={mediaId} mediaInfo={media} />;

      case "photo":
        // Para imágenes, mostrar con el token de autenticación
        return (
          <div className="bg-black rounded-lg flex items-center justify-center">
            <img
              src={`${API_URL}/api/media/${mediaId}/thumbnail?auth=${encodeURIComponent(
                token
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
        // Para audio, usar un reproductor de audio nativo con el token
        return (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                <img
                  src={`${API_URL}/api/media/${mediaId}/thumbnail?auth=${encodeURIComponent(
                    token
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
                src={`${API_URL}/api/media/${mediaId}/stream?auth=${encodeURIComponent(
                  token
                )}`}
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

      {/* Información de depuración (opcional - puede ser removido en producción) */}
      <div className="p-2 bg-gray-800 text-xs text-gray-400">
        ID: {mediaId} | Tipo: {media.type || "Desconocido"} | Formato:{" "}
        {media.format || "N/A"}
      </div>
    </div>
  );
}

export default MediaViewer;
