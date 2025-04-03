/**
 * @route   GET /api/auth/check-first-time
 * @desc    Verificar si es la primera ejecución (sin usuarios)
 * @access  Public
 */
router.get("/check-first-time", async (req, res) => {
  try {
    // Verificar si hay algún usuario en la base de datos
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");

    // Si no hay usuarios, es la primera ejecución
    const isFirstTime = !userCount || userCount.count === 0;

    res.json({
      isFirstTime,
    });
  } catch (error) {
    console.error("Error al verificar primera ejecución:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al verificar si es primera ejecución",
    });
  }
});

/**
 * @route   POST /api/auth/setup-first-user
 * @desc    Configurar el primer usuario administrador
 * @access  Public
 */
router.post("/setup-first-user", async (req, res) => {
  const { username, email, password } = req.body;

  // Validar entrada
  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere nombre de usuario, email y contraseña",
    });
  }

  try {
    // Verificar que no haya usuarios existentes
    const userCount = await db.asyncGet("SELECT COUNT(*) as count FROM users");

    if (userCount && userCount.count > 0) {
      return res.status(403).json({
        error: "Operación no permitida",
        message: "Ya existe al menos un usuario en el sistema",
      });
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar como usuario administrador
    const result = await db.asyncRun(
      "INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, 1] // is_admin = 1
    );

    // Generar token JWT
    const userId = result.lastID;
    const token = jwt.sign(
      { id: userId, username, email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" }
    );

    // Responder con token y datos básicos del usuario
    res.status(201).json({
      message: "Configuración inicial completada exitosamente",
      token,
      userId,
      username,
      email,
    });
  } catch (error) {
    console.error("Error en configuración inicial:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al configurar el primer usuario",
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar usuario y obtener token
 * @access  Public
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Validar entrada
  if (!email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere email y contraseña",
    });
  }

  try {
    // Buscar usuario por email
    const user = await db.asyncGet("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!user) {
      return res.status(401).json({
        error: "Credenciales inválidas",
        message: "Email o contraseña incorrectos",
      });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Credenciales inválidas",
        message: "Email o contraseña incorrectos",
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" } // Cambiado de 24h a 7d
    );

    // Responder con token y datos básicos del usuario
    res.json({
      message: "Login exitoso",
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      requirePasswordChange: user.force_password_change === 1,
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al procesar el inicio de sesión",
    });
  }
});

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Public
 */
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  // Validar entrada
  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Datos incompletos",
      message: "Se requiere nombre de usuario, email y contraseña",
    });
  }

  try {
    // Verificar si el email ya existe
    const existingEmail = await db.asyncGet(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingEmail) {
      return res.status(400).json({
        error: "Email en uso",
        message: "Este email ya está registrado",
      });
    }

    // Verificar si el nombre de usuario ya existe
    const existingUsername = await db.asyncGet(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    if (existingUsername) {
      return res.status(400).json({
        error: "Usuario en uso",
        message: "Este nombre de usuario ya está registrado",
      });
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar nuevo usuario
    const result = await db.asyncRun(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    // Generar token JWT
    const userId = result.lastID;
    const token = jwt.sign(
      { id: userId, username, email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" } // Cambiado de 24h a 7d
    );

    // Responder con token y datos básicos del usuario
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      token,
      userId,
      username,
      email,
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al registrar usuario",
    });
  }
});

// Añadir esta nueva ruta al final del archivo
/**
 * @route   POST /api/auth/refresh-token
 * @desc    Renovar token JWT
 * @access  Private
 */
router.post("/refresh-token", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener información actualizada del usuario
    const user = await db.asyncGet(
      "SELECT id, username, email, is_admin FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        message: "No se encontró el usuario con el ID proporcionado",
      });
    }

    // Generar nuevo token JWT
    const newToken = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || "streamvio_secret_key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Token renovado exitosamente",
      token: newToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1,
      },
    });
  } catch (error) {
    console.error("Error al renovar token:", error);
    res.status(500).json({
      error: "Error del servidor",
      message: "Error al renovar el token",
    });
  }
});
