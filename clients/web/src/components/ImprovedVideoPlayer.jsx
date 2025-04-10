// ImprovedVideoPlayer.jsx (Versión actualizada)
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Reproductor de video mejorado con controles personalizados
 * Versión actualizada con mejor manejo de rangos y streaming
 */
function ImprovedVideoPlayer(props) {
  const { videoId, autoPlay = false, streamUrl, mediaInfo } = props;

  // Estados del reproductor
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localStreamUrl, setLocalStreamUrl] = useState(streamUrl || null);

  // Estados de reproducción
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Referencias
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressUpdateIntervalRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Efecto para inicializar el reproductor
  useEffect(() => {
    // Si se proporciona una URL de streaming directamente, usarla
    if (streamUrl) {
      setLocalStreamUrl(streamUrl);

      if (mediaInfo) {
        setVideo(mediaInfo);
      } else if (videoId) {
        // Si hay ID pero no mediaInfo, intentar cargar la info
        fetchVideoInfo(videoId)
          .then((data) => setVideo(data))
          .catch((err) =>
            console.warn("No se pudo cargar info del video:", err)
          );
      }

      setLoading(false);
      setupProgressTracking();
      return;
    }

    // Si no hay URL proporcionada pero hay videoId, hacer la carga completa
    if (!videoId) return;

    const setupVideo = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Obtener información del video
        const videoData = await fetchVideoInfo(videoId);
        setVideo(videoData);

        // 2. Generar la URL de streaming correcta con autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          throw new Error("No hay token de autenticación disponible");
        }

        // 3. Decidir el método de streaming basado en la información disponible
        let streamingUrl;

        // Si HLS está disponible, usarlo preferentemente
        if (videoData.has_hls) {
          const fileName = videoData.file_path
            ?.split(/[\/\\]/)
            .pop()
            .split(".")[0];
          streamingUrl = `${API_URL}/data/transcoded/${fileName}_hls/master.m3u8?auth=${token}`;
          console.log("Usando streaming HLS:", streamingUrl);
        } else {
          // Streaming directo como fallback
          streamingUrl = `${API_URL}/api/media/${videoId}/stream?auth=${token}`;
          console.log("Usando streaming directo:", streamingUrl);
        }

        setLocalStreamUrl(streamingUrl);
        setLoading(false);

        // 4. Configurar guardado periódico de progreso
        setupProgressTracking();
      } catch (err) {
        console.error("Error al configurar reproductor:", err);
        handlePlayerError(err);
      }
    };

    setupVideo();

    // Limpieza
    return () => {
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [videoId, streamUrl, mediaInfo]);

  // Función para obtener información del video
  const fetchVideoInfo = async (id) => {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay token de autenticación disponible");
      }

      const response = await axios.get(`${API_URL}/api/media/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      console.log("Información del video obtenida:", response.data);
      return response.data;
    } catch (err) {
      console.error("Error al obtener información del video:", err);

      if (err.response?.status === 404) {
        throw new Error("El video solicitado no existe");
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        throw new Error("No tienes permiso para acceder a este contenido");
      } else if (!navigator.onLine) {
        throw new Error("No hay conexión a internet");
      } else {
        throw new Error(
          err.response?.data?.message || "Error al cargar información del video"
        );
      }
    }
  };

  // Configurar seguimiento de progreso
  const setupProgressTracking = () => {
    // Guardar progreso cada 30 segundos
    if (progressUpdateIntervalRef.current) {
      clearInterval(progressUpdateIntervalRef.current);
    }

    progressUpdateIntervalRef.current = setInterval(() => {
      if (videoRef.current && isPlaying && currentTime > 0) {
        saveProgress(currentTime);
      }
    }, 30000);
  };

  // Guardar progreso de visualización
  const saveProgress = async (timeInSeconds, isCompleted = false) => {
    if (!videoId) return;

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) return;

      console.log(
        `Guardando progreso: ${timeInSeconds}s, completado: ${isCompleted}`
      );

      await axios.post(
        `${API_URL}/api/media/${videoId}/progress`,
        { position: timeInSeconds, completed: isCompleted },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("Progreso guardado correctamente");
    } catch (err) {
      console.warn("Error al guardar progreso:", err);
      // No interrumpir la reproducción por errores al guardar
    }
  };

  // Manejo de errores del reproductor
  const handlePlayerError = (err) => {
    console.error("Error en reproductor:", err);

    // Determinar mensaje específico según tipo de error
    let errorMessage = "Error al reproducir el video";

    if (err.message) {
      errorMessage = err.message;
    } else if (videoRef.current?.error) {
      const videoError = videoRef.current.error;

      // Analizar códigos de error de video estándar
      switch (videoError.code) {
        case 1: // MEDIA_ERR_ABORTED
          errorMessage = "La reproducción fue abortada por el usuario";
          break;
        case 2: // MEDIA_ERR_NETWORK
          errorMessage = "Error de red al cargar el video";
          break;
        case 3: // MEDIA_ERR_DECODE
          errorMessage =
            "Error al decodificar el video. Puede que el formato no sea compatible";
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorMessage =
            "El formato de video no es compatible o la URL es inválida";
          break;
        default:
          errorMessage = videoError.message || "Error desconocido";
      }
    }

    setError(errorMessage);
    setLoading(false);

    // Intento de recuperación automática
    if (retryCountRef.current < maxRetries) {
      console.log(
        `Reintentando reproducción (${
          retryCountRef.current + 1
        }/${maxRetries})...`
      );
      retryCountRef.current++;

      // Esperar un momento y reintentar con una nueva URL
      setTimeout(() => {
        const token = localStorage.getItem("streamvio_token");
        if (token) {
          // Reconstruir URL con un timestamp para evitar cachés
          const timestamp = new Date().getTime();
          const newUrl = `${API_URL}/api/media/${videoId}/stream?auth=${token}&_t=${timestamp}`;
          setLocalStreamUrl(newUrl);
          setError(null);
        }
      }, 3000);
    }
  };

  // Manejadores de eventos del video
  const handleVideoPlay = () => {
    setIsPlaying(true);
    resetControlsTimer();
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    setCurrentTime(video.currentTime);

    // Si ha pasado más de 5% desde la última actualización, guardar progreso
    if (video.duration) {
      const progressPercent = (video.currentTime / video.duration) * 100;
      setProgress(progressPercent);

      const lastSavedPercent = (currentTime / duration) * 100;

      if (Math.abs(progressPercent - lastSavedPercent) > 5) {
        saveProgress(video.currentTime);
      }
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    saveProgress(duration, true); // Marcarlo como completado
  };

  const handleVideoMetadataLoaded = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);

    // Intentar reproducir automáticamente si está habilitado
    if (autoPlay) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Error de reproducción automática:", error);
          // No mostrar error, solo dejar pausa
        });
      }
    }
  };

  const handleVideoError = (e) => {
    handlePlayerError(e);
  };

  // Mostrar/ocultar controles automáticamente
  const resetControlsTimer = () => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Control de volumen
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuteState = !isMuted;
      videoRef.current.muted = newMuteState;
      setIsMuted(newMuteState);
    }
  };

  // Control de reproducción
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Error al reproducir:", error);
        });
      }
    }
  };

  // Control de la barra de progreso
  const handleSeek = (e) => {
    if (!videoRef.current || !duration) return;

    const seekPercent = parseFloat(e.target.value);
    const seekTime = (seekPercent / 100) * duration;
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Pantalla completa
  const toggleFullscreen = () => {
    if (!playerRef.current) return;

    if (!document.fullscreenElement) {
      if (playerRef.current.requestFullscreen) {
        playerRef.current.requestFullscreen();
      } else if (playerRef.current.webkitRequestFullscreen) {
        playerRef.current.webkitRequestFullscreen();
      } else if (playerRef.current.msRequestFullscreen) {
        playerRef.current.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
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

  // Formatear tiempo (segundos a MM:SS)
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return "00:00";

    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Generar el reproductor con manejo de estados

  // Estado de carga
  if (loading) {
    return (
      <div
        className="w-full bg-black rounded-lg flex items-center justify-center"
        style={{ minHeight: "300px" }}
      >
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
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
            onClick={() => {
              setError(null);
              setLoading(true);
              retryCountRef.current = 0;

              // Regenerar URL de streaming con nuevo token
              const token = localStorage.getItem("streamvio_token");
              if (token) {
                const timestamp = new Date().getTime();
                const newUrl = `${API_URL}/api/media/${videoId}/stream?auth=${token}&_t=${timestamp}`;
                setTimeout(() => {
                  setLocalStreamUrl(newUrl);
                  setLoading(false);
                }, 1000);
              }
            }}
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
        src={localStreamUrl}
        poster={
          video?.thumbnail_path
            ? `${API_URL}/api/media/${videoId}/thumbnail?auth=${localStorage.getItem(
                "streamvio_token"
              )}`
            : undefined
        }
        controls={false}
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
        onTimeUpdate={handleVideoTimeUpdate}
        onLoadedMetadata={handleVideoMetadataLoaded}
        onEnded={handleVideoEnd}
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

export default ImprovedVideoPlayer;
