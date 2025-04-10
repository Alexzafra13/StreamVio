// clients/web/src/components/MediaViewer.jsx (Versión actualizada)
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import ImprovedVideoPlayer from "./ImprovedVideoPlayer";

const API_URL = apiConfig.API_URL;

/**
 * Componente para visualizar diferentes tipos de medios (video, imágenes, etc.)
 * Versión mejorada con mejor manejo de streaming
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
      if (!mediaId) return;

      try {
        setLoading(true);
        setError(null);

        // Obtener token de autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          throw new Error("No hay sesión activa");
        }

        console.log(`MediaViewer: Obteniendo información del medio ${mediaId}`);

        // Obtener información del medio
        const response = await axios.get(`${API_URL}/api/media/${mediaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("MediaViewer: Información obtenida:", response.data);
        setMedia(response.data);

        // Verificar disponibilidad de HLS
        let hlsAvailable = false;

        // Intentar detectar si hay HLS disponible
        if (response.data.file_path) {
          const fileName = response.data.file_path
            .split(/[\/\\]/)
            .pop()
            .split(".")[0];
          try {
            // Verificar si existe la carpeta HLS
            const hlsCheckResponse = await axios.head(
              `${API_URL}/data/transcoded/${fileName}_hls/master.m3u8`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            hlsAvailable = hlsCheckResponse.status === 200;
          } catch (hlsError) {
            console.warn("HLS no disponible:", hlsError);
            hlsAvailable = false;
          }
        }

        // Configurar opciones de streaming
        setStreamingOptions({
          direct: {
            available: true,
            url: `${API_URL}/api/media/${mediaId}/stream?auth=${token}`,
            type: getMediaMimeType(response.data),
          },
          hls: {
            available: hlsAvailable,
            url: hlsAvailable
              ? `${API_URL}/data/transcoded/${
                  response.data.file_path
                    .split(/[\/\\]/)
                    .pop()
                    .split(".")[0]
                }_hls/master.m3u8?auth=${token}`
              : null,
            type: "application/vnd.apple.mpegurl",
          },
        });

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar medio:", err);

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

  // Determinar la mejor URL de streaming basada en opciones disponibles
  const getBestStreamingUrl = () => {
    if (!streamingOptions) return null;

    // Preferir HLS si está disponible
    if (streamingOptions.hls?.available) {
      return streamingOptions.hls.url;
    }

    // Fallback a streaming directo
    if (streamingOptions.direct?.available) {
      return streamingOptions.direct.url;
    }

    return null;
  };

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
        // Obtener la mejor URL de streaming
        const streamUrl = getBestStreamingUrl();
        return (
          <ImprovedVideoPlayer
            videoId={mediaId}
            streamUrl={streamUrl}
            mediaInfo={media}
          />
        );

      case "photo":
        // Renderizar imagen - usando directamente el token JWT
        const token = localStorage.getItem("streamvio_token");
        return (
          <div className="bg-black rounded-lg flex items-center justify-center">
            <img
              src={`${API_URL}/api/media/${mediaId}/thumbnail?auth=${token}`}
              alt={media.title || "Imagen"}
              className="max-w-full max-h-[80vh] object-contain"
              onError={(e) => {
                e.target.src = "/assets/default-photo.jpg";
              }}
            />
          </div>
        );

      case "music":
        // Renderizar reproductor de audio - usando directamente el token JWT
        const authToken = localStorage.getItem("streamvio_token");
        return (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                <img
                  src={`${API_URL}/api/media/${mediaId}/thumbnail?auth=${authToken}`}
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
                src={`${API_URL}/api/media/${mediaId}/stream?auth=${authToken}`}
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

      {/* Opcional: Información sobre el método de streaming (solo para debug) */}
      {streamingOptions &&
        (media.type === "movie" || media.type === "episode") && (
          <div className="p-2 bg-gray-800 text-xs text-gray-400">
            {streamingOptions.hls?.available
              ? "Usando streaming HLS adaptativo"
              : "Usando streaming directo"}
          </div>
        )}
    </div>
  );
}

export default MediaViewer;
