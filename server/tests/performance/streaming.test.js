// server/tests/performance/streaming.test.js
const request = require("supertest");
const app = require("../../app");
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("worker_threads");
const path = require("path");

// Función para obtener un token de autenticación
async function getAuthToken() {
  const res = await request(app).post("/api/auth/login").send({
    email: "test@example.com",
    password: "testpassword",
  });

  return res.body.token;
}

// Test de rendimiento para streaming de vídeo
describe("Streaming Performance Tests", () => {
  let token;

  beforeAll(async () => {
    // Obtener token para todas las pruebas
    token = await getAuthToken();
  }, 10000);

  test("Streaming de video con múltiples clientes simultáneos", async () => {
    // Número de clientes simulados
    const numClients = 10;
    const mediaId = 1; // ID de un video existente en la base de datos

    // Función para simular un cliente viendo un video
    const simulateStreaming = async () => {
      // Hacer una solicitud al endpoint de streaming
      const res = await request(app)
        .get(`/api/media/${mediaId}/stream`)
        .set("Authorization", `Bearer ${token}`)
        .set("Range", "bytes=0-1000000"); // Solicitar el primer MB

      return {
        statusCode: res.statusCode,
        contentLength: res.headers["content-length"],
        responseTime: res.time, // Tiempo de respuesta en ms
      };
    };

    // Ejecutar múltiples clientes en paralelo
    const results = await Promise.all(
      Array(numClients)
        .fill()
        .map(() => simulateStreaming())
    );

    // Verificar resultados
    results.forEach((result) => {
      expect(result.statusCode).toBe(206); // Código para respuesta parcial
      expect(parseInt(result.contentLength)).toBeGreaterThan(0);
    });

    // Calcular tiempo de respuesta promedio
    const avgResponseTime =
      results.reduce((acc, curr) => acc + curr.responseTime, 0) /
      results.length;
    console.log(
      `Tiempo de respuesta promedio para ${numClients} clientes: ${avgResponseTime.toFixed(
        2
      )}ms`
    );

    // Establecer umbrales de rendimiento aceptables
    expect(avgResponseTime).toBeLessThan(2000); // Menos de 2 segundos en promedio
  }, 30000); // Aumentar timeout para esta prueba

  test("Transcodificación en tiempo real", async () => {
    const mediaId = 2; // ID de un video que requiera transcodificación

    // Iniciar una transcodificación
    const startRes = await request(app)
      .post(`/api/transcoding/media/${mediaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        profile: "mobile-low",
      });

    expect(startRes.statusCode).toBe(200);
    expect(startRes.body).toHaveProperty("jobId");

    const jobId = startRes.body.jobId;

    // Comprobar el progreso periódicamente
    const startTime = Date.now();
    let completed = false;
    let lastProgress = 0;

    while (!completed && Date.now() - startTime < 60000) {
      // Timeout de 1 minuto
      // Esperar un poco entre comprobaciones
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Comprobar el estado
      const statusRes = await request(app)
        .get(`/api/transcoding/jobs/${jobId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(statusRes.statusCode).toBe(200);

      if (statusRes.body.status === "completed") {
        completed = true;
        break;
      }

      // Verificar que el progreso aumenta
      expect(statusRes.body.progress).toBeGreaterThanOrEqual(lastProgress);
      lastProgress = statusRes.body.progress;
    }

    // Verificar que la transcodificación se completó en tiempo razonable
    expect(completed).toBe(true);

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(
      `Tiempo de transcodificación: ${totalTime.toFixed(2)} segundos`
    );
  }, 120000); // 2 minutos de timeout
});
