import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

/**
 * Componente para verificar y reparar permisos de carpetas
 * @param {Object} props - Propiedades del componente
 * @param {string} props.folderPath - Ruta de la carpeta a verificar
 * @param {function} props.onPermissionsFixed - Callback para cuando se completa la reparación de permisos
 */
function FolderPermissionsManager({ folderPath, onPermissionsFixed }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [fixingPermissions, setFixingPermissions] = useState(false);
  const [fixResult, setFixResult] = useState(null);

  // Efecto para verificar permisos cuando se proporciona una ruta
  useEffect(() => {
    if (folderPath) {
      checkPermissions();
    }
  }, [folderPath]);

  // Verificar permisos de la carpeta
  const checkPermissions = async () => {
    if (!folderPath) {
      setError("Debes proporcionar una ruta de carpeta");
      return;
    }

    setLoading(true);
    setError(null);
    setFixResult(null);

    try {
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

      // Mostrar detalles si hay problemas
      if (!response.data.hasAccess) {
        setShowDetails(true);
      }
    } catch (err) {
      console.error("Error al verificar permisos:", err);

      // Manejar diferentes tipos de errores
      if (err.response && err.response.status === 404) {
        setError(
          "La carpeta no existe. Puedes crearla desde el explorador de archivos."
        );
      } else if (err.response && err.response.status === 403) {
        setError("No tienes permiso para verificar esta carpeta.");
      } else {
        setError(
          err.response?.data?.message ||
            "Error al verificar permisos de la carpeta. Verifica la ruta o tus permisos."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Reparar permisos de la carpeta
  const repairPermissions = async () => {
    if (!folderPath) {
      setError("Debes proporcionar una ruta de carpeta");
      return;
    }

    setFixingPermissions(true);
    setError(null);
    setFixResult(null);

    try {
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

      setFixResult(response.data);

      // Si la reparación fue exitosa, volver a verificar los permisos
      if (response.data.success) {
        // Pequeña pausa para asegurar que los cambios han tenido efecto
        setTimeout(() => {
          checkPermissions();

          // Notificar que se repararon los permisos
          if (onPermissionsFixed) {
            onPermissionsFixed(response.data);
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Error al reparar permisos:", err);

      if (err.response && err.response.status === 403) {
        setError(
          "No tienes permiso para reparar esta carpeta. Necesitas permisos de administrador."
        );
      } else {
        setError(
          err.response?.data?.message ||
            "Error al reparar permisos de la carpeta. Puede que necesites ejecutar como administrador."
        );
      }

      setFixResult({
        success: false,
        error: err.response?.data?.message || "Error desconocido",
      });
    } finally {
      setFixingPermissions(false);
    }
  };

  // Si no hay ruta de carpeta, no mostrar nada
  if (!folderPath) {
    return null;
  }

  return (
    <div className="bg-gray-700 p-4 rounded-lg">
      <h4 className="font-medium mb-2">Verificación de permisos</h4>

      {loading ? (
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
          <span className="text-gray-300">Verificando permisos...</span>
        </div>
      ) : !permissionStatus ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-300">
            Verifica que el servicio tenga acceso a esta carpeta
          </p>
          <button
            onClick={checkPermissions}
            className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Verificar acceso
          </button>
        </div>
      ) : permissionStatus.hasAccess ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg
              className="h-5 w-5 text-green-500 mr-2"
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
            <p className="text-sm text-green-400">
              El servicio tiene permisos correctos para esta carpeta
            </p>
          </div>
          {showDetails && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {showDetails ? "Ocultar detalles" : "Ver detalles"}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-red-500 mr-2"
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
              <p className="text-sm text-red-400">
                El servicio no tiene permisos suficientes para esta carpeta
              </p>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {showDetails ? "Ocultar detalles" : "Ver detalles"}
            </button>
          </div>

          {showDetails && (
            <div className="mt-2 mb-4 bg-gray-800 p-3 rounded text-sm text-gray-300">
              <p>
                <strong>Problema:</strong>{" "}
                {permissionStatus.message || "Permisos insuficientes"}
              </p>
              {permissionStatus.details && (
                <p className="mt-1">
                  <strong>Detalles:</strong> {permissionStatus.details}
                </p>
              )}
              {permissionStatus.error && (
                <p className="mt-1">
                  <strong>Error:</strong> {permissionStatus.error}
                </p>
              )}
              <p className="mt-2">
                Para solucionar este problema, el servidor necesita tener
                permisos de lectura y escritura en esta carpeta.
              </p>
              {permissionStatus.canCreate && (
                <p className="mt-1 text-yellow-400">
                  Esta carpeta no existe pero puede ser creada automáticamente.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end mt-3">
            <button
              onClick={repairPermissions}
              disabled={fixingPermissions}
              className={`bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm ${
                fixingPermissions ? "opacity-50 cursor-wait" : ""
              }`}
            >
              {fixingPermissions
                ? "Reparando..."
                : "Reparar permisos automáticamente"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}

      {fixResult && (
        <div
          className={`mt-4 p-3 rounded ${
            fixResult.success ? "bg-green-800" : "bg-red-800"
          }`}
        >
          <p
            className={`font-medium ${
              fixResult.success ? "text-green-200" : "text-red-200"
            }`}
          >
            {fixResult.success
              ? "✓ Reparación completada"
              : "✗ Error en reparación"}
          </p>
          {fixResult.message && (
            <p className="text-sm mt-1">{fixResult.message}</p>
          )}
          {fixResult.suggestedCommand && (
            <div className="mt-2">
              <p className="text-xs text-gray-300">Comando sugerido:</p>
              <pre className="mt-1 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                {fixResult.suggestedCommand}
              </pre>
              <p className="text-xs mt-1">
                Ejecuta este comando en el servidor como administrador (root)
              </p>
            </div>
          )}
          {fixResult.details && (
            <p className="text-xs mt-1 text-gray-300">{fixResult.details}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default FolderPermissionsManager;
