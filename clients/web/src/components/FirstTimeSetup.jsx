import React, { useState } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function FirstTimeSetup({ onComplete }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      // Enviar solicitud para crear el primer usuario administrador
      const response = await axios.post(
        `${API_URL}/api/auth/setup-first-user`,
        {
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }
      );

      // Guardar token y datos de usuario
      localStorage.setItem("streamvio_token", response.data.token);
      localStorage.setItem(
        "streamvio_user",
        JSON.stringify({
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
          isAdmin: true,
        })
      );

      // Configurar axios
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      // Notificar al componente padre
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error("Error en configuración inicial:", err);
      setError(
        err.response?.data?.message || "Error en la configuración inicial"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-500">
          Bienvenido a StreamVio
        </h2>

        <div className="bg-blue-900 text-white p-4 rounded mb-4">
          <p className="font-semibold">Configuración Inicial</p>
          <p className="text-sm">
            Este parece ser tu primer acceso. Por favor, configura tu cuenta de
            administrador.
          </p>
        </div>

        {error && (
          <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-gray-300 mb-2">
              Nombre de Usuario
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

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
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-gray-300 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
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
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Configurando..." : "Completar Configuración"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default FirstTimeSetup;
