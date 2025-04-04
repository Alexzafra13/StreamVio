import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function RegisterWithInvitation() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    invitationCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  useEffect(() => {
    // Verificar si hay un código en la URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      setFormData({ ...formData, invitationCode: code });
      validateInvitationCode(code);
    }
  }, []);

  // Validar el código de invitación
  const validateInvitationCode = async (code) => {
    setVerifyingCode(true);
    try {
      // Llamar al endpoint para verificar el código
      const response = await axios.get(
        `${API_URL}/api/auth/verify-invitation?code=${code}`
      );

      if (response.data.valid) {
        setCodeVerified(true);
      } else {
        setError(
          response.data.message || "Código de invitación inválido o expirado"
        );
      }
    } catch (err) {
      console.error("Error al verificar código:", err);
      setError(
        err.response?.data?.message ||
          "Error al verificar el código de invitación"
      );
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (!formData.invitationCode) {
      setError("El código de invitación es obligatorio");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/auth/register-with-invitation`,
        {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          invitationCode: formData.invitationCode,
        }
      );

      // Guardar el token y datos de usuario en localStorage
      localStorage.setItem("streamvio_token", response.data.token);
      localStorage.setItem(
        "streamvio_user",
        JSON.stringify({
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
        })
      );

      // Configurar axios para solicitudes futuras
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      // Mostrar mensaje de éxito
      setSuccess(true);

      // Redirigir al inicio después de un breve retraso
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err) {
      console.error("Error al registrarse:", err);
      setError(err.response?.data?.message || "Error al registrar cuenta");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    if (!formData.invitationCode) {
      setError("Ingresa un código de invitación");
      return;
    }
    validateInvitationCode(formData.invitationCode);
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-blue-500 mb-6 text-center">
        Crear Cuenta con Invitación
      </h2>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
      )}

      {success ? (
        <div className="bg-green-600 text-white p-4 rounded text-center">
          <p className="font-bold text-lg mb-2">¡Registro Exitoso!</p>
          <p>Tu cuenta ha sido creada correctamente.</p>
          <p className="mt-2">Redirigiendo a la página de inicio...</p>
        </div>
      ) : !codeVerified ? (
        <div>
          <p className="text-gray-300 mb-4">
            Ingresa el código de invitación que has recibido para crear una
            cuenta.
          </p>

          <form onSubmit={handleVerifyCode} className="mb-4">
            <div className="mb-4">
              <label
                htmlFor="invitationCode"
                className="block text-gray-300 mb-2"
              >
                Código de Invitación
              </label>
              <input
                type="text"
                id="invitationCode"
                name="invitationCode"
                value={formData.invitationCode}
                onChange={handleChange}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
                required
                disabled={verifyingCode}
              />
            </div>

            <button
              type="submit"
              disabled={verifyingCode}
              className={`w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition ${
                verifyingCode ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {verifyingCode ? "Verificando..." : "Verificar Código"}
            </button>
          </form>
        </div>
      ) : (
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

          <div className="mb-4 bg-blue-900 p-3 rounded">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-green-400 mr-2"
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
              <p className="text-sm">Código de invitación verificado</p>
            </div>
            <p className="text-xs text-gray-300 mt-1">
              Código: {formData.invitationCode}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Creando cuenta..." : "Crear Cuenta"}
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <p className="text-gray-400">
          ¿Ya tienes una cuenta?{" "}
          <a href="/auth" className="text-blue-400 hover:text-blue-300">
            Iniciar Sesión
          </a>
        </p>
      </div>
    </div>
  );
}

export default RegisterWithInvitation;
