import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function ImprovedLibrariesManager() {
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
  const [directoryBrowser, setDirectoryBrowser] = useState({
    visible: false,
    currentPath: "",
    contents: [],
    loading: false,
  });
  const [showPermissionCheck, setShowPermissionCheck] = useState(false);
  const [permissionsFixed, setPermissionsFixed] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

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
      setDirectoryBrowser({
        ...directoryBrowser,
        visible: false,
      });
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
    setDirectoryBrowser({
      ...directoryBrowser,
      visible: false,
    });
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
      }, 3000);
    } catch (err) {
      console.error("Error al iniciar escaneo:", err);
      setError(err.response?.data?.message || "Error al iniciar el escaneo");
      setScanningLibraries(scanningLibraries.filter((libId) => libId !== id));
    }
  };

  // Explorar directorio
  const browseDirectory = async (path = null) => {
    try {
      setDirectoryBrowser({
        ...directoryBrowser,
        loading: true,
      });

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
        contents: response.data.contents || [],
        loading: false,
      });

      // Si cambiamos de directorio, verificar permisos
      if (path !== directoryBrowser.currentPath) {
        checkPermissions(response.data.path);
      }
    } catch (err) {
      console.error("Error al explorar directorio:", err);
      setDirectoryBrowser({
        ...directoryBrowser,
        loading: false,
        error: err.response?.data?.message || "Error al explorar el directorio",
      });
      setError(
        err.response?.data?.message || "Error al explorar el directorio"
      );
    }
  };

  // Verificar permisos de carpeta
  const checkPermissions = async (folderPath) => {
    if (!folderPath) return;

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) throw new Error("No hay sesión activa");

      const response = await axios.post(
        `${API_URL}/api/filesystem/check-permissions`,
        { path: folderPath },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Si tiene permisos, actualizar estado
      if (response.data.hasAccess) {
        setPermissionsFixed(true);
        setShowPermissionCheck(true);
      } else {
        setPermissionsFixed(false);
        setShowPermissionCheck(true);
      }

      return response.data;
    } catch (err) {
      console.error("Error al verificar permisos:", err);
      setShowPermissionCheck(true);
      setPermissionsFixed(false);
      return {
        hasAccess: false,
        message: err.response?.data?.message || "Error al verificar permisos",
      };
    }
  };

  // Crear nueva carpeta en el directorio actual
  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Debes ingresar un nombre para la carpeta");
      return;
    }

    try {
      setCreatingFolder(true);

      const token = localStorage.getItem("streamvio_token");
      if (!token) throw new Error("No hay sesión activa");

      // Construir ruta de la nueva carpeta
      const folderPath = directoryBrowser.currentPath
        ? `${directoryBrowser.currentPath}/${newFolderName}`.replace(
            /\/\//g,
            "/"
          )
        : newFolderName;

      await axios.post(
        `${API_URL}/api/filesystem/create-directory`,
        { path: folderPath },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Actualizar directorio actual
      await browseDirectory(directoryBrowser.currentPath);

      // Resetear estado
      setNewFolderName("");
      setShowNewFolderInput(false);
      setCreatingFolder(false);

      // Verificar permisos de la nueva carpeta
      checkPermissions(folderPath);
    } catch (err) {
      console.error("Error al crear carpeta:", err);
      setError(err.response?.data?.message || "Error al crear la carpeta");
      setCreatingFolder(false);
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
    checkPermissions(path);
  };

  // Ir al directorio padre
  const navigateToParent = () => {
    if (directoryBrowser.currentPath) {
      const parentPath = directoryBrowser.currentPath
        .split("/")
        .slice(0, -1)
        .join("/");

      browseDirectory(parentPath || "/");
    }
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
  };

  // Manejar cuando los permisos se han arreglado
  const handlePermissionsFixed = (result) => {
    if (result && result.success) {
      setPermissionsFixed(true);
      // Mostrar mensaje de éxito temporal
      setError(null);
    }
  };

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
            setDirectoryBrowser({
              ...directoryBrowser,
              visible: true,
            });
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

      {/* Formulario de biblioteca */}
      {(directoryBrowser.visible || showPermissionCheck) && (
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
                    onClick={() =>
                      setDirectoryBrowser({
                        ...directoryBrowser,
                        visible: true,
                        currentPath: formData.path || "",
                      })
                    }
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
              <div className="mt-4 bg-gray-700 p-4 rounded">
                <h4 className="font-medium mb-2">Verificación de permisos</h4>

                {permissionsFixed ? (
                  <div className="flex items-center text-green-400">
                    <svg
                      className="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p>La carpeta tiene los permisos correctos</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center text-red-400 mb-3">
                      <svg
                        className="h-5 w-5 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <p>
                        Es posible que el servicio no tenga permiso para esta
                        carpeta
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        // Reparar permisos
                        try {
                          const token = localStorage.getItem("streamvio_token");
                          if (!token) throw new Error("No hay sesión activa");

                          axios
                            .post(
                              `${API_URL}/api/filesystem/fix-permissions`,
                              { path: formData.path },
                              {
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                },
                              }
                            )
                            .then((response) => {
                              if (response.data.success) {
                                setPermissionsFixed(true);
                              } else {
                                setError(
                                  "No se pudieron reparar los permisos automáticamente. " +
                                    (response.data.message || "")
                                );
                              }
                            })
                            .catch((err) => {
                              setError(
                                err.response?.data?.message ||
                                  "Error al reparar permisos"
                              );
                            });
                        } catch (err) {
                          setError("Error al reparar permisos: " + err.message);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Reparar permisos automáticamente
                    </button>
                  </div>
                )}
              </div>
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

          {/* Navegador de directorios */}
          {directoryBrowser.visible && (
            <div className="mt-6 bg-gray-900 p-4 rounded-lg border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold flex items-center">
                  <span className="mr-2">Explorar:</span>
                  <span className="font-mono text-sm bg-gray-800 px-2 py-1 rounded">
                    {directoryBrowser.currentPath || "/"}
                  </span>
                </h4>
                <div className="flex items-center">
                  {showNewFolderInput ? (
                    <div className="flex items-center mr-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Nombre de carpeta"
                        className="bg-gray-800 text-white border border-gray-600 rounded-l p-1 text-sm"
                      />
                      <button
                        onClick={createFolder}
                        disabled={creatingFolder || !newFolderName.trim()}
                        className={`bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-r text-sm ${
                          creatingFolder || !newFolderName.trim()
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {creatingFolder ? "..." : "Crear"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewFolderInput(true)}
                      className="mr-2 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm"
                      title="Crear carpeta"
                    >
                      Nueva carpeta
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setDirectoryBrowser({
                        ...directoryBrowser,
                        visible: false,
                      })
                    }
                    className="text-gray-400 hover:text-white"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Botón para subir un nivel */}
              {directoryBrowser.currentPath && (
                <button
                  onClick={navigateToParent}
                  className="bg-gray-700 text-gray-300 hover:bg-gray-600 px-3 py-1 rounded mb-3 text-sm flex items-center"
                >
                  <svg
                    className="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Subir un nivel
                </button>
              )}

              {directoryBrowser.loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {directoryBrowser.contents &&
                  directoryBrowser.contents.length > 0 ? (
                    directoryBrowser.contents.map((item, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded ${
                          item.isDirectory
                            ? "bg-blue-800 hover:bg-blue-700 cursor-pointer"
                            : "bg-gray-700 opacity-50"
                        } text-sm flex items-center`}
                        onClick={() => {
                          if (item.isDirectory) {
                            browseDirectory(item.path);
                          }
                        }}
                        onDoubleClick={() => {
                          if (item.isDirectory) {
                            selectDirectory(item.path);
                          }
                        }}
                      >
                        {item.isDirectory ? (
                          <svg
                            className="h-5 w-5 text-yellow-400 mr-2"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z"
                              clipRule="evenodd"
                            />
                            <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5 text-gray-400 mr-2"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        <span className="truncate">{item.name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-4 text-gray-400">
                      Directorio vacío
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-4">
                <button
                  onClick={() =>
                    setDirectoryBrowser({ ...directoryBrowser, visible: false })
                  }
                  className="text-gray-400 hover:text-white px-3 py-1 rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => selectDirectory(directoryBrowser.currentPath)}
                  disabled={!directoryBrowser.currentPath}
                  className={`bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded ${
                    !directoryBrowser.currentPath
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  Seleccionar esta carpeta
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {libraries.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No hay bibliotecas configuradas.</p>
          <button
            onClick={() =>
              setDirectoryBrowser({
                visible: true,
                currentPath: "",
                contents: [],
                loading: false,
              })
            }
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
