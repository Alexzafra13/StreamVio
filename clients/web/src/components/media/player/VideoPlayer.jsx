import React, { useState, useEffect, useRef } from "react";
import Hls from "hls.js"; // Asegúrate de instalar: npm install hls.js

/**
 * Componente de reproductor de video compatible con HLS y streaming directo
 * Se integra con el sistema de streaming del backend de StreamVio
 *
 * @param {Object} props
 * @param {string} props.src - URL del video (HLS o directo)
 * @param {string} [props.type='application/x-mpegURL'] - Tipo MIME del video
 * @param {string} [props.poster] - URL de la imagen de poster
 * @param {function} [props.onTimeUpdate] - Callback cuando cambia el tiempo de reproducción
 * @param {function} [props.onEnded] - Callback cuando termina el video
 * @param {number} [props.startTime=0] - Tiempo de inicio en segundos
 * @param {boolean} [props.autoplay=false] - Si el video debe reproducirse automáticamente
 */
const VideoPlayer = ({
  src,
  type = "application/x-mpegURL",
  poster,
  onTimeUpdate,
  onEnded,
  startTime = 0,
  autoplay = false,
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(null);

  const hideControlsTimeout = useRef(null);
  const hls = useRef(null);

  // Configurar el reproductor de video cuando cambia la URL
  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) return;

    // Limpiar cualquier instancia previa de HLS
    if (hls.current) {
      hls.current.destroy();
      hls.current = null;
    }

    // Configurar para HLS (m3u8)
    if (type === "application/x-mpegURL" || src.includes(".m3u8")) {
      if (Hls.isSupported()) {
        hls.current = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startPosition: startTime || -1,
        });

        hls.current.loadSource(src);
        hls.current.attachMedia(video);
        hls.current.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoplay) {
            video
              .play()
              .catch((err) => console.error("Error al reproducir:", err));
          }
        });

        hls.current.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("Error de red en HLS:", data);
                hls.current.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("Error de medio en HLS:", data);
                hls.current.recoverMediaError();
                break;
              default:
                console.error("Error fatal en HLS:", data);
                setError("Error al cargar el video");
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari soporta HLS nativamente
        video.src = src;
        video.currentTime = startTime;
        if (autoplay) {
          video
            .play()
            .catch((err) => console.error("Error al reproducir:", err));
        }
      } else {
        setError("Tu navegador no soporta streaming HLS");
      }
    } else {
      // Video normal (no HLS)
      video.src = src;
      video.currentTime = startTime;
      if (autoplay) {
        video.play().catch((err) => console.error("Error al reproducir:", err));
      }
    }

    // Limpieza al desmontar
    return () => {
      if (hls.current) {
        hls.current.destroy();
      }

      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [src, type, autoplay, startTime]);

  // Manejar eventos de reproducción
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const events = {
      // Actualizar tiempo actual
      timeupdate: () => {
        setCurrentTime(video.currentTime);
        if (onTimeUpdate) {
          onTimeUpdate(video.currentTime, video.duration);
        }
      },
      // Actualizar duración cuando esté disponible
      loadedmetadata: () => {
        setDuration(video.duration);
      },
      // Detectar pausa/reproducción
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      // Cuando termina el video
      ended: () => {
        setIsPlaying(false);
        if (onEnded) onEnded();
      },
      // Estados de buffering
      waiting: () => setIsBuffering(true),
      playing: () => setIsBuffering(false),
      // Errores
      error: () => {
        console.error("Error en el elemento de video:", video.error);
        setError("Error al reproducir el video");
      },
    };

    // Adjuntar todos los event listeners
    Object.entries(events).forEach(([event, handler]) => {
      video.addEventListener(event, handler);
    });

    // Eliminar listeners al desmontar
    return () => {
      if (video) {
        Object.entries(events).forEach(([event, handler]) => {
          video.removeEventListener(event, handler);
        });
      }
    };
  }, [onTimeUpdate, onEnded]);

  // Manejar eventos de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, []);

  // Ocultar controles después de inactividad
  const resetHideControlsTimer = () => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }

    setShowControls(true);

    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Controles de reproducción
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => console.error("Error al reproducir:", err));
    }

    resetHideControlsTimer();
  };

  // Control de volumen
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);

    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
    }

    resetHideControlsTimer();
  };

  // Control de seekbar
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);

    const video = videoRef.current;
    if (video) {
      video.currentTime = newTime;
    }

    resetHideControlsTimer();
  };

  // Pantalla completa
  const toggleFullscreen = () => {
    const playerContainer = document.getElementById("player-container");

    if (!playerContainer) return;

    if (!isFullscreen) {
      if (playerContainer.requestFullscreen) {
        playerContainer.requestFullscreen();
      } else if (playerContainer.webkitRequestFullscreen) {
        playerContainer.webkitRequestFullscreen();
      } else if (playerContainer.mozRequestFullScreen) {
        playerContainer.mozRequestFullScreen();
      } else if (playerContainer.msRequestFullscreen) {
        playerContainer.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }

    resetHideControlsTimer();
  };

  // Formatear tiempo (segundos -> MM:SS)
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "00:00";

    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      id="player-container"
      className="relative w-full bg-black"
      onMouseMove={resetHideControlsTimer}
      onClick={togglePlay}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        playsInline
      />

      {/* Overlay para errores o buffering */}
      {(error || isBuffering) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 text-white">
          {error ? (
            <div className="text-center">
              <div className="text-red-500 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto"
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
              </div>
              <p>{error}</p>
            </div>
          ) : (
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          )}
        </div>
      )}

      {/* Controles */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de progreso */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full cursor-pointer appearance-none h-1 bg-gray-700 rounded-full outline-none mb-4"
          style={{
            backgroundImage: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
              (currentTime / (duration || 1)) * 100
            }%, #4b5563 ${
              (currentTime / (duration || 1)) * 100
            }%, #4b5563 100%)`,
          }}
        />

        {/* Botones de control y tiempo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Botón play/pause */}
            <button className="text-white" onClick={togglePlay}>
              {isPlaying ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </button>

            {/* Contador de tiempo */}
            <div className="text-white text-sm">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Control de volumen */}
            <div className="flex items-center space-x-1">
              <button
                className="text-white"
                onClick={() => setVolume(volume > 0 ? 0 : 1)}
              >
                {volume === 0 ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      clipRule="evenodd"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
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
                className="w-16 cursor-pointer appearance-none h-1 bg-gray-700 rounded-full outline-none"
                style={{
                  backgroundImage: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                    volume * 100
                  }%, #4b5563 ${volume * 100}%, #4b5563 100%)`,
                }}
              />
            </div>
          </div>

          {/* Botón de pantalla completa */}
          <button className="text-white" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
