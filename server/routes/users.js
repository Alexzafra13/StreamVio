/**
 * @route   GET /api/auth/user
 * @desc    Obtener información del usuario autenticado
 * @access  Private
 */
router.get("/user", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener información completa del usuario
    const user = await db.asyncGet(
      "SELECT id, username, email, is_admin, force_password_change, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró el usuario con el ID proporcionado",
      });
    }

    // Devolver usuario sin la contraseña
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin,
      force_password_change: user.force_password_change,
      created_at: user.created_at,
    });
  } catch (error) {
    console.error("Error al obtener información de usuario:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al obtener información del usuario",
    });
  }
});
