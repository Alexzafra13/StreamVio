import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import EnhancedDirectoryBrowser from "./EnhancedDirectoryBrowser";
import FolderPermissionsManager from "./FolderPermissionsManager";

const API_URL = apiConfig.API_URL;

function ImprovedLibraryManager() {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    path: "",
    type: "movies",
    scan_automatically: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [scanningLibraries, setScanningLibraries] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [showBrowser, setShowBrowser] = useState(false);
  const [showPermissionCheck, setShowPermissionCheck] = useState(false);
  const [addingLibrary, setAddingLibrary] = useState(false);
  const [showFormAfterSelect, setShowFormAfterSelect] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Iconos para los tipos de biblioteca
  const libraryTypeIcons = {
    movies: (
      <svg
        className="h-8 w-8 text-blue-500"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v14h14V5H5zm4 2h6v6H9V7zm8 0h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zM9 15h6v2H9v-2zM5 7h2v2H5V7zm0 4h2v2H5v-2zm0 4h2v2H5v-2z" />
      </svg>
    ),
    series: (
      <svg
        className="h-8 w-8 text-purple-500"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M2 4h2v16H2V4zm4 0h2v16H6V4zm3 0h2v16H9V4zm10.276 5.293l-2.538 2.54L19.277 7.3a1 1 0 0 0-1.418-1.418l-3.54 3.536a1 1 0 0 0 0 1.414l3.536 3.539a1 1 0 0 0 1.42-1.414l-2.54-2.541 2.54-2.541a1 1 0 0 0-1.414-1.414zM21 4h1v16h-1V4z" />
      </svg>
    ),
    music: (
      <svg
        className="h-8 w-8 text-green-500"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    ),
    photos: (
      <svg
        className="h-8 w-8 text-yellow-500"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2zm0 2v14h14V5H5zm8.5 10.5l-3-3-3 3.5V7h10v7h-4v1.5zM11 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
      </svg>
    ),
  };

  // Cargar bibliotecas al iniciar
  useEffect(() => {
    fetchLibraries();
  }, []);

  // Función para cargar bibliotecas
  const fetchLibraries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        setError("Debes iniciar sesión para acceder a esta función");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/api/libraries`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setLibraries(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Error al cargar bibliotecas:", err);
      setError(
        err.response?.data?.message || "Error al cargar las bibliotecas"
      );
      setLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });

    // Limpiar error del campo
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null,
      });
    }
  };

  // Manejar selección del tipo de biblioteca
  const handleTypeSelect = (type) => {
    setFormData({
      ...formData,
      type,
    });
  };

  // Validar formulario
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "El nombre es obligatorio";
    }

    if (!formData.path.trim()) {
      errors.path = "La ruta es obligatoria";
    }

    if (!["movies", "series", "music", "photos"].includes(formData.type)) {
      errors.type = "Tipo de biblioteca no válido";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Guardar biblioteca
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setAddingLibrary(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        setError("Debes iniciar sesión para realizar esta acción");
        return;
      }

      if (editingId) {
        // Actualizar biblioteca existente
        await axios.put(`${API_URL}/api/libraries/${editingId}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Actualizar lista local
        setLibraries(
          libraries.map((lib) =>
            lib.id === editingId ? { ...lib, ...formData } : lib
          )
        );

        setSuccessMessage("¡Biblioteca actualizada correctamente!");
      } else {
        // Crear nueva biblioteca
        const response = await axios.post(
          `${API_URL}/api/libraries`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Añadir a la lista local
        setLibraries([...libraries, response.data.library]);

        setSuccessMessage("¡Nueva biblioteca creada correctamente!");
      }

      // Resetear formulario
      resetForm();

      // Mostrar mensaje de éxito temporal
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Error al guardar biblioteca:", err);
      setError(err.response?.data?.message || "Error al guardar la biblioteca");
    } finally {
      setAddingLibrary(false);
    }
  };

  // Iniciar edición
  const handleEdit = (library) => {
    setFormData({
      name: library.name,
      path: library.path,
      type: library.type,
      scan_automatically: !!library.scan_automatically,
    });
    setEditingId(library.id);
    setShowFormAfterSelect(true);
  };

  // Eliminar biblioteca
  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "¿Estás seguro de que deseas eliminar esta biblioteca? Esta acción es irreversible."
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("streamvio_token");

      await axios.delete(`${API_URL}/api/libraries/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Eliminar de la lista local
      setLibraries(libraries.filter((lib) => lib.id !== id));

      setSuccessMessage("Biblioteca eliminada correctamente");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Error al eliminar biblioteca:", err);
      setError(
        err.response?.data?.message || "Error al eliminar la biblioteca"
      );
    }
  };

  // Iniciar escaneo
  const handleScan = async (id) => {
    if (scanningLibraries.includes(id)) {
      return; // Ya se está escaneando
    }

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Marcar como escaneando
      setScanningLibraries([...scanningLibraries, id]);

      await axios.post(
        `${API_URL}/api/libraries/${id}/scan`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Programar una actualización después de un tiempo
      setTimeout(() => {
        fetchLibraries();
        setScanningLibraries(scanningLibraries.filter((libId) => libId !== id));
        setSuccessMessage("Escaneo completado");
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
      }, 3000);
    } catch (err) {
      console.error("Error al iniciar escaneo:", err);
      setError(err.response?.data?.message || "Error al iniciar el escaneo");
      setScanningLibraries(scanningLibraries.filter((libId) => libId !== id));
    }
  };

  // Función para manejar la selección de una carpeta del navegador
  const handleDirectorySelect = (path) => {
    setFormData({
      ...formData,
      path,
    });
    setShowBrowser(false);

    // Después de seleccionar la carpeta, mostrar el formulario completo
    setShowFormAfterSelect(true);

    // Verificar permisos de la carpeta
    setShowPermissionCheck(true);
  };

  // Cancelar navegación
  const handleBrowserCancel = () => {
    setShowBrowser(false);
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      name: "",
      path: "",
      type: "movies",
      scan_automatically: true,
    });
    setEditingId(null);
    setFormErrors({});
    setShowBrowser(false);
    setShowPermissionCheck(false);
    setShowFormAfterSelect(false);
  };

  // Manejar el evento cuando se arreglan los permisos de una carpeta
  const handlePermissionFixed = () => {
    // Actualizar estado después de arreglar permisos
    setSuccessMessage("Permisos de carpeta configurados correctamente");
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  // Renderizar selector de tipo de biblioteca visual
  const renderTypeSelector = () => (
    <div className="mb-6">
      <label className="block text-gray-300 mb-2 font-medium">
        Tipo de Biblioteca
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(libraryTypeIcons).map(([type, icon]) => (
          <div
            key={type}
            onClick={() => handleTypeSelect(type)}
            className={`flex flex-col items-center p-3 rounded-lg cursor-pointer border-2 transition-colors ${
              formData.type === type
                ? "border-blue-500 bg-blue-900 bg-opacity-30"
                : "border-gray-700 hover:border-gray-500 bg-gray-800"
            }`}
          >
            {icon}
            <span className="mt-2 capitalize">
              {type === "movies"
                ? "Películas"
                : type === "series"
                ? "Series"
                : type === "music"
                ? "Música"
                : "Fotos"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading && libraries.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Cargando bibliotecas...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Bibliotecas de medios</h2>
        <button
          onClick={() => {
            resetForm();
            setShowBrowser(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          Añadir biblioteca
        </button>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 rounded mb-6">
          {error}
          <button onClick={() => setError(null)} className="float-right">
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-600 text-white p-4 rounded mb-6 flex justify-between items-center">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-white font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Navegador de directorios */}
      {showBrowser && (
        <div className="mb-6">
          <EnhancedDirectoryBrowser
            initialPath={formData.path}
            onSelect={handleDirectorySelect}
            onCancel={handleBrowserCancel}
          />
        </div>
      )}

      {/* Formulario para añadir/editar biblioteca */}
      {showFormAfterSelect && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">
            {editingId ? "Editar biblioteca" : "Añadir nueva biblioteca"}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Nombre</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full bg-gray-700 text-white border ${
                  formErrors.name ? "border-red-500" : "border-gray-600"
                } rounded p-3 focus:outline-none focus:border-blue-500`}
              />
              {formErrors.name && (
                <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Ruta</label>
              <div className="flex">
                <input
                  type="text"
                  name="path"
                  value={formData.path}
                  onChange={handleInputChange}
                  readOnly
                  className={`w-full bg-gray-700 text-white border ${
                    formErrors.path ? "border-red-500" : "border-gray-600"
                  } rounded-l p-3 focus:outline-none focus:border-blue-500`}
                />
                <button
                  type="button"
                  onClick={() => setShowBrowser(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-r"
                >
                  Explorar
                </button>
              </div>
              {formErrors.path && (
                <p className="text-red-500 text-sm mt-1">{formErrors.path}</p>
              )}
            </div>

            {/* Selector visual de tipo de biblioteca */}
            {renderTypeSelector()}

            <div className="flex items-center mb-6">
              <input
                type="checkbox"
                id="scan_automatically"
                name="scan_automatically"
                checked={formData.scan_automatically}
                onChange={handleInputChange}
                className="h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="scan_automatically"
                className="ml-2 text-gray-300"
              >
                Escanear automáticamente
              </label>
            </div>

            {/* Componente de verificación de permisos */}
            {showPermissionCheck && formData.path && (
              <div className="mb-6">
                <FolderPermissionsManager
                  folderPath={formData.path}
                  onPermissionsFixed={handlePermissionFixed}
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={addingLibrary}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition ${
                  addingLibrary ? "opacity-70 cursor-wait" : ""
                }`}
              >
                {addingLibrary
                  ? editingId
                    ? "Actualizando..."
                    : "Creando..."
                  : editingId
                  ? "Actualizar"
                  : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de bibliotecas */}
      {libraries.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-400 mb-4">No hay bibliotecas configuradas.</p>
          <button
            onClick={() => setShowBrowser(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            Añadir tu primera biblioteca
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {libraries.map((library) => (
            <div
              key={library.id}
              className="bg-gray-800 rounded-lg overflow-hidden shadow-lg"
            >
              <div className="p-6">
                <div className="flex items-start">
                  <div className="mr-4">{libraryTypeIcons[library.type]}</div>
                  <div className="flex-grow">
                    <h3 className="text-xl font-semibold">{library.name}</h3>
                    <p className="text-gray-400 mt-1 break-all">
                      {library.path}
                    </p>
                    <div className="mt-2 flex items-center flex-wrap">
                      <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded mr-2 mb-1">
                        {library.type === "movies" && "Películas"}
                        {library.type === "series" && "Series"}
                        {library.type === "music" && "Música"}
                        {library.type === "photos" && "Fotos"}
                      </span>
                      <span className="text-gray-400 text-sm mb-1">
                        {library.itemCount || 0} elementos
                      </span>
                      {library.scan_automatically && (
                        <span className="bg-green-900 text-green-200 text-xs px-2 py-1 rounded ml-2 mb-1">
                          Escaneo automático
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-2">
                    <button
                      onClick={() => handleScan(library.id)}
                      disabled={scanningLibraries.includes(library.id)}
                      className={`flex items-center ${
                        scanningLibraries.includes(library.id)
                          ? "bg-green-800 cursor-wait"
                          : "bg-green-600 hover:bg-green-700"
                      } text-white px-3 py-1 rounded transition text-sm whitespace-nowrap`}
                    >
                      {scanningLibraries.includes(library.id) ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Escaneando...
                        </>
                      ) : (
                        "Escanear ahora"
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(library)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded transition text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(library.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>

              {/* Sección para mostrar acciones adicionales */}
              <div className="border-t border-gray-700 px-6 py-4">
                <div className="flex justify-between items-center">
                  <a
                    href={`/media?library=${library.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Ver contenido
                  </a>

                  <button
                    onClick={() => {
                      setFormData({
                        ...formData,
                        path: library.path,
                      });
                      setShowPermissionCheck(true);
                      setShowFormAfterSelect(true);
                    }}
                    className="text-sm text-gray-400 hover:text-blue-400"
                  >
                    Verificar permisos de carpeta
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImprovedLibraryManager;
