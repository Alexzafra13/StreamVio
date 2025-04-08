import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

// Crear el contexto
const AuthContext = createContext(null);

export const useAuth = () => {
  // Agregar verificación para asegurar que el hook se use dentro de un proveedor
  const context = useContext(AuthContext);
  if (context === undefined) {
    // En lugar de lanzar un error, devolver un objeto con valores por defecto
    console.warn("useAuth debe usarse dentro de un AuthProvider");
    return { currentUser: null, loading: false, initialized: true };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  // Función para actualizar el almacenamiento local y el estado
  const updateUserData = (userData) => {
    if (!userData) return;

    // Guardar en localStorage
    localStorage.setItem(
      "streamvio_user",
      JSON.stringify({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        isAdmin: userData.is_admin === 1 || userData.isAdmin === true,
      })
    );

    // Actualizar el estado
    setCurrentUser({
      id: userData.id,
      username: userData.username,
      email: userData.email,
      isAdmin: userData.is_admin === 1 || userData.isAdmin === true,
    });
  };

  // Verificar si se requiere cambio de contraseña
  const checkPasswordChangeRequired = async (token) => {
    if (!token) return false;

    try {
      const response = await axios.get(
        `${API_URL}/api/auth/check-password-change`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.requirePasswordChange) {
        setRequirePasswordChange(true);
        return true;
      } else {
        setRequirePasswordChange(false);
        return false;
      }
    } catch (error) {
      console.error("Error checking password change requirement:", error);
      return false;
    }
  };

  // Efecto para verificar autenticación al cargar
  useEffect(() => {
    // Verificar si hay un token guardado
    const checkLoggedIn = async () => {
      try {
        // Intentar verificar si es primera ejecución (sin usuarios)
        try {
          const firstTimeResponse = await axios.get(
            `${API_URL}/api/auth/check-first-time`
          );

          if (firstTimeResponse.data.isFirstTime) {
            console.log(
              "Primera ejecución detectada - requiere configuración de administrador"
            );
            setIsFirstTimeSetup(true);
            setLoading(false);
            setInitialized(true);
            return;
          }
        } catch (firstTimeError) {
          console.warn("Error al verificar primera ejecución:", firstTimeError);
          // Continuar con la verificación normal
        }

        const token = localStorage.getItem("streamvio_token");
        if (token) {
          try {
            // Configurar el token en los headers
            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

            // Intentar obtener información del usuario actual
            const response = await axios.get(`${API_URL}/api/auth/user`);

            // Guardar datos del usuario
            updateUserData(response.data);

            // Verificar explícitamente si es administrador
            try {
              const adminResponse = await axios.get(
                `${API_URL}/api/auth/verify-admin`
              );
              if (adminResponse.data.isAdmin) {
                const updatedUser = {
                  ...response.data,
                  is_admin: 1,
                };
                updateUserData(updatedUser);
                console.log("Usuario verificado como administrador");
              }
            } catch (adminError) {
              console.log("El usuario no es administrador:", adminError);
            }

            // Verificar estado de cambio de contraseña
            await checkPasswordChangeRequired(token);
          } catch (error) {
            console.log("Token inválido o expirado:", error);
            // Si hay un error, limpiar el token
            localStorage.removeItem("streamvio_token");
            localStorage.removeItem("streamvio_user");
            delete axios.defaults.headers.common["Authorization"];
            setCurrentUser(null);
          }
        } else {
          // Intentar obtener información del usuario del localStorage (fallback)
          const userStr = localStorage.getItem("streamvio_user");
          if (userStr) {
            try {
              const user = JSON.parse(userStr);
              setCurrentUser(user);
            } catch (e) {
              console.error("Error al parsear datos de usuario:", e);
              localStorage.removeItem("streamvio_user");
            }
          }
        }

        setLoading(false);
        setInitialized(true);
      } catch (error) {
        console.log("Error al verificar estado:", error);
        setLoading(false);
        setInitialized(true);
      }
    };

    checkLoggedIn();
  }, []);

  // Función para iniciar sesión
  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });

      // Guardar token
      localStorage.setItem("streamvio_token", response.data.token);

      // Actualizar datos de usuario
      updateUserData({
        id: response.data.userId,
        username: response.data.username,
        email: response.data.email,
        isAdmin: response.data.isAdmin,
      });

      // Configurar axios para enviar el token en solicitudes futuras
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      // Verificar inmediatamente si requiere cambio de contraseña
      await checkPasswordChangeRequired(response.data.token);

      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Función para registrar un nuevo usuario
  const register = async (username, email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        email,
        password,
      });

      // Guardar token
      localStorage.setItem("streamvio_token", response.data.token);

      // Actualizar datos de usuario
      updateUserData({
        id: response.data.userId,
        username: response.data.username,
        email: response.data.email,
      });

      // Configurar axios para enviar el token en solicitudes futuras
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Función para cerrar sesión
  const logout = () => {
    // Eliminar token y datos de usuario
    localStorage.removeItem("streamvio_token");
    localStorage.removeItem("streamvio_user");

    // Eliminar el token de los headers
    delete axios.defaults.headers.common["Authorization"];

    // Actualizar estado
    setCurrentUser(null);
    setRequirePasswordChange(false);

    // Disparar evento personalizado de cambio de autenticación
    window.dispatchEvent(new Event("streamvio-auth-change"));
  };

  // Función para manejar el cambio de contraseña completo
  const handlePasswordChangeComplete = () => {
    setRequirePasswordChange(false);

    // Actualizar la sesión del usuario
    const token = localStorage.getItem("streamvio_token");
    if (token) {
      axios
        .get(`${API_URL}/api/auth/user`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          updateUserData(response.data);
        })
        .catch((error) => {
          console.error("Error al actualizar datos de usuario:", error);
        });
    }
  };

  // Función para manejar la configuración inicial completa
  const handleFirstTimeSetupComplete = () => {
    setIsFirstTimeSetup(false);
    // Recargar la aplicación para aplicar cambios
    window.location.reload();
  };

  // Valor del contexto
  const value = {
    currentUser,
    loading,
    initialized,
    requirePasswordChange,
    isFirstTimeSetup,
    login,
    register,
    logout,
    updateUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {initialized && requirePasswordChange && (
        <PasswordChangeModal onComplete={handlePasswordChangeComplete} />
      )}

      {initialized && isFirstTimeSetup && (
        <FirstTimeSetup onComplete={handleFirstTimeSetupComplete} />
      )}

      {children}
    </AuthContext.Provider>
  );
};

// Importaciones dinámicas y condicionales para los componentes modales
let PasswordChangeModal;
let FirstTimeSetup;

try {
  PasswordChangeModal = require("../components/PasswordChangeModal").default;
} catch (error) {
  console.warn("No se pudo importar PasswordChangeModal:", error);
  // Componente de fallback
  PasswordChangeModal = ({ onComplete }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2>Cambio de contraseña requerido</h2>
        <button
          onClick={onComplete}
          className="bg-blue-600 text-white p-2 rounded"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

try {
  FirstTimeSetup = require("../components/FirstTimeSetup").default;
} catch (error) {
  console.warn("No se pudo importar FirstTimeSetup:", error);
  // Componente de fallback
  FirstTimeSetup = ({ onComplete }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2>Configuración inicial requerida</h2>
        <button
          onClick={onComplete}
          className="bg-blue-600 text-white p-2 rounded"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
