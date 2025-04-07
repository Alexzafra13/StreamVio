import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function MediaBrowser({ libraryId = null, type = null, searchTerm = null }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [sort, setSort] = useState("title");
  const [order, setOrder] = useState("asc");
  const [localSearch, setLocalSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    libraryId: libraryId,
    type: type,
    search: searchTerm || "",
  });

  const fetchMedia = async (page = 1) => {
    const controller = new AbortController();
    try {
      setLoading(true);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        setError("Debes iniciar sesión para acceder a esta función");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.append("page", page);
      params.append("limit", pagination.limit);
      params.append("sort", sort);
      params.append("order", order);

      if (activeFilters.libraryId)
        params.append("library_id", activeFilters.libraryId);
      if (activeFilters.type) params.append("type", activeFilters.type);
      if (activeFilters.search) params.append("search", activeFilters.search);

      console.log(
        "Solicitando medios:",
        `${API_URL}/api/media?${params.toString()}`
      );

      const response = await axios.get(
        `${API_URL}/api/media?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      console.log("Respuesta API de medios:", response.data);

      const responseData = response.data || {};
      // Asegurar que items es un array
      const items = Array.isArray(responseData.items) ? responseData.items : [];

      setMedia(items);

      if (responseData.pagination) {
        setPagination({
          ...pagination,
          page: responseData.pagination.page || 1,
          total: responseData.pagination.total || 0,
          totalPages: responseData.pagination.totalPages || 1,
        });
      } else {
        setPagination({
          ...pagination,
          page: 1,
          total: items.length,
          totalPages: 1,
        });
        console.warn(
          "La respuesta de la API no incluye información de paginación"
        );
      }

      setLoading(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Error al cargar medios:", err);
      setError(
        err.response?.data?.message ||
          "Error al cargar los elementos multimedia. Por favor, intenta de nuevo más tarde."
      );
      setMedia([]);
      setLoading(false);
    }

    return () => controller.abort();
  };

  useEffect(() => {
    setActiveFilters({
      libraryId: libraryId,
      type: type,
      search: searchTerm || "",
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [libraryId, type, searchTerm]);

  useEffect(() => {
    const cleanup = fetchMedia(pagination.page);
    return cleanup;
  }, [pagination.page, pagination.limit, sort, order, activeFilters]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveFilters((prev) => ({ ...prev, search: localSearch }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSortChange = (newSort) => {
    if (sort === newSort) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(newSort);
      setOrder("asc");
    }
  };

  const getThumbnail = (item) => {
    if (!item) return "/assets/default-media.jpg";
    const token = localStorage.getItem("streamvio_token");
    if (!token) return "/assets/default-media.jpg";
    const thumbnailUrl = `${API_URL}/api/media/${item.id}/thumbnail?auth=${token}`;
    const defaultThumbnails = {
      movie: "/assets/default-movie.jpg",
      series: "/assets/default-series.jpg",
      episode: "/assets/default-episode.jpg",
      music: "/assets/default-music.jpg",
      photo: "/assets/default-photo.jpg",
    };
    return item.thumbnail_path
      ? thumbnailUrl
      : defaultThumbnails[item.type] || "/assets/default-media.jpg";
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "Desconocida";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return "Desconocido";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
    if (i === 0) return `${bytes} ${sizes[i]}`;
    return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
  };

  // Asegurarnos de que media siempre es un array
  const safeMedia = Array.isArray(media) ? media : [];

  if (loading && pagination.page === 1) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-2xl font-semibold mb-4 md:mb-0">
          {activeFilters.type
            ? activeFilters.type.charAt(0).toUpperCase() +
              activeFilters.type.slice(1)
            : "Todos los medios"}
        </h2>
        <div className="w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="flex">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar..."
              className="bg-gray-700 text-white border border-gray-600 rounded-l p-2 focus:outline-none focus:border-blue-500 w-full"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r transition"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 rounded mb-6">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right"
            aria-label="Cerrar mensaje de error"
          >
            ×
          </button>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center flex-wrap">
        <div className="flex space-x-2 mb-2 md:mb-0">
          <button
            onClick={() => handleSortChange("title")}
            className={`px-3 py-1 rounded transition text-sm ${
              sort === "title"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Título {sort === "title" && (order === "asc" ? "↑" : "↓")}
          </button>
          <button
            onClick={() => handleSortChange("created_at")}
            className={`px-3 py-1 rounded transition text-sm ${
              sort === "created_at"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Fecha {sort === "created_at" && (order === "asc" ? "↑" : "↓")}
          </button>
          <button
            onClick={() => handleSortChange("duration")}
            className={`px-3 py-1 rounded transition text-sm ${
              sort === "duration"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Duración {sort === "duration" && (order === "asc" ? "↑" : "↓")}
          </button>
        </div>
        <div className="text-sm text-gray-400">
          {pagination.total} elementos encontrados
        </div>
      </div>

      {safeMedia.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">
            No se encontraron elementos multimedia.
          </p>
          {activeFilters.search && (
            <button
              onClick={() => {
                setActiveFilters((prev) => ({ ...prev, search: "" }));
                setLocalSearch("");
              }}
              className="text-blue-400 hover:text-blue-300 transition"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {safeMedia.map((item, index) => (
              <div
                key={item.id || `media-${index}`}
                className="bg-gray-800 rounded-lg overflow-hidden shadow-lg"
              >
                <div className="relative pb-[56.25%]">
                  <img
                    src={getThumbnail(item)}
                    alt={item.title || "Elemento multimedia"}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      if (e.target.src !== "/assets/default-media.jpg") {
                        e.target.src = "/assets/default-media.jpg";
                      }
                    }}
                  />
                  {item.type && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-xs text-white px-2 py-1 rounded">
                      {item.type === "movie" && "Película"}
                      {item.type === "series" && "Serie"}
                      {item.type === "episode" && "Episodio"}
                      {item.type === "music" && "Música"}
                      {item.type === "photo" && "Foto"}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3
                    className="text-lg font-semibold text-white truncate"
                    title={item.title}
                  >
                    {item.title || "Sin título"}
                  </h3>
                  {item.description && (
                    <p className="text-gray-400 mt-1 text-sm line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex justify-between text-gray-500 text-xs mt-2">
                    <span>
                      {item.duration
                        ? formatDuration(item.duration)
                        : item.size
                        ? formatSize(item.size)
                        : "N/A"}
                    </span>
                    {item.year && <span>{item.year}</span>}
                  </div>
                  <a
                    href={`/media/${item.id}`}
                    className="mt-3 inline-block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    {item.type === "movie" || item.type === "episode"
                      ? "Reproducir"
                      : item.type === "photo"
                      ? "Ver"
                      : "Escuchar"}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="flex space-x-2" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                  aria-label="Ir a la primera página"
                  className={`px-4 py-2 rounded-md ${
                    pagination.page === 1
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Primera
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  aria-label="Página anterior"
                  className={`px-4 py-2 rounded-md ${
                    pagination.page === 1
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Anterior
                </button>
                <div className="flex items-center px-4">
                  <span className="text-gray-300">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  aria-label="Página siguiente"
                  className={`px-4 py-2 rounded-md ${
                    pagination.page === pagination.totalPages
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Siguiente
                </button>
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages}
                  aria-label="Ir a la última página"
                  className={`px-4 py-2 rounded-md ${
                    pagination.page === pagination.totalPages
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Última
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MediaBrowser;
