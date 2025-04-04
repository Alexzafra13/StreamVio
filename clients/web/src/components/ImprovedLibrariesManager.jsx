import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import FolderPermissionsManager from "./FolderPermissionsManager";

const API_URL = apiConfig.API_URL;

function ImprovedLibrariesManager() {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    path: "",
    type: "movies",
    scan_automatically: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [scanningLibraries, setScanningLibraries] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [directoryBrowser, setDirectoryBrowser] = useState({
    visible: false,
    currentPath: "",
    contents: [],
    loading: false,
  });
  const [showPermissionCheck, setShowPermissionCheck] = useState(false);
  const [permissionsFixed, setPermissionsFixed] = useState(false);

  // Cargar bibliotecas
  const fetchLibraries = async () => {
    try {
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

  useEffect(() => {
    fetchLibraries();
  }, []);

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

    // Si se cambia la ruta, mostrar el componente de verificación de permisos
    if (name === "path" && value) {
      setShowPermissionCheck(true);
      setPermissionsFixed(false); // Reiniciar estado de permisos
    }
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
      }

      // Resetear formulario y cerrar
      resetForm();
      setFormVisible(false);
    } catch (err) {
      console.error("Error al guardar biblioteca:", err);
      setError(err.response?.data?.message || "Error al guardar la biblioteca");
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
    setFormVisible(true);
    // Ocultar validación de permisos para edición
    setShowPermissionCheck(false);
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
      }, 3000);
    } catch (err) {
      console.error("Error al iniciar escaneo:", err);
      setError(err.response?.data?.message || "Error al iniciar el escaneo");
      setScanningLibraries(scanningLibraries.filter((libId) => libId !== id));
    }
  };

  // Explorar directorio
  const browseDirectory = async (path = null) => {
    setDirectoryBrowser({
      ...directoryBrowser,
      loading: true,
    });

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("Se requiere autenticación");
      }

      // Construir URL de la API
      let apiUrl = `${API_URL}/api/filesystem/browse`;
      if (path) {
        apiUrl += `?path=${encodeURIComponent(path)}`;
      }

      // Realizar solicitud
      const response = await axios.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setDirectoryBrowser({
        visible: true,
        currentPath: response.data.path,
        contents: response.data.contents,
        loading: false,
      });
    } catch (err) {
      console.error("Error al explorar directorio:", err);
      setDirectoryBrowser({
        ...directoryBrowser,
        loading: false,
      });
      setError(
        err.response?.data?.message || "Error al explorar el directorio"
      );
    }
  };

  // Seleccionar un directorio
  const selectDirectory = (path) => {
    setFormData({
      ...formData,
      path,
    });
    setDirectoryBrowser({
      ...directoryBrowser,
      visible: false,
    });

    // Mostrar comprobación de permisos al seleccionar un directorio
    setShowPermissionCheck(true);
    setPermissionsFixed(false);
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
    setDirectoryBrowser({
      visible: false,
      currentPath: "",
      contents: [],
      loading: false,
    });
    setShowPermissionCheck(false);
    setPermissionsFixed(false);
  };

  // Cancelar edición/creación
  const handleCancel = () => {
    resetForm();
    setFormVisible(false);
  };

  // Manejar cuando los permisos se han arreglado
  const handlePermissionsFixed = (result) => {
    if (result && result.success) {
      setPermissionsFixed(true);
      // Mostrar mensaje de éxito temporal
      setError(null);
      // Opcional: mostrar mensaje de éxito
    }
  };

  if (loading) {
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
            setFormVisible(true);
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

      {formVisible && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">
            {editingId ? "Editar biblioteca" : "Añadir nueva biblioteca"}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
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

              <div>
                <label className="block text-gray-300 mb-2">Ruta</label>
                <div className="flex">
                  <input
                    type="text"
                    name="path"
                    value={formData.path}
                    onChange={handleInputChange}
                    placeholder="/ruta/a/los/archivos"
                    className={`w-full bg-gray-700 text-white border ${
                      formErrors.path ? "border-red-500" : "border-gray-600"
                    } rounded-l p-3 focus:outline-none focus:border-blue-500`}
                  />
                  <button
                    type="button"
                    onClick={() => browseDirectory()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-r"
                  >
                    Explorar
                  </button>
                </div>
                {formErrors.path && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.path}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Tipo</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
                >
                  <option value="movies">Películas</option>
                  <option value="series">Series</option>
                  <option value="music">Música</option>
                  <option value="photos">Fotos</option>
                </select>
              </div>

              <div className="flex items-center">
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
            </div>

            {/* Componente de verificación de permisos */}
            {showPermissionCheck && formData.path && (
              <FolderPermissionsManager
                folderPath={formData.path}
                onPermissionsFixed={handlePermissionsFixed}
              />
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
              >
                {editingId ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </form>

          {/* Explorador de directorios */}
          {directoryBrowser.visible && (
            <div className="mt-6 bg-gray-900 p-4 rounded-lg border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold">
                  Explorar: {directoryBrowser.currentPath}
                </h4>
                <button
                  onClick={() =>
                    setDirectoryBrowser({ ...directoryBrowser, visible: false })
                  }
                  className="text-gray-400 hover:text-white"
                >
                  &times;
                </button>
              </div>

              {directoryBrowser.loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  {/* Botón para subir un nivel */}
                  {directoryBrowser.currentPath &&
                    directoryBrowser.currentPath !== "/" && (
                      <button
                        onClick={() => {
                          const parentPath = directoryBrowser.currentPath
                            .split("/")
                            .slice(0, -1)
                            .join("/");
                          browseDirectory(parentPath || "/");
                        }}
                        className="bg-gray-700 text-gray-300 hover:bg-gray-600 px-3 py-1 rounded mb-3 text-sm flex items-center"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                        Subir un nivel
                      </button>
                    )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {directoryBrowser.contents.length > 0 ? (
                      directoryBrowser.contents.map((item) => (
                        <div
                          key={item.path}
                          className={`p-2 rounded ${
                            item.isDirectory
                              ? "bg-blue-800 hover:bg-blue-700 cursor-pointer"
                              : "bg-gray-700"
                          } text-sm`}
                          onClick={() => {
                            if (item.isDirectory) {
                              browseDirectory(item.path);
                            }
                          }}
                        >
                          <div className="flex items-center">
                            <span className="mr-2">
                              {item.isDirectory ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5 text-yellow-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5 text-gray-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                  />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{item.name}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 col-span-3 py-4 text-center">
                        Directorio vacío
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between mt-4">
                    <button
                      onClick={() =>
                        setDirectoryBrowser({
                          ...directoryBrowser,
                          visible: false,
                        })
                      }
                      className="text-gray-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() =>
                        selectDirectory(directoryBrowser.currentPath)
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                    >
                      Seleccionar esta carpeta
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {libraries.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No hay bibliotecas configuradas.</p>
          <button
            onClick={() => setFormVisible(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            Añadir tu primera biblioteca
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {libraries.map((library) => (
            <div
              key={library.id}
              className="bg-gray-800 rounded-lg overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold">{library.name}</h3>
                    <p className="text-gray-400 mt-1">{library.path}</p>
                    <div className="mt-2 flex items-center">
                      <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded">
                        {library.type === "movies" && "Películas"}
                        {library.type === "series" && "Series"}
                        {library.type === "music" && "Música"}
                        {library.type === "photos" && "Fotos"}
                      </span>
                      <span className="text-gray-400 text-sm ml-4">
                        {library.itemCount || 0} elementos
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleScan(library.id)}
                      disabled={scanningLibraries.includes(library.id)}
                      className={`flex items-center ${
                        scanningLibraries.includes(library.id)
                          ? "bg-green-800 cursor-wait"
                          : "bg-green-600 hover:bg-green-700"
                      } text-white px-3 py-1 rounded transition text-sm`}
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

              {/* Sección para mostrar contenido de la biblioteca */}
              <div className="border-t border-gray-700 px-6 py-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Elementos recientes</h4>
                  <a
                    href={`/media?library=${library.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Ver todos
                  </a>
                </div>

                <div className="overflow-x-auto pb-2 mt-2 -mx-2 px-2">
                  <div className="flex space-x-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-32 flex-shrink-0">
                        <div className="bg-gray-700 h-20 rounded-lg animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botón para verificar permisos de la biblioteca */}
              <div className="border-t border-gray-700 px-6 py-4">
                <button
                  onClick={() => {
                    setFormData({
                      ...formData,
                      path: library.path,
                    });
                    setShowPermissionCheck(true);
                    setFormVisible(true);
                    setEditingId(library.id);
                  }}
                  className="text-sm text-gray-400 hover:text-blue-400"
                >
                  Verificar permisos de carpeta
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImprovedLibrariesManager;
