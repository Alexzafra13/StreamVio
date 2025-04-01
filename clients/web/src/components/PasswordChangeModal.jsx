import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function PasswordChangeModal({ onComplete }) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    const checkIfAdmin = async () => {
      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) return;

        const userStr = localStorage.getItem("streamvio_user");
        if (userStr) {
          const userData = JSON.parse(userStr);
          if (userData.username === "admin") {
            setIsAdmin(true);

            // Verificar si es primer inicio de sesión
            try {
              const response = await axios.get(`${API_URL}/api/auth/user`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (response.data && response.data.force_password_change === 1) {
                setIsFirstLogin(true);
              }
            } catch (err) {
              console.error("Error al verificar estado de usuario:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error al verificar si es admin:", err);
      }
    };

    checkIfAdmin();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar que las contraseñas coincidan
    if (formData.newPassword !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    // Validar longitud mínima
    if (formData.newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Para el primer inicio de sesión del admin, podemos enviar una contraseña temporal
      // solo para cumplir con la validación del backend (que luego la ignorará)
      if (isAdmin && isFirstLogin && formData.currentPassword === "") {
        console.log("Primer inicio de sesión de admin detectado");
        formData.currentPassword = "admin";
      }

      await axios.post(`${API_URL}/api/auth/change-password`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Notificar que se completó el cambio
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error("Error al cambiar contraseña:", err);
      if (isAdmin && isFirstLogin && err.response?.status === 401) {
        setError(
          "Error al cambiar la contraseña. Intenta usar 'admin' como contraseña actual para este primer inicio de sesión."
        );
      } else {
        setError(
          err.response?.data?.message || "Error al cambiar la contraseña"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-500">
          Cambio de Contraseña Requerido
        </h2>

        {isAdmin && isFirstLogin && (
          <div className="bg-blue-900 text-white p-4 rounded mb-4">
            <p className="font-semibold">Usuario Administrador</p>
            <p className="text-sm">
              Este es tu primer acceso con el usuario admin. Por seguridad,
              debes cambiar la contraseña predeterminada.
            </p>
            <p className="text-sm mt-2">
              Usa la contraseña inicial "admin" como contraseña actual.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="currentPassword"
              className="block text-gray-300 mb-2"
            >
              Contraseña Actual
            </label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
              required
              placeholder={
                isAdmin && isFirstLogin
                  ? "Usa 'admin' como contraseña actual"
                  : ""
              }
            />
          </div>

          <div className="mb-4">
            <label htmlFor="newPassword" className="block text-gray-300 mb-2">
              Nueva Contraseña
            </label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
              required
              minLength="6"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="block text-gray-300 mb-2"
            >
              Confirmar Nueva Contraseña
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
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Procesando..." : "Cambiar Contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PasswordChangeModal;
