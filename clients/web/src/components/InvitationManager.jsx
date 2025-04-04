import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function InvitationManager() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newInvitation, setNewInvitation] = useState(null);
  const [copySuccess, setCopySuccess] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [userLimit] = useState(10); // Límite fijo de 10 usuarios
  const [activeTab, setActiveTab] = useState("users");

  useEffect(() => {
    fetchInvitations();
    fetchUserCount();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.get(`${API_URL}/api/auth/invitations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setInvitations(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Error al cargar invitaciones:", err);
      setError(err.response?.data?.message || "Error al cargar invitaciones");
      setLoading(false);
    }
  };

  const fetchUserCount = async () => {
    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.get(`${API_URL}/api/admin/users/count`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUserCount(response.data.count);
    } catch (err) {
      console.error("Error al obtener conteo de usuarios:", err);
    }
  };

  const createInvitation = async () => {
    try {
      // Verificar límite local antes de hacer la petición
      if (userCount >= userLimit) {
        setError(
          `No se pueden crear más invitaciones. Límite máximo de ${userLimit} usuarios alcanzado.`
        );
        return;
      }

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      const response = await axios.post(
        `${API_URL}/api/auth/create-invitation`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNewInvitation(response.data);
      fetchInvitations(); // Actualizar lista
    } catch (err) {
      console.error("Error al crear invitación:", err);
      setError(err.response?.data?.message || "Error al crear invitación");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopySuccess("¡Copiado!");
        setTimeout(() => setCopySuccess(""), 2000);
      },
      () => {
        setCopySuccess("Error al copiar");
      }
    );
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getInvitationLink = (code) => {
    return `${window.location.origin}/register?code=${code}`;
  };

  const remainingSlots = userLimit - userCount;

  if (loading) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-center mt-4 text-gray-400">
          Cargando invitaciones...
        </p>
      </div>
    );
  }

  return (
    <div>
      {activeTab === "users" && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Gestión de Usuarios</h2>
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">
              Gestión de Invitaciones
            </h3>

            {error && (
              <div className="bg-red-600 text-white p-3 rounded mb-4">
                {error}
                <button onClick={() => setError(null)} className="float-right">
                  ×
                </button>
              </div>
            )}

            {/* Información de límite de usuarios */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Capacidad del Grupo</h4>
              <div className="flex items-center">
                <div className="w-full bg-gray-600 rounded-full h-2.5 mr-2">
                  <div
                    className={`h-2.5 rounded-full ${
                      userCount >= userLimit ? "bg-red-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${(userCount / userLimit) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm whitespace-nowrap">
                  {userCount}/{userLimit} usuarios
                </span>
              </div>

              {remainingSlots > 0 ? (
                <p className="text-sm text-gray-300 mt-1">
                  Puedes invitar a {remainingSlots}{" "}
                  {remainingSlots === 1 ? "persona más" : "personas más"}.
                </p>
              ) : (
                <p className="text-sm text-red-300 mt-1">
                  Has alcanzado el límite máximo de usuarios.
                </p>
              )}
            </div>

            {newInvitation && (
              <div className="bg-green-800 p-4 rounded-lg mb-6">
                <h4 className="font-medium mb-2">Nueva Invitación Creada</h4>
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  <div className="flex-grow">
                    <p className="text-sm text-gray-300 mb-1">Código:</p>
                    <div className="bg-gray-700 p-2 rounded font-mono">
                      {newInvitation.code}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(newInvitation.code)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    {copySuccess === "¡Copiado!"
                      ? copySuccess
                      : "Copiar Código"}
                  </button>
                </div>
                <div className="mb-2">
                  <p className="text-sm text-gray-300 mb-1">
                    Enlace de Invitación:
                  </p>
                  <div className="bg-gray-700 p-2 rounded break-all">
                    {getInvitationLink(newInvitation.code)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-400">
                    Expira: {formatDateTime(newInvitation.expiresAt)}
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(getInvitationLink(newInvitation.code))
                    }
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Copiar Enlace
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6">
              <button
                onClick={createInvitation}
                disabled={remainingSlots <= 0}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${
                  remainingSlots <= 0 ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Crear Nueva Invitación
              </button>
              <p className="text-gray-400 text-sm mt-1">
                Las invitaciones son válidas por 1 hora desde su creación.
              </p>
            </div>

            <h4 className="font-medium mb-3">Historial de Invitaciones</h4>

            {invitations.length === 0 ? (
              <p className="text-gray-400 text-center py-4">
                No hay invitaciones para mostrar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-700 rounded-lg">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Expira
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Usado Por
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-600">
                    {invitations.map((invitation) => {
                      const isExpired =
                        new Date(invitation.expires_at) < new Date();
                      const isUsed = invitation.used === 1;

                      return (
                        <tr key={invitation.id}>
                          <td className="px-4 py-3 whitespace-nowrap font-mono">
                            {invitation.code}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDateTime(invitation.expires_at)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isUsed ? (
                              <span className="px-2 py-1 text-xs rounded bg-green-800 text-green-100">
                                Usado
                              </span>
                            ) : isExpired ? (
                              <span className="px-2 py-1 text-xs rounded bg-red-800 text-red-100">
                                Expirado
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded bg-blue-800 text-blue-100">
                                Activo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isUsed && invitation.used_by_username ? (
                              <span>
                                {invitation.used_by_username} (
                                {invitation.used_by_email})
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InvitationManager;
