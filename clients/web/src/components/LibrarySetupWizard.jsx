import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Asistente de primera configuración de bibliotecas
 * Guía al usuario en sus primeros pasos para configurar bibliotecas multimedia
 */
function LibrarySetupWizard({ onComplete }) {
  // Estados
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [showCustomPathInput, setShowCustomPathInput] = useState(false);
  const [libraryName, setLibraryName] = useState("");
  const [libraryType, setLibraryType] = useState("movies");
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [fixingPermissions, setFixingPermissions] = useState(false);
  const [fixPermissionsResult, setFixPermissionsResult] = useState(null);
  const [browseMode, setBrowseMode] = useState(false);
  const [directoryContents, setDirectoryContents] = useState([]);
  const [currentDirectory, setCurrentDirectory] = useState("");
  const [directoryHistory, setDirectoryHistory] = useState([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState(null);

  // Cargar sugerencias de rutas al montar el componente
  useEffect(() => {
    loadSuggestedPaths();
  }, []);

  /**
   * Cargar rutas sugeridas para bibliotecas
   */
  const loadSuggestedPaths = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.get(
        `${API_URL}/api/filesystem/suggest-paths`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuggestions(response.data.suggestions || []);
    } catch (err) {
      console.error("Error al cargar rutas sugeridas:", err);
      setError(
        "No se pudieron cargar las rutas sugeridas. Puedes continuar ingresando una ruta manualmente."
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Seleccionar una ruta sugerida o personalizada
   */
  const selectPath = (path) => {
    setSelectedPath(path);
    // Verificar permisos de la carpeta
    checkFolderPermissions(path);
  };

  /**
   * Verificar permisos de una carpeta
   */
  const checkFolderPermissions = async (folderPath) => {
    if (!folderPath) return;

    try {
      setLoading(true);
      setError(null);
      setFixPermissionsResult(null);

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
    } catch (err) {
      console.error("Error al verificar permisos:", err);
      setError(
        "Error al verificar permisos de la carpeta. Inténtalo de nuevo o elige otra ubicación."
      );
      setPermissionStatus(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reparar permisos de una carpeta
   */
  const fixFolderPermissions = async (folderPath) => {
    if (!folderPath) return;

    try {
      setFixingPermissions(true);
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.post(
        `${API_URL}/api/filesystem/fix-permissions`,
        { path: folderPath },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setFixPermissionsResult(response.data);

      // Verificar nuevamente los permisos si la reparación fue exitosa
      if (response.data.success) {
        setTimeout(() => {
          checkFolderPermissions(folderPath);
        }, 1000);
      }
    } catch (err) {
      console.error("Error al reparar permisos:", err);
      setError(
        "Error al reparar permisos. Intenta elegir otra ubicación o contacta al administrador del sistema."
      );

      setFixPermissionsResult({
        success: false,
        message: "Error al reparar permisos",
        details: err.message,
      });
    } finally {
      setFixingPermissions(false);
    }
  };

  /**
   * Abrir explorador para ruta personalizada
   */
  const openFileBrowser = async (initialPath = "") => {
    try {
      setBrowserLoading(true);
      setBrowserError(null);
      setBrowseMode(true);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      let apiPath = initialPath
        ? `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
            initialPath
          )}`
        : `${API_URL}/api/filesystem/roots`;

      const response = await axios.get(apiPath, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (initialPath) {
        setDirectoryContents(response.data.contents || []);
        setCurrentDirectory(response.data.path);

        // Actualizar historial
        if (
          response.data.path &&
          !directoryHistory.includes(response.data.path)
        ) {
          setDirectoryHistory([...directoryHistory, response.data.path]);
        }
      } else {
        setDirectoryContents(response.data || []);
        setCurrentDirectory("");
        setDirectoryHistory([]);
      }

      setBrowserLoading(false);
    } catch (err) {
      console.error("Error al explorar directorio:", err);
      setBrowserError(
        err.response?.data?.message || "Error al explorar directorio"
      );
      setBrowserLoading(false);
    }
  };

  /**
   * Navegar a un directorio específico
   */
  const navigateToDirectory = (path) => {
    openFileBrowser(path);
  };

  /**
   * Navegar al directorio padre
   */
  const navigateToParent = () => {
    if (!currentDirectory) {
      return openFileBrowser("");
    }

    const pathParts = currentDirectory.split("/").filter(Boolean);
    if (pathParts.length <= 1) {
      // Si solo queda un nivel, volver a las raíces
      openFileBrowser("");
    } else {
      pathParts.pop();
      const parentPath = "/" + pathParts.join("/");
      openFileBrowser(parentPath);
    }
  };

  /**
   * Seleccionar un directorio desde el explorador
   */
  const selectDirectory = (path) => {
    setSelectedPath(path);
    setCustomPath(path);
    setBrowseMode(false);

    // Verificar permisos
    checkFolderPermissions(path);
  };

  /**
   * Crear una nueva biblioteca
   */
  const createLibrary = async () => {
    // Validar datos
    if (!libraryName.trim()) {
      setError("Debes proporcionar un nombre para la biblioteca");
      return;
    }

    if (!selectedPath) {
      setError("Debes seleccionar una ubicación para la biblioteca");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Crear biblioteca
      const response = await axios.post(
        `${API_URL}/api/libraries`,
        {
          name: libraryName,
          path: selectedPath,
          type: libraryType,
          scan_automatically: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Biblioteca creada con éxito, notificar al componente padre
      if (onComplete && typeof onComplete === "function") {
        onComplete(response.data.library);
      }
    } catch (err) {
      console.error("Error al crear biblioteca:", err);
      setError(err.response?.data?.message || "Error al crear la biblioteca");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ir al siguiente paso del asistente
   */
  const nextStep = () => {
    if (step === 1 && !selectedPath) {
      setError("Debes seleccionar una ubicación para continuar");
      return;
    }

    if (step === 2 && !libraryName.trim()) {
      setError("Debes ingresar un nombre para tu biblioteca");
      return;
    }

    if (step === 3) {
      // Último paso, crear la biblioteca
      createLibrary();
      return;
    }

    setError(null);
    setStep(step + 1);
  };

  /**
   * Ir al paso anterior del asistente
   */
  const prevStep = () => {
    if (browseMode) {
      setBrowseMode(false);
      return;
    }

    if (step > 1) {
      setStep(step - 1);
    }
  };

  /**
   * Renderizar el paso 1: Selección de ubicación
   */
  const renderStep1 = () => {
    if (browseMode) {
      return renderFileBrowser();
    }

    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">
          Paso 1: Selecciona una ubicación para tu biblioteca
        </h3>

        <p className="text-gray-300 mb-6">
          Elige dónde quieres que se almacenen tus archivos multimedia. Esta
          carpeta debe tener permisos de lectura y escritura.
        </p>

        {loading && suggestions.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-3"></div>
            <span>Buscando ubicaciones recomendadas...</span>
          </div>
        ) : (
          <>
            {suggestions.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-blue-400 mb-2">
                  Ubicaciones recomendadas:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => selectPath(suggestion.path)}
                      className={`p-4 rounded-lg cursor-pointer border ${
                        selectedPath === suggestion.path
                          ? "border-blue-500 bg-blue-900 bg-opacity-30"
                          : "border-gray-700 hover:border-gray-500 bg-gray-800"
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="mr-3 text-2xl">📁</div>
                        <div>
                          <div className="font-medium break-all">
                            {suggestion.path}
                          </div>
                          {suggestion.description && (
                            <div className="text-sm text-gray-400 mt-1">
                              {suggestion.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opción para ruta personalizada */}
            <div className="mt-6">
              <h4 className="font-medium mb-2">
                O elige una ubicación personalizada:
              </h4>

              {showCustomPathInput ? (
                <div className="flex mb-2">
                  <input
                    type="text"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    className="flex-grow bg-gray-700 text-white border border-gray-600 rounded-l p-3 focus:outline-none focus:border-blue-500"
                    placeholder="/ruta/a/tu/biblioteca"
                  />
                  <button
                    onClick={() => {
                      if (customPath) {
                        selectPath(customPath);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r"
                  >
                    Usar
                  </button>
                </div>
              ) : (
                <div className="flex space-x-3">
                  <button
                    onClick={() => openFileBrowser("")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    Explorar carpetas
                  </button>

                  <button
                    onClick={() => setShowCustomPathInput(true)}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
                  >
                    Ingresar ruta manualmente
                  </button>
                </div>
              )}
            </div>

            {/* Información sobre la ruta seleccionada */}
            {selectedPath && (
              <div className="mt-6 bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Ruta seleccionada:</h4>
                <div className="flex items-center">
                  <div className="mr-3 text-xl">📁</div>
                  <div className="break-all">{selectedPath}</div>
                </div>

                {/* Estado de permisos */}
                {loading ? (
                  <div className="flex items-center mt-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
                    <span className="text-sm">Verificando permisos...</span>
                  </div>
                ) : permissionStatus ? (
                  <div className="mt-3">
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
                        <span>La carpeta tiene los permisos correctos</span>
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
                          <span>
                            {permissionStatus.message || "Problema de permisos"}
                          </span>
                        </div>

                        {permissionStatus.canCreate && (
                          <p className="text-yellow-400 text-sm mb-2">
                            La carpeta no existe pero puede crearse
                            automáticamente
                          </p>
                        )}

                        {!fixingPermissions && !fixPermissionsResult && (
                          <button
                            onClick={() => fixFolderPermissions(selectedPath)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm mt-2"
                          >
                            Reparar permisos automáticamente
                          </button>
                        )}

                        {fixingPermissions && (
                          <div className="flex items-center mt-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
                            <span className="text-sm">
                              Reparando permisos...
                            </span>
                          </div>
                        )}

                        {fixPermissionsResult && (
                          <div
                            className={`mt-2 p-2 rounded text-sm ${
                              fixPermissionsResult.success
                                ? "bg-green-900 bg-opacity-30"
                                : "bg-red-900 bg-opacity-30"
                            }`}
                          >
                            {fixPermissionsResult.success ? (
                              <div className="text-green-400">
                                ✓ Permisos reparados correctamente
                              </div>
                            ) : (
                              <div className="text-red-400">
                                ✗ No se pudieron reparar los permisos
                              </div>
                            )}

                            {fixPermissionsResult.message && (
                              <p className="mt-1 text-gray-300">
                                {fixPermissionsResult.message}
                              </p>
                            )}

                            {fixPermissionsResult.suggestedCommand && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-400">
                                  Comando sugerido:
                                </p>
                                <pre className="mt-1 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                                  {fixPermissionsResult.suggestedCommand}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  /**
   * Renderizar el paso 2: Configuración de la biblioteca
   */
  const renderStep2 = () => {
    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">
          Paso 2: Configura tu biblioteca
        </h3>

        <p className="text-gray-300 mb-6">
          Asigna un nombre y elige el tipo de contenido que almacenará esta
          biblioteca.
        </p>

        <div className="mb-6">
          <label className="block text-gray-300 mb-2">
            Nombre de la biblioteca
          </label>
          <input
            type="text"
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            placeholder="Ej: Mis Películas, Series Favoritas, etc."
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
          />
          <p className="text-sm text-gray-400 mt-1">
            Elige un nombre descriptivo que te ayude a identificar fácilmente el
            contenido
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-gray-300 mb-2">Tipo de contenido</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "movies", name: "Películas", icon: "🎬" },
              { id: "series", name: "Series", icon: "📺" },
              { id: "music", name: "Música", icon: "🎵" },
              { id: "photos", name: "Fotos", icon: "📷" },
            ].map((type) => (
              <div
                key={type.id}
                onClick={() => setLibraryType(type.id)}
                className={`p-4 rounded-lg cursor-pointer border ${
                  libraryType === type.id
                    ? "border-blue-500 bg-blue-900 bg-opacity-30"
                    : "border-gray-700 hover:border-gray-500 bg-gray-800"
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="text-3xl mb-2">{type.icon}</div>
                  <div className="font-medium">{type.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h4 className="font-medium mb-2">Resumen de la ubicación:</h4>
          <div className="flex items-center">
            <div className="mr-3 text-xl">📁</div>
            <div className="break-all">{selectedPath}</div>
          </div>

          {permissionStatus &&
            !permissionStatus.hasAccess &&
            !fixPermissionsResult?.success && (
              <div className="mt-2 text-yellow-400 text-sm">
                ⚠️ Esta carpeta podría tener problemas de permisos. Recomendamos
                repararlos antes de continuar.
              </div>
            )}
        </div>
      </div>
    );
  };

  /**
   * Renderizar el paso 3: Confirmación
   */
  const renderStep3 = () => {
    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">
          Paso 3: Confirma tu biblioteca
        </h3>

        <p className="text-gray-300 mb-6">
          Revisa la información de tu biblioteca antes de crearla.
        </p>

        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-blue-400 mb-2">Nombre:</h4>
              <p className="text-lg">{libraryName}</p>
            </div>

            <div>
              <h4 className="font-medium text-blue-400 mb-2">Tipo:</h4>
              <p className="text-lg">
                {libraryType === "movies" && "Películas 🎬"}
                {libraryType === "series" && "Series 📺"}
                {libraryType === "music" && "Música 🎵"}
                {libraryType === "photos" && "Fotos 📷"}
              </p>
            </div>

            <div className="md:col-span-2">
              <h4 className="font-medium text-blue-400 mb-2">Ubicación:</h4>
              <p className="text-lg break-all">{selectedPath}</p>

              {permissionStatus && (
                <div className="mt-2">
                  {permissionStatus.hasAccess ||
                  fixPermissionsResult?.success ? (
                    <span className="text-green-400">✓ Permisos correctos</span>
                  ) : (
                    <span className="text-yellow-400">
                      ⚠️ Posibles problemas de permisos
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-blue-900 bg-opacity-30 p-4 rounded">
            <p className="text-blue-300">
              Al crear esta biblioteca, se configurará la carpeta para ser
              utilizada por StreamVio. La aplicación escaneará automáticamente
              esta ubicación para buscar archivos multimedia.
            </p>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renderizar explorador de archivos
   */
  const renderFileBrowser = () => {
    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">Explorador de Archivos</h3>

        {/* Navegación */}
        <div className="flex items-center space-x-2 mb-4">
          <button
            onClick={() => openFileBrowser("")}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded"
            title="Raíz"
          >
            Raíz
          </button>

          <button
            onClick={navigateToParent}
            disabled={!currentDirectory}
            className={`bg-gray-700 text-white px-3 py-2 rounded ${
              !currentDirectory
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-600"
            }`}
            title="Subir"
          >
            ↑ Subir
          </button>

          <div className="flex-grow bg-gray-700 px-3 py-2 rounded text-sm overflow-x-auto whitespace-nowrap">
            {currentDirectory || "Raíz"}
          </div>
        </div>

        {/* Errores del navegador */}
        {browserError && (
          <div className="bg-red-600 text-white p-3 rounded mb-4 flex justify-between">
            <span>{browserError}</span>
            <button onClick={() => setBrowserError(null)} className="font-bold">
              ×
            </button>
          </div>
        )}

        {/* Contenido del directorio */}
        <div className="bg-gray-700 rounded-lg p-3 max-h-96 overflow-y-auto mb-4">
          {browserLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : directoryContents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No hay elementos para mostrar</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {directoryContents.map((item, index) => (
                <div
                  key={index}
                  className={`p-2 rounded cursor-pointer ${
                    item.isDirectory
                      ? "bg-blue-900 bg-opacity-30 hover:bg-blue-800"
                      : "bg-gray-600 opacity-50 cursor-not-allowed"
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
                  title={`${item.path}${
                    item.isDirectory ? " (Doble clic para seleccionar)" : ""
                  }`}
                >
                  <div className="flex items-center">
                    <div className="mr-2 text-lg">
                      {item.isDirectory ? "📁" : "📄"}
                    </div>
                    <div className="truncate">{item.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setBrowseMode(false)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            Cancelar
          </button>

          {currentDirectory && (
            <button
              onClick={() => selectDirectory(currentDirectory)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Seleccionar esta carpeta
            </button>
          )}
        </div>
      </div>
    );
  };

  /**
   * Renderizar contenido según el paso actual
   */
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

  /**
   * Renderizar indicador de pasos
   */
  const renderStepIndicator = () => {
    return (
      <div className="flex justify-between mb-8">
        {[1, 2, 3].map((stepNumber) => (
          <div
            key={stepNumber}
            className={`flex-1 relative ${
              stepNumber < step
                ? "text-green-500"
                : stepNumber === step
                ? "text-blue-500"
                : "text-gray-500"
            }`}
          >
            <div className="flex items-center">
              <div
                className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${
                  stepNumber < step
                    ? "border-green-500 bg-green-500 bg-opacity-20"
                    : stepNumber === step
                    ? "border-blue-500 bg-blue-500 bg-opacity-20"
                    : "border-gray-500"
                }`}
              >
                {stepNumber < step ? (
                  <svg
                    className="h-5 w-5"
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
                ) : (
                  stepNumber
                )}
              </div>
              <div
                className={`hidden md:block ml-2 text-sm ${
                  stepNumber === step ? "font-medium" : ""
                }`}
              >
                {stepNumber === 1 && "Ubicación"}
                {stepNumber === 2 && "Configuración"}
                {stepNumber === 3 && "Confirmación"}
              </div>
            </div>

            {stepNumber < 3 && (
              <div
                className={`absolute top-4 left-8 right-0 border-t ${
                  stepNumber < step ? "border-green-500" : "border-gray-500"
                }`}
              ></div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Cabecera */}
      <div className="flex justify-center mb-6">
        <h2 className="text-2xl font-bold">Asistente de configuración</h2>
      </div>

      {/* Indicador de pasos */}
      {!browseMode && renderStepIndicator()}

      {/* Mensajes de error */}
      {error && (
        <div className="bg-red-600 text-white p-4 rounded mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-white font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Contenido del paso actual */}
      {renderStepContent()}

      {/* Botones de navegación */}
      <div className="flex justify-between mt-8">
        <button
          onClick={prevStep}
          className={`${
            step === 1 && !browseMode ? "invisible" : ""
          } bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded`}
        >
          {browseMode ? "Cancelar" : "Anterior"}
        </button>

        <button
          onClick={nextStep}
          disabled={
            loading ||
            (step === 1 && !selectedPath) ||
            (step === 2 && !libraryName.trim())
          }
          className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${
            loading ||
            (step === 1 && !selectedPath) ||
            (step === 2 && !libraryName.trim())
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
        >
          {loading
            ? "Procesando..."
            : step === 3
            ? "Crear biblioteca"
            : "Siguiente"}
        </button>
      </div>
    </div>
  );
}

export default LibrarySetupWizard;
