// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from "react";
import authService from "../services/authService.js";

// Crear el contexto con un valor inicial vacío
export const AuthContext = createContext();

/**
 * Proveedor de contexto de autenticación
 * Gestiona el estado de autenticación y operaciones relacionadas
 */
export const AuthProvider = ({ children }) => {
  // Estado para el usuario actual
  const [user, setUser] = useState(null);
  // Estado de carga durante operaciones de autenticación
  const [loading, setLoading] = useState(true);
  // Estado para indicar si es la primera vez que se ejecuta la app
  const [isFirstTime, setIsFirstTime] = useState(false);
  // Estado para indicar si el usuario necesita cambiar su contraseña
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);

  // Cargar usuario al montar el componente
  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true);

        // Obtener usuario del almacenamiento local
        const storedUser = authService.getCurrentUser();

        if (storedUser) {
          // Actualizar el estado con el usuario almacenado
          setUser(storedUser);
          setRequirePasswordChange(storedUser.requirePasswordChange || false);
        } else {
          // Verificar si es la primera ejecución de la aplicación
          const firstTime = await authService.checkFirstTime();
          setIsFirstTime(firstTime);
        }
      } catch (error) {
        console.error("Error al inicializar autenticación:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Iniciar sesión de usuario
   * @param {string} email
   * @param {string} password
   */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const userData = await authService.login(email, password);
      setUser(userData);
      setRequirePasswordChange(userData.requirePasswordChange || false);
      return userData;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Cerrar sesión de usuario
   */
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setRequirePasswordChange(false);
    } catch (error) {
      console.error("Error en logout:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Registrar un nuevo usuario
   * @param {Object} userData - Datos del usuario (username, email, password, invitationCode)
   */
  const register = useCallback(async (userData) => {
    setLoading(true);
    try {
      const result = await authService.register(userData);
      return result;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Configurar el primer usuario administrador
   * @param {Object} userData - Datos del administrador inicial
   */
  const setupFirstUser = useCallback(async (userData) => {
    setLoading(true);
    try {
      const result = await authService.setupFirstUser(userData);
      setUser(result);
      setIsFirstTime(false);
      return result;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Cambiar contraseña del usuario
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      setLoading(true);
      try {
        const result = await authService.changePassword(
          currentPassword,
          newPassword
        );

        // Actualizar el estado si la contraseña se cambió correctamente
        if (requirePasswordChange) {
          setRequirePasswordChange(false);

          // Actualizar el objeto usuario en el estado y localStorage
          const updatedUser = { ...user, requirePasswordChange: false };
          setUser(updatedUser);
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }

        return result;
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user, requirePasswordChange]
  );

  /**
   * Generar un código de invitación
   */
  const createInvitation = useCallback(async () => {
    setLoading(true);
    try {
      return await authService.createInvitation();
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Verificar si el usuario actual es administrador
   */
  const isAdmin = useCallback(() => {
    return user && user.isAdmin === true;
  }, [user]);

  /**
   * Verificar si hay un usuario autenticado
   */
  const isAuthenticated = useCallback(() => {
    return !!user;
  }, [user]);

  /**
   * Obtener datos actualizados del perfil de usuario
   */
  const refreshUserProfile = useCallback(async () => {
    if (!user) return null;

    try {
      const userData = await authService.getUserProfile();

      // Actualizar el estado con los datos actualizados
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      return updatedUser;
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      return null;
    }
  }, [user]);

  // Valor que se proporcionará al contexto
  const value = {
    user,
    loading,
    isFirstTime,
    requirePasswordChange,
    login,
    logout,
    register,
    setupFirstUser,
    changePassword,
    createInvitation,
    isAdmin,
    isAuthenticated,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
