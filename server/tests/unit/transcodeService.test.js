const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const enhancedTranscoder = require("../../services/enhancedTranscoderService");

// Mockear fs para no realizar operaciones reales en archivos
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mockear exec para no ejecutar comandos reales
jest.mock("util", () => ({
  ...jest.requireActual("util"),
  promisify: jest.fn(() => jest.fn()),
}));

describe("TranscoderService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Configurar que los archivos "existen" para las pruebas
    fs.existsSync.mockImplementation(() => true);
  });

  describe("getMediaInfo", () => {
    test("debería devolver información del archivo multimedia", async () => {
      // Configurar el mock para simular la ejecución del comando ffprobe
      const mockExecAsync = promisify(jest.fn());
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify({
          format: {
            duration: "120.5",
            bit_rate: "2000000",
            tags: { title: "Test Video" },
          },
          streams: [
            {
              codec_type: "video",
              width: 1280,
              height: 720,
              codec_name: "h264",
              bit_rate: "1800000",
            },
            {
              codec_type: "audio",
              codec_name: "aac",
              bit_rate: "192000",
              channels: 2,
              sample_rate: "44100",
            },
          ],
        }),
      });

      // Aplicar el mock
      promisify.mockReturnValue(mockExecAsync);

      // Ejecutar el método a probar
      const info = await enhancedTranscoder.getMediaInfo("/path/to/test.mp4");

      // Verificar el resultado
      expect(info).toHaveProperty("duration");
      expect(info).toHaveProperty("width", 1280);
      expect(info).toHaveProperty("height", 720);
      expect(info).toHaveProperty("videoCodec", "h264");
      expect(info).toHaveProperty("audioCodec", "aac");
    });

    test("debería manejar errores si el archivo no existe", async () => {
      // Simular que el archivo no existe
      fs.existsSync.mockReturnValue(false);

      // Verificar que se produce una excepción
      await expect(
        enhancedTranscoder.getMediaInfo("/nonexistent/file.mp4")
      ).rejects.toThrow("Archivo no encontrado");
    });
  });

  describe("generateThumbnail", () => {
    test("debería generar una miniatura correctamente", async () => {
      // Configurar el mock para simular la ejecución del comando ffmpeg
      const mockExecAsync = promisify(jest.fn());
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });

      // Aplicar el mock
      promisify.mockReturnValue(mockExecAsync);

      // Ejecutar el método a probar
      const thumbnailPath = await enhancedTranscoder.generateThumbnail(
        "/path/to/test.mp4",
        5
      );

      // Verificar que se llamó al ejecutable
      expect(mockExecAsync).toHaveBeenCalledTimes(1);

      // Verificar la ruta de la miniatura
      expect(thumbnailPath).toContain("_thumb.jpg");
    });
  });
});
