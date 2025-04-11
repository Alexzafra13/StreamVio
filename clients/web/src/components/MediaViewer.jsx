// clients/web/src/components/MediaViewer.jsx - Versión optimizada
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import ImprovedVideoPlayer from "./ImprovedVideoPlayer";
import authUrlHelper from "../utils/authUrlHelper";

const API_URL = apiConfig.API_URL;

/**
 * Componente para visualizar diferentes tipos de medios (video, imágenes, etc.)
 */
function MediaViewer({ mediaId }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamingOptions, setStreamingOptions] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Cargar información del medio y opciones de streaming
  useEffect(() => {
    const fetchMedia = async () => {
      if (!mediaId) {
        console.error("MediaViewer: No se proporcionó mediaId");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        // Obtener token de autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          console.error("MediaViewer: No hay token de autenticación");
          throw new Error("No hay sesión activa");
        }
        console.log(`MediaViewer: Obteniendo información del medio ${mediaId}`);

        // Obtener información del medio
        console.log(
          `MediaViewer: URL de la API: ${API_URL}/api/media/${mediaId}`
        );
        const response = await axios.get(`${API_URL}/api/media/${mediaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("MediaViewer: Información obtenida:", response.data);
        setMedia(response.data);

        // Generar URL para streaming usando el helper
        const streamUrl = authUrlHelper.getStreamUrl(mediaId);
        console.log("URL de streaming completa:", streamUrl); // Log completo para depuración

        // Verificar disponibilidad de HLS
        let hlsAvailable = false;
        // Aquí podrías añadir lógica para verificar si hay HLS disponible
        setStreamingOptions({
          direct: {
            available: true,
            url: streamUrl,
            type: getMediaMimeType(response.data),
          },
          hls: {
            available: hlsAvailable,
            url: null,
            type: "application/vnd.apple.mpegurl",
          },
        });
        setLoading(false);
      } catch (err) {
        console.error("Error al cargar medio:", err);
        console.error("Detalles del error:", err.response?.data || err.message);
        // Manejar diferentes tipos de errores
        if (err.response && err.response.status === 401) {
          setError(
            "Error de autenticación. Por favor, inicia sesión nuevamente."
          );
        } else if (err.response && err.response.status === 404) {
          setError("No se encontró el contenido solicitado.");
        } else if (!navigator.onLine) {
          setError("No hay conexión a internet. Verifica tu red.");
        } else {
          setError(err.response?.data?.message || "Error al cargar el medio");
        }

        setLoading(false);
      }
    };

    fetchMedia();
  }, [mediaId, retryCount]);

  // Obtener tipo MIME basado en tipo de medio
  const getMediaMimeType = (mediaData) => {
    if (!mediaData) return "video/mp4";

    const fileExt = mediaData.file_path?.split(".").pop()?.toLowerCase();

    switch (fileExt) {
      case "mp4":
        return "video/mp4";
      case "webm":
        return "video/webm";
      case "ogg":
        return "video/ogg";
      case "mkv":
        return "video/x-matroska";
      case "mov":
        return "video/quicktime";
      case "avi":
        return "video/x-msvideo";
      default:
        return "video/mp4";
    }
  };

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
          onClick={() => setRetryCount((current) => current + 1)}
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
        // Usar la URL de streaming de las opciones
        const streamUrl = streamingOptions?.direct?.url;

        if (!streamUrl) {
          return (
            <div className="bg-red-900 bg-opacity-50 rounded-lg p-8 text-center">
              <p className="text-red-300 mb-4">
                No se pudo obtener la URL de streaming
              </p>
              <button
                onClick={() => setRetryCount((current) => current + 1)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Reintentar
              </button>
            </div>
          );
        }

        return (
          <ImprovedVideoPlayer
            videoId={mediaId}
            streamUrl={streamUrl}
            mediaInfo={media}
          />
        );

      case "photo":
        // Renderizar imagen con token
        const thumbnailUrl = authUrlHelper.getThumbnailUrl(mediaId);
        return (
          <div className="bg-black rounded-lg flex items-center justify-center">
            <img
              src={thumbnailUrl}
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
        const audioUrl = authUrlHelper.getStreamUrl(mediaId);
        const audioThumbnailUrl = authUrlHelper.getThumbnailUrl(mediaId);

        return (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                <img
                  src={audioThumbnailUrl}
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

              <audio controls className="w-full mt-4" src={audioUrl}>
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

      {/* Información de debugging */}
      <div className="p-2 bg-gray-800 text-xs text-gray-400">
        Estado:{" "}
        {streamingOptions?.direct?.available
          ? "Stream disponible"
          : "Error en stream"}
        {/* Agregar un botón para reintentar */}
        <button
          onClick={() => setRetryCount((current) => current + 1)}
          className="ml-2 text-blue-400 hover:text-blue-300"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export default MediaViewer;
