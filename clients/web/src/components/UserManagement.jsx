// clients/web/src/components/UserManagement.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [userLibraryAccess, setUserLibraryAccess] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Obtener usuarios al cargar
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          throw new Error("No hay sesión activa");
        }

        // Obtener datos del usuario actual
        const userStr = localStorage.getItem("streamvio_user");
        if (userStr) {
          const userData = JSON.parse(userStr);
          setCurrentUser(userData);
        }

        // Obtener lista de usuarios
        const response = await axios.get(`${API_URL}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUsers(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error al cargar usuarios:", err);
        setError(err.response?.data?.message || "Error al cargar usuarios");
        setLoading(false);
      }
    };

    // Obtener bibliotecas disponibles
    const fetchLibraries = async () => {
      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) return;

        const response = await axios.get(`${API_URL}/api/libraries`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setLibraries(response.data);
      } catch (err) {
        console.error("Error al cargar bibliotecas:", err);
      }
    };

    fetchUsers();
    fetchLibraries();
  }, []);

  // Función para cambiar el estado de administrador de un usuario
  const toggleAdmin = async (userId) => {
    try {
      // No permitir cambiar el propio estado de admin
      if (currentUser && userId === currentUser.id) {
        setError("No puedes cambiar tus propios privilegios de administrador");
        return;
      }

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.post(
        `${API_URL}/api/admin/users/${userId}/toggle-admin`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Actualizar estado local de usuarios
      setUsers(
        users.map((user) =>
          user.id === userId
            ? { ...user, is_admin: response.data.isAdmin ? 1 : 0 }
            : user
        )
      );
    } catch (err) {
      console.error("Error al cambiar privilegios:", err);
      setError(
        err.response?.data?.message ||
          "Error al cambiar privilegios de administrador"
      );
    }
  };

  // Función para eliminar un usuario
  const deleteUser = async (userId) => {
    try {
      // No permitir eliminar al propio usuario
      if (currentUser && userId === currentUser.id) {
        setError("No puedes eliminar tu propio usuario");
        setShowDeleteConfirm(false);
        return;
      }

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      await axios.delete(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Actualizar estado local de usuarios
      setUsers(users.filter((user) => user.id !== userId));
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      setError(err.response?.data?.message || "Error al eliminar usuario");
      setShowDeleteConfirm(false);
    }
  };

  // Función para mostrar modal de gestión de acceso a bibliotecas
  const showLibraryAccessModal = async (userId) => {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Inicializar objeto de acceso con todas las bibliotecas en false
      const initialAccess = {};
      libraries.forEach((lib) => {
        initialAccess[lib.id] = false;
      });

      setUserLibraryAccess(initialAccess);

      try {
        // Obtener acceso actual a bibliotecas para el usuario
        const response = await axios.get(
          `${API_URL}/api/admin/users/${userId}/libraries`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Si la API responde correctamente, actualizar el estado con los datos reales
        setUserLibraryAccess(response.data.access || initialAccess);
      } catch (error) {
        // Si hay un error con la API específica, continuamos con el acceso inicial
        // pero mostramos una advertencia en la consola
        console.warn(
          "No se pudo obtener el acceso actual a bibliotecas:",
          error
        );
        // No mostramos error al usuario para permitir continuar con la funcionalidad
      }

      setSelectedUserId(userId);
      setShowLibraryModal(true);
    } catch (err) {
      console.error("Error al preparar el modal de bibliotecas:", err);
      setError(err.response?.data?.message || "Error al gestionar bibliotecas");
    }
  };

  // Función para actualizar acceso a bibliotecas
  const updateLibraryAccess = async () => {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      await axios.post(
        `${API_URL}/api/admin/users/${selectedUserId}/libraries`,
        { access: userLibraryAccess },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowLibraryModal(false);
    } catch (err) {
      console.error("Error al actualizar acceso a bibliotecas:", err);
      setError(
        err.response?.data?.message ||
          "Error al actualizar acceso a bibliotecas"
      );
    }
  };

  // Función para cambiar acceso a una biblioteca específica
  const toggleLibraryAccess = (libraryId) => {
    setUserLibraryAccess((prev) => ({
      ...prev,
      [libraryId]: !prev[libraryId],
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Gestión de Usuarios</h2>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-700 rounded-lg">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Fecha de creación
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-sm mr-3">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                    <span>
                      {user.username}
                      {currentUser && currentUser.id === user.id && (
                        <span className="text-gray-400 text-xs ml-2">(Tú)</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{user.email}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {user.is_admin ? (
                    <span className="px-2 py-1 text-xs rounded bg-blue-800 text-blue-100">
                      Administrador
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded bg-gray-600 text-gray-100">
                      Usuario
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleAdmin(user.id)}
                      className={`${
                        user.is_admin
                          ? "bg-gray-600 hover:bg-gray-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      } text-white px-2 py-1 rounded text-xs`}
                      disabled={currentUser && currentUser.id === user.id}
                      title={
                        currentUser && currentUser.id === user.id
                          ? "No puedes cambiar tus propios privilegios"
                          : user.is_admin
                          ? "Quitar privilegios de administrador"
                          : "Hacer administrador"
                      }
                    >
                      {user.is_admin ? "Quitar admin" : "Hacer admin"}
                    </button>
                    <button
                      onClick={() => showLibraryAccessModal(user.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
                      title="Gestionar acceso a bibliotecas"
                    >
                      Bibliotecas
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setShowDeleteConfirm(true);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                      disabled={currentUser && currentUser.id === user.id}
                      title={
                        currentUser && currentUser.id === user.id
                          ? "No puedes eliminar tu propio usuario"
                          : "Eliminar usuario"
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                  No se encontraron usuarios
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para gestionar acceso a bibliotecas */}
      {showLibraryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              Gestionar Acceso a Bibliotecas
            </h3>
            <p className="text-gray-400 mb-4">
              Selecciona a qué bibliotecas puede acceder este usuario:
            </p>

            <div className="max-h-60 overflow-y-auto mb-4">
              {libraries.map((library) => (
                <div key={library.id} className="mb-2 flex items-center">
                  <input
                    type="checkbox"
                    id={`library-${library.id}`}
                    checked={!!userLibraryAccess[library.id]}
                    onChange={() => toggleLibraryAccess(library.id)}
                    className="mr-2"
                  />
                  <label
                    htmlFor={`library-${library.id}`}
                    className="flex-grow"
                  >
                    <span className="font-medium">{library.name}</span>
                    <span className="text-sm text-gray-400 ml-2">
                      ({library.type})
                    </span>
                  </label>
                </div>
              ))}
              {libraries.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No hay bibliotecas disponibles
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowLibraryModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={updateLibraryAccess}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar usuario */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-red-500">
              Confirmar Eliminación
            </h3>
            <p className="text-gray-300 mb-4">
              ¿Estás seguro de que deseas eliminar este usuario? Esta acción no
              se puede deshacer.
            </p>
            <p className="text-gray-400 mb-6 text-sm">
              Se eliminarán todos los datos asociados a este usuario, incluyendo
              su historial, favoritos y configuraciones personales.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteUser(selectedUserId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
