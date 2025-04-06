// clients/web/src/components/MediaViewer.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function MediaViewer({ mediaId }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamToken, setStreamToken] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [supportsHls, setSupportsHls] = useState(false);

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressUpdateIntervalRef = useRef(null);
  const tokenRenewalTimeoutRef = useRef(null);

  // Cargar información del medio y obtener el token de streaming
  useEffect(() => {
    const fetchMediaAndToken = async () => {
      if (!mediaId) return;

      try {
        setLoading(true);
        setError(null);

        // Obtener token de autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          throw new Error("No hay sesión activa");
        }

        // 1. Primero obtener información del medio
        const mediaResponse = await axios.get(
          `${API_URL}/api/media/${mediaId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setMedia(mediaResponse.data);

        // 2. Luego obtener token de streaming específico para este medio
        const streamResponse = await axios.get(
          `${API_URL}/api/streaming/token/${mediaId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        // Guardar el token de streaming
        setStreamToken(streamResponse.data.stream_token);

        // 3. Determinar si el navegador soporta HLS para streaming adaptativo
        const checkHlsSupport = () => {
          // Verificar si el navegador soporta HLS nativamente (Safari)
          if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
            return true;
          }

          // Para otros navegadores podemos usar HLS.js (habría que importarlo)
          // De momento simplemente verificamos si mediaSource está disponible
          return window.MediaSource !== undefined;
        };

        setSupportsHls(checkHlsSupport());

        // 4. Configurar la URL de streaming con el token
        updateStreamUrl(mediaResponse.data, streamResponse.data.stream_token);

        // 5. Configurar renovación automática del token antes de que expire
        setupTokenRenewal(streamResponse.data.expires_in);

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar medio o token:", err);
        setError(err.response?.data?.message || "Error al cargar el medio");
        setLoading(false);
      }
    };

    fetchMediaAndToken();

    // Limpieza al desmontar
    return () => {
      // Limpiar intervalos y timeouts
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
      }
      if (tokenRenewalTimeoutRef.current) {
        clearTimeout(tokenRenewalTimeoutRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [mediaId]);

  // Actualizar la URL de streaming basada en el token
  const updateStreamUrl = (mediaData, token) => {
    if (!mediaData || !token) return;

    let url;
    if (supportsHls && mediaData.has_hls) {
      // URL para streaming adaptativo HLS
      const fileName = mediaData.file_path
        .split(/[\/\\]/)
        .pop()
        .split(".")[0];
      url = `${API_URL}/api/streaming/media/${mediaId}?stream_token=${token}&type=hls`;
    } else {
      // URL para streaming directo
      url = `${API_URL}/api/streaming/media/${mediaId}?stream_token=${token}`;
    }

    setStreamUrl(url);
  };

  // Configurar renovación automática del token
  const setupTokenRenewal = (expiresInSeconds) => {
    // Si hay un timeout existente, limpiarlo
    if (tokenRenewalTimeoutRef.current) {
      clearTimeout(tokenRenewalTimeoutRef.current);
    }

    // Renovar el token 2 minutos antes de que expire
    const renewalTime = (expiresInSeconds - 120) * 1000;

    // Crear un nuevo timeout para renovar el token
    tokenRenewalTimeoutRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) return;

        // Obtener un nuevo token de streaming
        const response = await axios.get(
          `${API_URL}/api/streaming/token/${mediaId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        // Actualizar el token y la URL
        setStreamToken(response.data.stream_token);
        updateStreamUrl(media, response.data.stream_token);

        // Configurar la siguiente renovación
        setupTokenRenewal(response.data.expires_in);

        console.log("Token de streaming renovado automáticamente");
      } catch (err) {
        console.error("Error al renovar token de streaming:", err);
      }
    }, renewalTime);
  };

  // Manejar eventos del reproductor
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

      // Actualizar progreso en el servidor cada 10 segundos o cuando el progreso cambia significativamente
      const shouldUpdateProgress = Math.abs(calculatedProgress - progress) > 5;
      if (shouldUpdateProgress && streamToken) {
        updateProgressOnServer(calculatedProgress, video.currentTime);
      }
    }
  };

  // Actualizar progreso en el servidor
  const updateProgressOnServer = async (progressPercent, timeInSeconds) => {
    if (!streamToken || !mediaId) return;

    try {
      await axios.post(
        `${API_URL}/api/streaming/progress/${mediaId}`,
        {
          progress: progressPercent,
          currentTime: timeInSeconds,
        },
        {
          headers: {
            "x-stream-token": streamToken,
          },
        }
      );
    } catch (err) {
      console.warn("Error al actualizar progreso en el servidor:", err);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;

    setDuration(videoRef.current.duration);

    // Configurar intervalo para actualizar progreso periódicamente
    if (progressUpdateIntervalRef.current) {
      clearInterval(progressUpdateIntervalRef.current);
    }

    progressUpdateIntervalRef.current = setInterval(() => {
      if (videoRef.current && isPlaying) {
        updateProgressOnServer(progress, videoRef.current.currentTime);
      }
    }, 30000); // Actualizar cada 30 segundos
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
      videoRef.current.play();
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
    console.error("Error en el reproductor de video:", e);
    setError(
      "Error al cargar el video. Posible problema con el token de streaming o el archivo no está disponible."
    );
  };

  // Verificar token renovado en respuestas HTTP
  useEffect(() => {
    // Crear un interceptor para verificar headers en las respuestas
    const interceptor = axios.interceptors.response.use(
      (response) => {
        // Verificar si hay un nuevo token de streaming en la respuesta
        const newToken = response.headers["x-new-stream-token"];
        if (newToken && streamToken) {
          // Actualizar el token y la URL
          setStreamToken(newToken);
          updateStreamUrl(media, newToken);
          console.log("Token de streaming renovado desde respuesta HTTP");
        }
        return response;
      },
      (error) => {
        // Manejar error de token expirado
        if (
          error.response &&
          error.response.status === 401 &&
          error.response.data.code === "TOKEN_EXPIRED"
        ) {
          // Intentar obtener un nuevo token
          const refreshStreamToken = async () => {
            try {
              const token = localStorage.getItem("streamvio_token");
              if (!token) return;

              const response = await axios.get(
                `${API_URL}/api/streaming/token/${mediaId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );

              setStreamToken(response.data.stream_token);
              updateStreamUrl(media, response.data.stream_token);
              console.log("Token de streaming renovado tras error 401");

              // Recargar el video
              if (videoRef.current) {
                videoRef.current.load();
              }
            } catch (err) {
              console.error("Error al renovar token tras expiración:", err);
              setError(
                "El token de streaming ha expirado y no se pudo renovar. Intenta recargar la página."
              );
            }
          };

          refreshStreamToken();
        }
        return Promise.reject(error);
      }
    );

    // Limpiar interceptor al desmontar
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [streamToken, media, mediaId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96 bg-gray-900 rounded-lg">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 rounded-lg p-8 text-center">
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Recargar
        </button>
      </div>
    );
  }

  if (!media || !streamUrl) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">
          No se ha podido cargar el contenido multimedia
        </p>
      </div>
    );
  }

  return (
    <div
      ref={playerRef}
      className="relative bg-black rounded-lg overflow-hidden"
      onMouseMove={showControlsTemporary}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-auto"
        src={streamUrl}
        poster={media.thumbnail_url}
        controls={false}
        autoPlay={false}
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
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
            className="w-full h-1 bg-gray-600 rounded-full appearance-none cursor-pointer"
          />
        </div>

        {/* Controles principales */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Botón de reproducción/pausa */}
            <button onClick={togglePlay} className="text-white">
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
              <button onClick={toggleMute} className="text-white">
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
                      d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
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
                className="w-16 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer"
              />
            </div>

            {/* Contador de tiempo */}
            <div className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Botón de pantalla completa */}
          <button onClick={toggleFullscreen} className="text-white">
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

      {/* Indicador de carga de streaming */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Botón de reproducción central cuando está pausado */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30"
        >
          <div className="bg-blue-600 bg-opacity-90 rounded-full p-5">
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
    </div>
  );
}

export default MediaViewer;
