import React, { useState } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function AdminFirstLogin({ onComplete }) {
  const [formData, setFormData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Por favor, introduce un email válido");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        throw new Error("No hay sesión activa");
      }

      // Llamada a la nueva ruta de API para la configuración inicial del admin
      const response = await axios.post(
        `${API_URL}/api/auth/setup-admin`,
        {
          email: formData.email,
          newPassword: formData.newPassword,
          // Pasamos la contraseña original como verificación
          currentPassword: "admin",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Guardar el nuevo token recibido del servidor
      if (response.data.token) {
        localStorage.setItem("streamvio_token", response.data.token);

        // Actualizar también las cabeceras para futuras solicitudes
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;
      }

      // Actualizar el email en el localStorage
      const userStr = localStorage.getItem("streamvio_user");
      if (userStr) {
        const userData = JSON.parse(userStr);
        userData.email = formData.email;
        localStorage.setItem("streamvio_user", JSON.stringify(userData));
      }

      // Mostrar mensaje de éxito brevemente
      setSuccess(true);

      // Esperar un poco para que el usuario vea el mensaje de éxito
      setTimeout(() => {
        // Notificar que se completó la configuración
        if (onComplete) {
          onComplete(formData.email);
        }

        // Redirigir al dashboard o página principal
        window.location.href = "/";
      }, 1500);
    } catch (err) {
      console.error("Error al configurar cuenta admin:", err);
      setError(
        err.response?.data?.message ||
          "Error al configurar la cuenta de administrador"
      );
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-500">
          Configuración Inicial de Administrador
        </h2>

        <div className="bg-blue-900 text-white p-4 rounded mb-4">
          <p className="font-semibold">¡Bienvenido a StreamVio!</p>
          <p className="text-sm">
            Este es el primer inicio de sesión. Por favor, configura tu cuenta
            de administrador con tu email y contraseña personales.
          </p>
        </div>

        {error && (
          <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
        )}

        {success && (
          <div className="bg-green-600 text-white p-3 rounded mb-4">
            ¡Configuración exitosa! Redireccionando...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
              required
              placeholder="tu@email.com"
              disabled={loading || success}
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
              disabled={loading || success}
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="block text-gray-300 mb-2"
            >
              Confirmar Contraseña
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
              disabled={loading || success}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className={`w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition ${
              loading || success ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading
              ? "Procesando..."
              : success
              ? "¡Completado!"
              : "Configurar cuenta de administrador"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminFirstLogin;
