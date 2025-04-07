// Versión corregida de MediaLibraryManager.jsx con manejo de errores mejorado
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * MediaLibraryManager - Componente para gestión de bibliotecas multimedia
 * Versión corregida con mejor manejo de errores
 */
function MediaLibraryManager() {
  // Estados principales
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [scanningLibraries, setScanningLibraries] = useState([]);

  // Estados para gestión de formulario y modal
  const [formData, setFormData] = useState({
    name: "",
    path: "",
    type: "movies",
    scan_automatically: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formVisible, setFormVisible] = useState(false);

  // Estados para explorador de archivos
  const [showBrowser, setShowBrowser] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState("");
  const [directoryContents, setDirectoryContents] = useState([]);
  const [directoryHistory, setDirectoryHistory] = useState([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState(null);

  // Estados para creación de carpetas
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Estados para gestión de permisos
  const [showPermissionCheck, setShowPermissionCheck] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [fixingPermissions, setFixingPermissions] = useState(false);
  const [fixPermissionsResult, setFixPermissionsResult] = useState(null);

  // Cargar bibliotecas al iniciar
  useEffect(() => {
    fetchLibraries();
  }, []);

  /**
   * Cargar la lista de bibliotecas desde el servidor
   */
  const fetchLibraries = async () => {
    try {
      setLoading(true);
      setError(null);

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

      console.log("Respuesta API de bibliotecas:", response.data);

      // Asegurar que tenemos un array, incluso si la API devuelve otra cosa
      const librariesData = Array.isArray(response.data) ? response.data : [];
      setLibraries(librariesData);
      setLoading(false);
    } catch (err) {
      console.error("Error al cargar bibliotecas:", err);
      setError(
        err.response?.data?.message || "Error al cargar las bibliotecas"
      );
      setLibraries([]); // Asegurar que siempre es un array
      setLoading(false);
    }
  };

  /**
   * Manejar cambios en el formulario
   */
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

  /**
   * Manejar selección del tipo de biblioteca
   */
  const handleTypeSelect = (type) => {
    setFormData({
      ...formData,
      type,
    });
  };

  /**
   * Validar formulario antes de enviar
   */
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

  /**
   * Guardar biblioteca (crear o actualizar)
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        setError("Debes iniciar sesión para realizar esta acción");
        setLoading(false);
        return;
      }

      if (editingId) {
        // Actualizar biblioteca existente
        const response = await axios.put(
          `${API_URL}/api/libraries/${editingId}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("Respuesta de actualización:", response.data);

        // Actualizar lista local con manejo seguro
        setLibraries((prevLibraries) => {
          if (!Array.isArray(prevLibraries)) return [];
          return prevLibraries.map((lib) =>
            lib.id === editingId ? { ...lib, ...formData } : lib
          );
        });

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

        console.log("Respuesta de creación:", response.data);

        // Añadir a la lista local con manejo seguro
        const newLibrary = response.data.library || response.data;
        setLibraries((prevLibraries) => {
          if (!Array.isArray(prevLibraries)) return [newLibrary];
          return [...prevLibraries, newLibrary];
        });

        setSuccessMessage("¡Nueva biblioteca creada correctamente!");
      }

      // Resetear formulario
      resetForm();

      // Ocultar mensaje de éxito después de un tiempo
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Error al guardar biblioteca:", err);
      setError(err.response?.data?.message || "Error al guardar la biblioteca");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Iniciar edición de una biblioteca
   */
  const handleEdit = (library) => {
    if (!library || !library.id) {
      console.error("Biblioteca inválida para editar:", library);
      return;
    }

    setFormData({
      name: library.name || "",
      path: library.path || "",
      type: library.type || "movies",
      scan_automatically: !!library.scan_automatically,
    });
    setEditingId(library.id);
    setFormVisible(true);

    // Verificar permisos al editar
    checkFolderPermissions(library.path);
  };

  /**
   * Eliminar biblioteca
   */
  const handleDelete = async (id) => {
    if (!id) {
      console.error("ID inválido para eliminar");
      return;
    }

    if (
      !window.confirm(
        "¿Estás seguro de que deseas eliminar esta biblioteca? Esta acción es irreversible."
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      await axios.delete(`${API_URL}/api/libraries/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Eliminar de la lista local
      setLibraries((prevLibraries) => {
        if (!Array.isArray(prevLibraries)) return [];
        return prevLibraries.filter((lib) => lib.id !== id);
      });

      setSuccessMessage("Biblioteca eliminada correctamente");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Error al eliminar biblioteca:", err);
      setError(
        err.response?.data?.message || "Error al eliminar la biblioteca"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Iniciar escaneo de biblioteca
   */
  const handleScan = async (id) => {
    if (!id) {
      console.error("ID inválido para escanear");
      return;
    }

    if (scanningLibraries.includes(id)) {
      return; // Ya se está escaneando
    }

    try {
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Marcar como escaneando
      setScanningLibraries((prev) => [...prev, id]);

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
        setScanningLibraries((prev) => prev.filter((libId) => libId !== id));
        setSuccessMessage("Escaneo completado");
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
      }, 3000);
    } catch (err) {
      console.error("Error al iniciar escaneo:", err);
      setError(err.response?.data?.message || "Error al iniciar el escaneo");
      setScanningLibraries((prev) => prev.filter((libId) => libId !== id));
    }
  };

  /**
   * Resetear formulario y estados relacionados
   */
  const resetForm = () => {
    setFormData({
      name: "",
      path: "",
      type: "movies",
      scan_automatically: true,
    });
    setEditingId(null);
    setFormErrors({});
    setFormVisible(false);
    setShowBrowser(false);
    setShowPermissionCheck(false);
    setPermissionStatus(null);
    setFixPermissionsResult(null);
  };

  /**
   * Abrir el explorador de archivos
   */
  const openFileBrowser = async (initialPath = "") => {
    try {
      setBrowserLoading(true);
      setBrowserError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      let apiPath = initialPath
        ? `${API_URL}/api/filesystem/browse?path=${encodeURIComponent(
            initialPath
          )}`
        : `${API_URL}/api/filesystem/roots`;

      console.log("Solicitando explorador para:", apiPath);

      const response = await axios.get(apiPath, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Respuesta del explorador:", response.data);

      if (initialPath) {
        // Asegurar que contents es un array
        const contents = Array.isArray(response.data.contents)
          ? response.data.contents
          : [];

        setDirectoryContents(contents);
        setCurrentDirectory(response.data.path || "");

        // Actualizar historial
        if (
          response.data.path &&
          !directoryHistory.includes(response.data.path)
        ) {
          setDirectoryHistory((prev) => [...prev, response.data.path]);
        }
      } else {
        // Asegurar que la respuesta es un array
        const contents = Array.isArray(response.data) ? response.data : [];

        setDirectoryContents(contents);
        setCurrentDirectory("");
        setDirectoryHistory([]);
      }

      setShowBrowser(true);
      setBrowserLoading(false);
    } catch (err) {
      console.error("Error al explorar directorio:", err);
      setBrowserError(
        err.response?.data?.message || "Error al explorar directorio"
      );
      setDirectoryContents([]); // Asegurar que siempre es un array
      setBrowserLoading(false);
    }
  };

  /**
   * Navegar a un directorio específico
   */
  const navigateToDirectory = (path) => {
    if (!path) {
      console.error("Ruta inválida para navegar");
      return;
    }
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
   * Seleccionar un directorio
   */
  const selectDirectory = (path) => {
    if (!path) {
      console.error("Ruta inválida para seleccionar");
      return;
    }

    setFormData({
      ...formData,
      path,
    });
    setShowBrowser(false);

    // Verificar permisos de la carpeta seleccionada
    checkFolderPermissions(path);

    // Mostrar el formulario si no estaba visible
    setFormVisible(true);
  };

  /**
   * Crear una nueva carpeta
   */
  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setBrowserError("Ingresa un nombre para la carpeta");
      return;
    }

    if (!currentDirectory && currentDirectory !== "") {
      setBrowserError("Selecciona un directorio primero");
      return;
    }

    // Validar nombre de carpeta
    if (
      newFolderName.includes("/") ||
      newFolderName.includes("\\") ||
      newFolderName.includes(":")
    ) {
      setBrowserError("El nombre de la carpeta contiene caracteres no válidos");
      return;
    }

    try {
      setCreatingFolder(true);
      setBrowserError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const folderPath = currentDirectory
        ? `${currentDirectory}/${newFolderName}`.replace(/\/\//g, "/")
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

      // Refrescar directorio
      await openFileBrowser(currentDirectory);

      // Limpiar
      setNewFolderName("");
      setShowNewFolderInput(false);

      setSuccessMessage("Carpeta creada correctamente");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Error al crear carpeta:", err);
      setBrowserError(err.response?.data?.message || "Error al crear carpeta");
    } finally {
      setCreatingFolder(false);
    }
  };

  /**
   * Verificar permisos de una carpeta
   */
  const checkFolderPermissions = async (folderPath) => {
    if (!folderPath) return;

    try {
      setFixingPermissions(false);
      setFixPermissionsResult(null);
      setShowPermissionCheck(true);
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

      console.log("Respuesta de verificación de permisos:", response.data);
      setPermissionStatus(response.data);
    } catch (err) {
      console.error("Error al verificar permisos:", err);
      setError(
        err.response?.data?.message ||
          "Error al verificar permisos de la carpeta"
      );
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
      setFixPermissionsResult(null);

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

      // Verificar nuevamente los permisos
      if (response.data.success) {
        setTimeout(() => {
          checkFolderPermissions(folderPath);
        }, 1000);
      }
    } catch (err) {
      console.error("Error al reparar permisos:", err);
      setError(
        err.response?.data?.message || "Error al reparar permisos de la carpeta"
      );

      setFixPermissionsResult({
        success: false,
        message: "Error al reparar permisos",
        details: err.message,
        suggestedCommand: `sudo chmod -R 777 "${folderPath}"`,
      });
    } finally {
      setFixingPermissions(false);
    }
  };

  /**
   * Renderizar el selector visual de tipo de biblioteca
   */
  const renderTypeSelector = () => (
    <div className="mb-6">
      <label className="block text-gray-300 mb-2 font-medium">
        Tipo de Biblioteca
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: "movies", name: "Películas" },
          { id: "series", name: "Series" },
          { id: "music", name: "Música" },
          { id: "photos", name: "Fotos" },
        ].map((type) => (
          <div
            key={type.id}
            onClick={() => handleTypeSelect(type.id)}
            className={`flex flex-col items-center p-3 rounded-lg cursor-pointer border-2 transition-colors ${
              formData.type === type.id
                ? "border-blue-500 bg-blue-900 bg-opacity-30"
                : "border-gray-700 hover:border-gray-500 bg-gray-800"
            }`}
          >
            <span className="mt-2 capitalize">{type.name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Renderizar información de permisos de carpeta
   */
  const renderPermissionsInfo = () => {
    if (!permissionStatus) return null;

    return (
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h4 className="font-semibold text-lg mb-2">Estado de permisos</h4>

        {permissionStatus.hasAccess ? (
          <div className="bg-green-900 bg-opacity-30 p-3 rounded">
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
              <span className="font-medium">¡Permisos correctos!</span>
            </div>
            <p className="text-gray-300">
              Esta carpeta tiene los permisos necesarios para ser usada como
              biblioteca de medios.
            </p>
          </div>
        ) : (
          <div className="bg-red-900 bg-opacity-30 p-3 rounded">
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
              <span className="font-medium">Problema de permisos</span>
            </div>
            <p className="text-gray-300 mb-2">
              {permissionStatus.message || "Permisos insuficientes"}
            </p>

            {permissionStatus.details && (
              <p className="text-gray-400 text-sm mb-3">
                {permissionStatus.details}
              </p>
            )}

            {/* Información sobre cómo solucionar */}
            <div className="bg-gray-900 p-2 rounded text-sm text-gray-400 mb-3">
              <p>
                La aplicación necesita permisos de lectura y escritura en esta
                carpeta para funcionar correctamente.
              </p>
            </div>

            <button
              onClick={() => fixFolderPermissions(formData.path)}
              disabled={fixingPermissions}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded w-full ${
                fixingPermissions ? "opacity-50 cursor-wait" : ""
              }`}
            >
              {fixingPermissions
                ? "Reparando permisos..."
                : "Reparar permisos automáticamente"}
            </button>
          </div>
        )}

        {/* Resultado de la reparación */}
        {fixPermissionsResult && (
          <div
            className={`mt-4 p-3 rounded ${
              fixPermissionsResult.success
                ? "bg-green-900 bg-opacity-30"
                : "bg-red-900 bg-opacity-30"
            }`}
          >
            <p
              className={`font-medium ${
                fixPermissionsResult.success ? "text-green-400" : "text-red-400"
              }`}
            >
              {fixPermissionsResult.success
                ? "✓ Reparación completada"
                : "✗ Error en reparación"}
            </p>

            {fixPermissionsResult.message && (
              <p className="text-sm mt-1 text-gray-300">
                {fixPermissionsResult.message}
              </p>
            )}

            {fixPermissionsResult.details && (
              <p className="text-xs mt-1 text-gray-400">
                {fixPermissionsResult.details}
              </p>
            )}

            {fixPermissionsResult.suggestedCommand && (
              <div className="mt-2">
                <p className="text-xs text-gray-400">
                  Comando sugerido para ejecutar manualmente:
                </p>
                <pre className="mt-1 p-2 bg-gray-800 rounded text-xs overflow-x-auto text-blue-300">
                  {fixPermissionsResult.suggestedCommand}
                </pre>
                <p className="text-xs mt-1 text-gray-400">
                  Ejecuta este comando en el servidor como administrador (root)
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * Renderizar modal de explorador de archivos
   */
  const renderFileBrowser = () => {
    if (!showBrowser) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Explorador de Archivos</h3>
            <button
              onClick={() => setShowBrowser(false)}
              className="text-gray-400 hover:text-white text-2xl"
            >
              &times;
            </button>
          </div>

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

            <button
              onClick={() => setShowNewFolderInput(!showNewFolderInput)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded"
              title="Nueva carpeta"
            >
              + Carpeta
            </button>
          </div>

          {/* Crear nueva carpeta */}
          {showNewFolderInput && (
            <div className="bg-gray-700 p-3 rounded mb-4">
              <div className="flex">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nombre de la nueva carpeta"
                  className="flex-grow bg-gray-600 text-white border border-gray-500 rounded-l p-2 focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => {
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
              </div>
            </div>
          )}

          {/* Errores del navegador */}
          {browserError && (
            <div className="bg-red-600 text-white p-3 rounded mb-4 flex justify-between">
              <span>{browserError}</span>
              <button
                onClick={() => setBrowserError(null)}
                className="font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Contenido del directorio */}
          <div className="bg-gray-700 rounded-lg p-3 max-h-96 overflow-y-auto">
            {browserLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : directoryContents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No hay elementos para mostrar</p>
                {currentDirectory && (
                  <button
                    onClick={() => setShowNewFolderInput(true)}
                    className="mt-2 text-blue-400 hover:text-blue-300"
                  >
                    Crear una nueva carpeta aquí
                  </button>
                )}
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
                    title={`${item.path || item.name}${
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

          {/* Acciones del explorador */}
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setShowBrowser(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Cancelar
            </button>

            <div>
              {currentDirectory && (
                <button
                  onClick={() => {
                    checkFolderPermissions(currentDirectory);
                    selectDirectory(currentDirectory);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ml-2"
                >
                  Seleccionar esta carpeta
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renderizar lista de bibliotecas
   */
  const renderLibrariesList = () => {
    // Asegurarse de que libraries es un array
    const safeLibraries = Array.isArray(libraries) ? libraries : [];

    if (safeLibraries.length === 0) {
      return (
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
            onClick={() => {
              resetForm();
              openFileBrowser();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
          >
            Añadir tu primera biblioteca
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {safeLibraries.map((library) => (
          <div
            key={library.id || `library-${Math.random()}`}
            className="bg-gray-800 rounded-lg overflow-hidden shadow-lg"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {library.name || "Biblioteca sin nombre"}
                    </h3>
                    <p className="text-gray-400 mt-1 break-all">
                      {library.path || "Sin ruta"}
                    </p>
                    <div className="mt-2 flex items-center flex-wrap">
                      <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded mr-2 mb-1">
                        {library.type === "movies" && "Películas"}
                        {library.type === "series" && "Series"}
                        {library.type === "music" && "Música"}
                        {library.type === "photos" && "Fotos"}
                        {!library.type && "Tipo desconocido"}
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
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
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

            {/* Panel de acciones adicionales */}
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
                    checkFolderPermissions(library.path);
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
    );
  };

  // Componente principal
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Bibliotecas de medios</h2>
        <button
          onClick={() => {
            resetForm();
            openFileBrowser();
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          Añadir biblioteca
        </button>
      </div>

      {/* Mensajes de error y éxito */}
      {error && (
        <div className="bg-red-600 text-white p-4 rounded mb-6 flex justify-between items-center">
          <div>
            <p className="font-semibold">{error}</p>
            {error.includes("permisos") && (
              <p className="text-sm mt-1">
                Verifica que la aplicación tenga los permisos necesarios para
                acceder a la carpeta.
              </p>
            )}
          </div>
          <button
            onClick={() => setError(null)}
            className="text-white text-xl font-bold"
          >
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

      {/* Formulario de biblioteca */}
      {formVisible && (
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
                  onClick={() => openFileBrowser(formData.path || "")}
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

            {/* Información y gestión de permisos */}
            {formData.path && renderPermissionsInfo()}

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
                disabled={loading}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition ${
                  loading ? "opacity-70 cursor-wait" : ""
                }`}
              >
                {loading
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

      {/* Mostrar lista de bibliotecas o mensaje si no hay ninguna */}
      {loading && libraries.length === 0 ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Cargando bibliotecas...</p>
        </div>
      ) : (
        renderLibrariesList()
      )}

      {/* Modales */}
      {renderFileBrowser()}
    </div>
  );
}

export default MediaLibraryManager;
