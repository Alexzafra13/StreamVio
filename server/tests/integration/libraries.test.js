// server/tests/integration/libraries.test.js
const request = require('supertest');
const app = require('../../app'); // Solo importa la app, no inicia el servidor
const db = require('../../config/database');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

describe('API de Bibliotecas', () => {
  let authToken;
  let adminToken;
  let testLibraryId;
  
  // Antes de todas las pruebas, configurar la base de datos de prueba
  beforeAll(async () => {
    // Crear directorios de prueba
    const testDir = path.join(__dirname, '../../data/test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Crear subdirectorios para pruebas
    const moviesDir = path.join(testDir, 'movies');
    if (!fs.existsSync(moviesDir)) {
      fs.mkdirSync(moviesDir, { recursive: true });
    }
    
    // Asegurarse de que las tablas necesarias existen
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
    
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS libraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('movies', 'series', 'music', 'photos')),
        scan_automatically BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crear usuarios de prueba
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Eliminar los usuarios si ya existen
    await db.asyncRun('DELETE FROM users WHERE email IN (?, ?)',
      ['test_libraries@example.com', 'admin_libraries@example.com']);
    
    // Crear usuario normal
    await db.asyncRun(
      'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)',
      ['test_libraries_user', 'test_libraries@example.com', hashedPassword, 0]
    );
    
    // Crear usuario administrador
    await db.asyncRun(
      'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)',
      ['admin_libraries_user', 'admin_libraries@example.com', hashedPassword, 1]
    );
    
    // Iniciar sesión y obtener tokens
    const userLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test_libraries@example.com',
        password: 'password123'
      });
    
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin_libraries@example.com',
        password: 'password123'
      });
    
    authToken = userLoginResponse.body.token;
    adminToken = adminLoginResponse.body.token;
    
    // Limpiar bibliotecas de pruebas anteriores
    await db.asyncRun("DELETE FROM libraries WHERE name LIKE 'Test Library%'");
  });
  
  // Después de todas las pruebas, limpiar la base de datos
  afterAll(async () => {
    // Eliminar usuarios de prueba
    await db.asyncRun(
      'DELETE FROM users WHERE email IN (?, ?)',
      ['test_libraries@example.com', 'admin_libraries@example.com']
    );
    
    // Eliminar bibliotecas de prueba
    await db.asyncRun("DELETE FROM libraries WHERE name LIKE 'Test Library%'");
  });
  
  // Crear una biblioteca para pruebas
  describe('POST /api/libraries', () => {
    it('debería crear una nueva biblioteca correctamente', async () => {
      const libraryData = {
        name: 'Test Library ' + Date.now(),
        path: path.join(__dirname, '../../data/test/movies'),
        type: 'movies',
        scan_automatically: true
      };
      
      const response = await request(app)
        .post('/api/libraries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(libraryData);
      
      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('message', 'Biblioteca creada exitosamente');
      expect(response.body).toHaveProperty('library');
      expect(response.body.library).toHaveProperty('name', libraryData.name);
      
      // Guardar el ID para pruebas posteriores
      testLibraryId = response.body.library.id;
    });
    
    it('debería rechazar la creación sin autenticación', async () => {
      const libraryData = {
        name: 'Test Library Unauthorized',
        path: path.join(__dirname, '../../data/test/movies'),
        type: 'movies'
      };
      
      const response = await request(app)
        .post('/api/libraries')
        .send(libraryData);
      
      expect(response.statusCode).toBe(401);
    });
    
    it('debería rechazar la creación con datos incompletos', async () => {
      const incompleteData = {
        name: 'Incomplete Library'
        // Faltan path y type
      };
      
      const response = await request(app)
        .post('/api/libraries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData);
      
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  // Obtener lista de bibliotecas
  describe('GET /api/libraries', () => {
    it('debería obtener la lista de bibliotecas', async () => {
      const response = await request(app)
        .get('/api/libraries')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Debería incluir la biblioteca que creamos
      const createdLibrary = response.body.find(lib => lib.id === testLibraryId);
      expect(createdLibrary).toBeDefined();
    });
    
    it('debería rechazar la solicitud sin autenticación', async () => {
      const response = await request(app)
        .get('/api/libraries');
      
      expect(response.statusCode).toBe(401);
    });
  });
  
  // Obtener una biblioteca específica
  describe('GET /api/libraries/:id', () => {
    it('debería obtener una biblioteca por ID', async () => {
      // Asegurarnos de que tenemos un ID de biblioteca
      expect(testLibraryId).toBeDefined();
      
      const response = await request(app)
        .get(`/api/libraries/${testLibraryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('id', testLibraryId);
    });
    
    it('debería devolver 404 para una biblioteca inexistente', async () => {
      const response = await request(app)
        .get('/api/libraries/99999') // ID que no debería existir
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.statusCode).toBe(404);
    });
  });
  
  // Actualizar una biblioteca
  describe('PUT /api/libraries/:id', () => {
    it('debería actualizar una biblioteca existente', async () => {
      const updateData = {
        name: 'Updated Test Library',
        scan_automatically: false
      };
      
      const response = await request(app)
        .put(`/api/libraries/${testLibraryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message', 'Biblioteca actualizada exitosamente');
      expect(response.body.library).toHaveProperty('name', updateData.name);
      expect(response.body.library).toHaveProperty('scan_automatically', 0); // 0 para false en SQLite
    });
  });
  
  // Iniciar escaneo de biblioteca
  describe('POST /api/libraries/:id/scan', () => {
    it('debería iniciar el escaneo de una biblioteca', async () => {
      const response = await request(app)
        .post(`/api/libraries/${testLibraryId}/scan`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message', 'Escaneo iniciado');
      expect(response.body).toHaveProperty('status', 'scanning');
    });
  });
  
  // Obtener elementos multimedia de una biblioteca
  describe('GET /api/libraries/:id/media', () => {
    it('debería obtener los elementos multimedia de una biblioteca', async () => {
      const response = await request(app)
        .get(`/api/libraries/${testLibraryId}/media`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.items)).toBe(true);
    });
  });
  
  // Eliminar una biblioteca
  describe('DELETE /api/libraries/:id', () => {
    it('debería eliminar una biblioteca existente', async () => {
      const response = await request(app)
        .delete(`/api/libraries/${testLibraryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message', 'Biblioteca eliminada exitosamente');
      expect(response.body).toHaveProperty('libraryId', testLibraryId);
      
      // Verificar que realmente se eliminó
      const checkResponse = await request(app)
        .get(`/api/libraries/${testLibraryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(checkResponse.statusCode).toBe(404);
    });
  });
});