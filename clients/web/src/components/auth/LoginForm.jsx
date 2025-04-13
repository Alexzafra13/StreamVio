import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import { AuthContext } from "../../context/AuthContext";
import { UIContext } from "../../context/UIContext";

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const { login, loading } = useContext(AuthContext);
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

    // Validar email
    if (!formData.email) {
      newErrors.email = "El email es requerido";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "El email no es válido";
    }

    // Validar contraseña
    if (!formData.password) {
      newErrors.password = "La contraseña es requerida";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await login(formData.email, formData.password);
      showSuccess("¡Sesión iniciada correctamente!");
      navigate("/");
    } catch (error) {
      console.error("Error al iniciar sesión:", error);

      // Manejar errores específicos de la API
      if (error.response && error.response.data) {
        setErrors({
          server:
            error.response.data.message ||
            "Error al iniciar sesión. Verifica tus credenciales.",
        });
      } else {
        showError("No se pudo iniciar sesión. Inténtalo de nuevo más tarde.");
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
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Contraseña
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:text-primary-hover"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
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

        {/* Botón de inicio de sesión */}
        <div>
          <Button type="submit" isFullWidth isLoading={loading} size="lg">
            Iniciar sesión
          </Button>
        </div>

        {/* Enlace para registrarse */}
        <div className="text-center text-sm text-text-secondary">
          ¿No tienes una cuenta?{" "}
          <Link
            to="/register"
            className="text-primary hover:text-primary-hover"
          >
            Regístrate aquí
          </Link>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
