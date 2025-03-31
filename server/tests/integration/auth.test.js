// server/tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../app'); // Solo importa la app, no inicia el servidor
const db = require('../../config/database');
const bcrypt = require('bcrypt');

describe('API de Autenticación', () => {
  // Antes de todas las pruebas, configurar la base de datos de prueba
  beforeAll(async () => {
    // Asegurarse de que la tabla de usuarios existe
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        force_password_change BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crear un usuario de prueba
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Eliminar el usuario si ya existe (para evitar conflictos)
    await db.asyncRun(
      'DELETE FROM users WHERE email = ? OR username = ?',
      ['test_integration@example.com', 'test_integration_user']
    );
    
    // Insertar usuario de prueba
    await db.asyncRun(
      'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)',
      ['test_integration_user', 'test_integration@example.com', hashedPassword, 0]
    );
  });
  
  // Después de todas las pruebas, limpiar la base de datos
  afterAll(async () => {
    // Eliminar usuario de prueba
    await db.asyncRun(
      'DELETE FROM users WHERE email = ?',
      ['test_integration@example.com']
    );
  });
  
  // Prueba de registro de usuario
  describe('POST /api/auth/register', () => {
    it('debería registrar un nuevo usuario con éxito', async () => {
      const userData = {
        username: 'newuser_integration',
        email: 'newuser_integration@example.com',
        password: 'SecurePass123'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.username).toBe(userData.username);
      expect(response.body.email).toBe(userData.email);
      
      // Limpiar: eliminar el usuario creado
      await db.asyncRun(
        'DELETE FROM users WHERE email = ?',
        [userData.email]
      );
    });
    
    it('debería rechazar el registro con datos incompletos', async () => {
      const incompleteData = {
        username: 'incomplete',
        // falta email y password
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData);
      
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('debería rechazar el registro con email duplicado', async () => {
      const duplicateData = {
        username: 'duplicate_user',
        email: 'test_integration@example.com', // email ya existente
        password: 'password123'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateData);
      
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  // Prueba de inicio de sesión
  describe('POST /api/auth/login', () => {
    it('debería permitir iniciar sesión con credenciales correctas', async () => {
      const loginData = {
        email: 'test_integration@example.com',
        password: 'password123'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('username', 'test_integration_user');
    });
    
    it('debería rechazar el inicio de sesión con contraseña incorrecta', async () => {
      const wrongData = {
        email: 'test_integration@example.com',
        password: 'wrong_password'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(wrongData);
      
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
    
    it('debería rechazar el inicio de sesión con email inexistente', async () => {
      const nonExistentData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(nonExistentData);
      
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  // Prueba de obtención de información del usuario
  describe('GET /api/auth/user', () => {
    it('debería obtener información del usuario autenticado', async () => {
      // Primero, obtener un token válido
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test_integration@example.com',
          password: 'password123'
        });
      
      const token = loginResponse.body.token;
      
      // Usar el token para obtener información del usuario
      const response = await request(app)
        .get('/api/auth/user')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('username', 'test_integration_user');
      expect(response.body).toHaveProperty('email', 'test_integration@example.com');
    });
    
    it('debería rechazar la solicitud sin token de autenticación', async () => {
      const response = await request(app)
        .get('/api/auth/user');
      
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
    
    it('debería rechazar la solicitud con token inválido', async () => {
      const response = await request(app)
        .get('/api/auth/user')
        .set('Authorization', 'Bearer invalid_token');
      
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});