// server/api/controllers/userController.js
const bcrypt = require("bcrypt");
const userRepository = require("../../data/repositories/userRepository");
const {
  asyncHandler,
  createBadRequestError,
  createNotFoundError,
  createForbiddenError,
} = require("../middlewares/errorMiddleware");

/**
 * Obtener todos los usuarios (solo administradores)
 */
const getAllUsers = asyncHandler(async (req, res) => {
  // Verificar si el usuario es administrador
  if (!req.user.isAdmin) {
    throw createForbiddenError(
      "Solo los administradores pueden ver la lista de usuarios"
    );
  }

  const users = await userRepository.findAll();

  // Eliminar campos sensibles
  const sanitizedUsers = users.map((user) => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });

  res.json(sanitizedUsers);
});

/**
 * Obtener detalles de un usuario específico
 */
const getUserById = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);

  if (isNaN(userId)) {
    throw createBadRequestError("ID de usuario no válido");
  }

  // Verificar si el usuario es administrador o si es el propio usuario
  if (!req.user.isAdmin && req.user.id !== userId) {
    throw createForbiddenError(
      "No tienes permiso para ver los detalles de este usuario"
    );
  }

  const user = await userRepository.findById(userId);

  if (!user) {
    throw createNotFoundError("Usuario no encontrado");
  }

  // Eliminar campo de contraseña
  const { password, ...userWithoutPassword } = user;

  res.json(userWithoutPassword);
});

/**
 * Actualizar información del usuario
 */
const updateUser = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);
  const { username, email } = req.body;

  if (isNaN(userId)) {
    throw createBadRequestError("ID de usuario no válido");
  }

  // Verificar si el usuario es administrador o si es el propio usuario
  if (!req.user.isAdmin && req.user.id !== userId) {
    throw createForbiddenError(
      "No tienes permiso para actualizar este usuario"
    );
  }

  // Verificar que el usuario existe
  const user = await userRepository.findById(userId);

  if (!user) {
    throw createNotFoundError("Usuario no encontrado");
  }

  // Preparar datos para actualización
  const updateData = {};

  if (username) {
    // Verificar si el nombre de usuario ya está en uso
    const existingUsername = await userRepository.findByUsername(username);

    if (existingUsername && existingUsername.id !== userId) {
      throw createBadRequestError("Este nombre de usuario ya está en uso");
    }

    updateData.username = username;
  }

  if (email) {
    // Verificar si el email ya está en uso
    const existingEmail = await userRepository.findByEmail(email);

    if (existingEmail && existingEmail.id !== userId) {
      throw createBadRequestError("Este email ya está en uso");
    }

    updateData.email = email;
  }

  // Si no hay campos para actualizar
  if (Object.keys(updateData).length === 0) {
    throw createBadRequestError("No se proporcionaron datos para actualizar");
  }

  // Actualizar usuario
  const updatedUser = await userRepository.update(userId, updateData);

  // Eliminar campo de contraseña
  const { password, ...userWithoutPassword } = updatedUser;

  res.json({
    message: "Usuario actualizado correctamente",
    user: userWithoutPassword,
  });
});

/**
 * Cambiar contraseña del usuario
 */
const changePassword = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);
  const { currentPassword, newPassword } = req.body;

  if (isNaN(userId)) {
    throw createBadRequestError("ID de usuario no válido");
  }

  // Verificar si es el propio usuario (solo el propio usuario puede cambiar su contraseña)
  if (req.user.id !== userId) {
    throw createForbiddenError("Solo puedes cambiar tu propia contraseña");
  }

  // Validar entrada
  if (!currentPassword || !newPassword) {
    throw createBadRequestError("Se requieren las contraseñas actual y nueva");
  }

  // Verificar que el usuario existe
  const user = await userRepository.findById(userId);

  if (!user) {
    throw createNotFoundError("Usuario no encontrado");
  }

  // Verificar contraseña actual
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordValid) {
    throw createBadRequestError("Contraseña actual incorrecta");
  }

  // Hash de la nueva contraseña
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Actualizar contraseña y quitar flag de forzar cambio si existe
  await userRepository.update(userId, {
    password: hashedPassword,
    forcePasswordChange: false,
  });

  res.json({
    message: "Contraseña cambiada exitosamente",
  });
});

/**
 * Eliminar un usuario (solo administradores)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);

  if (isNaN(userId)) {
    throw createBadRequestError("ID de usuario no válido");
  }

  // Verificar si el usuario es administrador
  if (!req.user.isAdmin) {
    throw createForbiddenError(
      "Solo los administradores pueden eliminar usuarios"
    );
  }

  // No permitir eliminar al propio usuario administrador
  if (req.user.id === userId) {
    throw createBadRequestError("No puedes eliminar tu propio usuario");
  }

  // Verificar que el usuario existe
  const user = await userRepository.findById(userId);

  if (!user) {
    throw createNotFoundError("Usuario no encontrado");
  }

  // Eliminar usuario
  const result = await userRepository.delete(userId);

  if (!result) {
    throw createBadRequestError("Error al eliminar el usuario");
  }

  res.json({
    message: "Usuario eliminado correctamente",
    userId,
  });
});

/**
 * Cambiar estado de administrador de un usuario (solo administradores)
 */
const toggleAdmin = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);

  if (isNaN(userId)) {
    throw createBadRequestError("ID de usuario no válido");
  }

  // Verificar si el usuario es administrador
  if (!req.user.isAdmin) {
    throw createForbiddenError(
      "Solo los administradores pueden cambiar privilegios"
    );
  }

  // No permitir cambiar sus propios privilegios
  if (req.user.id === userId) {
    throw createBadRequestError(
      "No puedes cambiar tus propios privilegios de administrador"
    );
  }

  // Verificar que el usuario existe
  const user = await userRepository.findById(userId);

  if (!user) {
    throw createNotFoundError("Usuario no encontrado");
  }

  // Cambiar estado de administrador
  const newAdminStatus = user.is_admin === 1 ? 0 : 1;

  await userRepository.update(userId, {
    isAdmin: !!newAdminStatus, // Convertir a booleano
  });

  res.json({
    message: newAdminStatus
      ? "Privilegios de administrador activados correctamente"
      : "Privilegios de administrador desactivados correctamente",
    userId,
    isAdmin: !!newAdminStatus,
  });
});

/**
 * Crear un nuevo usuario (solo administradores)
 */
const createUser = asyncHandler(async (req, res) => {
  const { username, email, password, isAdmin = false } = req.body;

  // Verificar si el usuario es administrador
  if (!req.user.isAdmin) {
    throw createForbiddenError(
      "Solo los administradores pueden crear usuarios"
    );
  }

  // Validar entrada
  if (!username || !email || !password) {
    throw createBadRequestError(
      "Se requiere nombre de usuario, email y contraseña"
    );
  }

  // Verificar si el nombre de usuario ya existe
  const existingUsername = await userRepository.findByUsername(username);

  if (existingUsername) {
    throw createBadRequestError("Este nombre de usuario ya está en uso");
  }

  // Verificar si el email ya existe
  const existingEmail = await userRepository.findByEmail(email);

  if (existingEmail) {
    throw createBadRequestError("Este email ya está en uso");
  }

  // Hash de la contraseña
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Crear usuario
  const newUser = await userRepository.create({
    username,
    email,
    password: hashedPassword,
    isAdmin,
    forcePasswordChange: true, // Forzar cambio de contraseña en primer inicio de sesión
  });

  // Eliminar campo de contraseña
  const { password: _, ...userWithoutPassword } = newUser;

  res.status(201).json({
    message: "Usuario creado exitosamente",
    user: userWithoutPassword,
  });
});

/**
 * Obtener bibliotecas accesibles para un usuario
 */
const getUserLibraries = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);

  if (isNaN(userId)) {
    throw createBadRequestError("ID de usuario no válido");
  }

  // Verificar si el usuario es administrador o si es el propio usuario
  if (!req.user.isAdmin && req.user.id !== userId) {
    throw createForbiddenError(
      "No tienes permiso para ver las bibliotecas de este usuario"
    );
  }

  // Verificar que el usuario existe
  const user = await userRepository.findById(userId);

  if (!user) {
    throw createNotFoundError("Usuario no encontrado");
  }

  // Obtener bibliotecas accesibles para un usuario
  const libraryRepository = require("../../data/repositories/libraryRepository");
  const libraries = await libraryRepository.findAccessibleByUser(userId, true);

  res.json(libraries);
});

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  changePassword,
  deleteUser,
  toggleAdmin,
  createUser,
  getUserLibraries,
};
