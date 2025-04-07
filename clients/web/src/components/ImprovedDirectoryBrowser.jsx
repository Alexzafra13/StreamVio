import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Explorador de directorios mejorado con permisos más flexibles
 * @param {Object} props - Propiedades del componente
 * @param {string} props.initialPath - Ruta inicial para el explorador
 * @param {function} props.onSelect - Función a llamar cuando se selecciona una carpeta
 * @param {function} props.onCancel - Función a llamar cuando se cancela
 */
function ImprovedDirectoryBrowser({ initialPath = "", onSelect, onCancel }) {
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
  const [fixingPermissions, setFixingPermissions] = useState(false);
  const [permissionFixResult, setPermissionFixResult] = useState(null);

  // Lista de ubicaciones comunes para facilitar la navegación
  const commonLocations = [
    { name: "Home", path: "/home", icon: "home" },
    { name: "Media", path: "/media", icon: "media" },
    { name: "Mnt", path: "/mnt", icon: "mount" },
    { name: "Var", path: "/var", icon: "folder" },
    { name: "Var/lib", path: "/var/lib", icon: "folder" },
    { name: "Opt", path: "/opt", icon: "folder" },
    { name: "Tmp", path: "/tmp", icon: "folder" },
    { name: "Documentos", path: "/home/Documents", icon: "document" },
  ];

  // Al montar el componente, cargar los directorios raíz o el directorio inicial
  useEffect(() => {
    if (initialPath) {
      browseDirectory(initialPath);
    } else {
      loadRootDirectories();
    }
  }, [initialPath]);

  // Cargar directorios raíz del sistema con manejo de errores mejorado
  const loadRootDirectories = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Verificar si hay una ruta guardada en localStorage para empezar ahí
      const lastPath = localStorage.getItem("lastBrowsedPath");
      if (lastPath) {
        try {
          const checkResponse = await axios.get(
            `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
              lastPath
            )}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (checkResponse.data && checkResponse.data.contents) {
            console.log("Recuperando última ruta visitada:", lastPath);
            setContents(checkResponse.data.contents || []);
            setCurrentPath(lastPath);
            setPathHistory([lastPath]);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn(
            "No se pudo acceder a la última ruta guardada:",
            lastPath
          );
          // Continuamos con la carga de raíces si falla
        }
      }

      // Obtener unidades y directorios raíz
      let rootsLoaded = false;
      try {
        const response = await axios.get(`${API_URL}/api/filesystem/roots`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Si la respuesta contiene directorios raíz, usarlos
        if (response.data && response.data.length > 0) {
          setRootDirectories(response.data);
          setContents(response.data);
          setCurrentPath("");
          setPathHistory([]);
          rootsLoaded = true;
        }
      } catch (err) {
        console.warn(
          "Error al cargar directorios raíz, intentando alternativas:",
          err
        );
      }

      // Si no se pudieron cargar las raíces, probar con ubicaciones comunes
      if (!rootsLoaded) {
        console.log("Intentando cargar ubicaciones comunes...");
        const validLocations = [];

        // Verificar cada ubicación común
        for (const location of commonLocations) {
          try {
            const response = await axios.get(
              `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
                location.path
              )}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (response.data && response.data.path) {
              // Si la ubicación es accesible, añadirla
              validLocations.push({
                name: location.name,
                path: location.path,
                isDirectory: true,
              });
            }
          } catch (err) {
            // Ignorar ubicaciones no accesibles
            console.warn(`Ubicación ${location.path} no accesible`);
          }
        }

        // Si hay alguna ubicación válida, usarla
        if (validLocations.length > 0) {
          setRootDirectories(validLocations);
          setContents(validLocations);
          setCurrentPath("");
          setPathHistory([]);
          rootsLoaded = true;
        }
      }

      // Si aún no tenemos ubicaciones, mostrar un error amigable
      if (!rootsLoaded) {
        setError(
          "No se pudieron obtener ubicaciones accesibles. Intenta navegar directamente a una ruta conocida o verificar los permisos del sistema."
        );
        setContents([]);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error al cargar directorios raíz:", err);
      setError(
        "Error al cargar ubicaciones. Verifica que el servidor tenga permisos adecuados."
      );
      setContents([]);
      setLoading(false);
    }
  };

  // Función mejorada para explorar un directorio
  const browseDirectory = async (path) => {
    if (!path) {
      return loadRootDirectories();
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.get(
        `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(path)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Guardar esta ruta como la última visitada
      localStorage.setItem("lastBrowsedPath", response.data.path);

      // Actualizar estado con resultados
      setContents(response.data.contents || []);
      setCurrentPath(response.data.path);

      // Actualizar historial de navegación
      if (!pathHistory.includes(response.data.path)) {
        setPathHistory((prev) => [...prev, response.data.path]);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error al explorar directorio:", err);

      // Mostrar mensaje de error más descriptivo según el código de error
      if (err.response) {
        if (err.response.status === 403) {
          setError(
            `No tienes permiso para acceder a esta ubicación. Prueba otra carpeta o verifica los permisos del sistema.`
          );
        } else if (err.response.status === 404) {
          setError(`La ruta ${path} no existe o no es accesible.`);
        } else {
          setError(err.response.data?.message || `Error al explorar ${path}`);
        }
      } else {
        setError(`Error de conexión al intentar explorar ${path}`);
      }

      setLoading(false);
    }
  };

  // Función mejorada para crear carpeta con manejo de errores más detallado
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
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Construir ruta completa para la nueva carpeta
      const folderPath = currentPath
        ? `${currentPath}/${newFolderName}`.replace(/\/\//g, "/")
        : newFolderName;

      await axios.post(
        `${API_URL}/api/filesystem/create-directory`,
        { path: folderPath },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Refrescar el directorio actual
      await browseDirectory(currentPath);

      // Verificar permisos de la nueva carpeta
      try {
        const permResponse = await axios.post(
          `${API_URL}/api/filesystem/check-permissions`,
          { path: folderPath },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        // Si hay problemas de permisos, intentar repararlos automáticamente
        if (permResponse.data && !permResponse.data.hasAccess) {
          console.log(
            "La nueva carpeta necesita ajuste de permisos, intentando reparar..."
          );

          try {
            await axios.post(
              `${API_URL}/api/filesystem/fix-permissions`,
              { path: folderPath },
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            // Refrescar vista después de arreglar permisos
            await browseDirectory(currentPath);
          } catch (fixErr) {
            console.warn(
              "No se pudieron reparar permisos automáticamente:",
              fixErr
            );
            // Continuamos sin mostrar error, ya que la carpeta fue creada
          }
        }
      } catch (permErr) {
        console.warn(
          "Error al verificar permisos de la nueva carpeta:",
          permErr
        );
        // No es crítico, la carpeta ya está creada
      }

      // Limpiar estado
      setNewFolderName("");
      setShowNewFolderInput(false);
    } catch (err) {
      console.error("Error al crear carpeta:", err);

      // Proporcionar información más útil sobre el error
      if (err.response) {
        if (err.response.status === 403) {
          setError(
            "No tienes permiso para crear carpetas en esta ubicación. Prueba otra ubicación con más permisos (como /tmp)."
          );
        } else {
          setError(
            err.response.data?.message ||
              "Error al crear la carpeta. Prueba con otra ubicación."
          );
        }
      } else {
        setError("Error de conexión al intentar crear la carpeta.");
      }
    } finally {
      setCreatingFolder(false);
    }
  };

  // Función para ir al directorio padre
  const navigateToParent = () => {
    if (!currentPath) {
      return loadRootDirectories();
    }

    // Dividir la ruta en segmentos
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

  // Función mejorada para verificar permisos con manejo de errores
  const checkFolderPermissions = async (folderPath) => {
    setFixingPermissions(false);
    setPermissionFixResult(null);

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
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setPermissionStatus(response.data);
      setSelectedFolder(folderPath);
      setShowFixPermissions(true);
      setLoading(false);
    } catch (err) {
      console.error("Error al verificar permisos:", err);

      if (err.response && err.response.status === 403) {
        setError(
          "No tienes permiso para verificar permisos en esta ubicación."
        );
      } else {
        setError(
          err.response?.data?.message ||
            "Error al verificar permisos de la carpeta."
        );
      }

      setLoading(false);
    }
  };

  // Función mejorada para reparar permisos con información detallada
  const fixFolderPermissions = async () => {
    try {
      setFixingPermissions(true);
      setPermissionFixResult(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.post(
        `${API_URL}/api/filesystem/fix-permissions`,
        { path: selectedFolder },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setPermissionFixResult(response.data);

      // Después de reparar, verificar nuevamente los permisos
      try {
        const checkResponse = await axios.post(
          `${API_URL}/api/filesystem/check-permissions`,
          { path: selectedFolder },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setPermissionStatus(checkResponse.data);

        // Si se ha reparado correctamente, actualizar la vista
        if (response.data.success && currentPath === selectedFolder) {
          browseDirectory(currentPath);
        }
      } catch (checkErr) {
        console.warn(
          "Error al re-verificar permisos después de reparación:",
          checkErr
        );
        // No es crítico, ya tenemos el resultado de la reparación
      }
    } catch (err) {
      console.error("Error al reparar permisos:", err);

      setPermissionFixResult({
        success: false,
        message: err.response?.data?.message || "Error al reparar permisos",
        error: err.message,
        suggestedCommand: "sudo chmod -R 777 " + selectedFolder,
      });
    } finally {
      setFixingPermissions(false);
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

  // Renderizar diálogo de permisos con información detallada
  const renderPermissionsDialog = () => {
    if (!showFixPermissions || !permissionStatus) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-semibold mb-4 flex justify-between items-center">
            <span>Permisos de carpeta</span>
            <button
              onClick={() => setShowFixPermissions(false)}
              className="text-gray-400 hover:text-white"
            >
              &times;
            </button>
          </h3>

          <div className="mb-4 bg-gray-700 p-3 rounded">
            <div className="font-medium mb-1">Ruta seleccionada:</div>
            <div className="text-gray-300 break-all">{selectedFolder}</div>
          </div>

          <div className="mb-6 bg-gray-700 p-4 rounded">
            {permissionStatus.hasAccess ? (
              <div className="flex items-center text-green-400 mb-2">
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

                {!permissionFixResult && (
                  <div className="flex justify-end">
                    <button
                      onClick={fixFolderPermissions}
                      disabled={fixingPermissions}
                      className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${
                        fixingPermissions ? "opacity-50 cursor-wait" : ""
                      }`}
                    >
                      {fixingPermissions
                        ? "Reparando..."
                        : "Reparar permisos automáticamente"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resultado de la reparación */}
            {permissionFixResult && (
              <div
                className={`mt-4 p-3 rounded ${
                  permissionFixResult.success ? "bg-green-800" : "bg-red-800"
                }`}
              >
                <p
                  className={`font-medium ${
                    permissionFixResult.success
                      ? "text-green-200"
                      : "text-red-200"
                  }`}
                >
                  {permissionFixResult.success
                    ? "✓ Reparación completada"
                    : "✗ Error en reparación"}
                </p>
                {permissionFixResult.message && (
                  <p className="text-sm mt-1">{permissionFixResult.message}</p>
                )}
                {permissionFixResult.suggestedCommand && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-300">Comando sugerido:</p>
                    <pre className="mt-1 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                      {permissionFixResult.suggestedCommand}
                    </pre>
                    <p className="text-xs mt-1">
                      Ejecuta este comando en el servidor como administrador
                      (root)
                    </p>
                  </div>
                )}
                {permissionFixResult.details && (
                  <p className="text-xs mt-1 text-gray-300">
                    {permissionFixResult.details}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => {
                setShowFixPermissions(false);
                // Si se arreglaron los permisos y estamos en el directorio actual, refrescar
                if (
                  permissionFixResult?.success &&
                  currentPath === selectedFolder
                ) {
                  browseDirectory(currentPath);
                }
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Cerrar
            </button>

            {!permissionStatus.hasAccess && permissionFixResult?.success && (
              <button
                onClick={() => selectDirectory(selectedFolder)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Usar esta carpeta
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Generar una lista de ubicaciones sugeridas
  const renderSuggestedLocations = () => {
    if (currentPath || contents.length > 0) return null;

    return (
      <div className="bg-gray-800 p-4 rounded mb-4">
        <h4 className="font-semibold mb-2 text-blue-400">
          Ubicaciones sugeridas:
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => browseDirectory("/tmp")}
            className="text-left p-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            /tmp (acceso temporal)
          </button>
          <button
            onClick={() => browseDirectory("/home")}
            className="text-left p-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            /home (directorio personal)
          </button>
          <button
            onClick={() => browseDirectory("/media")}
            className="text-left p-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            /media (dispositivos externos)
          </button>
          <button
            onClick={() => browseDirectory("/mnt")}
            className="text-left p-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            /mnt (montajes)
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-400">
          También puedes escribir una ruta completa en el campo de búsqueda, por
          ejemplo: /var/lib/streamvio
        </div>
      </div>
    );
  };

  // Manejar entrada directa de ruta
  const [manualPath, setManualPath] = useState("");

  const handleManualPath = (e) => {
    e.preventDefault();
    if (manualPath.trim()) {
      browseDirectory(manualPath.trim());
    }
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

      {/* Entrada manual de ruta */}
      <form onSubmit={handleManualPath} className="mb-3">
        <div className="flex">
          <input
            type="text"
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            placeholder="Escribir ruta directamente... (ej: /var/lib)"
            className="flex-grow bg-gray-700 text-white border border-gray-600 rounded-l p-2 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-r"
          >
            Ir
          </button>
        </div>
      </form>

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

      {/* Mostrar ubicaciones sugeridas si no hay contenido */}
      {renderSuggestedLocations()}

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
              autoFocus
              onKeyPress={(e) => {
                if (e.key === "Enter") createFolder();
              }}
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
          <p className="text-xs text-gray-400 mt-2">
            Nota: Si tienes problemas para crear carpetas, prueba con
            ubicaciones como /tmp donde normalmente hay menos restricciones de
            permisos.
          </p>
        </div>
      )}

      {/* Mensajes de error */}
      {error && (
        <div className="bg-red-700 bg-opacity-75 text-white p-3 rounded mb-3 flex justify-between items-center">
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
            <p>Carpeta vacía o sin acceso</p>
            {currentPath && (
              <>
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  className="mt-2 text-blue-400 hover:text-blue-300"
                >
                  Crear una nueva carpeta aquí
                </button>
                <button
                  onClick={() => checkFolderPermissions(currentPath)}
                  className="mt-2 text-purple-400 hover:text-purple-300"
                >
                  Verificar permisos de esta carpeta
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {contents.map((item, index) => (
              <div
                key={index}
                className={`p-2 rounded ${
                  item.isDirectory
                    ? "bg-blue-800 bg-opacity-30 hover:bg-blue-700 cursor-pointer"
                    : "bg-gray-700 opacity-50 cursor-not-allowed"
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
                title={`${item.path}${
                  item.isDirectory ? " (Doble click para seleccionar)" : ""
                }`}
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
              Usar esta carpeta
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

export default ImprovedDirectoryBrowser;
