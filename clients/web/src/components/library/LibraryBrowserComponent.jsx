import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { UIContext } from "../../context/UIContext.jsx";
import libraryService from "../../services/libraryService.js";

/**
 * Componente para explorar y gestionar bibliotecas
 */
const LibraryBrowserComponent = () => {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showError, showSuccess } = useContext(UIContext);

  // Cargar bibliotecas al montar el componente
  useEffect(() => {
    const fetchLibraries = async () => {
      try {
        setLoading(true);
        const data = await libraryService.getAllLibraries();
        setLibraries(data);
      } catch (error) {
        console.error("Error al cargar bibliotecas:", error);
        showError("No se pudieron cargar las bibliotecas");
      } finally {
        setLoading(false);
      }
    };

    fetchLibraries();
  }, [showError]);

  // Iniciar escaneo de una biblioteca
  const handleScan = async (libraryId) => {
    try {
      await libraryService.scanLibrary(libraryId);
      showSuccess("Escaneo iniciado correctamente");
    } catch (error) {
      console.error("Error al iniciar escaneo:", error);
      showError("No se pudo iniciar el escaneo");
    }
  };

  // Renderizado de estado de carga
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <Card>
              <div className="h-8 bg-background-dark rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-background-dark rounded w-1/2 mb-6"></div>
              <div className="h-6 bg-background-dark rounded w-1/3"></div>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  // Renderizado cuando no hay bibliotecas
  if (libraries.length === 0) {
    return (
      <Card>
        <div className="text-center py-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto text-text-secondary mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
            />
          </svg>
          <h3 className="text-xl font-bold mb-2">No hay bibliotecas</h3>
          <p className="text-text-secondary mb-6">
            No se encontraron bibliotecas. Crea una para comenzar a organizar tu
            contenido multimedia.
          </p>
          <Button as={Link} to="/libraries/new" variant="primary">
            Crear biblioteca
          </Button>
        </div>
      </Card>
    );
  }

  // Íconos para los diferentes tipos de bibliotecas
  const getLibraryIcon = (type) => {
    switch (type) {
      case "movies":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-primary"
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
        );
      case "series":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-secondary"
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
        );
      case "music":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        );
      case "photos":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        );
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
        );
    }
  };

  // Traducir el tipo de biblioteca a español
  const getLibraryTypeText = (type) => {
    const types = {
      movies: "Películas",
      series: "Series",
      music: "Música",
      photos: "Fotos",
    };
    return types[type] || "Desconocido";
  };

  return (
    <div className="space-y-6">
      {/* Cabecera con botón para añadir biblioteca */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Bibliotecas</h1>
        <Button as={Link} to="/libraries/new" variant="primary">
          Añadir biblioteca
        </Button>
      </div>

      {/* Listado de bibliotecas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {libraries.map((library) => (
          <Card key={library.id} isHoverable>
            <div className="flex items-start">
              {/* Ícono del tipo de biblioteca */}
              <div className="mr-4">{getLibraryIcon(library.type)}</div>

              {/* Información de la biblioteca */}
              <div className="flex-1">
                <h3 className="text-lg font-bold">{library.name}</h3>
                <p className="text-text-secondary text-sm mb-2">
                  {getLibraryTypeText(library.type)}
                </p>
                <p
                  className="text-text-secondary text-sm truncate"
                  title={library.path}
                >
                  {library.path}
                </p>

                {/* Contador de elementos si está disponible */}
                {library.itemCount !== undefined && (
                  <p className="text-text-secondary text-sm mt-2">
                    {library.itemCount} elementos
                  </p>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="mt-4 pt-4 border-t border-gray-700 flex space-x-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleScan(library.id)}
              >
                Escanear
              </Button>
              <Button
                as={Link}
                to={`/libraries/${library.id}`}
                variant="primary"
                size="sm"
              >
                Ver
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LibraryBrowserComponent;