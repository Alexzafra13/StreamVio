// clients/web/src/components/MediaViewer.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function MediaViewer({ mediaId }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [hlsAvailable, setHLSAvailable] = useState(false);
  const [streamType, setStreamType] = useState("direct"); // 'direct' or 'hls'
  const playerRef = useRef(null);
  const progressInterval = useRef(null);

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

        setMedia(response.data);

        // Verificar si existe streaming HLS
        const fileName = response.data.file_path.split("/").pop().split(".")[0];
        const hlsPath = `${API_URL}/data/transcoded/${fileName}_hls/master.m3u8`;

        try {
          const hlsResponse = await axios.head(hlsPath, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (hlsResponse.status === 200) {
            setHLSAvailable(true);
            setStreamType("hls"); // Usar HLS por defecto si está disponible
          }
        } catch (err) {
          // No hay streaming HLS disponible, seguir con streaming directo
          console.log("HLS no disponible:", err);
          setHLSAvailable(false);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar datos del medio:", err);
        setError(
          err.response?.data?.message ||
            "Error al cargar el contenido multimedia"
        );
        setLoading(false);
      }
    };

    fetchMedia();

    // Limpiar intervalo al desmontar
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [mediaId]);

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

  const handleStreamTypeChange = (e) => {
    setStreamType(e.target.value);
  };

  // Formatear tiempo en formato MM:SS
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Obtener URL de streaming según el tipo
  const getStreamUrl = () => {
    if (!media) return "";

    const token = localStorage.getItem("streamvio_token");

    if (streamType === "hls" && hlsAvailable) {
      // URL para streaming HLS
      const fileName = media.file_path.split("/").pop().split(".")[0];
      return `${API_URL}/data/transcoded/${fileName}_hls/master.m3u8`;
    } else {
      // URL para streaming directo
      return `${API_URL}/api/media/${mediaId}/stream`;
    }
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
              <video
                ref={playerRef}
                className="absolute inset-0 w-full h-full"
                controls
                autoPlay
                src={getStreamUrl()}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onEnded={() => saveProgress(duration)}
              >
                Tu navegador no soporta el elemento de video.
              </video>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center">
              <div className="flex items-center mb-2 sm:mb-0">
                <button
                  onClick={() => playerRef.current?.play()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded mr-2"
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
              src={`${API_URL}/api/media/${mediaId}/stream`}
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
                    src={`${API_URL}/api/media/${mediaId}/thumbnail`}
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
                src={getStreamUrl()}
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
          href="/auth"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          Iniciar Sesión
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden">{renderMediaPlayer()}</div>
  );
}

export default MediaViewer;
