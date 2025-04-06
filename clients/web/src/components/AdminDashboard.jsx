// clients/web/src/components/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";
import EnhancedInvitationManager from "./EnhancedInvitationManager";
import UserManagement from "./UserManagement";

const API_URL = apiConfig.API_URL;

function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    libraries: 0,
    mediaItems: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          throw new Error("No hay sesión activa");
        }

        const response = await axios.get(`${API_URL}/api/admin/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setStats(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error al cargar estadísticas:", err);
        setError(
          err.response?.data?.message || "Error al cargar datos del panel"
        );
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 font-medium ${
            activeTab === "overview"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Resumen
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 font-medium ${
            activeTab === "users"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Usuarios
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`px-4 py-2 font-medium ${
            activeTab === "invitations"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Invitaciones
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`px-4 py-2 font-medium ${
            activeTab === "media"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Contenido
        </button>
        <button
          onClick={() => setActiveTab("system")}
          className={`px-4 py-2 font-medium ${
            activeTab === "system"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Sistema
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Resumen del Sistema</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-700 p-6 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-gray-400 text-sm">Usuarios</h3>
                  <p className="text-3xl font-bold">{stats.users}</p>
                </div>
                <div className="bg-blue-600 p-2 rounded">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 p-6 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-gray-400 text-sm">Bibliotecas</h3>
                  <p className="text-3xl font-bold">{stats.libraries}</p>
                </div>
                <div className="bg-green-600 p-2 rounded">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 p-6 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-gray-400 text-sm">
                    Elementos Multimedia
                  </h3>
                  <p className="text-3xl font-bold">{stats.mediaItems}</p>
                </div>
                <div className="bg-purple-600 p-2 rounded">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-xl font-bold mb-4">Actividad Reciente</h3>
          <div className="bg-gray-700 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-600">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Acción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Elemento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-600">
                {stats.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {activity.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {activity.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {activity.item}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(activity.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-4 text-center text-gray-400"
                    >
                      No hay actividad reciente
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "invitations" && (
        <div>
          <EnhancedInvitationManager />
        </div>
      )}

      {activeTab === "users" && (
        <div>
          <UserManagement />
        </div>
      )}

      {activeTab === "media" && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Gestión de Contenido</h2>
          <p className="text-gray-400">
            Esta función estará disponible en la próxima versión.
          </p>
        </div>
      )}

      {activeTab === "system" && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Estado del Sistema</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">
                Información del Servidor
              </h3>
              <p className="text-gray-400 mb-2">
                Versión: <span className="text-white">0.1.0</span>
              </p>
              <p className="text-gray-400 mb-2">
                Entorno: <span className="text-white">Desarrollo</span>
              </p>
              <p className="text-gray-400">
                Estado: <span className="text-green-500">En línea</span>
              </p>
            </div>
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Transcodificación</h3>
              <p className="text-gray-400 mb-2">
                Estado: <span className="text-green-500">Activo</span>
              </p>
              <p className="text-gray-400 mb-2">
                Trabajos pendientes: <span className="text-white">0</span>
              </p>
              <p className="text-gray-400">
                Trabajos completados: <span className="text-white">0</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
