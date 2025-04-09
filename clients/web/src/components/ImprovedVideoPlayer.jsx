// clients/web/src/components/ImprovedVideoPlayer.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Reproductor de video mejorado con controles personalizados
 * Versión simplificada que usa directamente el token JWT
 */
function ImprovedVideoPlayer({ videoId }) {
  // Estados del reproductor
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);

  // Estados de reproducción
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Estado para streaming adaptativo
  const [supportsHls, setSupportsHls] = useState(false);
  const [hlsAvailable, setHlsAvailable] = useState(false);
  const [streamType, setStreamType] = useState("direct"); // "direct" o "hls"

  // Referencias
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressUpdateIntervalRef = useRef(null);

  // Cargar información del video y configurar streaming
  useEffect(() => {
    const fetchVideoAndSetupStreaming = async () => {
      if (!videoId) return;

      try {
        setLoading(true);
        setError(null);

        // Obtener token de autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          throw new Error("No hay sesión activa");
        }

        // 1. Obtener información del video
        console.log(`Obteniendo información del video ID: ${videoId}`);
        const videoResponse = await axios.get(
          `${API_URL}/api/media/${videoId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const videoData = videoResponse.data;
        console.log("Información del video obtenida:", videoData);
        setVideo(videoData);

        // 2. Verificar si es un video (no una imagen o música)
        if (videoData.type !== "movie" && videoData.type !== "episode") {
          setError("Este tipo de contenido no es reproducible como video");
          setLoading(false);
          return;
        }

        // 3. Comprobar si el navegador soporta HLS
        const checkHlsSupport = () => {
          // Safari soporta HLS nativamente
          if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
            return true;
          }
          // Otros navegadores pueden usar hls.js si tienen MediaSource
          return window.MediaSource !== undefined;
        };

        const hlsSupport = checkHlsSupport();
        setSupportsHls(hlsSupport);

        // 4. Comprobar si hay versión HLS disponible para este video
        const hasHls = videoData.has_hls || false;
        setHlsAvailable(hasHls);

        // 5. Determinar el tipo de streaming a usar
        const bestStreamType = hasHls && hlsSupport ? "hls" : "direct";
        setStreamType(bestStreamType);

        // 6. Configurar URL de streaming directamente con el token JWT
        const streamUrl =
          bestStreamType === "hls" && hasHls
            ? `${API_URL}/api/streaming/${videoId}/hls?auth=${token}`
            : `${API_URL}/api/streaming/${videoId}/stream?auth=${token}`;

        console.log(
          `URL de streaming configurada (${bestStreamType}):`,
          streamUrl
        );
        setStreamUrl(streamUrl);

        // 7. Cargar historial de reproducción si existe
        await loadWatchHistory(token);

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar video:", err);
        setError(err.response?.data?.message || "Error al cargar el video");
        setLoading(false);
      }
    };

    fetchVideoAndSetupStreaming();

    // Limpieza al desmontar
    return () => {
      clearTimeouts();
    };
  }, [videoId]);

  // Limpiar todos los timeouts e intervalos
  const clearTimeouts = () => {
    if (progressUpdateIntervalRef.current) {
      clearInterval(progressUpdateIntervalRef.current);
    }
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  };

  // Cargar historial de visualización con manejo de errores
  const loadWatchHistory = async (token) => {
    try {
      if (!token || !videoId) return;

      console.log("Cargando historial de visualización...");

      try {
        // Intentar cargar el historial
        const response = await axios.get(
          `${API_URL}/api/media/${videoId}/progress`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.position && videoRef.current) {
          // Si hay una posición guardada, adelantar el video a ese punto
          const savedPosition = response.data.position;
          console.log(
            `Posición guardada encontrada: ${savedPosition} segundos`
          );
          videoRef.current.currentTime = savedPosition;
        }
      } catch (progressError) {
        console.warn(
          "Error al cargar historial de visualización:",
          progressError
        );
        // No es un error crítico, continuamos con la reproducción

        // Usar la posición 0 como fallback
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
        }
      }
    } catch (err) {
      console.warn("Error general al cargar historial de visualización:", err);
      // No es un error crítico, continuamos con la reproducción
    }
  };

  // Guardar progreso de visualización
  const saveWatchProgress = async (timeInSeconds, isCompleted = false) => {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token || !videoId) return;

      console.log(
        `Guardando progreso: ${timeInSeconds}s, completado: ${isCompleted}`
      );

      await axios.post(
        `${API_URL}/api/streaming/${videoId}/progress`,
        {
          position: timeInSeconds,
          completed: isCompleted,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log("Progreso guardado correctamente");
    } catch (err) {
      console.warn("Error al guardar progreso de visualización:", err);
      // No interrumpir reproducción por errores al guardar progreso
    }
  };

  // Manejadores de eventos del reproductor
  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    setCurrentTime(video.currentTime);

    if (video.duration) {
      const calculatedProgress = (video.currentTime / video.duration) * 100;
      setProgress(calculatedProgress);

      // Actualizar progreso en el servidor cuando el progreso cambia significativamente
      const shouldUpdateProgress = Math.abs(calculatedProgress - progress) > 5;
      if (shouldUpdateProgress) {
        saveWatchProgress(video.currentTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;

    setDuration(videoRef.current.duration);
    console.log(`Video cargado, duración: ${videoRef.current.duration}s`);

    // Configurar intervalo para actualizar progreso periódicamente
    if (progressUpdateIntervalRef.current) {
      clearInterval(progressUpdateIntervalRef.current);
    }

    progressUpdateIntervalRef.current = setInterval(() => {
      if (videoRef.current && isPlaying) {
        saveWatchProgress(videoRef.current.currentTime);
      }
    }, 30000); // Actualizar cada 30 segundos
  };

  const handleEnded = () => {
    // Marcar como completado cuando termina el video
    saveWatchProgress(duration, true);
    setIsPlaying(false);
    console.log("Video finalizado");
  };

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

  const handleSeek = (e) => {
    if (!videoRef.current) return;

    const seekTime = (e.target.value / 100) * duration;
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      const playPromise = videoRef.current.play();

      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Error al reproducir video:", error);
          // Intentar reproducir después de interacción del usuario
          setError(
            "Error al reproducir. El navegador puede estar bloqueando la reproducción automática."
          );
        });
      }
    }
  };

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

  // Mostrar/ocultar controles con temporizador
  const showControlsTemporary = () => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Formatear tiempo (segundos a MM:SS)
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds) return "00:00";

    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Manejar error en la carga del video
  const handleVideoError = (e) => {
    const videoElement = e.target;
    const errorCode = videoElement.error ? videoElement.error.code : 0;
    const errorMessage = videoElement.error ? videoElement.error.message : "";

    console.error(
      `Error en el reproductor de video (${errorCode}): ${errorMessage}`,
      e
    );

    if (errorCode === 2) {
      // MEDIA_ERR_NETWORK
      setError("Error de red al cargar el video. Verifica tu conexión.");
    } else if (errorCode === 3) {
      // MEDIA_ERR_DECODE
      setError(
        "Error al decodificar el video. El formato podría no ser compatible."
      );
    } else if (errorCode === 4) {
      // MEDIA_ERR_SRC_NOT_SUPPORTED
      setError("Formato de video no soportado o error de autenticación.");
    } else {
      setError(
        "Error al cargar el video. Es posible que no tengas permisos o el archivo no esté disponible."
      );
    }

    // Intentar actualizar la URL con el token principal
    const token = localStorage.getItem("streamvio_token");
    if (token) {
      console.log("Intentando reconstruir URL de streaming debido a error...");
      const newStreamUrl =
        streamType === "hls" && hlsAvailable
          ? `${API_URL}/api/streaming/${videoId}/hls?auth=${token}`
          : `${API_URL}/api/streaming/${videoId}/stream?auth=${token}`;

      setStreamUrl(newStreamUrl);
    }
  };

  // Renderizado condicional para estado de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96 bg-gray-900 rounded-lg">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Renderizado condicional para estado de error
  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 rounded-lg p-8 text-center h-96 flex flex-col items-center justify-center">
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            // Intentar cargar de nuevo con un pequeño retraso
            setTimeout(() => {
              const token = localStorage.getItem("streamvio_token");
              // Reconstruir URL con token JWT
              const newStreamUrl =
                streamType === "hls" && hlsAvailable
                  ? `${API_URL}/api/streaming/${videoId}/hls?auth=${token}`
                  : `${API_URL}/api/streaming/${videoId}/stream?auth=${token}`;

              setStreamUrl(newStreamUrl);
              setLoading(false);
            }, 1000);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2"
        >
          Reintentar
        </button>
        <button
          onClick={() => window.location.reload()}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          Recargar página
        </button>
      </div>
    );
  }

  // Renderizado condicional si no hay video
  if (!video || !streamUrl) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center h-96 flex flex-col items-center justify-center">
        <p className="text-gray-400">
          No se ha podido cargar el contenido multimedia
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Renderizado del reproductor
  return (
    <div
      ref={playerRef}
      className="relative bg-black rounded-lg overflow-hidden w-full"
      onMouseMove={showControlsTemporary}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-auto"
        src={streamUrl}
        poster={
          video.thumbnail_url ||
          `${API_URL}/api/media/${videoId}/thumbnail?auth=${localStorage.getItem(
            "streamvio_token"
          )}`
        }
        controls={false}
        autoPlay={false}
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleVideoError}
      />

      {/* Controles personalizados */}
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
            value={progress}
            onChange={handleSeek}
            className="w-full h-1 bg-gray-600 rounded-full appearance-none cursor-pointer focus:outline-none"
            style={{
              backgroundImage: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progress}%, #4b5563 ${progress}%, #4b5563 100%)`,
            }}
          />
        </div>

        {/* Controles principales */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Botón de reproducción/pausa */}
            <button
              onClick={togglePlay}
              className="text-white focus:outline-none hover:text-blue-400 transition-colors"
              aria-label={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            {/* Control de volumen */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-white focus:outline-none hover:text-blue-400 transition-colors"
                aria-label={isMuted ? "Activar sonido" : "Silenciar"}
              >
                {isMuted ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071a1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243a1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer focus:outline-none"
                style={{
                  backgroundImage: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                    volume * 100
                  }%, #4b5563 ${volume * 100}%, #4b5563 100%)`,
                }}
              />
            </div>

            {/* Contador de tiempo */}
            <div className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Información de tipo de streaming (solo para usuarios avanzados) */}
          <div className="hidden md:flex items-center mr-4">
            <span className="text-xs text-gray-400 px-2 py-1 bg-gray-800 rounded">
              {streamType === "hls" ? "HLS Adaptativo" : "Directo"}
            </span>
          </div>

          {/* Botón de pantalla completa */}
          <button
            onClick={toggleFullscreen}
            className="text-white focus:outline-none hover:text-blue-400 transition-colors"
            aria-label={
              isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"
            }
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 4a1 1 0 00-1 1v4a1 1 0 01-2 0V5a3 3 0 013-3h4a1 1 0 010 2H5zm10 8a1 1 0 00-1 1v2a1 1 0 01-1 1H9a1 1 0 110-2h4V9a1 1 0 112 0v3zm-8-3a1 1 0 00-1-1H3a1 1 0 000 2h3v3a1 1 0 102 0v-4zm8-6a1 1 0 010 2h-3a1 1 0 100 2v3a1 1 0 11-2 0V7a1 1 0 011-1h4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Botón de reproducción central cuando está pausado */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 focus:outline-none"
          aria-label="Reproducir"
        >
          <div className="bg-blue-600 bg-opacity-90 rounded-full p-5 transform transition-transform hover:scale-110">
            <svg
              className="w-12 h-12 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </button>
      )}

      {/* Indicador de error de reproducción */}
      {error && !loading && (
        <div className="absolute bottom-16 left-0 right-0 bg-red-900 bg-opacity-80 text-white p-3 text-center">
          <p>{error}</p>
          <button
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            onClick={() => {
              setError(null);
              if (videoRef.current) {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                  playPromise.catch(() => {
                    console.log(
                      "Reproducción fallida después de intento de recuperación"
                    );
                  });
                }
              }
            }}
          >
            Intentar reproducir
          </button>
        </div>
      )}
    </div>
  );
}

export default ImprovedVideoPlayer;
