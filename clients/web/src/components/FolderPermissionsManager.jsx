// clients/web/src/components/FolderPermissionsManager.jsx
import React, { useState } from "react";
import { checkFolderPermissions, fixFolderPermissions } from "../utils/auth";

/**
 * Componente para verificar y reparar permisos de carpetas
 * @param {Object} props - Propiedades del componente
 * @param {string} props.folderPath - Ruta de la carpeta
 * @param {function} props.onPermissionsFixed - Callback para cuando se reparan los permisos
 */
function FolderPermissionsManager({ folderPath, onPermissionsFixed }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Verificar permisos de la carpeta
  const checkPermissions = async () => {
    if (!folderPath) {
      setError("Debes proporcionar una ruta de carpeta");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await checkFolderPermissions(folderPath);
      setPermissionStatus(result);

      // Mostrar detalles si hay problemas
      if (!result.hasAccess) {
        setShowDetails(true);
      }
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

  // Reparar permisos de la carpeta
  const repairPermissions = async () => {
    if (!folderPath) {
      setError("Debes proporcionar una ruta de carpeta");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fixFolderPermissions(folderPath);
      setPermissionStatus(result);

      // Notificar que se repararon los permisos
      if (onPermissionsFixed) {
        onPermissionsFixed(result);
      }
    } catch (err) {
      console.error("Error al reparar permisos:", err);
      setError(
        err.response?.data?.message || "Error al reparar permisos de la carpeta"
      );
    } finally {
      setLoading(false);
    }
  };

  // Si no hay ruta de carpeta, no mostrar nada
  if (!folderPath) {
    return null;
  }

  return (
    <div className="mt-4 bg-gray-700 p-4 rounded-lg">
      <h4 className="font-medium mb-2">Verificación de permisos</h4>

      {!permissionStatus ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-300">
            Verifica que el servicio tenga acceso a esta carpeta
          </p>
          <button
            onClick={checkPermissions}
            disabled={loading}
            className={`ml-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm ${
              loading ? "opacity-50 cursor-wait" : ""
            }`}
          >
            {loading ? "Verificando..." : "Verificar acceso"}
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
              <p className="mt-2">
                Para solucionar este problema, el servidor necesita tener
                permisos de lectura y escritura en esta carpeta.
              </p>
            </div>
          )}

          <div className="flex justify-end mt-3">
            <button
              onClick={repairPermissions}
              disabled={loading}
              className={`bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm ${
                loading ? "opacity-50 cursor-wait" : ""
              }`}
            >
              {loading ? "Reparando..." : "Reparar permisos automáticamente"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
    </div>
  );
}

export default FolderPermissionsManager;
