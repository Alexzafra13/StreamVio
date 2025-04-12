// server/api/controllers/authController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const environment = require("../../config/environment");
const userRepository = require("../../data/repositories/userRepository");
const {
  asyncHandler,
  createBadRequestError,
  createUnauthorizedError,
} = require("../middlewares/errorMiddleware");

/**
 * Verificar si es la primera vez que se ejecuta la aplicación
 */
const checkFirstTime = asyncHandler(async (req, res) => {
  const userCount = await userRepository.count();

  res.json({
    isFirstTime: userCount === 0,
    message:
      userCount === 0
        ? "Primera ejecución detectada. Se requiere configuración inicial."
        : "El sistema ya está configurado.",
  });
});

/**
 * Configuración del primer usuario administrador
 */
const setupFirstUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Validar entrada
  if (!username || !email || !password) {
    throw createBadRequestError(
      "Datos incompletos. Se requiere nombre de usuario, email y contraseña."
    );
  }

  // Verificar que no haya usuarios existentes
  const userCount = await userRepository.count();

  if (userCount > 0) {
    throw createBadRequestError(
      "Ya existe al menos un usuario en el sistema",
      "SETUP_ALREADY_DONE"
    );
  }

  // Hash de la contraseña
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Crear usuario administrador
  const newUser = await userRepository.create({
    username,
    email,
    password: hashedPassword,
    isAdmin: true,
  });

  // Generar token JWT
  const token = jwt.sign(
    {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
    },
    environment.JWT_SECRET,
    { expiresIn: environment.JWT_EXPIRY }
  );

  // Responder con token y datos básicos del usuario
  res.status(201).json({
    message: "Configuración inicial completada exitosamente",
    token,
    userId: newUser.id,
    username: newUser.username,
    email: newUser.email,
    isAdmin: true,
  });
});

/**
 * Iniciar sesión de usuario
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validar entrada
  if (!email || !password) {
    throw createBadRequestError("Se requiere email y contraseña");
  }

  // Buscar usuario por email
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw createUnauthorizedError("Credenciales inválidas");
  }

  // Verificar contraseña
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw createUnauthorizedError("Credenciales inválidas");
  }

  // Generar token JWT
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
    },
    environment.JWT_SECRET,
    { expiresIn: environment.JWT_EXPIRY }
  );

  // Responder con token y datos básicos del usuario
  res.json({
    message: "Login exitoso",
    token,
    userId: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.is_admin === 1,
    requirePasswordChange: user.force_password_change === 1,
  });
});

/**
 * Obtener información del usuario autenticado
 */
const getUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Obtener usuario completo sin contraseña
  const user = await userRepository.findById(userId);

  if (!user) {
    throw createUnauthorizedError("Usuario no encontrado");
  }

  // Devolver usuario sin la contraseña
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.is_admin === 1,
    forcePasswordChange: user.force_password_change === 1,
    createdAt: user.created_at,
  });
});

/**
 * Cambiar contraseña del usuario
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Validar entrada
  if (!currentPassword || !newPassword) {
    throw createBadRequestError("Se requieren las contraseñas actual y nueva");
  }

  // Buscar usuario
  const user = await userRepository.findById(userId);

  if (!user) {
    throw createUnauthorizedError("Usuario no encontrado");
  }

  // Verificar contraseña actual
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordValid) {
    throw createUnauthorizedError("Contraseña actual incorrecta");
  }

  // Hash de la nueva contraseña
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Actualizar contraseña y quitar flag de forzar cambio
  await userRepository.update(userId, {
    password: hashedPassword,
    forcePasswordChange: false,
  });

  res.json({
    message: "Contraseña cambiada exitosamente",
  });
});

/**
 * Crear código de invitación
 */
const createInvitation = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Verificar que el usuario sea administrador
  const isAdmin = await userRepository.isAdmin(userId);

  if (!isAdmin) {
    throw createUnauthorizedError(
      "Solo los administradores pueden crear invitaciones"
    );
  }

  // Generar código aleatorio
  const code = crypto.randomBytes(4).toString("hex").toUpperCase();

  // Calcular fecha de expiración (1 hora)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // Guardar en la base de datos
  await db.asyncRun(
    "INSERT INTO invitation_codes (code, created_by, expires_at) VALUES (?, ?, ?)",
    [code, userId, expiresAt.toISOString()]
  );

  res.status(201).json({
    message: "Código de invitación creado exitosamente",
    code,
    expiresAt: expiresAt.toISOString(),
  });
});

module.exports = {
  checkFirstTime,
  setupFirstUser,
  login,
  getUser,
  changePassword,
  createInvitation,
};
