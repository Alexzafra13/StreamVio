import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function FirstTimeSetup({ onComplete }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0); // 0: verificando, 1: configuración usuario, 2: verificando permisos, 3: completado
  const [systemStatus, setSystemStatus] = useState(null);
  const [fixingPermissions, setFixingPermissions] = useState(false);

  // Verificar estado del sistema al cargar
  useEffect(() => {
    checkSystemStatus();
  }, []);

  // Función para verificar estado del sistema
  const checkSystemStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/setup/check`);
      setSystemStatus(response.data);

      // Determinar el paso adecuado
      if (response.data.needsFirstTimeSetup) {
        if (!response.data.permissionsOk) {
          setStep(2); // Problemas de permisos
        } else {
          setStep(1); // Configuración de usuario
        }
      } else {
        // No necesita configuración, pero podemos tener problemas de permisos
        if (!response.data.permissionsOk) {
          setStep(2);
        } else {
          // Todo está bien, completar
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 2000);
        }
      }
    } catch (err) {
      console.error("Error al verificar estado del sistema:", err);
      setError(
        "No se pudo verificar el estado del sistema. Por favor, verifica tu conexión e inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(null);
  };

  // Función para intentar reparar permisos
  const fixPermissions = async () => {
    setFixingPermissions(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/setup/fix-permissions`);

      if (response.data.success) {
        // Si se repararon con éxito, verificar de nuevo el estado
        await checkSystemStatus();
      } else {
        setError(
          "No se pudieron reparar todos los permisos automáticamente. Es posible que necesites hacerlo manualmente."
        );
      }
    } catch (err) {
      console.error("Error al reparar permisos:", err);
      setError(
        "Error al intentar reparar los permisos. Es posible que necesites permisos de administrador."
      );
    } finally {
      setFixingPermissions(false);
    }
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      // Enviar solicitud para crear el primer usuario administrador
      const response = await axios.post(`${API_URL}/api/setup/init`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      // Guardar token y datos de usuario
      localStorage.setItem("streamvio_token", response.data.token);
      localStorage.setItem(
        "streamvio_user",
        JSON.stringify({
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
          isAdmin: true,
        })
      );

      // Configurar axios para solicitudes futuras
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      // Mostrar pantalla de éxito
      setStep(3);
      setLoading(false);

      // Después de 3 segundos, completar el proceso
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 3000);
    } catch (err) {
      console.error("Error en configuración inicial:", err);
      setError(
        err.response?.data?.message || "Error en la configuración inicial"
      );
      setLoading(false);
    }
  };

  // Renderizar paso de verificación
  const renderCheckingStep = () => (
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <h2 className="text-xl font-semibold mb-2">
        Verificando estado del sistema
      </h2>
      <p className="text-gray-300">
        Por favor espera mientras comprobamos el estado de la instalación...
      </p>
    </div>
  );

  // Renderizar paso de configuración de usuario
  const renderUserSetupStep = () => (
    <>
      <h2 className="text-2xl font-bold mb-6 text-center text-blue-500">
        Bienvenido a StreamVio
      </h2>

      <div className="bg-blue-900 text-white p-4 rounded mb-4">
        <p className="font-semibold">Configuración Inicial</p>
        <p className="text-sm">
          Esta es la primera vez que accedes a StreamVio. Por favor, configura
          tu cuenta de administrador para empezar a usar el sistema.
        </p>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="username" className="block text-gray-300 mb-2">
            Nombre de Usuario
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            required
            disabled={loading}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            required
            disabled={loading}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="block text-gray-300 mb-2">
            Contraseña
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            required
            minLength="6"
            disabled={loading}
          />
        </div>

        <div className="mb-6">
          <label htmlFor="confirmPassword" className="block text-gray-300 mb-2">
            Confirmar Contraseña
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            required
            minLength="6"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition ${
            loading ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
              Configurando...
            </span>
          ) : (
            "Completar Configuración"
          )}
        </button>
      </form>
    </>
  );

  // Renderizar paso de verificación/arreglo de permisos
  const renderPermissionsStep = () => (
    <>
      <h2 className="text-2xl font-bold mb-6 text-center text-yellow-500">
        Verificación de Permisos
      </h2>

      <div className="bg-yellow-900 text-white p-4 rounded mb-4">
        <p className="font-semibold">Problemas de Permisos Detectados</p>
        <p className="text-sm">
          StreamVio necesita permisos adecuados en ciertos directorios para
          funcionar correctamente. Los siguientes directorios tienen problemas
          de permisos:
        </p>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
      )}

      <div className="bg-gray-700 p-4 rounded-lg mb-4 max-h-48 overflow-y-auto">
        <ul className="space-y-2">
          {systemStatus &&
            systemStatus.permissionsDetails &&
            systemStatus.permissionsDetails.map((dir, index) => (
              <li key={index} className="flex items-start">
                <svg
                  className="h-5 w-5 text-red-500 mr-2 mt-0.5"
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
                <div>
                  <p className="text-sm font-medium">{dir.path}</p>
                  <p className="text-xs text-gray-400">
                    {dir.message || dir.error}
                  </p>
                </div>
              </li>
            ))}
        </ul>
      </div>

      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <h3 className="font-medium text-yellow-400 mb-2">
          Posibles soluciones:
        </h3>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Ejecutar la aplicación con permisos de administrador</li>
          <li>
            Comprobar que el usuario tiene permisos de escritura en la carpeta
            de datos
          </li>
          <li>
            Usar el script de instalación con sudo (Linux/Mac) o como
            administrador (Windows)
          </li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-4">
        <button
          onClick={fixPermissions}
          disabled={fixingPermissions}
          className={`bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg transition flex-1 ${
            fixingPermissions ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {fixingPermissions ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
              Reparando permisos...
            </span>
          ) : (
            "Reparar Permisos Automáticamente"
          )}
        </button>
        <button
          onClick={checkSystemStatus}
          disabled={loading || fixingPermissions}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
        >
          Verificar de Nuevo
        </button>
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={() =>
            systemStatus?.needsFirstTimeSetup ? setStep(1) : onComplete?.()
          }
          className="text-gray-400 hover:text-blue-400 text-sm"
        >
          {systemStatus?.needsFirstTimeSetup
            ? "Continuar con la configuración de todas formas"
            : "Omitir esta verificación"}
        </button>
      </div>
    </>
  );

  // Renderizar paso de finalización
  const renderCompletedStep = () => (
    <div className="text-center">
      <svg
        className="h-16 w-16 text-green-500 mx-auto mb-4"
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

      <h2 className="text-2xl font-bold mb-4 text-green-500">
        ¡Configuración Completa!
      </h2>

      <p className="text-gray-300 mb-4">
        Tu cuenta de administrador ha sido creada exitosamente. Serás redirigido
        al panel principal en unos momentos.
      </p>

      <div className="animate-pulse">
        <div className="h-2 bg-blue-500 rounded"></div>
      </div>
    </div>
  );

  // Renderizar contenido según el paso actual
  const renderStep = () => {
    switch (step) {
      case 0:
        return renderCheckingStep();
      case 1:
        return renderUserSetupStep();
      case 2:
        return renderPermissionsStep();
      case 3:
        return renderCompletedStep();
      default:
        return renderCheckingStep();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md mx-auto my-10">
        {renderStep()}
      </div>
    </div>
  );
}

export default FirstTimeSetup;
