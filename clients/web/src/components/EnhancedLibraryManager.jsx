import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import FolderPermissionsManager from "./FolderPermissionsManager";

const API_URL = apiConfig.API_URL;

function EnhancedLibraryManager() {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newLibrary, setNewLibrary] = useState({
    name: "",
    path: "",
    type: "movies",
    scan_automatically: true,
  });
  const [currentDirectory, setCurrentDirectory] = useState("");
  const [directoryContents, setDirectoryContents] = useState([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [directoryHistory, setDirectoryHistory] = useState([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderError, setCreateFolderError] = useState(null);
  const [showPermissionCheck, setShowPermissionCheck] = useState(false);
  const [selectedPathForPermissions, setSelectedPathForPermissions] =
    useState("");

  // Cargar bibliotecas al montar el componente
  useEffect(() => {
    fetchLibraries();
  }, []);

  // Función para cargar bibliotecas
  const fetchLibraries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
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
      setError(err.response?.data?.message || "Error al cargar bibliotecas");
      setLoading(false);
    }
  };

  // Abrir navegador de archivos
  const openFileBrowser = async (initialPath = "") => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Si no hay ruta inicial, obtener unidades/raíces
      if (!initialPath) {
        const response = await axios.get(`${API_URL}/api/filesystem/roots`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setDirectoryContents(response.data);
        setCurrentDirectory("");
        setDirectoryHistory([]);
      } else {
        // Explorar directorio específico
        const response = await axios.get(
          `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
            initialPath
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setDirectoryContents(response.data.contents || []);
        setCurrentDirectory(response.data.path);
        if (!directoryHistory.includes(response.data.path)) {
          setDirectoryHistory([...directoryHistory, response.data.path]);
        }
      }

      setShowBrowser(true);
      setLoading(false);
    } catch (err) {
      console.error("Error al explorar directorio:", err);
      setError(err.response?.data?.message || "Error al explorar directorio");
      setLoading(false);
    }
  };

  // Navegar a un directorio
  const navigateToDirectory = (path) => {
    openFileBrowser(path);
  };

  // Seleccionar un directorio
  const selectDirectory = (path) => {
    setNewLibrary({ ...newLibrary, path });
    setShowBrowser(false);
  };

  // Navegar hacia atrás en el historial
  const goBack = () => {
    if (directoryHistory.length > 1) {
      const newHistory = [...directoryHistory];
      newHistory.pop(); // Eliminar el directorio actual
      const previousDirectory = newHistory[newHistory.length - 1];
      setDirectoryHistory(newHistory);
      openFileBrowser(previousDirectory);
    } else {
      // Si no hay historial, volver a las raíces
      openFileBrowser("");
    }
  };

  // Manejar cambios en el formulario de nueva biblioteca
  const handleNewLibraryChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewLibrary({
      ...newLibrary,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Crear nueva biblioteca
  const createLibrary = async (e) => {
    e.preventDefault();

    if (!newLibrary.name || !newLibrary.path) {
      setError("Nombre y ruta son obligatorios");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      await axios.post(`${API_URL}/api/libraries`, newLibrary, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Actualizar lista de bibliotecas
      fetchLibraries();

      // Limpiar formulario
      setNewLibrary({
        name: "",
        path: "",
        type: "movies",
        scan_automatically: true,
      });

      setLoading(false);
    } catch (err) {
      console.error("Error al crear biblioteca:", err);
      setError(err.response?.data?.message || "Error al crear biblioteca");
      setLoading(false);
    }
  };

  // Eliminar biblioteca
  const deleteLibrary = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta biblioteca?")) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      await axios.delete(`${API_URL}/api/libraries/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Actualizar lista de bibliotecas
      fetchLibraries();
    } catch (err) {
      console.error("Error al eliminar biblioteca:", err);
      setError(err.response?.data?.message || "Error al eliminar biblioteca");
      setLoading(false);
    }
  };

  // Función para crear una nueva carpeta
  const createFolder = async () => {
    if (!newFolderName) {
      setCreateFolderError("Debes especificar un nombre para la carpeta");
      return;
    }

    if (!currentDirectory) {
      setCreateFolderError("Debes seleccionar un directorio primero");
      return;
    }

    setCreateFolderError(null);

    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const folderPath = `${currentDirectory}/${newFolderName}`.replace(
        /\/\//g,
        "/"
      );

      await axios.post(
        `${API_URL}/api/filesystem/create-directory`,
        { path: folderPath },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Refrescar el directorio actual
      openFileBrowser(currentDirectory);
      setNewFolderName("");
      setShowCreateFolder(false);
    } catch (err) {
      console.error("Error al crear carpeta:", err);
      setCreateFolderError(
        err.response?.data?.message || "Error al crear carpeta"
      );
      setLoading(false);
    }
  };

  // Verificar permisos de una carpeta
  const checkPermissions = (path) => {
    setSelectedPathForPermissions(path);
    setShowPermissionCheck(true);
  };

  // Manejar cuando se reparan los permisos
  const handlePermissionsFixed = (result) => {
    if (result && result.success) {
      // Recargar el directorio actual para mostrar los cambios
      openFileBrowser(currentDirectory);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Gestión de Bibliotecas</h2>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Formulario para crear biblioteca */}
      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <h3 className="text-xl font-semibold mb-4">Añadir Nueva Biblioteca</h3>
        <form onSubmit={createLibrary}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="name" className="block text-gray-300 mb-1">
                Nombre
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={newLibrary.name}
                onChange={handleNewLibraryChange}
                className="w-full bg-gray-600 text-white border border-gray-500 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-gray-300 mb-1">
                Tipo
              </label>
              <select
                id="type"
                name="type"
                value={newLibrary.type}
                onChange={handleNewLibraryChange}
                className="w-full bg-gray-600 text-white border border-gray-500 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="movies">Películas</option>
                <option value="series">Series</option>
                <option value="music">Música</option>
                <option value="photos">Fotos</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="path" className="block text-gray-300 mb-1">
              Ubicación
            </label>
            <div className="flex items-center">
              <input
                type="text"
                id="path"
                name="path"
                value={newLibrary.path}
                onChange={handleNewLibraryChange}
                className="flex-grow bg-gray-600 text-white border border-gray-500 rounded-l p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                readOnly
              />
              <button
                type="button"
                onClick={() => openFileBrowser(newLibrary.path || "")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r"
              >
                Explorar
              </button>
            </div>
          </div>

          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="scan_automatically"
              name="scan_automatically"
              checked={newLibrary.scan_automatically}
              onChange={handleNewLibraryChange}
              className="mr-2"
            />
            <label htmlFor="scan_automatically" className="text-gray-300">
              Escanear automáticamente
            </label>
          </div>

          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            {loading ? "Guardando..." : "Crear Biblioteca"}
          </button>
        </form>
      </div>

      {/* Lista de bibliotecas */}
      <h3 className="text-xl font-semibold mb-4">Mis Bibliotecas</h3>
      {libraries.length === 0 ? (
        <div className="bg-gray-700 rounded-lg p-6 text-center">
          <p className="text-gray-400">
            No hay bibliotecas configuradas. Añade una nueva biblioteca para
            empezar.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-700 rounded-lg">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Ubicación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {libraries.map((library) => (
                <tr key={library.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {library.name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {library.type === "movies"
                      ? "Películas"
                      : library.type === "series"
                      ? "Series"
                      : library.type === "music"
                      ? "Música"
                      : "Fotos"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className="truncate max-w-xs mr-2">
                        {library.path}
                      </span>
                      <button
                        onClick={() => checkPermissions(library.path)}
                        className="text-blue-400 hover:text-blue-300 text-xs"
                        title="Verificar permisos"
                      >
                        Verificar permisos
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => deleteLibrary(library.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de navegación de archivos */}
      {showBrowser && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Explorador de Archivos</h3>
              <button
                onClick={() => setShowBrowser(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="bg-gray-900 p-2 rounded-lg mb-4 flex items-center">
              <button
                onClick={goBack}
                className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded mr-2"
                disabled={directoryHistory.length <= 1}
              >
                ⬅️ Atrás
              </button>
              <div className="flex-grow truncate bg-gray-700 px-2 py-1 rounded">
                {currentDirectory || "Raíz"}
              </div>
              <div className="ml-2 flex">
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded ml-2"
                  disabled={!currentDirectory}
                  title="Crear carpeta"
                >
                  📁+
                </button>
                <button
                  onClick={() => checkPermissions(currentDirectory)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded ml-2"
                  disabled={!currentDirectory}
                  title="Verificar permisos"
                >
                  🔒
                </button>
              </div>
            </div>

            {/* Formulario para crear carpeta */}
            {showCreateFolder && (
              <div className="bg-gray-700 p-3 rounded-lg mb-4">
                <h4 className="text-sm font-semibold mb-2">
                  Crear Nueva Carpeta
                </h4>
                {createFolderError && (
                  <div className="bg-red-600 text-white p-2 rounded mb-2 text-sm">
                    {createFolderError}
                  </div>
                )}
                <div className="flex">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Nombre de la carpeta"
                    className="flex-grow bg-gray-600 text-white border border-gray-500 rounded-l p-2 focus:outline-none"
                  />
                  <button
                    onClick={createFolder}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 rounded-r"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName("");
                      setCreateFolderError(null);
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 rounded ml-2"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Verificador de permisos */}
            {showPermissionCheck &&
              selectedPathForPermissions === currentDirectory && (
                <div className="bg-gray-700 p-3 rounded-lg mb-4">
                  <FolderPermissionsManager
                    folderPath={selectedPathForPermissions}
                    onPermissionsFixed={handlePermissionsFixed}
                  />
                </div>
              )}

            <div className="max-h-96 overflow-y-auto bg-gray-700 rounded-lg p-2">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : directoryContents.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No hay elementos para mostrar
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {directoryContents.map((item, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded cursor-pointer ${
                        item.isDirectory
                          ? "hover:bg-blue-700"
                          : "hover:bg-gray-600 opacity-50"
                      }`}
                      onClick={() => {
                        if (item.isDirectory) {
                          navigateToDirectory(item.path);
                        }
                      }}
                      onDoubleClick={() => {
                        if (item.isDirectory) {
                          selectDirectory(item.path);
                        }
                      }}
                    >
                      <div className="flex items-center">
                        <div className="mr-2">
                          {item.isDirectory ? "📁" : "📄"}
                        </div>
                        <div className="truncate">{item.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={() => setShowBrowser(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={() => selectDirectory(currentDirectory)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                disabled={!currentDirectory}
              >
                Seleccionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para verificar permisos (para bibliotecas existentes) */}
      {showPermissionCheck &&
        selectedPathForPermissions !== currentDirectory && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Verificar Permisos</h3>
                <button
                  onClick={() => setShowPermissionCheck(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-4 bg-gray-700 p-3 rounded">
                <div className="font-medium mb-1">Ruta seleccionada:</div>
                <div className="text-gray-300 break-all">
                  {selectedPathForPermissions}
                </div>
              </div>

              <FolderPermissionsManager
                folderPath={selectedPathForPermissions}
                onPermissionsFixed={() => {
                  // Cerrar modal después de reparar
                  setTimeout(() => setShowPermissionCheck(false), 2000);
                }}
              />

              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowPermissionCheck(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default EnhancedLibraryManager;
