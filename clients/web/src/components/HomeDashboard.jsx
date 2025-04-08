// clients/web/src/components/HomeDashboard.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

// Modificado: importación condicional y manejo de casos donde useAuth no está disponible
let useAuth;
try {
  useAuth = require("../context/AuthContext").useAuth;
} catch (error) {
  console.warn("AuthContext not available:", error);
  // Implementamos un hook de reemplazo que devuelve un objeto vacío
  useAuth = () => ({ currentUser: null });
}

const API_URL = apiConfig.API_URL;

function HomeDashboard() {
  // Modificado: manejo seguro del hook useAuth
  const auth = useAuth ? useAuth() : { currentUser: null };
  const currentUser = auth?.currentUser || null;

  const [recentMedia, setRecentMedia] = useState([]);
  const [movieCount, setMovieCount] = useState(0);
  const [seriesCount, setSeriesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [watchHistory, setWatchHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Cargar conteo de medios y elementos recientes
  useEffect(() => {
    const fetchMediaCounts = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("streamvio_token");
        if (!token) return;

        // Obtener conteo de películas
        const moviesResponse = await axios.get(
          `${API_URL}/api/media?type=movie&limit=1`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (moviesResponse.data && moviesResponse.data.pagination) {
          setMovieCount(moviesResponse.data.pagination.total || 0);
        }

        // Obtener conteo de series
        const seriesResponse = await axios.get(
          `${API_URL}/api/media?type=series&limit=1`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (seriesResponse.data && seriesResponse.data.pagination) {
          setSeriesCount(seriesResponse.data.pagination.total || 0);
        }

        // Obtener elementos recientes
        const recentResponse = await axios.get(
          `${API_URL}/api/media?page=1&limit=10&sort=created_at&order=desc`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (recentResponse.data && recentResponse.data.items) {
          setRecentMedia(recentResponse.data.items || []);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar datos:", err);
        setError(
          "Error al cargar datos. Por favor, intenta de nuevo más tarde."
        );
        setLoading(false);
      }
    };

    // Modificado: añadir protección para carga de datos iniciales
    if (localStorage.getItem("streamvio_token")) {
      fetchMediaCounts();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  // Cargar historial de visualización
  useEffect(() => {
    const fetchWatchHistory = async () => {
      try {
        setHistoryLoading(true);
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          setHistoryLoading(false);
          return;
        }

        try {
          // Intentar primero con la ruta específica para historial
          const historyResponse = await axios.get(
            `${API_URL}/api/user/history?completed=false&limit=10`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (historyResponse.data) {
            setWatchHistory(historyResponse.data || []);
          }
        } catch (historyError) {
          console.warn("Error al cargar historial:", historyError);

          // Si la ruta /api/user/history falla, intentar construir un historial a partir de watch_history
          try {
            // Esta es una solución alternativa que intenta obtener los elementos vistos recientemente
            // sin usar una ruta específica para histórico
            const mediaItems = recentMedia.slice(0, 10);
            setWatchHistory(
              mediaItems.map((item) => ({
                id: item.id,
                mediaId: item.id,
                title: item.title,
                type: item.type,
                thumbnail_path: item.thumbnail_path,
                position: 0,
                completed: false,
                watched_at: item.updated_at || new Date().toISOString(),
              }))
            );
          } catch (alternativeError) {
            console.error(
              "Error al crear historial alternativo:",
              alternativeError
            );
            // Usar un historial vacío como último recurso
            setWatchHistory([]);
          }
        }

        setHistoryLoading(false);
      } catch (err) {
        console.error("Error al cargar historial:", err);
        setHistoryLoading(false);
        // No mostrar error para no afectar la experiencia del usuario
      }
    };

    if (recentMedia.length > 0 && localStorage.getItem("streamvio_token")) {
      fetchWatchHistory();
    } else {
      setHistoryLoading(false);
    }
  }, [currentUser, recentMedia]);

  // Formatear la fecha para mostrar
  const formatDate = (dateString) => {
    if (!dateString) return "Fecha desconocida";

    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Obtener URL de la miniatura
  const getThumbnailUrl = (item) => {
    if (!item) return "/assets/default-media.jpg";

    const token = localStorage.getItem("streamvio_token");
    if (!token) return "/assets/default-media.jpg";

    return `${API_URL}/api/media/${
      item.id || item.mediaId
    }/thumbnail?auth=${token}`;
  };

  // Modificado: Si no hay un usuario autenticado, mostrar mensaje de inicio de sesión
  if (!localStorage.getItem("streamvio_token")) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Bienvenido a StreamVio</h2>
        <p className="text-gray-300 mb-6">
          Inicia sesión para ver tu panel principal personalizado.
        </p>
        <a
          href="/auth"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg inline-block transition"
        >
          Iniciar Sesión
        </a>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Panel Principal</h2>

      {error && (
        <div className="bg-red-600 bg-opacity-75 text-white p-4 rounded mb-6">
          {error}
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="bg-blue-500 p-3 rounded-full mr-4">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm text-blue-300">Películas</h3>
              <p className="text-2xl font-bold text-white">
                {loading ? "-" : movieCount}
              </p>
            </div>
          </div>
          <a
            href="/media?type=movie"
            className="text-blue-200 hover:text-white text-sm block mt-2"
          >
            Ver todas las películas →
          </a>
        </div>

        <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="bg-purple-500 p-3 rounded-full mr-4">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm text-purple-300">Series</h3>
              <p className="text-2xl font-bold text-white">
                {loading ? "-" : seriesCount}
              </p>
            </div>
          </div>
          <a
            href="/media?type=series"
            className="text-purple-200 hover:text-white text-sm block mt-2"
          >
            Ver todas las series →
          </a>
        </div>

        <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="bg-green-500 p-3 rounded-full mr-4">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm text-green-300">Bibliotecas</h3>
              <p className="text-2xl font-bold text-white">
                {loading ? "-" : "Ver"}
              </p>
            </div>
          </div>
          <a
            href="/bibliotecas"
            className="text-green-200 hover:text-white text-sm block mt-2"
          >
            Administrar bibliotecas →
          </a>
        </div>
      </div>

      {/* Contenido reciente */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-4">Contenido Reciente</h3>
        {loading ? (
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Cargando contenido reciente...</p>
          </div>
        ) : recentMedia.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {recentMedia.slice(0, 10).map((item) => (
              <a
                key={item.id}
                href={`/media/${item.id}`}
                className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition duration-200 shadow-lg"
              >
                <div className="relative pb-[56.25%]">
                  <img
                    src={getThumbnailUrl(item)}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = "/assets/default-media.jpg";
                    }}
                  />
                  <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-xs text-white px-2 py-1 rounded">
                    {item.type === "movie" && "Película"}
                    {item.type === "series" && "Serie"}
                    {item.type === "episode" && "Episodio"}
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-medium text-sm truncate">{item.title}</h4>
                  <p className="text-gray-400 text-xs mt-1">
                    {formatDate(item.created_at)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <p className="text-gray-400">
              No hay contenido reciente para mostrar
            </p>
          </div>
        )}
      </div>

      {/* Continuar viendo */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Continuar Viendo</h3>
        {historyLoading ? (
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Cargando historial...</p>
          </div>
        ) : watchHistory.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {watchHistory.slice(0, 10).map((item) => (
              <a
                key={item.id || item.mediaId}
                href={`/media/${item.mediaId || item.id}`}
                className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition duration-200 shadow-lg"
              >
                <div className="relative pb-[56.25%]">
                  <img
                    src={getThumbnailUrl(item)}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = "/assets/default-media.jpg";
                    }}
                  />
                  {item.position > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${
                            item.duration
                              ? (item.position / item.duration) * 100
                              : 50
                          }%`,
                        }}
                      ></div>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h4 className="font-medium text-sm truncate">{item.title}</h4>
                  <p className="text-gray-400 text-xs mt-1">
                    {formatDate(item.watched_at)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <p className="text-gray-400">No hay elementos en el historial</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeDashboard;
