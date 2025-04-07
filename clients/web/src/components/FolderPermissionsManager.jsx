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
  const [fixingPermissions, setFixingPermissions] = useState(false);
  const [fixResult, setFixResult] = useState(null);

  // Verificar permisos al montar o cuando cambia la ruta
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
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setPermissionStatus(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Error al verificar permisos:", err);

      if (err.response) {
        setError(err.response.data?.message || "Error al verificar permisos");
      } else {
        setError("Error de conexión al verificar permisos");
      }

      setLoading(false);
    }
  };

  // Reparar permisos de la carpeta
  const fixPermissions = async () => {
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
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setFixResult(response.data);

      // Si fue exitoso, verificar nuevamente los permisos después de un breve retraso
      if (response.data.success) {
        setTimeout(() => {
          checkPermissions();

          // Notificar que se han reparado los permisos
          if (onPermissionsFixed) {
            onPermissionsFixed(response.data);
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Error al reparar permisos:", err);

      if (err.response) {
        setError(err.response.data?.message || "Error al reparar permisos");
      } else {
        setError("Error de conexión al reparar permisos");
      }

      setFixResult({
        success: false,
        message: "No se pudieron reparar los permisos",
        error: err.message,
        suggestedCommand: "sudo chmod -R 777 " + folderPath,
      });
    } finally {
      setFixingPermissions(false);
    }
  };

  // Si no hay ruta, no mostrar el componente
  if (!folderPath) {
    return null;
  }

  return (
    <div className="rounded-lg overflow-hidden">
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
        <div>
          <div className="flex items-center mb-2">
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
              ¡Genial! El servicio tiene permisos correctos para esta carpeta
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Esta carpeta tiene los permisos de lectura/escritura necesarios para
            ser usada como biblioteca de medios
          </p>
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
                ¡Problema detectado! El servicio no tiene permisos suficientes
                para esta carpeta
              </p>
            </div>
          </div>

          <div className="mt-2 bg-gray-800 p-3 rounded text-sm">
            <p className="font-semibold text-gray-300">Problema encontrado:</p>
            <p className="mt-1 text-gray-400">
              {permissionStatus.message || "Permisos insuficientes"}
            </p>

            {permissionStatus.details && (
              <p className="mt-2 text-gray-400 text-xs">
                {permissionStatus.details}
              </p>
            )}

            {permissionStatus.canCreate && (
              <p className="mt-2 text-yellow-400 text-xs">
                La carpeta no existe pero puede ser creada automáticamente.
              </p>
            )}

            <div className="mt-4 bg-gray-900 bg-opacity-50 p-2 rounded text-xs">
              <p className="text-gray-300">
                Para usar esta carpeta como biblioteca de medios, el servicio
                necesita tener permisos de lectura y escritura.
              </p>
            </div>
          </div>

          {/* Botón para reparar permisos */}
          <div className="flex justify-end mt-3">
            <button
              onClick={fixPermissions}
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

      {error && (
        <div className="mt-2 text-sm text-red-400 bg-red-900 bg-opacity-30 p-2 rounded">
          {error}
        </div>
      )}

      {/* Resultado de la reparación */}
      {fixResult && (
        <div
          className={`mt-4 p-3 rounded ${
            fixResult.success
              ? "bg-green-800 bg-opacity-30"
              : "bg-red-800 bg-opacity-30"
          }`}
        >
          <p
            className={`font-medium ${
              fixResult.success ? "text-green-400" : "text-red-400"
            }`}
          >
            {fixResult.success
              ? "✓ Reparación completada"
              : "✗ Error en reparación"}
          </p>
          {fixResult.message && (
            <p className="text-sm mt-1 text-gray-300">{fixResult.message}</p>
          )}
          {fixResult.suggestedCommand && (
            <div className="mt-2">
              <p className="text-xs text-gray-400">
                Comando sugerido para ejecutar manualmente:
              </p>
              <pre className="mt-1 p-2 bg-gray-900 rounded text-xs overflow-x-auto text-blue-300">
                {fixResult.suggestedCommand}
              </pre>
              <p className="text-xs mt-1 text-gray-400">
                Ejecuta este comando en el servidor como administrador (root)
              </p>
            </div>
          )}
          {fixResult.details && (
            <p className="text-xs mt-1 text-gray-400">{fixResult.details}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default FolderPermissionsManager;
