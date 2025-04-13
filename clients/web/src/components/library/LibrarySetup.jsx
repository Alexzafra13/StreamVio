import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { UIContext } from "../../context/UIContext";
import libraryService from "../../services/libraryService";

/**
 * Componente para crear o editar una biblioteca
 *
 * @param {Object} props
 * @param {Object} [props.library] - Datos de la biblioteca a editar (si es edición)
 * @param {function} props.onSaved - Callback cuando se guarda la biblioteca
 * @param {function} props.onCancel - Callback cuando se cancela la operación
 */
const LibrarySetup = ({ library, onSaved, onCancel }) => {
  const isEditing = !!library;
  const navigate = useNavigate();
  const { showSuccess, showError } = useContext(UIContext);

  // Estado del formulario
  const [formData, setFormData] = useState({
    name: "",
    path: "",
    type: "movies",
    scan_automatically: true,
  });

  // Otros estados
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPathHelp, setShowPathHelp] = useState(false);
  const [paths, setPaths] = useState([]);
  const [loadingPaths, setLoadingPaths] = useState(false);

  // Inicializar formulario con datos de biblioteca si estamos editando
  useEffect(() => {
    if (isEditing && library) {
      setFormData({
        name: library.name || "",
        path: library.path || "",
        type: library.type || "movies",
        scan_automatically: library.scan_automatically !== false,
      });
    }
  }, [isEditing, library]);

  // Manejar cambios en los inputs
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Actualizar formData basado en el tipo de input
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Limpiar error al cambiar valor
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es obligatorio";
    }

    if (!formData.path.trim()) {
      newErrors.path = "La ruta es obligatoria";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Guardar biblioteca
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);

      if (isEditing) {
        // Actualizar biblioteca existente
        await libraryService.updateLibrary(library.id, formData);
        showSuccess("Biblioteca actualizada correctamente");
      } else {
        // Crear nueva biblioteca
        await libraryService.createLibrary(formData);
        showSuccess("Biblioteca creada correctamente");
      }

      if (onSaved) {
        onSaved();
      } else {
        navigate("/libraries");
      }
    } catch (error) {
      console.error("Error al guardar biblioteca:", error);

      // Manejar errores específicos de la API
      if (error.response && error.response.data) {
        if (error.response.data.code === "PATH_EXISTS") {
          setErrors((prev) => ({
            ...prev,
            path: "Esta ruta ya está asignada a otra biblioteca",
          }));
        } else {
          showError(
            error.response.data.message || "Error al guardar la biblioteca"
          );
        }
      } else {
        showError("Error al guardar la biblioteca");
      }
    } finally {
      setLoading(false);
    }
  };

  // Buscar posibles directorios
  const handleFindDirectories = async () => {
    try {
      setLoadingPaths(true);

      // Esta petición es solo un ejemplo y deberá adaptarse según tu API
      // Tu backend debe proporcionar un endpoint para buscar directorios
      const foundPaths = await libraryService.findPotentialDirectories("/");

      setPaths(foundPaths || []);
    } catch (error) {
      console.error("Error al buscar directorios:", error);
      showError("No se pudieron encontrar directorios");
    } finally {
      setLoadingPaths(false);
    }
  };

  // Seleccionar una ruta de la lista
  const selectPath = (path) => {
    setFormData((prev) => ({ ...prev, path }));
    setShowPathHelp(false);
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>
          {isEditing ? "Editar biblioteca" : "Añadir nueva biblioteca"}
        </Card.Title>
      </Card.Header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre de la biblioteca */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-4 py-2 bg-background-dark border ${
              errors.name ? "border-red-500" : "border-gray-700"
            } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
            placeholder="Mi biblioteca de películas"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Tipo de biblioteca */}
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Tipo de contenido
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="movies">Películas</option>
            <option value="series">Series</option>
            <option value="music">Música</option>
            <option value="photos">Fotos</option>
          </select>
        </div>

        {/* Ruta de la biblioteca */}
        <div>
          <div className="flex justify-between">
            <label
              htmlFor="path"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Ruta de la carpeta
            </label>
            <button
              type="button"
              className="text-xs text-primary hover:text-primary-hover"
              onClick={() => setShowPathHelp(true)}
            >
              Buscar carpetas
            </button>
          </div>
          <input
            id="path"
            name="path"
            type="text"
            value={formData.path}
            onChange={handleChange}
            className={`w-full px-4 py-2 bg-background-dark border ${
              errors.path ? "border-red-500" : "border-gray-700"
            } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
            placeholder="/ruta/a/tus/medios"
          />
          {errors.path && (
            <p className="mt-1 text-sm text-red-500">{errors.path}</p>
          )}
          <p className="mt-1 text-xs text-text-secondary">
            Introduce la ruta completa a la carpeta que contiene tus archivos
            multimedia.
          </p>
        </div>

        {/* Escaneo automático */}
        <div className="flex items-center">
          <input
            id="scan_automatically"
            name="scan_automatically"
            type="checkbox"
            checked={formData.scan_automatically}
            onChange={handleChange}
            className="h-4 w-4 text-primary focus:ring-primary rounded bg-background-dark border-gray-700"
          />
          <label
            htmlFor="scan_automatically"
            className="ml-2 text-sm text-text-secondary"
          >
            Escanear automáticamente la biblioteca
          </label>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel || (() => navigate("/libraries"))}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            {isEditing ? "Guardar cambios" : "Crear biblioteca"}
          </Button>
        </div>
      </form>

      {/* Modal de ayuda para encontrar carpetas */}
      <Modal
        isOpen={showPathHelp}
        onClose={() => setShowPathHelp(false)}
        title="Seleccionar carpeta"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Selecciona una de las carpetas disponibles o busca nuevas carpetas
            en el servidor.
          </p>

          <div className="mb-4">
            <Button
              variant="primary"
              onClick={handleFindDirectories}
              isLoading={loadingPaths}
              size="sm"
            >
              Buscar carpetas
            </Button>
          </div>

          {loadingPaths ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-text-secondary">Buscando carpetas...</p>
            </div>
          ) : paths.length > 0 ? (
            <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-md divide-y divide-gray-700">
              {paths.map((path, index) => (
                <button
                  key={index}
                  className="block w-full px-4 py-2 text-left hover:bg-background-dark text-text-primary focus:outline-none"
                  onClick={() => selectPath(path.path)}
                >
                  <p className="font-medium">
                    {path.name || path.path.split("/").pop()}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {path.path}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary">
              {loadingPaths
                ? "Buscando carpetas..."
                : "No se encontraron carpetas o aún no has realizado una búsqueda."}
            </div>
          )}
        </div>

        <Modal.Footer
          onCancel={() => setShowPathHelp(false)}
          cancelText="Cerrar"
        />
      </Modal>
    </Card>
  );
};

export default LibrarySetup;
