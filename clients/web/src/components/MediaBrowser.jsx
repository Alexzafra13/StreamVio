// clients/web/src/components/MediaBrowser.jsx (versión optimizada)
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function MediaBrowser({ libraryId = null, type = null, searchTerm = null }) {
  // Estados
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [sort, setSort] = useState("title");
  const [order, setOrder] = useState("asc");
  const [localSearch, setLocalSearch] = useState(searchTerm || "");
  const [activeFilters, setActiveFilters] = useState({
    libraryId: libraryId,
    type: type,
    search: searchTerm || "",
  });

  // Función para obtener medios con mejor manejo de errores
  const fetchMedia = useCallback(
    async (page = 1) => {
      const controller = new AbortController();

      try {
        setLoading(true);
        setError(null);

        // Verificar autenticación
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          setError("Debes iniciar sesión para acceder a esta función");
          setLoading(false);
          return;
        }

        // Construir parámetros para la solicitud
        const params = new URLSearchParams();
        params.append("page", page);
        params.append("limit", pagination.limit);
        params.append("sort", sort);
        params.append("order", order);

        if (activeFilters.libraryId) {
          params.append("library_id", activeFilters.libraryId);
        }
        if (activeFilters.type) {
          params.append("type", activeFilters.type);
        }
        if (activeFilters.search) {
          params.append("search", activeFilters.search);
        }

        console.log(
          "Solicitando medios:",
          `${API_URL}/api/media?${params.toString()}`
        );

        // Realizar solicitud al servidor
        const response = await axios.get(
          `${API_URL}/api/media?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
            timeout: 10000, // 10 segundos de timeout
          }
        );

        // Procesar respuesta con validaciones
        const responseData = response.data || {};

        // Verificar si la respuesta es un array directo o tiene estructura con paginación
        if (!responseData.items && Array.isArray(responseData)) {
          setMedia(responseData);
          setPagination({
            ...pagination,
            page: page,
            total: responseData.length,
            totalPages: 1,
          });
        } else {
          const items = Array.isArray(responseData.items)
            ? responseData.items
            : [];
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
          }
        }

        setLoading(false);
      } catch (err) {
        if (err.name === "AbortError") return;

        console.error("Error al cargar medios:", err);

        // Intentar extraer detalles del error
        if (err.response) {
          setError(
            err.response.data?.message ||
              `Error al cargar los elementos multimedia (${err.response.status})`
          );
        } else if (err.request) {
          // Error de red o solicitud sin respuesta
          setError(
            "Error de conexión. Verifica tu red o el estado del servidor."
          );
        } else {
          setError(err.message || "Error al cargar los elementos multimedia");
        }

        setMedia([]);
        setLoading(false);
      }

      return () => controller.abort();
    },
    [pagination.limit, sort, order, activeFilters]
  );

  // Actualizar filtros cuando cambian las props
  useEffect(() => {
    setActiveFilters({
      libraryId: libraryId,
      type: type,
      search: searchTerm || "",
    });
    setLocalSearch(searchTerm || "");
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [libraryId, type, searchTerm]);

  // Cargar medios cuando cambian los filtros o la paginación
  useEffect(() => {
    const cleanup = fetchMedia(pagination.page);
    return cleanup;
  }, [fetchMedia, pagination.page]);

  // Manejar cambio de página
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
      // Scroll al inicio de los resultados
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Manejar envío del formulario de búsqueda
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveFilters((prev) => ({ ...prev, search: localSearch }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Manejar cambios en el orden
  const handleSortChange = (newSort) => {
    if (sort === newSort) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(newSort);
      setOrder("asc");
    }
  };

  // Obtener URL de la miniatura con manejo de errores
  const getThumbnail = (item) => {
    if (!item || !item.id) return "/assets/default-media.jpg";

    const token = localStorage.getItem("streamvio_token");
    if (!token) return "/assets/default-media.jpg";

    // Si la API devuelve una URL de miniatura completa, usarla
    if (item.thumbnail_url) return item.thumbnail_url;

    const thumbnailUrl = `${API_URL}/api/media/${item.id}/thumbnail?auth=${token}`;

    // Usar miniaturas predeterminadas según el tipo de medio
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

  // Formatear duración para mostrar
  const formatDuration = (seconds) => {
    if (!seconds) return "Desconocida";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Formatear tamaño para mostrar
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

  // Mostrar pantalla de carga en la primera carga
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
            ? activeFilters.type === "movie"
              ? "Películas"
              : activeFilters.type === "series"
              ? "Series"
              : activeFilters.type === "music"
              ? "Música"
              : activeFilters.type.charAt(0).toUpperCase() +
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

      {/* Manejo de errores */}
      {error && (
        <div className="bg-red-600 bg-opacity-75 text-white p-4 rounded mb-6 flex justify-between items-start">
          <div>
            <p className="font-semibold">{error}</p>
            <p className="text-sm mt-1">
              Prueba a recargar la página o verificar tu conexión.
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-white"
            aria-label="Cerrar mensaje de error"
          >
            ×
          </button>
        </div>
      )}

      {/* Botones de filtro y ordenación */}
      <div className="mb-4 flex justify-between items-center flex-wrap">
        <div className="flex flex-wrap gap-2 mb-2 md:mb-0">
          <button
            onClick={() => handleSortChange("title")}
            className={`px-3 py-1 rounded transition text-sm ${
              sort === "title"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            aria-label="Ordenar por título"
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
            aria-label="Ordenar por fecha"
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
            aria-label="Ordenar por duración"
          >
            Duración {sort === "duration" && (order === "asc" ? "↑" : "↓")}
          </button>
        </div>
        <div className="text-sm text-gray-400">
          {pagination.total} elementos encontrados
        </div>
      </div>

      {/* Mensaje cuando no hay resultados */}
      {safeMedia.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-gray-500 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
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
            <div className="mt-4 text-sm text-gray-500">
              {!loading && (
                <button
                  onClick={() => fetchMedia(1)}
                  className="underline hover:text-blue-400"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Grid de tarjetas de medios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {safeMedia.map((item, index) => (
              <div
                key={item.id || `media-${index}`}
                className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-102"
              >
                <div className="relative pb-[56.25%] group">
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
                  {/* Overlay al pasar el ratón */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100">
                    <a
                      href={`/media/${item.id}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full transition transform hover:scale-105"
                    >
                      {item.type === "movie" || item.type === "episode"
                        ? "Reproducir"
                        : item.type === "photo"
                        ? "Ver"
                        : "Escuchar"}
                    </a>
                  </div>
                  {/* Etiqueta de tipo */}
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
                    className="text-lg font-semibold text-white truncate group-hover:text-blue-400"
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

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="flex flex-wrap gap-2" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1 || loading}
                  aria-label="Ir a la primera página"
                  className={`px-3 py-2 rounded-md ${
                    pagination.page === 1 || loading
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Primera
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1 || loading}
                  aria-label="Página anterior"
                  className={`px-3 py-2 rounded-md ${
                    pagination.page === 1 || loading
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Anterior
                </button>

                {/* Páginas numeradas */}
                <div className="hidden sm:flex space-x-1">
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        // Si hay 5 o menos páginas, mostrar todas
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        // Si estamos en las primeras 3 páginas
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        // Si estamos en las últimas 3 páginas
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        // Estamos en medio, mostrar la página actual en el centro
                        pageNum = pagination.page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                          className={`px-3 py-2 rounded-md ${
                            pagination.page === pageNum
                              ? "bg-blue-700 text-white"
                              : "bg-gray-700 text-white hover:bg-gray-600"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Indicador móvil */}
                <div className="flex items-center px-3 py-2 sm:hidden bg-gray-700 rounded-md">
                  <span className="text-gray-300">
                    {pagination.page} de {pagination.totalPages}
                  </span>
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={
                    pagination.page === pagination.totalPages || loading
                  }
                  aria-label="Página siguiente"
                  className={`px-3 py-2 rounded-md ${
                    pagination.page === pagination.totalPages || loading
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Siguiente
                </button>
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={
                    pagination.page === pagination.totalPages || loading
                  }
                  aria-label="Ir a la última página"
                  className={`px-3 py-2 rounded-md ${
                    pagination.page === pagination.totalPages || loading
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Última
                </button>
              </nav>
            </div>
          )}

          {/* Indicador de carga cuando no es la primera página */}
          {loading && pagination.page !== 1 && (
            <div className="flex justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
        </>
      )}

      {/* Botón para recargar si hay error */}
      {error && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchMedia(pagination.page)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}

export default MediaBrowser;
