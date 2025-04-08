// clients/web/src/components/HomeDashboard.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import appConfig from "../config/config";

const API_URL = apiConfig.API_URL;

/**
 * Panel de inicio personalizado con secciones de contenido
 */
function HomeDashboard() {
  const [recentMedia, setRecentMedia] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Cargar datos del usuario y contenido al iniciar
  useEffect(() => {
    const fetchUserAndContent = async () => {
      try {
        setLoading(true);

        // Verificar autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          setLoading(false);
          return;
        }

        // Obtener datos del usuario desde localStorage
        const userStr = localStorage.getItem("streamvio_user");
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            setUser(userData);
          } catch (error) {
            console.error("Error al parsear datos de usuario:", error);
          }
        }

        // Cargar medios recientes
        const recentResponse = await axios.get(
          `${API_URL}/api/media?page=1&limit=10&sort=created_at&order=desc`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const recentData = recentResponse.data;
        if (recentData.items && Array.isArray(recentData.items)) {
          setRecentMedia(recentData.items);
        } else if (Array.isArray(recentData)) {
          setRecentMedia(recentData);
        }

        // Cargar películas
        const moviesResponse = await axios.get(
          `${API_URL}/api/media?page=1&limit=10&type=movie`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const moviesData = moviesResponse.data;
        if (moviesData.items && Array.isArray(moviesData.items)) {
          setMovies(moviesData.items);
        } else if (Array.isArray(moviesData)) {
          setMovies(moviesData);
        }

        // Cargar series
        const seriesResponse = await axios.get(
          `${API_URL}/api/media?page=1&limit=10&type=series`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const seriesData = seriesResponse.data;
        if (seriesData.items && Array.isArray(seriesData.items)) {
          setSeries(seriesData.items);
        } else if (Array.isArray(seriesData)) {
          setSeries(seriesData);
        }

        // Cargar contenido "continuar viendo" (media en progreso)
        try {
          const historyResponse = await axios.get(
            `${API_URL}/api/user/history?completed=false&limit=10`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (historyResponse.data.items) {
            setContinueWatching(historyResponse.data.items);
          }
        } catch (historyError) {
          console.warn("Error al cargar historial:", historyError);
          // No es un error crítico, podemos continuar sin el historial
        }

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar contenido del dashboard:", err);
        setError(
          "Error al cargar el contenido. Por favor, inténtalo de nuevo más tarde."
        );
        setLoading(false);
      }
    };

    fetchUserAndContent();
  }, []);

  // Obtener URL de la miniatura
  const getThumbnail = (item) => {
    if (!item || !item.id) return appConfig.defaultImages.generic;

    const token = localStorage.getItem("streamvio_token");
    if (!token) return appConfig.defaultImages.generic;

    // Si la API devuelve una URL de miniatura completa, usarla
    if (item.thumbnail_url) return item.thumbnail_url;

    const thumbnailUrl = `${API_URL}/api/media/${item.id}/thumbnail?auth=${token}`;

    return item.thumbnail_path
      ? thumbnailUrl
      : appConfig.getDefaultImage(item.type);
  };

  // Formatear duración para mostrar
  const formatDuration = (seconds) => {
    return appConfig.formatDuration(seconds);
  };

  // Renderizar un carrusel de medios
  const renderMediaRow = (title, items, emptyMessage) => {
    const safeItems = Array.isArray(items) ? items : [];

    if (safeItems.length === 0) {
      return null; // No mostrar secciones vacías
    }

    return (
      <div className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <a
            href={`/media?type=${safeItems[0]?.type || ""}`}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Ver todo &rarr;
          </a>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="flex space-x-4" style={{ minWidth: "max-content" }}>
            {safeItems.map((item) => (
              <div
                key={item.id}
                className="w-48 flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <a href={`/media/${item.id}`} className="block">
                  <div className="relative pb-[56.25%]">
                    <img
                      src={getThumbnail(item)}
                      alt={item.title || "Contenido"}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = appConfig.defaultImages.generic;
                      }}
                    />
                    {/* Información sobre tipo */}
                    {item.type && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-xs text-white px-2 py-1 rounded">
                        {item.type === "movie" && "Película"}
                        {item.type === "series" && "Serie"}
                        {item.type === "episode" && "Episodio"}
                        {item.type === "music" && "Música"}
                      </div>
                    )}

                    {/* Para "Continuar viendo", mostrar barra de progreso */}
                    {item.progress > 0 && item.progress < 100 && (
                      <div className="absolute bottom-0 left-0 right-0">
                        <div className="h-1 bg-gray-800">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h3
                      className="text-white font-medium truncate hover:text-blue-400 transition-colors"
                      title={item.title}
                    >
                      {item.title || "Sin título"}
                    </h3>

                    <div className="flex justify-between text-gray-500 text-xs mt-1">
                      <span>
                        {item.duration ? formatDuration(item.duration) : ""}
                      </span>
                      {item.year && <span>{item.year}</span>}
                    </div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Estado de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Mensaje de error
  if (error) {
    return (
      <div className="bg-red-600 bg-opacity-25 text-white p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-2">Error</h3>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Saludo personalizado según la hora del día
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Banner de bienvenida */}
      {user && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-800 rounded-lg p-6 mb-8 shadow-lg">
          <h1 className="text-2xl font-bold mb-2">
            {getGreeting()}, {user.username}
          </h1>
          <p className="text-gray-300">¿Qué te gustaría ver hoy?</p>
        </div>
      )}

      {/* Sección "Continuar viendo" si hay contenido */}
      {continueWatching.length > 0 &&
        renderMediaRow(
          "Continuar viendo",
          continueWatching,
          "No hay contenido en progreso"
        )}

      {/* Películas recientes */}
      {renderMediaRow("Películas", movies, "No hay películas disponibles")}

      {/* Series recientes */}
      {renderMediaRow("Series", series, "No hay series disponibles")}

      {/* Contenido reciente (todo mezclado) */}
      {renderMediaRow(
        "Añadido recientemente",
        recentMedia,
        "No hay contenido reciente"
      )}

      {/* Si no hay contenido, mostrar mensaje para agregar bibliotecas */}
      {recentMedia.length === 0 &&
        movies.length === 0 &&
        series.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="mb-4 text-6xl">📺</div>
            <h2 className="text-xl font-semibold mb-3">
              Aquí no hay nada que ver aún
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Parece que todavía no tienes ningún contenido en tu biblioteca.
              Configura tu primera biblioteca para empezar a disfrutar de tu
              contenido multimedia.
            </p>
            <a
              href="/bibliotecas"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg inline-block transition"
            >
              Configurar biblioteca
            </a>
          </div>
        )}
    </div>
  );
}

export default HomeDashboard;
