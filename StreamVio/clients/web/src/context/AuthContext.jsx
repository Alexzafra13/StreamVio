import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const API_URL = "http://localhost:3000";

// Crear el contexto
const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Verificar si hay un token guardado
    const checkLoggedIn = async () => {
      const token = localStorage.getItem('streamvio_token');
      
      if (token) {
        try {
          // Configurar el token en los headers
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Intentar obtener información del usuario actual
          const response = await axios.get(`${API_URL}/api/auth/user`);
          setCurrentUser(response.data);
        } catch (error) {
          console.log("Token inválido o expirado:", error);
          // Si hay un error, limpiar el token
          localStorage.removeItem('streamvio_token');
          localStorage.removeItem('streamvio_user');
          delete axios.defaults.headers.common['Authorization'];
        }
      } else {
        // Intentar obtener información del usuario del localStorage (fallback)
        const userStr = localStorage.getItem('streamvio_user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
          } catch (e) {
            console.error("Error al parsear datos de usuario:", e);
            localStorage.removeItem('streamvio_user');
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
      const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      
      // Guardar token y datos de usuario
      localStorage.setItem('streamvio_token', response.data.token);
      localStorage.setItem('streamvio_user', JSON.stringify({
        id: response.data.userId,
        username: response.data.username,
        email: response.data.email
      }));
      
      // Configurar axios para enviar el token en solicitudes futuras
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      
      setCurrentUser({
        id: response.data.userId,
        username: response.data.username,
        email: response.data.email
      });
      
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
        password
      });
      
      // Guardar token y datos de usuario
      localStorage.setItem('streamvio_token', response.data.token);
      localStorage.setItem('streamvio_user', JSON.stringify({
        id: response.data.userId,
        username: response.data.username,
        email: response.data.email
      }));
      
      // Configurar axios para enviar el token en solicitudes futuras
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      
      setCurrentUser({
        id: response.data.userId,
        username: response.data.username,
        email: response.data.email
      });
      
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Función para cerrar sesión
  const logout = () => {
    // Eliminar token y datos de usuario
    localStorage.removeItem('streamvio_token');
    localStorage.removeItem('streamvio_user');
    
    // Eliminar el token de los headers
    delete axios.defaults.headers.common['Authorization'];
    
    // Actualizar estado
    setCurrentUser(null);
  };

  // Valor del contexto
  const value = {
    currentUser,
    loading,
    initialized,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};