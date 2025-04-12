// clients/web/src/components/VideoPlayer.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Componente de reproductor de video simplificado
 * @param {Object} props - Propiedades del componente
 * @param {string|number} props.mediaId - ID del medio a reproducir
 * @param {string} props.streamUrl - URL directa del stream (opcional)
 * @param {Object} props.mediaInfo - Información del medio (opcional)
 * @param {boolean} props.autoPlay - Reproducir automáticamente (opcional)
 */
function VideoPlayer({ mediaId, streamUrl, mediaInfo, autoPlay = false }) {
  // Referencias
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const controlsTimerRef = useRef(null);

  // Estados para reproducción
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(streamUrl || null);
  const [videoInfo, setVideoInfo] = useState(mediaInfo || null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cargar datos necesarios al montar el componente
  useEffect(() => {
    if (!mediaId && !streamUrl) {
      setError("No se proporcionó ID del medio o URL de stream");
      setIsLoading(false);
      return;
    }

    // Si ya tenemos una URL de stream, usarla directamente
    if (streamUrl) {
      console.log(
        "Usando URL de stream proporcionada:",
        streamUrl.split("?")[0]
      ); // No mostrar token en logs
      setVideoUrl(streamUrl);
      setIsLoading(false);
      return;
    }

    // Si no hay URL, pero hay ID, cargar la información y generar URL
    const loadVideoData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Obtener token de autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          throw new Error("No hay sesión activa");
        }

        // 1. Obtener información del video si no se proporcionó
        if (!mediaInfo) {
          const response = await axios.get(`${API_URL}/api/media/${mediaId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          setVideoInfo(response.data);
        }

        // 2. Generar URL de streaming con el token
        const streamUrl = `${API_URL}/api/media/${mediaId}/stream?auth=${encodeURIComponent(
          token
        )}`;
        console.log("URL de streaming generada:", streamUrl.split("?")[0]);

        setVideoUrl(streamUrl);
        setIsLoading(false);

        // 3. Obtener progreso de reproducción si existe
        try {
          const progressResponse = await axios.get(
            `${API_URL}/api/media/${mediaId}/progress`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (progressResponse.data && progressResponse.data.position > 0) {
            // Asignar tiempo inicial al cargar el video
            const savedPosition = progressResponse.data.position;
            console.log(`Progreso guardado encontrado: ${savedPosition}s`);

            // Aplicaremos la posición guardada cuando se carguen los metadatos
            if (videoRef.current) {
              videoRef.current.addEventListener(
                "loadedmetadata",
                () => {
                  if (
                    savedPosition > 0 &&
                    savedPosition < videoRef.current.duration - 30
                  ) {
                    videoRef.current.currentTime = savedPosition;
                    console.log(`Posición establecida a ${savedPosition}s`);
                  }
                },
                { once: true }
              );
            }
          }
        } catch (progressError) {
          console.warn("Error al obtener progreso:", progressError);
          // No bloqueamos la reproducción por este error
        }
      } catch (error) {
        console.error("Error al cargar datos del video:", error);
        setError(error.response?.data?.message || "Error al cargar el video");
        setIsLoading(false);
      }
    };

    loadVideoData();

    // Configurar guardado periódico de progreso
    const progressInterval = setInterval(() => {
      if (videoRef.current && isPlaying && currentTime > 0) {
        saveProgress(currentTime);
      }
    }, 30000); // Guardar cada 30 segundos

    // Limpieza
    return () => {
      clearInterval(progressInterval);
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [mediaId, streamUrl, mediaInfo]);

  // Guardar progreso de reproducción
  const saveProgress = async (timeInSeconds, isCompleted = false) => {
    if (!mediaId) return;

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) return;

      await axios.post(
        `${API_URL}/api/media/${mediaId}/progress`,
        { position: Math.floor(timeInSeconds), completed: isCompleted },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log(`Progreso guardado: ${Math.floor(timeInSeconds)}s`);
    } catch (error) {
      console.warn("Error al guardar progreso:", error);
    }
  };

  // Manejadores de eventos de video
  const handleVideoPlay = () => {
    setIsPlaying(true);
    resetControlsTimer();
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    setCurrentTime(video.currentTime);

    if (video.duration) {
      const progressValue = (video.currentTime / video.duration) * 100;
      setProgress(progressValue);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowControls(true);

    // Marcar como completado
    saveProgress(duration, true);
  };

  const handleVideoMetadataLoaded = () => {
    if (!videoRef.current) return;

    setDuration(videoRef.current.duration);

    // Iniciar reproducción automática si está habilitada
    if (autoPlay) {
      const playPromise = videoRef.current.play();

      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Error de reproducción automática:", error);
          // La mayoría de navegadores requieren interacción del usuario antes de reproducir
        });
      }
    }
  };

  const handleVideoError = (e) => {
    console.error("Error de reproducción:", e);

    let errorMessage = "Error al reproducir el video";

    if (videoRef.current && videoRef.current.error) {
      switch (videoRef.current.error.code) {
        case 1: // MEDIA_ERR_ABORTED
          errorMessage = "Reproducción abortada";
          break;
        case 2: // MEDIA_ERR_NETWORK
          errorMessage = "Error de red al cargar el video";
          break;
        case 3: // MEDIA_ERR_DECODE
          errorMessage = "Error al decodificar el video";
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorMessage = "Formato de video no soportado";
          break;
        default:
          errorMessage = videoRef.current.error.message || "Error desconocido";
      }
    }

    setError(errorMessage);
  };

  // Funciones de control
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Error al reproducir:", error);
          setError("No se pudo iniciar la reproducción");
        });
      }
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;

    const newMuteState = !isMuted;
    videoRef.current.muted = newMuteState;
    setIsMuted(newMuteState);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);

    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (e) => {
    if (!videoRef.current || !duration) return;

    const seekPercent = parseFloat(e.target.value);
    const seekTime = (seekPercent / 100) * duration;

    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const toggleFullscreen = () => {
    if (!playerRef.current) return;

    if (!document.fullscreenElement) {
      // Entrar a pantalla completa
      if (playerRef.current.requestFullscreen) {
        playerRef.current.requestFullscreen();
      } else if (playerRef.current.webkitRequestFullscreen) {
        playerRef.current.webkitRequestFullscreen();
      } else if (playerRef.current.msRequestFullscreen) {
        playerRef.current.msRequestFullscreen();
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

  // Control de visibilidad de controles
  const resetControlsTimer = () => {
    setShowControls(true);

    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }

    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000); // Ocultar controles después de 3 segundos
    }
  };

  // Formatear tiempo (segundos a MM:SS)
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return "00:00";

    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Reintentar reproducción
  const retryPlayback = () => {
    if (!mediaId) return;

    setIsLoading(true);
    setError(null);

    // Regenerar URL con token fresco (añadiendo timestamp para evitar caché)
    const token = localStorage.getItem("streamvio_token");
    if (token) {
      const timestamp = new Date().getTime();
      const newUrl = `${API_URL}/api/media/${mediaId}/stream?auth=${encodeURIComponent(
        token
      )}&_t=${timestamp}`;

      setVideoUrl(newUrl);
      setIsLoading(false);
    } else {
      setError("No hay sesión activa. Inicia sesión nuevamente.");
    }
  };

  // RENDERIZADO DEL COMPONENTE

  // Estado de carga
  if (isLoading) {
    return (
      <div
        className="w-full bg-black rounded-lg flex items-center justify-center"
        style={{ minHeight: "300px" }}
      >
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-white">Cargando video...</p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <div
        className="w-full bg-black bg-opacity-80 rounded-lg p-8 text-center"
        style={{ minHeight: "300px" }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 text-red-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-red-500 text-xl font-semibold mb-2">
            Error de reproducción
          </p>
          <p className="text-white mb-4">{error}</p>
          <button
            onClick={retryPlayback}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded focus:outline-none"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Reproductor normal
  return (
    <div
      ref={playerRef}
      className="relative w-full bg-black rounded-lg overflow-hidden"
      onMouseMove={resetControlsTimer}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video principal */}
      <video
        ref={videoRef}
        className="w-full h-auto"
        src={videoUrl}
        poster={
          videoInfo?.thumbnail_path
            ? `${API_URL}/api/media/${mediaId}/thumbnail?auth=${encodeURIComponent(
                localStorage.getItem("streamvio_token") || ""
              )}`
            : undefined
        }
        controls={false}
        playsInline
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
        onTimeUpdate={handleVideoTimeUpdate}
        onLoadedMetadata={handleVideoMetadataLoaded}
        onEnded={handleVideoEnded}
        onError={handleVideoError}
        onClick={togglePlay}
      />

      {/* Capa de controles personalizados */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Barra de progreso */}
        <div className="mb-2">
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progress}%, #4b5563 ${progress}%, #4b5563 100%)`,
            }}
          />
        </div>

        {/* Controles principales */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Botón reproducir/pausar */}
            <button
              onClick={togglePlay}
              className="text-white focus:outline-none hover:text-blue-400"
              aria-label={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? (
                <svg
                  className="w-8 h-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
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
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-white focus:outline-none hover:text-blue-400"
                aria-label={isMuted ? "Activar sonido" : "Silenciar"}
              >
                {isMuted ? (
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3.63 3.63a.996.996 0 0 0 0 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 1 0 1.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0 0 14 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z" />
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
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 md:w-24 h-2 bg-gray-700 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                    volume * 100
                  }%, #4b5563 ${volume * 100}%, #4b5563 100%)`,
                }}
              />
            </div>

            {/* Tiempo */}
            <div className="text-white text-sm hidden sm:block">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Botón de pantalla completa */}
          <button
            onClick={toggleFullscreen}
            className="text-white focus:outline-none hover:text-blue-400"
            aria-label="Pantalla completa"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Botón central de reproducción cuando está pausado */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="bg-blue-600 bg-opacity-80 rounded-full p-4 focus:outline-none transform transition-transform hover:scale-110"
            aria-label="Reproducir"
          >
            <svg
              className="w-12 h-12 text-white"
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
