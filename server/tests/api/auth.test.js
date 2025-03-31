// server/tests/api/auth.test.js
const request = require("supertest");
const app = require("../../app");
const db = require("../../config/database");
const bcrypt = require("bcrypt");

describe("Auth API Endpoints", () => {
  // Configuración antes de los tests
  beforeAll(async () => {
    // Crear un usuario de prueba en la base de datos
    const hashedPassword = await bcrypt.hash("testpassword", 10);
    await db.asyncRun(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      ["testuser", "test@example.com", hashedPassword]
    );
  });

  // Limpieza después de los tests
  afterAll(async () => {
    // Eliminar el usuario de prueba
    await db.asyncRun("DELETE FROM users WHERE email = ?", [
      "test@example.com",
    ]);
    // Cerrar la conexión a la base de datos
    await new Promise((resolve) => db.close(resolve));
  });

  // Test de login
  test("POST /api/auth/login - login exitoso", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "testpassword",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("userId");
    expect(res.body.email).toBe("test@example.com");
  });

  // Test de login con credenciales incorrectas
  test("POST /api/auth/login - credenciales incorrectas", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "wrongpassword",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  // Test de endpoint protegido
  test("GET /api/auth/user - acceso con token válido", async () => {
    // Primero obtener un token válido
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "testpassword",
    });

    const token = loginRes.body.token;

    // Usar el token para acceder a un endpoint protegido
    const res = await request(app)
      .get("/api/auth/user")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("username", "testuser");
  });
});
