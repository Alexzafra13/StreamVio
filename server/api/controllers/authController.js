// server/api/controllers/authController.js
const authService = require("../../services/authService");
const {
  asyncHandler,
  createBadRequestError,
  createUnauthorizedError,
} = require("../middlewares/errorMiddleware");

/**
 * Verificar si es la primera vez que se ejecuta la aplicación
 */
const checkFirstTime = asyncHandler(async (req, res) => {
  const isFirstTime = await authService.isFirstTime();

  res.json({
    isFirstTime,
    message: isFirstTime
      ? "Primera ejecución detectada. Se requiere configuración inicial."
      : "El sistema ya está configurado.",
  });
});

/**
 * Configuración del primer usuario administrador
 */
const setupFirstUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const result = await authService.setupFirstUser({
      username,
      email,
      password,
    });

    res.status(201).json({
      message: "Configuración inicial completada exitosamente",
      token: result.token,
      userId: result.user.id,
      username: result.user.username,
      email: result.user.email,
      isAdmin: true,
    });
  } catch (error) {
    throw createBadRequestError(error.message, "SETUP_FAILED");
  }
});

/**
 * Iniciar sesión de usuario
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await authService.login(email, password);

    // Configurar cookie si está disponible
    if (req.cookies) {
      res.cookie("streamvio_token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      });
    }

    res.json({
      message: "Login exitoso",
      token: result.token,
      userId: result.user.id,
      username: result.user.username,
      email: result.user.email,
      isAdmin: result.user.isAdmin,
      requirePasswordChange: result.user.requirePasswordChange,
    });
  } catch (error) {
    throw createUnauthorizedError("Credenciales inválidas");
  }
});

/**
 * Obtener información del usuario autenticado
 */
const getUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // El middleware de autenticación ya verificó que el usuario existe
  // Sólo tenemos que devolver los datos
  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    isAdmin: req.user.isAdmin,
  });
});

/**
 * Cambiar contraseña del usuario
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    await authService.changePassword(userId, currentPassword, newPassword);

    res.json({
      message: "Contraseña cambiada exitosamente",
    });
  } catch (error) {
    if (error.message.includes("actual incorrecta")) {
      throw createUnauthorizedError("Contraseña actual incorrecta");
    } else {
      throw createBadRequestError(error.message);
    }
  }
});

/**
 * Crear código de invitación
 */
const createInvitation = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const invitation = await authService.createInvitationCode(userId);

    res.status(201).json({
      message: "Código de invitación creado exitosamente",
      code: invitation.code,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    throw createBadRequestError("Error al crear código de invitación");
  }
});

/**
 * Registro con código de invitación
 */
const registerWithInvitation = asyncHandler(async (req, res) => {
  const { username, email, password, invitationCode } = req.body;

  if (!invitationCode) {
    throw createBadRequestError("Se requiere un código de invitación");
  }

  try {
    // Verificar si el código es válido
    const isValid = await authService.verifyInvitationCode(invitationCode);

    if (!isValid) {
      throw createBadRequestError("Código de invitación inválido o expirado");
    }

    // Registrar el usuario
    const result = await authService.registerWithInvitation(
      { username, email, password },
      invitationCode
    );

    res.status(201).json({
      message: "Registro exitoso",
      token: result.token,
      userId: result.user.id,
      username: result.user.username,
      email: result.user.email,
      isAdmin: result.user.isAdmin,
    });
  } catch (error) {
    throw createBadRequestError(error.message, "REGISTRATION_FAILED");
  }
});

/**
 * Cerrar sesión
 */
const logout = asyncHandler(async (req, res) => {
  // Obtener token de la solicitud
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.substring(7);
  } else if (req.cookies && req.cookies.streamvio_token) {
    token = req.cookies.streamvio_token;
  }

  if (token) {
    // Invalidar token
    await authService.logout(token);

    // Limpiar cookie si existe
    if (req.cookies) {
      res.clearCookie("streamvio_token");
    }
  }

  res.json({
    message: "Sesión cerrada exitosamente",
  });
});

module.exports = {
  checkFirstTime,
  setupFirstUser,
  login,
  getUser,
  changePassword,
  createInvitation,
  registerWithInvitation,
  logout,
};
