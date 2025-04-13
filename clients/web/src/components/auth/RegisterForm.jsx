import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import { AuthContext } from "../../context/AuthContext.jsx";
import { UIContext } from "../../context/UIContext.jsx";

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    invitationCode: "",
  });
  const [errors, setErrors] = useState({});
  const { register, loading } = useContext(AuthContext);
  const { showSuccess, showError } = useContext(UIContext);
  const navigate = useNavigate();

  // Manejar cambios en los inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Limpiar errores al modificar campo
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Validar el formulario
  const validateForm = () => {
    const newErrors = {};

    // Validar nombre de usuario
    if (!formData.username) {
      newErrors.username = "El nombre de usuario es requerido";
    } else if (formData.username.length < 3) {
      newErrors.username =
        "El nombre de usuario debe tener al menos 3 caracteres";
    }

    // Validar email
    if (!formData.email) {
      newErrors.email = "El email es requerido";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "El email no es válido";
    }

    // Validar contraseña
    if (!formData.password) {
      newErrors.password = "La contraseña es requerida";
    } else if (formData.password.length < 6) {
      newErrors.password = "La contraseña debe tener al menos 6 caracteres";
    }

    // Validar código de invitación
    if (!formData.invitationCode) {
      newErrors.invitationCode = "El código de invitación es requerido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await register(formData);
      showSuccess("¡Registro exitoso! Ahora puedes iniciar sesión");
      navigate("/login");
    } catch (error) {
      console.error("Error al registrarse:", error);

      // Manejar errores específicos de la API
      if (error.response && error.response.data) {
        const errorMsg = error.response.data.message;

        if (errorMsg.includes("nombre de usuario ya está en uso")) {
          setErrors((prev) => ({
            ...prev,
            username: "Este nombre de usuario ya está en uso",
          }));
        } else if (errorMsg.includes("email ya está en uso")) {
          setErrors((prev) => ({
            ...prev,
            email: "Este email ya está registrado",
          }));
        } else if (errorMsg.includes("código de invitación")) {
          setErrors((prev) => ({
            ...prev,
            invitationCode: "Código de invitación inválido o expirado",
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            server: errorMsg || "Error al registrarse",
          }));
        }
      } else {
        showError(
          "No se pudo completar el registro. Inténtalo de nuevo más tarde."
        );
      }
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mensaje de error del servidor */}
        {errors.server && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-md text-sm text-red-200">
            {errors.server}
          </div>
        )}

        {/* Campo Nombre de Usuario */}
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Nombre de usuario
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            className={`w-full px-4 py-2 bg-background-dark border ${
              errors.username ? "border-red-500" : "border-gray-700"
            } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
            value={formData.username}
            onChange={handleChange}
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-500">{errors.username}</p>
          )}
        </div>

        {/* Campo Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={`w-full px-4 py-2 bg-background-dark border ${
              errors.email ? "border-red-500" : "border-gray-700"
            } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
            value={formData.email}
            onChange={handleChange}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Campo Contraseña */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={`w-full px-4 py-2 bg-background-dark border ${
              errors.password ? "border-red-500" : "border-gray-700"
            } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
            value={formData.password}
            onChange={handleChange}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-500">{errors.password}</p>
          )}
        </div>

        {/* Campo Código de Invitación */}
        <div>
          <label
            htmlFor="invitationCode"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Código de invitación
          </label>
          <input
            id="invitationCode"
            name="invitationCode"
            type="text"
            required
            className={`w-full px-4 py-2 bg-background-dark border ${
              errors.invitationCode ? "border-red-500" : "border-gray-700"
            } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
            value={formData.invitationCode}
            onChange={handleChange}
          />
          {errors.invitationCode && (
            <p className="mt-1 text-sm text-red-500">{errors.invitationCode}</p>
          )}
        </div>

        {/* Botón de registro */}
        <div>
          <Button type="submit" isFullWidth isLoading={loading} size="lg">
            Registrarse
          </Button>
        </div>

        {/* Enlace para iniciar sesión */}
        <div className="text-center text-sm text-text-secondary">
          ¿Ya tienes una cuenta?{" "}
          <Link to="/login" className="text-primary hover:text-primary-hover">
            Inicia sesión aquí
          </Link>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;
