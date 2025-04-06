import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Navegador de directorios mejorado con acceso completo al sistema
 * @param {Object} props - Propiedades del componente
 * @param {string} props.initialPath - Ruta inicial para el explorador
 * @param {function} props.onSelect - Función a llamar cuando se selecciona una carpeta
 * @param {function} props.onCancel - Función a llamar cuando se cancela
 */
function EnhancedSystemDirectoryBrowser({
  initialPath = "",
  onSelect,
  onCancel,
}) {
  const [currentPath, setCurrentPath] = useState(initialPath || "");
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [pathHistory, setPathHistory] = useState([]);
  const [rootDirectories, setRootDirectories] = useState([]);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [showFixPermissions, setShowFixPermissions] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("");

  // Al montar el componente, cargar los directorios raíz o el directorio inicial
  useEffect(() => {
    if (initialPath) {
      browseDirectory(initialPath);
    } else {
      loadRootDirectories();
    }
  }, [initialPath]);

  // Cargar directorios raíz del sistema
  const loadRootDirectories = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.get(`${API_URL}/api/filesystem/roots`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Obtener las unidades/raíces del sistema
      const systemRoots = response.data || [];

      // Intentar detectar discos externos o montajes adicionales
      try {
        // Verificar directorio /media y /mnt donde suelen montarse dispositivos en Linux/Unix
        const mediaResponse = await axios
          .get(
            `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
              "/media"
            )}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
          .catch(() => ({ data: { contents: [] } }));

        const mntResponse = await axios
          .get(
            `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
              "/mnt"
            )}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
          .catch(() => ({ data: { contents: [] } }));

        // También verificar /home y /var/
        const homeResponse = await axios
          .get(
            `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
              "/home"
            )}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
          .catch(() => ({ data: { contents: [] } }));

        const varResponse = await axios
          .get(
            `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
              "/var"
            )}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
          .catch(() => ({ data: { contents: [] } }));

        // Filtrar solo directorios y añadirlos a la lista de raíces
        if (mediaResponse.data && mediaResponse.data.contents) {
          const mediaFolders = mediaResponse.data.contents.filter(
            (item) => item.isDirectory
          );
          systemRoots.push(...mediaFolders);
        }

        if (mntResponse.data && mntResponse.data.contents) {
          const mntFolders = mntResponse.data.contents.filter(
            (item) => item.isDirectory
          );
          systemRoots.push(...mntFolders);
        }

        if (homeResponse.data && homeResponse.data.contents) {
          const homeFolders = homeResponse.data.contents.filter(
            (item) => item.isDirectory
          );
          systemRoots.push(...homeFolders);
        }

        if (varResponse.data && varResponse.data.contents) {
          const varFolders = varResponse.data.contents.filter(
            (item) => item.isDirectory
          );
          systemRoots.push(...varFolders);
        }
      } catch (mountError) {
        console.warn(
          "No se pudieron detectar montajes adicionales:",
          mountError
        );
      }

      // Eliminar duplicados
      const uniqueRoots = [];
      const paths = new Set();

      systemRoots.forEach((root) => {
        if (!paths.has(root.path)) {
          paths.add(root.path);
          uniqueRoots.push(root);
        }
      });

      setRootDirectories(uniqueRoots);
      setContents(uniqueRoots);
      setCurrentPath("");
      setPathHistory([]);
      setLoading(false);
    } catch (err) {
      console.error("Error al cargar directorios raíz:", err);
      setError(err.response?.data?.message || "Error al cargar directorios");
      setLoading(false);
    }
  };

  // Función para explorar un directorio
  const browseDirectory = async (path) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Si no hay ruta, cargar los directorios raíz
      if (!path) {
        return loadRootDirectories();
      }

      const response = await axios.get(
        `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(path)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setContents(response.data.contents || []);
      setCurrentPath(response.data.path);

      // Actualizar historial de navegación
      if (!pathHistory.includes(response.data.path)) {
        setPathHistory((prev) => [...prev, response.data.path]);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error al explorar directorio:", err);
      setError(err.response?.data?.message || "Error al explorar directorio");
      setLoading(false);
    }
  };

  // Función para crear una nueva carpeta
  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Debes ingresar un nombre para la carpeta");
      return;
    }

    // Validar que el nombre no contenga caracteres no permitidos
    const invalidChars = /[\\/:*?"<>|]/;
    if (invalidChars.test(newFolderName)) {
      setError(
        'El nombre contiene caracteres no permitidos: \\ / : * ? " < > |'
      );
      return;
    }

    try {
      setCreatingFolder(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Construir ruta completa para la nueva carpeta
      const folderPath = currentPath
        ? `${currentPath}/${newFolderName}`.replace(/\/\//g, "/")
        : newFolderName;

      try {
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
        browseDirectory(currentPath);

        // Limpiar estado
        setNewFolderName("");
        setShowNewFolderInput(false);
        setError(null);
      } catch (err) {
        console.error("Error al crear carpeta:", err);

        if (err.response && err.response.status === 500) {
          setError(
            "Error del servidor al crear la carpeta. Es posible que no tengas permisos suficientes en esta ubicación."
          );
        } else if (err.response && err.response.status === 403) {
          setError("No tienes permiso para crear carpetas en esta ubicación.");
        } else {
          setError(err.response?.data?.message || "Error al crear carpeta");
        }
      }
    } catch (err) {
      console.error("Error general al crear carpeta:", err);
      setError("Error inesperado al intentar crear la carpeta.");
    } finally {
      setCreatingFolder(false);
    }
  };

  // Función para ir al directorio padre/anterior
  const navigateToParent = () => {
    if (!currentPath) {
      return loadRootDirectories();
    }

    const segments = currentPath.split("/").filter(Boolean);

    if (segments.length <= 1) {
      // Si solo queda un segmento, volver a la raíz
      return loadRootDirectories();
    } else {
      // Construir la ruta del directorio padre
      const parentPath = "/" + segments.slice(0, -1).join("/");
      browseDirectory(parentPath);
    }
  };

  // Función para navegar atrás en el historial
  const navigateBack = () => {
    if (pathHistory.length <= 1) {
      return loadRootDirectories();
    }

    const newHistory = [...pathHistory];
    newHistory.pop(); // Eliminar ruta actual
    const previousPath = newHistory[newHistory.length - 1];

    setPathHistory(newHistory);
    browseDirectory(previousPath);
  };

  // Verificar permisos de una carpeta
  const checkFolderPermissions = async (folderPath) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.post(
        `${API_URL}/api/filesystem/check-permissions`,
        { path: folderPath },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setPermissionStatus(response.data);
      setSelectedFolder(folderPath);
      setShowFixPermissions(true);
      setLoading(false);
    } catch (err) {
      console.error("Error al verificar permisos:", err);
      setError(err.response?.data?.message || "Error al verificar permisos");
      setLoading(false);
    }
  };

  // Reparar permisos de una carpeta
  const fixFolderPermissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.post(
        `${API_URL}/api/filesystem/fix-permissions`,
        { path: selectedFolder },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Después de reparar, verificar nuevamente
      if (response.data.success) {
        await checkFolderPermissions(selectedFolder);
      } else {
        setError(
          response.data.message || "No se pudieron reparar los permisos"
        );
      }

      setLoading(false);
    } catch (err) {
      console.error("Error al reparar permisos:", err);
      setError(err.response?.data?.message || "Error al reparar permisos");
      setLoading(false);
    }
  };

  // Función para seleccionar un directorio
  const selectDirectory = (path) => {
    if (onSelect) {
      onSelect(path);
    }
  };

  // Renderizar una barra de ruta (breadcrumbs) para facilitar la navegación
  const renderPathBreadcrumbs = () => {
    if (!currentPath) return null;

    const segments = currentPath.split("/").filter(Boolean);
    let accumulatedPath = "";

    return (
      <div className="flex flex-wrap items-center text-sm mb-2 bg-gray-800 p-2 rounded overflow-x-auto">
        <span
          className="text-blue-400 hover:text-blue-300 cursor-pointer px-1"
          onClick={() => loadRootDirectories()}
        >
          Raíz
        </span>

        {segments.map((segment, index) => {
          accumulatedPath += "/" + segment;
          const pathForSegment = accumulatedPath;

          return (
            <React.Fragment key={index}>
              <span className="mx-1 text-gray-500">/</span>
              <span
                className="text-blue-400 hover:text-blue-300 cursor-pointer px-1 truncate max-w-xs"
                onClick={() => browseDirectory(pathForSegment)}
              >
                {segment}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Renderizar el diálogo de permisos
  const renderPermissionsDialog = () => {
    if (!showFixPermissions || !permissionStatus) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg">
          <h3 className="text-xl font-semibold mb-4">Permisos de carpeta</h3>

          <div className="mb-4 bg-gray-700 p-3 rounded">
            <div className="font-medium mb-1">Ruta seleccionada:</div>
            <div className="text-gray-300 break-all">{selectedFolder}</div>
          </div>

          <div className="mb-6 bg-gray-700 p-4 rounded">
            {permissionStatus.hasAccess ? (
              <div className="flex items-center text-green-400">
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>
                  Esta carpeta tiene los permisos correctos para StreamVio
                </span>
              </div>
            ) : (
              <div>
                <div className="flex items-center text-red-400 mb-2">
                  <svg
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span>Problema de permisos detectado</span>
                </div>
                <p className="text-gray-300 mb-2">{permissionStatus.message}</p>

                {permissionStatus.details && (
                  <p className="text-gray-400 text-sm mb-3">
                    {permissionStatus.details}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={fixFolderPermissions}
                    disabled={loading}
                    className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${
                      loading ? "opacity-50 cursor-wait" : ""
                    }`}
                  >
                    {loading
                      ? "Reparando..."
                      : "Reparar permisos automáticamente"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setShowFixPermissions(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Explorador de Archivos</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowNewFolderInput(!showNewFolderInput)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
            title="Crear nueva carpeta"
          >
            Nueva Carpeta
          </button>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
            title="Cerrar"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Barra de navegación */}
      <div className="flex items-center space-x-2 mb-2">
        <button
          onClick={navigateBack}
          disabled={pathHistory.length <= 1}
          className={`bg-gray-700 text-white p-2 rounded ${
            pathHistory.length <= 1
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-gray-600"
          }`}
          title="Atrás"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <button
          onClick={navigateToParent}
          disabled={!currentPath}
          className={`bg-gray-700 text-white p-2 rounded ${
            !currentPath ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-600"
          }`}
          title="Subir un nivel"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="bg-gray-700 px-3 py-2 rounded flex-grow text-sm overflow-x-auto whitespace-nowrap">
          {currentPath || "Raíz"}
        </div>

        <button
          onClick={() => browseDirectory(currentPath)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
          title="Refrescar"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {currentPath && (
          <button
            onClick={() => checkFolderPermissions(currentPath)}
            className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded"
            title="Verificar permisos"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Atajos de navegación para dispositivos externos y ubicaciones populares */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => loadRootDirectories()}
          className="bg-gray-700 hover:bg-gray-600 text-sm text-white px-3 py-1 rounded flex items-center"
        >
          <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Inicio
        </button>

        {/* Botón para /media donde suelen estar los discos externos en Linux */}
        <button
          onClick={() => browseDirectory("/media")}
          className="bg-gray-700 hover:bg-gray-600 text-sm text-white px-3 py-1 rounded flex items-center"
        >
          <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
          </svg>
          Dispositivos
        </button>

        {/* Botón para /home */}
        <button
          onClick={() => browseDirectory("/home")}
          className="bg-gray-700 hover:bg-gray-600 text-sm text-white px-3 py-1 rounded flex items-center"
        >
          <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Home
        </button>

        {/* Botón para /mnt */}
        <button
          onClick={() => browseDirectory("/mnt")}
          className="bg-gray-700 hover:bg-gray-600 text-sm text-white px-3 py-1 rounded flex items-center"
        >
          <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
          </svg>
          Montajes
        </button>

        {/* Botón para /var */}
        <button
          onClick={() => browseDirectory("/var")}
          className="bg-gray-700 hover:bg-gray-600 text-sm text-white px-3 py-1 rounded flex items-center"
        >
          <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
            <path
              fillRule="evenodd"
              d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
              clipRule="evenodd"
            />
          </svg>
          Var
        </button>
      </div>

      {/* Breadcrumbs */}
      {renderPathBreadcrumbs()}

      {/* Crear nueva carpeta */}
      {showNewFolderInput && (
        <div className="bg-gray-800 p-3 rounded-lg mb-3">
          <div className="flex items-center">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              className="flex-grow bg-gray-700 text-white border border-gray-600 rounded-l p-2 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={createFolder}
              disabled={creatingFolder || !newFolderName.trim()}
              className={`bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-r ${
                creatingFolder || !newFolderName.trim()
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              {creatingFolder ? "Creando..." : "Crear"}
            </button>
            <button
              onClick={() => {
                setShowNewFolderInput(false);
                setNewFolderName("");
              }}
              className="ml-2 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Mensajes de error */}
      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-3 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-white font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Área de contenido */}
      <div className="bg-gray-800 rounded-lg p-2 min-h-[300px] max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : contents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <svg
              className="h-12 w-12 mb-2"
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
            <p>Carpeta vacía</p>
            <button
              onClick={() => setShowNewFolderInput(true)}
              className="mt-2 text-blue-400 hover:text-blue-300"
            >
              Crear una nueva carpeta aquí
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {contents.map((item, index) => (
              <div
                key={index}
                className={`p-2 rounded ${
                  item.isDirectory
                    ? "bg-blue-800 bg-opacity-30 hover:bg-blue-700 cursor-pointer"
                    : "bg-gray-700 opacity-50"
                }`}
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
                title={item.path}
              >
                <div className="flex items-center">
                  {item.isDirectory ? (
                    <svg
                      className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0"
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex justify-between mt-4">
        <button
          onClick={onCancel}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          Cancelar
        </button>

        <div className="flex space-x-2">
          {currentPath && (
            <button
              onClick={() => selectDirectory(currentPath)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
            >
              <svg
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Crear biblioteca aquí
            </button>
          )}

          <button
            onClick={() => selectDirectory(currentPath)}
            disabled={!currentPath}
            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${
              !currentPath ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Seleccionar esta carpeta
          </button>
        </div>
      </div>

      {/* Diálogo de permisos */}
      {renderPermissionsDialog()}
    </div>
  );
}

export default EnhancedSystemDirectoryBrowser;
