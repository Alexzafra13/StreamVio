import React, { useState } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

export const LoginForm = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Limpiar mensaje de error al modificar campos
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, formData);

      // Guardar token en localStorage
      localStorage.setItem("streamvio_token", response.data.token);
      localStorage.setItem(
        "streamvio_user",
        JSON.stringify({
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
          isAdmin: response.data.isAdmin,
        })
      );

      // Configurar axios para enviar el token en solicitudes futuras
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      // Notificar éxito al componente padre
      if (onLoginSuccess) {
        onLoginSuccess(response.data);
      } else {
        // Notificar cambio en la autenticación
        window.dispatchEvent(new Event("streamvio-auth-change"));

        // Redirigir a la página principal
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (err) {
      console.error("Error de inicio de sesión:", err);
      setError(
        err.response?.data?.message ||
          "Error al iniciar sesión. Verifica tus credenciales."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-blue-500 mb-6 text-center">
        Iniciar Sesión
      </h2>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
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
          />
        </div>

        <div className="mb-6">
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
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition ${
            loading ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
        </button>
      </form>
    </div>
  );
};

export const InvitationInfo = () => {
  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-blue-500 mb-6 text-center">
        ¿Quieres unirte?
      </h2>

      <div className="bg-gray-700 p-4 rounded-lg mb-4">
        <h3 className="text-lg font-semibold mb-2">Se requiere invitación</h3>
        <p className="text-gray-300 mb-3">
          StreamVio es un servicio privado que requiere una invitación para
          registrarse.
        </p>
        <p className="text-gray-300">
          Si has recibido un código de invitación, por favor visita el enlace
          que se te proporcionó o utiliza el botón de abajo.
        </p>
      </div>

      <a
        href="/register"
        className="block w-full bg-green-600 text-white py-3 rounded-md font-medium hover:bg-green-700 transition text-center"
      >
        Tengo un código de invitación
      </a>

      <div className="mt-4 text-center text-gray-400 text-sm">
        <p>
          StreamVio funciona por invitación para garantizar una experiencia de
          calidad para todos los usuarios.
        </p>
      </div>
    </div>
  );
};

export const RegisterForm = ({ onRegisterSuccess }) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar que las contraseñas coinciden
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Enviar solo username, email y password (sin confirmPassword)
      const { confirmPassword, ...registerData } = formData;
      const response = await axios.post(
        `${API_URL}/api/auth/register`,
        registerData
      );

      // Guardar token en localStorage
      localStorage.setItem("streamvio_token", response.data.token);
      localStorage.setItem(
        "streamvio_user",
        JSON.stringify({
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
        })
      );

      // Configurar axios para enviar el token en solicitudes futuras
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      // Notificar éxito al componente padre
      if (onRegisterSuccess) {
        onRegisterSuccess(response.data);
      } else {
        // Notificar cambio en la autenticación
        window.dispatchEvent(new Event("streamvio-auth-change"));

        // Redirigir a la página principal
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (err) {
      console.error("Error de registro:", err);
      setError(
        err.response?.data?.message ||
          "Error al registrar la cuenta. Intenta con otro email o nombre de usuario."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-blue-500 mb-6 text-center">
        Crear Cuenta
      </h2>

      <div className="bg-yellow-700 text-white p-3 rounded mb-4 text-center">
        <p className="font-semibold">Registro desactivado</p>
        <p className="text-sm">
          El registro directo ha sido desactivado. Por favor, solicita una
          invitación para unirte.
        </p>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="opacity-50 pointer-events-none">
        <div className="mb-4">
          <label htmlFor="username" className="block text-gray-300 mb-2">
            Nombre de usuario
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            required
            disabled
          />
        </div>

        <div className="mb-4">
          <label htmlFor="registerEmail" className="block text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            id="registerEmail"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            required
            disabled
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="registerPassword"
            className="block text-gray-300 mb-2"
          >
            Contraseña
          </label>
          <input
            type="password"
            id="registerPassword"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-3 focus:outline-none focus:border-blue-500"
            required
            minLength="6"
            disabled
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
            disabled
          />
        </div>

        <button
          type="submit"
          disabled={true}
          className="w-full bg-gray-600 text-white py-3 rounded-md font-medium opacity-50 cursor-not-allowed"
        >
          Crear Cuenta
        </button>
      </form>

      <div className="mt-4 text-center">
        <a href="/register" className="text-blue-400 hover:text-blue-300">
          Registrarse con código de invitación
        </a>
      </div>
    </div>
  );
};
