import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import PasswordChangeModal from "../components/PasswordChangeModal";
import AdminFirstLogin from "../components/AdminFirstLogin";

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
  const [isAdminFirstLogin, setIsAdminFirstLogin] = useState(false);

  useEffect(() => {
    // Verificar si hay un token guardado
    const checkLoggedIn = async () => {
      const token = localStorage.getItem("streamvio_token");

      if (token) {
        try {
          // Configurar el token en los headers
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          // Intentar obtener información del usuario actual
          const response = await axios.get(`${API_URL}/api/auth/user`);
          setCurrentUser(response.data);

          // Verificar si es admin y requiere cambio de contraseña
          if (
            response.data.username === "admin" &&
            response.data.force_password_change === 1
          ) {
            setIsAdminFirstLogin(true);
            setRequirePasswordChange(false); // No mostrar el modal regular de cambio de contraseña
          }
          // Verificar si se requiere cambio de contraseña (para otros usuarios)
          else if (response.data.force_password_change === 1) {
            setRequirePasswordChange(true);
          }
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

      // Verificar si es admin y requiere cambio de contraseña
      if (
        response.data.username === "admin" &&
        response.data.requirePasswordChange
      ) {
        setIsAdminFirstLogin(true);
      }
      // Verificar si se requiere cambio de contraseña (para otros usuarios)
      else if (response.data.requirePasswordChange) {
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
    setIsAdminFirstLogin(false);
  };

  // Función para manejar el cambio de contraseña completo
  const handlePasswordChangeComplete = () => {
    setRequirePasswordChange(false);
  };

  // Función para manejar la configuración inicial de admin completa
  const handleAdminSetupComplete = (newEmail) => {
    setIsAdminFirstLogin(false);
    // Actualizar email del usuario en el estado si cambió
    if (newEmail && currentUser) {
      setCurrentUser({
        ...currentUser,
        email: newEmail,
      });
    }
  };

  // Valor del contexto
  const value = {
    currentUser,
    loading,
    initialized,
    requirePasswordChange,
    isAdminFirstLogin,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {requirePasswordChange && (
        <PasswordChangeModal onComplete={handlePasswordChangeComplete} />
      )}
      {isAdminFirstLogin && (
        <AdminFirstLogin onComplete={handleAdminSetupComplete} />
      )}
      {children}
    </AuthContext.Provider>
  );
};
