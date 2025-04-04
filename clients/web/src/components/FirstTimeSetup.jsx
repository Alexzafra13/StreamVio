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
  const [step, setStep] = useState(1); // 1: Datos admin, 2: Configuración completada

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

      // Mostrar pantalla de éxito
      setStep(2);
      setLoading(false);

      // Después de 3 segundos, completar el proceso
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 3000);
    } catch (err) {
      console.error("Error en configuración inicial:", err);
      setError(
        err.response?.data?.message || "Error en la configuración inicial"
      );
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        {step === 1 ? (
          // Paso 1: Formulario de creación de administrador
          <>
            <h2 className="text-2xl font-bold mb-6 text-center text-blue-500">
              Bienvenido a StreamVio
            </h2>

            <div className="bg-blue-900 text-white p-4 rounded mb-4">
              <p className="font-semibold">Configuración Inicial</p>
              <p className="text-sm">
                Este parece ser tu primer acceso. Por favor, configura tu cuenta
                de administrador para empezar a usar StreamVio.
              </p>
            </div>

            {error && (
              <div className="bg-red-600 text-white p-3 rounded mb-4">
                {error}
              </div>
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Configurando...
                  </span>
                ) : (
                  "Completar Configuración"
                )}
              </button>
            </form>
          </>
        ) : (
          // Paso 2: Configuración completada
          <div className="text-center">
            <svg
              className="h-16 w-16 text-green-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>

            <h2 className="text-2xl font-bold mb-4 text-green-500">
              ¡Configuración Completa!
            </h2>

            <p className="text-gray-300 mb-4">
              Tu cuenta de administrador ha sido creada exitosamente. Serás
              redirigido al panel principal en unos momentos.
            </p>

            <div className="animate-pulse">
              <div className="h-2 bg-blue-500 rounded"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FirstTimeSetup;
