const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  // Validar que se incluyan todos los campos requeridos
  if (!username || !email || !password) {
    return res.status(400).json({ 
      error: 'Datos incompletos',
      message: 'Todos los campos son obligatorios' 
    });
  }
  
  try {
    // Verificar si el usuario ya existe
    db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], async (err, user) => {
      if (err) {
        console.error('Error al consultar usuario:', err);
        return res.status(500).json({ 
          error: 'Error del servidor',
          message: 'Error al verificar usuario'
        });
      }
      
      if (user) {
        return res.status(400).json({ 
          error: 'Usuario existente',
          message: 'El email o nombre de usuario ya está registrado' 
        });
      }
      
      // Generar hash de la contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Insertar el nuevo usuario
      const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
      db.run(query, [username, email, hashedPassword], function(err) {
        if (err) {
          console.error('Error al registrar usuario:', err);
          return res.status(500).json({ 
            error: 'Error del servidor',
            message: 'No se pudo completar el registro' 
          });
        }
        
        // Generar token JWT
        const userId = this.lastID;
        const token = jwt.sign(
          { id: userId, username, email },
          process.env.JWT_SECRET || 'streamvio_secret_key',
          { expiresIn: '24h' }
        );
        
        // Responder con el token y datos básicos del usuario
        res.status(201).json({
          message: 'Usuario registrado exitosamente',
          userId,
          username,
          email,
          token
        });
      });
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      message: 'Error al procesar el registro' 
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar usuario y obtener token
 * @access  Public
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // Validar que se incluyan todos los campos requeridos
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Datos incompletos',
      message: 'Email y contraseña son requeridos' 
    });
  }
  
  // Buscar usuario por email
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error('Error al consultar usuario:', err);
      return res.status(500).json({ 
        error: 'Error del servidor',
        message: 'Error al verificar credenciales' 
      });
    }
    
    // Verificar si el usuario existe
    if (!user) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos' 
      });
    }
    
    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos' 
      });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'streamvio_secret_key',
      { expiresIn: '24h' }
    );
    
    // Responder con el token y datos básicos del usuario
    res.json({
      message: 'Inicio de sesión exitoso',
      userId: user.id,
      username: user.username,
      email: user.email,
      token
    });
  });
});

/**
 * @route   GET /api/auth/user
 * @desc    Obtener información del usuario actual
 * @access  Private
 */
router.get('/user', (req, res) => {
  // El middleware de autenticación ya ha validado el token
  // y ha agregado la información del usuario a req.user
  const { id } = req.user;
  
  db.get('SELECT id, username, email, created_at FROM users WHERE id = ?', [id], (err, user) => {
    if (err) {
      console.error('Error al obtener usuario:', err);
      return res.status(500).json({ 
        error: 'Error del servidor',
        message: 'Error al obtener información del usuario' 
      });
    }
    
    if (!user) {
      return res.status(404).json({ 
        error: 'No encontrado',
        message: 'Usuario no encontrado' 
      });
    }
    
    res.json(user);
  });
});

module.exports = router;