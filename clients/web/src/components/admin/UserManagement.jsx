import React, { useState, useEffect, useContext } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { UIContext } from "../../context/UIContext";
import userService from "../../services/userService";

/**
 * Componente para gestionar usuarios (solo para administradores)
 */
const UserManagement = () => {
  // Estados
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState({
    show: false,
    type: null, // 'create', 'edit', 'delete', 'invite'
    user: null,
  });
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    isAdmin: false,
  });
  const [errors, setErrors] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [invitationCode, setInvitationCode] = useState("");

  const { showSuccess, showError } = useContext(UIContext);

  // Cargar usuarios al montar el componente
  useEffect(() => {
    fetchUsers();
  }, []);

  // Obtener lista de usuarios
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      showError("No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en los inputs del formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Limpiar error al cambiar valor
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.username.trim()) {
      newErrors.username = "El nombre de usuario es obligatorio";
    }

    if (!formData.email.trim()) {
      newErrors.email = "El email es obligatorio";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "El email no es válido";
    }

    if (modalState.type === "create" && !formData.password.trim()) {
      newErrors.password = "La contraseña es obligatoria";
    } else if (modalState.type === "create" && formData.password.length < 6) {
      newErrors.password = "La contraseña debe tener al menos 6 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Abrir modal para crear usuario
  const openCreateModal = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      isAdmin: false,
    });
    setErrors({});
    setModalState({
      show: true,
      type: "create",
      user: null,
    });
  };

  // Abrir modal para editar usuario
  const openEditModal = (user) => {
    setFormData({
      username: user.username,
      email: user.email,
      password: "", // No se carga la contraseña por seguridad
      isAdmin: user.isAdmin,
    });
    setErrors({});
    setModalState({
      show: true,
      type: "edit",
      user,
    });
  };

  // Abrir modal para eliminar usuario
  const openDeleteModal = (user) => {
    setModalState({
      show: true,
      type: "delete",
      user,
    });
  };

  // Abrir modal para generar código de invitación
  const openInviteModal = () => {
    setInvitationCode("");
    setModalState({
      show: true,
      type: "invite",
      user: null,
    });
  };

  // Cerrar modal
  const closeModal = () => {
    setModalState({
      show: false,
      type: null,
      user: null,
    });
  };

  // Crear usuario
  const handleCreateUser = async () => {
    if (!validateForm()) return;

    try {
      setActionLoading(true);
      await userService.createUser(formData);
      showSuccess("Usuario creado correctamente");
      closeModal();
      fetchUsers(); // Recargar lista
    } catch (error) {
      console.error("Error al crear usuario:", error);

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
        } else {
          showError(errorMsg || "Error al crear el usuario");
        }
      } else {
        showError("Error al crear el usuario");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Actualizar usuario
  const handleUpdateUser = async () => {
    if (!validateForm()) return;

    try {
      setActionLoading(true);
      await userService.updateUser(modalState.user.id, formData);
      showSuccess("Usuario actualizado correctamente");
      closeModal();
      fetchUsers(); // Recargar lista
    } catch (error) {
      console.error("Error al actualizar usuario:", error);

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
        } else {
          showError(errorMsg || "Error al actualizar el usuario");
        }
      } else {
        showError("Error al actualizar el usuario");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async () => {
    try {
      setActionLoading(true);
      await userService.deleteUser(modalState.user.id);
      showSuccess("Usuario eliminado correctamente");
      closeModal();
      fetchUsers(); // Recargar lista
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      showError("Error al eliminar el usuario");
    } finally {
      setActionLoading(false);
    }
  };

  // Cambiar estado de administrador
  const handleToggleAdmin = async (userId, currentState) => {
    try {
      await userService.toggleAdmin(userId);
      showSuccess(
        `Privilegios de administrador ${
          currentState ? "revocados" : "concedidos"
        } correctamente`
      );
      fetchUsers(); // Recargar lista
    } catch (error) {
      console.error("Error al cambiar privilegios:", error);
      showError("Error al cambiar privilegios de administrador");
    }
  };

  // Generar código de invitación
  const handleCreateInvitation = async () => {
    try {
      setActionLoading(true);
      const result = await userService.createInvitation();
      setInvitationCode(result.code);
      showSuccess("Código de invitación generado correctamente");
    } catch (error) {
      console.error("Error al generar código de invitación:", error);
      showError("Error al generar código de invitación");
    } finally {
      setActionLoading(false);
    }
  };

  // Copiar código de invitación al portapapeles
  const copyInvitationCode = () => {
    navigator.clipboard
      .writeText(invitationCode)
      .then(() => {
        showSuccess("Código copiado al portapapeles");
      })
      .catch(() => {
        showError("No se pudo copiar el código");
      });
  };

  // Renderizar contenido del modal según su tipo
  const renderModalContent = () => {
    switch (modalState.type) {
      case "create":
        return (
          <>
            <div className="space-y-4">
              {/* Nombre de usuario */}
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
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 bg-background-dark border ${
                    errors.username ? "border-red-500" : "border-gray-700"
                  } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-500">{errors.username}</p>
                )}
              </div>

              {/* Email */}
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
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 bg-background-dark border ${
                    errors.email ? "border-red-500" : "border-gray-700"
                  } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Contraseña */}
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
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 bg-background-dark border ${
                    errors.password ? "border-red-500" : "border-gray-700"
                  } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              {/* Es administrador */}
              <div className="flex items-center">
                <input
                  id="isAdmin"
                  name="isAdmin"
                  type="checkbox"
                  checked={formData.isAdmin}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-primary focus:ring-primary rounded bg-background-dark border-gray-700"
                />
                <label
                  htmlFor="isAdmin"
                  className="ml-2 text-sm text-text-secondary"
                >
                  Otorgar privilegios de administrador
                </label>
              </div>
            </div>
            <Modal.Footer
              onCancel={closeModal}
              onConfirm={handleCreateUser}
              confirmText="Crear usuario"
              isConfirmLoading={actionLoading}
            />
          </>
        );

      case "edit":
        return (
          <>
            <div className="space-y-4">
              {/* Nombre de usuario */}
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
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 bg-background-dark border ${
                    errors.username ? "border-red-500" : "border-gray-700"
                  } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-500">{errors.username}</p>
                )}
              </div>

              {/* Email */}
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
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 bg-background-dark border ${
                    errors.email ? "border-red-500" : "border-gray-700"
                  } rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary`}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Es administrador */}
              <div className="flex items-center">
                <input
                  id="isAdmin"
                  name="isAdmin"
                  type="checkbox"
                  checked={formData.isAdmin}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-primary focus:ring-primary rounded bg-background-dark border-gray-700"
                />
                <label
                  htmlFor="isAdmin"
                  className="ml-2 text-sm text-text-secondary"
                >
                  Otorgar privilegios de administrador
                </label>
              </div>
            </div>
            <Modal.Footer
              onCancel={closeModal}
              onConfirm={handleUpdateUser}
              confirmText="Guardar cambios"
              isConfirmLoading={actionLoading}
            />
          </>
        );

      case "delete":
        return (
          <>
            <div className="text-center py-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto text-red-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <h3 className="text-lg font-bold mb-2">Confirmar eliminación</h3>
              <p className="text-text-secondary mb-1">
                ¿Estás seguro de que deseas eliminar al usuario{" "}
                <strong>{modalState.user?.username}</strong>?
              </p>
              <p className="text-text-secondary text-sm">
                Esta acción es irreversible y eliminará todo su historial de
                visualización y configuraciones.
              </p>
            </div>
            <Modal.Footer
              onCancel={closeModal}
              onConfirm={handleDeleteUser}
              confirmText="Eliminar"
              cancelText="Cancelar"
              isConfirmLoading={actionLoading}
            />
          </>
        );

      case "invite":
        return (
          <>
            <div className="space-y-4">
              <p className="text-text-secondary">
                Genera un código de invitación para que nuevos usuarios puedan
                registrarse en StreamVio.
              </p>

              {!invitationCode ? (
                <Button
                  variant="primary"
                  isFullWidth
                  isLoading={actionLoading}
                  onClick={handleCreateInvitation}
                >
                  Generar código de invitación
                </Button>
              ) : (
                <div className="bg-background-dark border border-gray-700 rounded-md p-4">
                  <p className="text-sm text-text-secondary mb-2">
                    Código de invitación:
                  </p>
                  <div className="flex items-center">
                    <code className="flex-1 bg-black p-2 rounded font-mono">
                      {invitationCode}
                    </code>
                    <button
                      className="ml-2 text-primary hover:text-primary-hover"
                      onClick={copyInvitationCode}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    Comparte este código con la persona que deseas invitar. El
                    código es válido por 24 horas.
                  </p>
                </div>
              )}
            </div>
            <Modal.Footer onCancel={closeModal} cancelText="Cerrar" />
          </>
        );

      default:
        return null;
    }
  };

  // Obtener título del modal
  const getModalTitle = () => {
    switch (modalState.type) {
      case "create":
        return "Crear nuevo usuario";
      case "edit":
        return "Editar usuario";
      case "delete":
        return "Eliminar usuario";
      case "invite":
        return "Generar código de invitación";
      default:
        return "";
    }
  };

  // Esqueletos para estado de carga
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 bg-background-card rounded w-1/4"></div>
          <div className="h-10 bg-background-card rounded w-36"></div>
        </div>

        <Card>
          <div className="animate-pulse">
            <div className="h-8 bg-background-dark rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-background-dark rounded"></div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera con botones de acción */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
        <div className="flex space-x-3">
          <Button variant="ghost" onClick={openInviteModal}>
            Generar invitación
          </Button>
          <Button variant="primary" onClick={openCreateModal}>
            Crear usuario
          </Button>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <Card>
        <Card.Header>
          <Card.Title>Usuarios</Card.Title>
        </Card.Header>

        {users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-text-secondary">No hay usuarios registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-text-secondary border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-background-dark">
                    <td className="px-4 py-3">{user.username}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          user.isAdmin
                            ? "bg-primary bg-opacity-20 text-primary"
                            : "bg-gray-700 text-text-secondary"
                        }`}
                      >
                        {user.isAdmin ? "Administrador" : "Usuario"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <button
                          className="text-text-secondary hover:text-text-primary"
                          onClick={() =>
                            handleToggleAdmin(user.id, user.isAdmin)
                          }
                          title={
                            user.isAdmin
                              ? "Quitar privilegios de administrador"
                              : "Hacer administrador"
                          }
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </button>
                        <button
                          className="text-text-secondary hover:text-text-primary"
                          onClick={() => openEditModal(user)}
                          title="Editar usuario"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 0L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          className="text-text-secondary hover:text-red-500"
                          onClick={() => openDeleteModal(user)}
                          title="Eliminar usuario"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal dinámico */}
      <Modal
        isOpen={modalState.show}
        onClose={closeModal}
        title={getModalTitle()}
        size={modalState.type === "delete" ? "md" : "lg"}
      >
        {renderModalContent()}
      </Modal>
    </div>
  );
};

export default UserManagement;
