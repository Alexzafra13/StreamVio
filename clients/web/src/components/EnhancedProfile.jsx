import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import PasswordChangeModal from "./PasswordChangeModal";

// Usar la configuración correcta de la API
const API_URL = apiConfig.API_URL;

function EnhancedProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.get(`${API_URL}/api/auth/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Error al obtener datos del perfil:", err);
      setError(err.response?.data?.message || "Error al cargar el perfil");
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Información no disponible";

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      console.error("Error al formatear fecha:", e);
      return "Fecha inválida";
    }
  };

  const handlePasswordChangeComplete = () => {
    setShowPasswordModal(false);
    // Refrescar los datos del usuario
    fetchUserProfile();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3">Cargando perfil...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-600 text-white p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-2">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl text-red-500 mb-4">Acceso Restringido</h2>
        <p className="mb-4">Debes iniciar sesión para acceder a esta página.</p>
        <a
          href="/auth"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded inline-block transition"
        >
          Iniciar Sesión
        </a>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-8">
      <div className="flex items-center justify-center mb-8">
        <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold">
          {user.username ? user.username.charAt(0).toUpperCase() : "U"}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-700 p-4 rounded">
          <h3 className="text-gray-400 text-sm mb-1">Nombre de usuario</h3>
          <p className="text-xl">{user.username}</p>
        </div>

        <div className="bg-gray-700 p-4 rounded">
          <h3 className="text-gray-400 text-sm mb-1">Email</h3>
          <p className="text-xl">{user.email}</p>
        </div>

        <div className="bg-gray-700 p-4 rounded">
          <h3 className="text-gray-400 text-sm mb-1">Miembro desde</h3>
          <p className="text-xl">{formatDate(user.created_at)}</p>
        </div>

        <div className="bg-gray-700 p-4 rounded">
          <h3 className="text-gray-400 text-sm mb-1">Tipo de cuenta</h3>
          <p className="text-xl">
            {user.isAdmin || user.is_admin ? (
              <span className="text-blue-400">Administrador</span>
            ) : (
              "Plan Básico"
            )}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          onClick={() => setShowPasswordModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition"
        >
          Cambiar Contraseña
        </button>

        <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded transition">
          Editar Perfil
        </button>

        {user.isAdmin || user.is_admin ? (
          <a
            href="/admin"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded transition inline-block"
          >
            Panel de Administración
          </a>
        ) : null}
      </div>

      {/* Modal de cambio de contraseña */}
      {showPasswordModal && (
        <PasswordChangeModal onComplete={handlePasswordChangeComplete} />
      )}
    </div>
  );
}

export default EnhancedProfile;
