import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import PasswordChangeModal from "../components/PasswordChangeModal";

const API_URL = apiConfig.API_URL;

// Crear el contexto
const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);

  useEffect(() => {
    // Verificar si hay un token guardado
    const checkLoggedIn = async () => {
      const token = localStorage.getItem("streamvio_token");

      if (token) {
        try {
          // Configurar el token en los headers
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          // Verificar si se requiere cambio de contraseña
          try {
            const passwordCheckResponse = await axios.get(
              `${API_URL}/api/auth/check-password-change`
            );
            setRequirePasswordChange(
              passwordCheckResponse.data.requirePasswordChange
            );
          } catch (passwordCheckError) {
            // Si hay un error 403 con requirePasswordChange, significa que se necesita cambiar la contraseña
            if (
              passwordCheckError.response?.status === 403 &&
              passwordCheckError.response?.data?.requirePasswordChange
            ) {
              setRequirePasswordChange(true);
            }
          }

          // Intentar obtener información del usuario actual
          const response = await axios.get(`${API_URL}/api/auth/user`);
          setCurrentUser(response.data);
        } catch (error) {
          console.log("Token inválido o expirado:", error);
          // Si hay un error, limpiar el token
          localStorage.removeItem("streamvio_token");
          localStorage.removeItem("streamvio_user");
          delete axios.defaults.headers.common["Authorization"];
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

      // Guardar token y datos de usuario
      localStorage.setItem("streamvio_token", response.data.token);
      localStorage.setItem(
        "streamvio_user",
        JSON.stringify({
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
        })
      );

      // Configurar axios para enviar el token en solicitudes futuras
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      setCurrentUser({
        id: response.data.userId,
        username: response.data.username,
        email: response.data.email,
      });

      // Verificar si se requiere cambio de contraseña
      if (response.data.requirePasswordChange) {
        setRequirePasswordChange(true);
      }

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

      // Guardar token y datos de usuario
      localStorage.setItem("streamvio_token", response.data.token);
      localStorage.setItem(
        "streamvio_user",
        JSON.stringify({
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
        })
      );

      // Configurar axios para enviar el token en solicitudes futuras
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      setCurrentUser({
        id: response.data.userId,
        username: response.data.username,
        email: response.data.email,
      });

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
  };

  // Función para manejar el cambio de contraseña completo
  const handlePasswordChangeComplete = () => {
    setRequirePasswordChange(false);
  };

  // Valor del contexto
  const value = {
    currentUser,
    loading,
    initialized,
    requirePasswordChange,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {requirePasswordChange && (
        <PasswordChangeModal onComplete={handlePasswordChangeComplete} />
      )}
      {children}
    </AuthContext.Provider>
  );
};
