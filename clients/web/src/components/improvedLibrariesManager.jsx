import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

// Componente que muestra el error en los permisos del sistema de archivos
function FilesystemError({ message, onRetry }) {
  return (
    <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-300">
            Error de permisos
          </h3>
          <div className="mt-2 text-sm text-red-200">
            <p>
              {message ||
                "No se puede acceder al sistema de archivos. Verifica que tienes permisos suficientes."}
            </p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-100 bg-red-800 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const API_URL = apiConfig.API_URL;

function ImprovedLibrariesManager() {
  // Estados principales
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para el formulario y creación de bibliotecas
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState(1); // 1: Tipo, 2: Navegador de carpetas
  const [formData, setFormData] = useState({
    name: "",
    path: "",
    type: "movies",
    scan_automatically: true,
  });

  // Estados para la navegación de carpetas
  const [currentPath, setCurrentPath] = useState("/");
  const [folderContents, setFolderContents] = useState([]);
  const [folderHistory, setFolderHistory] = useState([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Estado para la edición
  const [editingId, setEditingId] = useState(null);

  // Estados para el escaneo
  const [scanningLibraries, setScanningLibraries] = useState([]);

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

  // Función para obtener contenido de una carpeta
  const fetchFolderContents = async (path) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");

      const normalizedPath = normalizePath(path);

      const response = await axios.get(`${API_URL}/api/filesystem/browse`, {
        params: { path: normalizedPath },
        headers: { Authorization: `Bearer ${token}` },
      });

      setFolderContents(response.data.contents);
      setCurrentPath(normalizedPath);
      setLoading(false);
    } catch (err) {
      console.error("Error al navegar por directorios:", err);
      setError("No se pudo acceder al directorio seleccionado");
      setLoading(false);
    }
  };

  // Normalizar rutas (convertir \ a /)
  const normalizePath = (path) => {
    return path.replace(/\\/g, "/");
  };

  // Navegar a una carpeta
  const navigateToFolder = (folder) => {
    // Guardar la ruta actual en el historial
    setFolderHistory([...folderHistory, currentPath]);

    // Ir a la nueva ruta
    let newPath;
    if (folder.path) {
      // Si el objeto tiene una ruta completa
      newPath = folder.path;
    } else {
      // Si solo tenemos el nombre, concatenar con la ruta actual
      newPath = currentPath.endsWith("/")
        ? `${currentPath}${folder.name}`
        : `${currentPath}/${folder.name}`;
    }

    fetchFolderContents(newPath);
  };

  // Navegar hacia atrás
  const navigateBack = () => {
    if (folderHistory.length > 0) {
      const previousPath = folderHistory[folderHistory.length - 1];
      setFolderHistory(folderHistory.slice(0, -1));
      fetchFolderContents(previousPath);
    }
  };

  // Crear una nueva carpeta
  const createNewFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Ingresa un nombre válido para la carpeta");
      return;
    }

    try {
      const token = localStorage.getItem("streamvio_token");
      const folderPath = normalizePath(`${currentPath}/${newFolderName}`);

      await axios.post(
        `${API_URL}/api/filesystem/create-directory`,
        { path: folderPath },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refrescar el contenido de la carpeta actual
      fetchFolderContents(currentPath);

      // Reiniciar estados
      setNewFolderName("");
      setCreatingFolder(false);
    } catch (err) {
      console.error("Error al crear carpeta:", err);
      setError("No se pudo crear la carpeta. Verifica los permisos.");
    }
  };

  // Seleccionar carpeta actual
  const selectCurrentFolder = () => {
    setFormData({
      ...formData,
      path: currentPath,
    });
    // Avanzar al siguiente paso o finalizar
    if (editingId) {
      handleSubmit();
    } else {
      setFormStep(3); // Paso final de confirmación
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Guardar biblioteca
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        setError("Debes iniciar sesión para realizar esta acción");
        return;
      }

      // Normalizar la ruta antes de enviar
      const normalizedFormData = {
        ...formData,
        path: normalizePath(formData.path),
      };

      if (editingId) {
        // Actualizar biblioteca existente
        await axios.put(
          `${API_URL}/api/libraries/${editingId}`,
          normalizedFormData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Actualizar lista local
        setLibraries(
          libraries.map((lib) =>
            lib.id === editingId ? { ...lib, ...normalizedFormData } : lib
          )
        );
      } else {
        // Crear nueva biblioteca
        const response = await axios.post(
          `${API_URL}/api/libraries`,
          normalizedFormData,
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
      setShowForm(false);
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
    setShowForm(true);
    setFormStep(1);
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

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      name: "",
      path: "",
      type: "movies",
      scan_automatically: true,
    });
    setEditingId(null);
    setFormStep(1);
    setCurrentPath("/");
    setFolderContents([]);
    setFolderHistory([]);
  };

  // Cancelar edición/creación
  const handleCancel = () => {
    resetForm();
    setShowForm(false);
  };

  // Avanzar al siguiente paso del formulario
  const nextStep = () => {
    if (formStep === 1) {
      // Si estamos en el paso 1 (selección de tipo) y avanzamos al 2 (navegador)
      // iniciar la navegación de carpetas
      fetchFolderContents("/");
    }

    setFormStep(formStep + 1);
  };

  // Retroceder al paso anterior
  const prevStep = () => {
    setFormStep(formStep - 1);
  };

  // Renderizar el paso 1: Selección de tipo de biblioteca
  const renderStep1 = () => {
    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">
          Paso 1: Tipo de biblioteca
        </h3>

        <div className="mb-4">
          <label className="block text-gray-300 mb-2">
            Nombre de la biblioteca
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            placeholder="Mi colección de películas"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-300 mb-2">Tipo de contenido</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Tarjetas seleccionables para tipo de biblioteca */}
            <div
              className={`p-4 rounded-lg cursor-pointer border-2 text-center
                ${
                  formData.type === "movies"
                    ? "border-blue-500 bg-blue-900 bg-opacity-50"
                    : "border-gray-700 bg-gray-800 hover:bg-gray-700"
                }`}
              onClick={() => setFormData({ ...formData, type: "movies" })}
            >
              <div className="text-3xl mb-2">🎬</div>
              <div className="font-medium">Películas</div>
            </div>

            <div
              className={`p-4 rounded-lg cursor-pointer border-2 text-center
                ${
                  formData.type === "series"
                    ? "border-blue-500 bg-blue-900 bg-opacity-50"
                    : "border-gray-700 bg-gray-800 hover:bg-gray-700"
                }`}
              onClick={() => setFormData({ ...formData, type: "series" })}
            >
              <div className="text-3xl mb-2">📺</div>
              <div className="font-medium">Series</div>
            </div>

            <div
              className={`p-4 rounded-lg cursor-pointer border-2 text-center
                ${
                  formData.type === "music"
                    ? "border-blue-500 bg-blue-900 bg-opacity-50"
                    : "border-gray-700 bg-gray-800 hover:bg-gray-700"
                }`}
              onClick={() => setFormData({ ...formData, type: "music" })}
            >
              <div className="text-3xl mb-2">🎵</div>
              <div className="font-medium">Música</div>
            </div>

            <div
              className={`p-4 rounded-lg cursor-pointer border-2 text-center
                ${
                  formData.type === "photos"
                    ? "border-blue-500 bg-blue-900 bg-opacity-50"
                    : "border-gray-700 bg-gray-800 hover:bg-gray-700"
                }`}
              onClick={() => setFormData({ ...formData, type: "photos" })}
            >
              <div className="text-3xl mb-2">📷</div>
              <div className="font-medium">Fotos</div>
            </div>
          </div>
        </div>

        <div className="flex items-center mb-6">
          <input
            type="checkbox"
            id="scan_automatically"
            name="scan_automatically"
            checked={formData.scan_automatically}
            onChange={handleInputChange}
            className="h-5 w-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="scan_automatically" className="ml-2 text-gray-300">
            Escanear automáticamente
          </label>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={!formData.name.trim()}
            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition
              ${!formData.name.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Siguiente
          </button>
        </div>
      </div>
    );
  };

  // Renderizar el paso 2: Navegador de carpetas
  const renderStep2 = () => {
    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">
          Paso 2: Seleccionar carpeta
        </h3>

        {/* Barra de ruta */}
        <div className="bg-gray-700 p-2 rounded-lg mb-4 flex items-center">
          <span className="text-gray-400 mr-2">Ruta actual:</span>
          <div className="bg-gray-800 py-1 px-3 rounded flex-grow truncate">
            {currentPath || "/"}
          </div>
        </div>

        {/* Barra de acciones */}
        <div className="flex mb-4 space-x-2">
          <button
            onClick={navigateBack}
            disabled={folderHistory.length === 0}
            className={`flex items-center bg-gray-700 px-3 py-1 rounded transition
              ${
                folderHistory.length === 0
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-gray-600"
              }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Atrás
          </button>

          <button
            onClick={() => setCreatingFolder(true)}
            className="flex items-center bg-green-700 hover:bg-green-600 px-3 py-1 rounded transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Nueva carpeta
          </button>

          <button
            onClick={selectCurrentFolder}
            className="flex items-center bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition ml-auto"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Usar carpeta actual
          </button>
        </div>

        {/* Crear nueva carpeta */}
        {creatingFolder && (
          <div className="mb-4 p-3 bg-gray-700 rounded-lg">
            <h4 className="font-medium mb-2">
              Crear nueva carpeta en: {currentPath}
            </h4>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de la carpeta"
                className="flex-grow bg-gray-800 text-white border border-gray-600 rounded p-2 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={createNewFolder}
                className="bg-green-600 hover:bg-green-700 text-white px-3 rounded"
              >
                Crear
              </button>
              <button
                onClick={() => {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de carpetas */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-400">Cargando...</p>
            </div>
          ) : folderContents.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Tipo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {folderContents.map((item, index) => (
                    <tr
                      key={index}
                      className={
                        item.isDirectory
                          ? "cursor-pointer hover:bg-gray-700"
                          : "text-gray-500"
                      }
                      onClick={() => item.isDirectory && navigateToFolder(item)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.isDirectory ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 mr-2 text-yellow-500"
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
                              className="h-5 w-5 mr-2 text-gray-400"
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
                          {item.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.isDirectory ? "Carpeta" : "Archivo"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-400">
              Esta carpeta está vacía
            </div>
          )}
        </div>

        <div className="flex justify-between space-x-3 mt-6">
          <button
            type="button"
            onClick={prevStep}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
          >
            Anterior
          </button>
          <div>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-400 hover:text-white transition mr-3"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={selectCurrentFolder}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
            >
              Seleccionar esta carpeta
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar el paso 3: Confirmación
  const renderStep3 = () => {
    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">
          Paso 3: Confirmar biblioteca
        </h3>

        <div className="bg-gray-700 p-4 rounded-lg mb-6">
          <h4 className="font-medium mb-3">Resumen de la biblioteca</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Nombre:</p>
              <p className="font-medium">{formData.name}</p>
            </div>

            <div>
              <p className="text-gray-400 text-sm">Tipo:</p>
              <p className="font-medium">
                {formData.type === "movies" && "Películas"}
                {formData.type === "series" && "Series"}
                {formData.type === "music" && "Música"}
                {formData.type === "photos" && "Fotos"}
              </p>
            </div>

            <div className="md:col-span-2">
              <p className="text-gray-400 text-sm">Ruta:</p>
              <p className="font-medium bg-gray-800 p-2 rounded break-all">
                {formData.path}
              </p>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="scan_automatically_confirm"
                  name="scan_automatically"
                  checked={formData.scan_automatically}
                  onChange={handleInputChange}
                  className="h-5 w-5 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="scan_automatically_confirm"
                  className="ml-2 text-gray-300"
                >
                  Escanear automáticamente
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between space-x-3 mt-6">
          <button
            type="button"
            onClick={prevStep}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
          >
            Anterior
          </button>
          <div>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-400 hover:text-white transition mr-3"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
            >
              {editingId ? "Actualizar biblioteca" : "Guardar biblioteca"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar el formulario según el paso actual
  const renderFormByStep = () => {
    switch (formStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return renderStep1();
    }
  };

  if (loading && !showForm) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4">Cargando bibliotecas...</p>
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
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Añadir biblioteca
        </button>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 rounded mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-white text-xl">
            &times;
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          {renderFormByStep()}
        </div>
      )}

      {libraries.length === 0 && !showForm ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No hay bibliotecas configuradas.</p>
          <button
            onClick={() => setShowForm(true)}
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
                    <p className="text-gray-400 mt-1 break-all">
                      {library.path}
                    </p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default ImprovedLibrariesManager;
