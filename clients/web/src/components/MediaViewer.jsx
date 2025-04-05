// src/components/MediaViewer.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function MediaViewer({ mediaId }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [hlsAvailable, setHLSAvailable] = useState(false);
  const [streamType, setStreamType] = useState("direct"); // 'direct' o 'hls'
  const [streamUrl, setStreamUrl] = useState("");
  const [streamingToken, setStreamingToken] = useState(null);
  const playerRef = useRef(null);
  const progressInterval = useRef(null);
  const tokenRefreshTimeout = useRef(null);

  // Cargar información del medio
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          setError("Se requiere autenticación para ver este contenido");
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API_URL}/api/media/${mediaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Si llegamos aquí, la petición fue exitosa
        setMedia(response.data);
        console.log("Datos del medio cargados:", response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error al cargar datos del medio:", err);

        // Manejo específico según el tipo de error
        if (err.response) {
          if (err.response.status === 404) {
            setError("El medio solicitado no existe o ha sido eliminado");
          } else if (err.response.status === 401) {
            setError(
              "Tu sesión ha expirado. Por favor, inicia sesión nuevamente"
            );
          } else if (err.response.status === 403) {
            setError("No tienes permisos para acceder a este contenido");
          } else {
            setError(
              err.response.data?.message ||
                "Error al cargar el contenido multimedia"
            );
          }
        } else if (err.request) {
          setError(
            "No se pudo conectar con el servidor. Verifica tu conexión a internet"
          );
        } else {
          setError("Error de configuración al intentar cargar el contenido");
        }

        setLoading(false);
      }
    };

    fetchMedia();

    // Limpiar intervalo y timeout al desmontar
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (tokenRefreshTimeout.current) {
        clearTimeout(tokenRefreshTimeout.current);
      }
    };
  }, [mediaId]);

  // Preparar el streaming y obtener token específico
  useEffect(() => {
    if (!media) return;

    const prepareStreaming = async () => {
      try {
        setLoadingStream(true);
        console.log("Preparando streaming para medio:", mediaId);

        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          setError("Se requiere autenticación para ver este contenido");
          setLoadingStream(false);
          return;
        }

        // Solicitar token específico para streaming
        const response = await axios.get(
          `${API_URL}/api/streaming/${mediaId}/prepare`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        console.log("Información de streaming recibida:", response.data);

        // Verificar si hay soporte para HLS
        setHLSAvailable(response.data.hasHLS);

        // Guardar token específico para streaming
        setStreamingToken(response.data);

        // Configurar URL según tipo de streaming
        if (response.data.hasHLS && streamType === "hls") {
          setStreamUrl(response.data.hlsStreamUrl);
        } else {
          setStreamUrl(response.data.directStreamUrl);
        }

        // Programar renovación del token antes de que expire
        if (response.data.expiresAt) {
          const expiresAt = new Date(response.data.expiresAt).getTime();
          const now = new Date().getTime();

          // Calcular cuánto falta para que expire (en milisegundos)
          const timeUntilExpiry = expiresAt - now;

          // Programar renovación 15 minutos antes de que expire
          const refreshTime = Math.max(timeUntilExpiry - 15 * 60 * 1000, 60000); // Al menos 1 minuto

          if (tokenRefreshTimeout.current) {
            clearTimeout(tokenRefreshTimeout.current);
          }

          tokenRefreshTimeout.current = setTimeout(() => {
            console.log("Renovando token de streaming...");
            prepareStreaming();
          }, refreshTime);
        }

        setLoadingStream(false);
      } catch (err) {
        console.error("Error al preparar streaming:", err);
        if (err.response && err.response.data) {
          setError(
            err.response.data.message || "Error al preparar la reproducción"
          );
        } else {
          setError(
            "Error al preparar la reproducción. Intente de nuevo más tarde."
          );
        }
        setLoadingStream(false);
      }
    };

    prepareStreaming();
  }, [media, mediaId, streamType]);

  // Actualizar el progreso periódicamente
  useEffect(() => {
    if (!playerRef.current) return;

    // Guardar progreso cada 5 segundos
    progressInterval.current = setInterval(() => {
      if (playerRef.current && playerRef.current.currentTime > 0) {
        saveProgress(playerRef.current.currentTime);
      }
    }, 5000);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [media]);

  // Cargar progreso anterior
  useEffect(() => {
    if (!media) return;

    const loadProgress = async () => {
      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) return;

        const response = await axios.get(
          `${API_URL}/api/media/${mediaId}/progress`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.position > 0) {
          // Si hay un playerRef y tenemos un tiempo guardado, establecerlo
          if (playerRef.current) {
            playerRef.current.currentTime = response.data.position;
          }

          setCurrentTime(response.data.position);
        }
      } catch (err) {
        console.error("Error al cargar progreso:", err);
      }
    };

    loadProgress();
  }, [media, mediaId]);

  // Cambiar tipo de streaming
  const handleStreamTypeChange = (e) => {
    setStreamType(e.target.value);
  };

  // Guardar progreso en el servidor
  const saveProgress = async (position) => {
    if (!media || !mediaId) return;

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) return;

      // Calcular si está completado (>90% visto)
      const isCompleted = position > duration * 0.9;

      await axios.post(
        `${API_URL}/api/media/${mediaId}/progress`,
        { position, completed: isCompleted },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log(
        `Progreso guardado: ${position}s, completado: ${isCompleted}`
      );
    } catch (err) {
      console.error("Error al guardar progreso:", err);
    }
  };

  // Manejar eventos de video
  const handleTimeUpdate = () => {
    if (playerRef.current) {
      setCurrentTime(playerRef.current.currentTime);
    }
  };

  const handleDurationChange = () => {
    if (playerRef.current) {
      setDuration(playerRef.current.duration);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);

    if (playerRef.current) {
      playerRef.current.volume = newVolume;
    }
  };

  // Formatear tiempo en formato MM:SS
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds) return "00:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Obtener URL de miniatura con token de autenticación
  const getThumbnailUrl = () => {
    const token = localStorage.getItem("streamvio_token");
    const authParam = token ? `?auth=${token}` : "";
    return `${API_URL}/api/media/${mediaId}/thumbnail${authParam}`;
  };

  // Renderizar según el tipo de medio
  const renderMediaPlayer = () => {
    if (!media) return null;

    switch (media.type) {
      case "movie":
      case "episode":
        return (
          <div className="relative">
            <div className="relative pb-[56.25%] bg-black rounded-lg overflow-hidden">
              {loadingStream ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <video
                  ref={playerRef}
                  className="absolute inset-0 w-full h-full"
                  controls
                  autoPlay
                  src={streamUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleDurationChange}
                  onEnded={() => saveProgress(duration)}
                >
                  Tu navegador no soporta el elemento de video.
                </video>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center">
              <div className="flex items-center mb-2 sm:mb-0">
                <button
                  onClick={() => playerRef.current?.play()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded mr-2"
                  disabled={loadingStream}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <div className="text-gray-300 text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center">
                <span className="text-gray-300 text-sm mr-2">Volumen:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-24"
                />
              </div>

              {hlsAvailable && (
                <div className="flex items-center ml-4">
                  <span className="text-gray-300 text-sm mr-2">
                    Tipo de stream:
                  </span>
                  <select
                    value={streamType}
                    onChange={handleStreamTypeChange}
                    className="bg-gray-700 text-white border border-gray-600 rounded p-1 text-sm"
                    disabled={loadingStream}
                  >
                    <option value="direct">Directo</option>
                    <option value="hls">Adaptativo (HLS)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        );

      case "photo":
        return (
          <div className="flex justify-center rounded-lg overflow-hidden bg-black">
            <img
              src={streamUrl}
              alt={media.title}
              className="max-h-[80vh] object-contain"
            />
          </div>
        );

      case "music":
        return (
          <div className="rounded-lg overflow-hidden bg-gray-900 p-6">
            <div className="flex justify-center mb-6">
              <div className="w-48 h-48 bg-gray-800 rounded-lg flex items-center justify-center">
                {media.thumbnail_path ? (
                  <img
                    src={getThumbnailUrl()}
                    alt={media.title}
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-24 w-24 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                )}
              </div>
            </div>

            <div className="w-full">
              <audio
                ref={playerRef}
                className="w-full"
                controls
                autoPlay
                src={streamUrl}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onEnded={() => saveProgress(duration)}
              >
                Tu navegador no soporta el elemento de audio.
              </audio>

              <div className="mt-4 text-center">
                <h3 className="text-xl font-semibold">{media.title}</h3>
                {media.description && (
                  <p className="text-gray-400 mt-2">{media.description}</p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="rounded-lg bg-gray-800 p-6 text-center">
            <p className="text-gray-400">
              No se puede mostrar este tipo de contenido
            </p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-gray-800 p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-800 p-6 text-center">
        <p className="text-white mb-4">{error}</p>
        <a
          href="/media"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          Volver a la Biblioteca
        </a>
      </div>
    );
  }

  // Componente principal
  return (
    <div className="rounded-lg overflow-hidden">
      {/* Debug info - solo visible en desarrollo */}
      {process.env.NODE_ENV === "development" && streamingToken && (
        <div className="bg-blue-900 p-2 text-xs text-white mb-2 rounded">
          <p>Token de streaming: {streamingToken.token?.substring(0, 15)}...</p>
          {streamingToken.expiresAt && (
            <p>Expira: {new Date(streamingToken.expiresAt).toLocaleString()}</p>
          )}
        </div>
      )}

      {renderMediaPlayer()}
    </div>
  );
}

export default MediaViewer;
