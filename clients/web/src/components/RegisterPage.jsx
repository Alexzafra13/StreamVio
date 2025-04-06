import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function RegisterPage() {
  // Estados para manejar los diferentes pasos del registro
  const [step, setStep] = useState("verification"); // "verification" o "registration"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Estado para el código de invitación
  const [invitationCode, setInvitationCode] = useState("");

  // Estado para el formulario de registro
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Efecto para verificar si hay un código en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      setInvitationCode(code);
      verifyInvitationCode(code);
    }
  }, []);

  // Función para verificar código de invitación
  const verifyInvitationCode = async (code) => {
    if (!code) {
      setError("Por favor, ingresa un código de invitación");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/api/auth/verify-invitation?code=${code}`
      );

      if (response.data.valid) {
        // Si el código es válido, pasar al siguiente paso
        setStep("registration");
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
      setLoading(false);
    }
  };

  // Manejar envío del formulario de verificación
  const handleVerifySubmit = (e) => {
    e.preventDefault();
    verifyInvitationCode(invitationCode);
  };

  // Manejar cambios en el formulario de registro
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "invitationCode") {
      setInvitationCode(value);
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setError(null);
  };

  // Manejar envío del formulario de registro
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    // Validar contraseñas
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    // Validar longitud de contraseña
    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/auth/register-with-invitation`,
        {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          invitationCode: invitationCode,
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
        })
      );

      // Establecer éxito
      setSuccess(true);

      // Disparar evento para notificar cambio de autenticación
      window.dispatchEvent(new Event("streamvio-auth-change"));

      // Redirigir a la página principal después de un breve retraso
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

  // Renderizar el paso de verificación
  const renderVerificationStep = () => (
    <div>
      <p className="text-gray-300 mb-4">
        Ingresa el código de invitación que has recibido para crear una cuenta.
      </p>

      <form onSubmit={handleVerifySubmit} className="mb-4">
        <div className="mb-4">
          <label htmlFor="invitationCode" className="block text-gray-300 mb-2">
            Código de Invitación
          </label>
          <input
            type="text"
            id="invitationCode"
            name="invitationCode"
            value={invitationCode}
            onChange={handleChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            required
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
          {loading ? "Verificando..." : "Verificar Código"}
        </button>
      </form>
    </div>
  );

  // Renderizar paso de registro
  const renderRegistrationStep = () => (
    <form onSubmit={handleRegisterSubmit}>
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
        <p className="text-xs text-gray-300 mt-1">Código: {invitationCode}</p>
      </div>

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
        <label htmlFor="confirmPassword" className="block text-gray-300 mb-2">
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
        {loading ? "Creando cuenta..." : "Crear Cuenta"}
      </button>
    </form>
  );

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-blue-500 mb-6 text-center">
        {step === "verification" ? "Verificar Invitación" : "Crear Cuenta"}
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
      ) : step === "verification" ? (
        renderVerificationStep()
      ) : (
        renderRegistrationStep()
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

export default RegisterPage;
