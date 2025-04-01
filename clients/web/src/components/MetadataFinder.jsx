// clients/web/src/components/MetadataFinder.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function MetadataFinder({ mediaId, mediaType, mediaTitle, onMetadataApplied }) {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [year, setYear] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);

  // Cargar título inicial como término de búsqueda
  useEffect(() => {
    if (mediaTitle) {
      // Limpiar el término de búsqueda (quitar año si está entre paréntesis)
      const cleanTitle = mediaTitle.replace(/\(\d{4}\)$/, "").trim();
      setSearchTerm(cleanTitle);

      // Intentar extraer año
      const yearMatch = mediaTitle.match(/\((\d{4})\)$/);
      if (yearMatch && yearMatch[1]) {
        setYear(yearMatch[1]);
      }
    }
  }, [mediaTitle]);

  // Realizar búsqueda
  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchTerm.trim()) {
      setError("Ingresa un término de búsqueda");
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Construir URL de búsqueda
      let url = `${API_URL}/api/metadata/search?title=${encodeURIComponent(
        searchTerm
      )}&type=${mediaType || "movie"}`;

      if (year) {
        url += `&year=${year}`;
      }

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSearchResults(response.data);

      if (response.data.length === 0) {
        setError(
          "No se encontraron resultados. Intenta con otro término de búsqueda."
        );
      }
    } catch (err) {
      console.error("Error en búsqueda:", err);
      setError(err.response?.data?.message || "Error al realizar la búsqueda");
    } finally {
      setSearching(false);
    }
  };

  // Aplicar metadatos
  const applyMetadata = async (resultId) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      await axios.post(
        `${API_URL}/api/metadata/enrich/${mediaId}`,
        {
          tmdbId: resultId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Notificar que se aplicaron metadatos correctamente
      if (onMetadataApplied) {
        onMetadataApplied();
      }

      setLoading(false);
    } catch (err) {
      console.error("Error al aplicar metadatos:", err);
      setError(err.response?.data?.message || "Error al aplicar metadatos");
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4">Buscar Metadatos</h3>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <label htmlFor="searchTerm" className="block text-gray-300 mb-2">
              Título
            </label>
            <input
              type="text"
              id="searchTerm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2"
              placeholder="Buscar película..."
            />
          </div>

          <div className="w-full md:w-24">
            <label htmlFor="year" className="block text-gray-300 mb-2">
              Año
            </label>
            <input
              type="text"
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2"
              placeholder="Año"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={searching}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${
                searching ? "opacity-50 cursor-wait" : ""
              }`}
            >
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>
      </form>

      {searchResults.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Resultados de la búsqueda</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className={`bg-gray-700 rounded-lg overflow-hidden cursor-pointer transition ${
                  selectedResult === result.id ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => setSelectedResult(result.id)}
              >
                {result.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${result.poster_path}`}
                    alt={result.title}
                    className="w-full object-cover h-40"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-800 flex items-center justify-center">
                    <span className="text-gray-500">Sin imagen</span>
                  </div>
                )}

                <div className="p-3">
                  <h5 className="font-semibold">{result.title}</h5>
                  <p className="text-sm text-gray-400">
                    {result.release_date
                      ? result.release_date.substring(0, 4)
                      : "Sin fecha"}
                  </p>
                  {selectedResult === result.id && (
                    <button
                      onClick={() => applyMetadata(result.id)}
                      disabled={loading}
                      className={`mt-2 w-full bg-green-600 hover:bg-green-700 text-white py-1 rounded text-sm ${
                        loading ? "opacity-50 cursor-wait" : ""
                      }`}
                    >
                      {loading ? "Aplicando..." : "Aplicar metadatos"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MetadataFinder;
