// clients/web/src/components/VideoPlayer.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import auth from "../utils/auth";

/**
 * Componente mejorado para reproducción de video
 * - Gestión integrada de tokens de autenticación
 * - Progreso automático
 * - Controles personalizados
 */
function VideoPlayer({ mediaId, autoPlay = false }) {
  // Referencias
  const videoRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const playerContainerRef = useRef(null);

  // Estados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [mediaInfo, setMediaInfo] = useState(null);

  // Cargar datos y URL de streaming
  useEffect(() => {
    if (!mediaId) {
      setError("ID de medio no proporcionado");
      setLoading(false);
      return;
    }

    const loadVideoData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Obtener información del medio
        const response = await axios.get(`/api/media/${mediaId}`, {
          headers: auth.getAuthHeaders(),
        });
        setMediaInfo(response.data);

        // 2. Generar URL de streaming con autenticación
        const streamUrl = auth.getStreamUrl(mediaId);
        setStreamUrl(streamUrl);

        // 3. Obtener progreso anterior si existe
        try {
          const progressResponse = await axios.get(
            `/api/media/${mediaId}/progress`,
            {
              headers: auth.getAuthHeaders(),
            }
          );

          // Si hay progreso guardado, lo aplicaremos después de cargar el video
          if (progressResponse.data && progressResponse.data.position > 0) {
            const savedPosition = progressResponse.data.position;
            console.log(`Progreso guardado: ${savedPosition}s`);

            // Establecer posición cuando el video esté listo
            const handleMetadataLoaded = () => {
              if (
                videoRef.current &&
                savedPosition > 0 &&
                savedPosition < videoRef.current.duration - 30
              ) {
                videoRef.current.currentTime = savedPosition;
                console.log(`Posición establecida a ${savedPosition}s`);
              }
              videoRef.current.removeEventListener(
                "loadedmetadata",
                handleMetadataLoaded
              );
            };

            if (videoRef.current) {
              videoRef.current.addEventListener(
                "loadedmetadata",
                handleMetadataLoaded
              );
            }
          }
        } catch (progressError) {
          console.warn("Error al obtener progreso:", progressError);
          // No bloqueamos la reproducción por error en progreso
        }

        setLoading(false);
      } catch (error) {
        console.error("Error al cargar video:", error);
        setError(error.response?.data?.message || "Error al cargar el video");
        setLoading(false);
      }
    };

    loadVideoData();

    // Función para guardar progreso periódicamente (cada 10 segundos)
    const progressInterval = setInterval(() => {
      if (videoRef.current && isPlaying && currentTime > 0) {
        saveProgress(currentTime);
      }
    }, 10000);

    // Limpieza
    return () => {
      clearInterval(progressInterval);
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [mediaId]);

  // Función para guardar progreso
  const saveProgress = async (timeInSeconds, isCompleted = false) => {
    if (!mediaId) return;

    try {
      await axios.post(
        `/api/media/${mediaId}/progress`,
        {
          position: Math.floor(timeInSeconds),
          completed: isCompleted,
        },
        {
          headers: auth.getAuthHeaders(),
        }
      );
      console.log(`Progreso guardado: ${Math.floor(timeInSeconds)}s`);
    } catch (error) {
      console.warn("Error al guardar progreso:", error);
    }
  };

  // Gestión de eventos del video
  const handlePlay = () => {
    setIsPlaying(true);
    resetControlsTimer();
  };

  const handlePause = () => {
    setIsPlaying(false);
    setShowControls(true);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
    // Marcar como completado
    saveProgress(duration, true);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    setCurrentTime(video.currentTime);

    if (video.duration) {
      const progressValue = (video.currentTime / video.duration) * 100;
      setProgress(progressValue);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;

    setDuration(videoRef.current.duration);
    setLoading(false);

    // Reproducción automática si está habilitada
    if (autoPlay) {
      videoRef.current.play().catch((error) => {
        console.warn("Reproducción automática bloqueada:", error);
      });
    }
  };

  const handleVolumeChange = (e) => {
    if (!videoRef.current) return;

    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;

    const newMuteState = !isMuted;
    videoRef.current.muted = newMuteState;
    setIsMuted(newMuteState);
  };

  const handleSeek = (e) => {
    if (!videoRef.current || !duration) return;

    const seekPercent = parseFloat(e.target.value);
    const seekTime = (seekPercent / 100) * duration;

    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((error) => {
        console.error("Error al reproducir:", error);
        setError("No se pudo iniciar la reproducción");
      });
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      // Entrar a pantalla completa
      if (playerContainerRef.current.requestFullscreen) {
        playerContainerRef.current.requestFullscreen();
      } else if (playerContainerRef.current.webkitRequestFullscreen) {
        playerContainerRef.current.webkitRequestFullscreen();
      } else if (playerContainerRef.current.msRequestFullscreen) {
        playerContainerRef.current.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      // Salir de pantalla completa
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const resetControlsTimer = () => {
    setShowControls(true);

    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }

    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Formatear tiempo
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) return "00:00";

    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Renderizado condicional para estados de carga y error
  if (loading) {
    return (
      <div className="w-full h-64 md:h-80 lg:h-96 bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
          <span className="text-gray-300">Cargando video...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-64 md:h-80 lg:h-96 bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center text-center p-4">
          <svg
            className="w-12 h-12 text-red-500 mb-3"
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
          <span className="text-red-400 font-medium mb-2">
            Error de reproducción
          </span>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Renderizado del reproductor
  return (
    <div
      ref={playerContainerRef}
      className="relative w-full bg-black rounded-lg overflow-hidden"
      onMouseMove={resetControlsTimer}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video principal */}
      <video
        ref={videoRef}
        className="w-full h-auto"
        src={streamUrl}
        poster={
          mediaInfo?.thumbnail_path ? auth.getThumbnailUrl(mediaId) : undefined
        }
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setError("Error al reproducir el video")}
        playsInline
        controls={false}
      />

      {/* Controles personalizados */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent px-4 py-3 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Barra de progreso */}
        <div className="mb-3">
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progress}%, #6b7280 ${progress}%, #6b7280 100%)`,
            }}
          />
        </div>

        {/* Controles principales */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Botón de play/pause */}
            <button
              className="text-white hover:text-blue-400 transition focus:outline-none"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? (
                <svg
                  className="w-8 h-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path fillRule="evenodd" d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Control de volumen */}
            <div className="hidden sm:flex items-center space-x-1">
              <button
                className="text-white hover:text-blue-400 transition focus:outline-none"
                onClick={toggleMute}
                aria-label={isMuted ? "Activar sonido" : "Silenciar"}
              >
                {isMuted ? (
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 md:w-24 h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                    volume * 100
                  }%, #6b7280 ${volume * 100}%, #6b7280 100%)`,
                }}
              />
            </div>

            {/* Tiempo actual / duración */}
            <div className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Botón de pantalla completa */}
          <button
            className="text-white hover:text-blue-400 transition focus:outline-none"
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"
            }
          >
            {isFullscreen ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Botón central de play/pause */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            className="bg-blue-600 bg-opacity-70 hover:bg-opacity-90 rounded-full p-5 transform transition hover:scale-110 focus:outline-none"
            onClick={togglePlay}
            aria-label="Reproducir"
          >
            <svg
              className="w-10 h-10 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
