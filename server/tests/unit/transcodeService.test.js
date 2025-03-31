// server/tests/unit/transcoderService.test.js
const fs = require("fs");
const path = require("path");

// Mockear fs para no realizar operaciones reales en archivos
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Crear un mock para execAsync que podamos controlar en cada test
const mockExecAsync = jest.fn();

// Mockear exec para no ejecutar comandos reales
jest.mock("util", () => {
  return {
    ...jest.requireActual("util"),
    promisify: jest.fn().mockImplementation(() => mockExecAsync),
  };
});

// Importar el módulo después de definir los mocks
const enhancedTranscoder = require("../../services/enhancedTranscoderService");

describe("TranscoderService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar que los archivos "existen" para las pruebas
    fs.existsSync.mockImplementation((path) => {
      // Simular que el transcodificador no existe para forzar FFprobe
      if (path.includes("transcodificador") || path.includes("streamvio_transcoder")) {
        return false;
      }
      // Por defecto, todo lo demás existe
      return true;
    });
  });

  describe("getMediaInfo", () => {
    test("debería devolver información del archivo multimedia con FFprobe", async () => {
      // Configurar el mock para simular la ejecución del comando ffprobe
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          format: {
            duration: "120.5",
            format_name: "mp4",
            tags: { title: "Test Video" },
          },
          streams: [
            {
              codec_type: "video",
              width: 1280,
              height: 720,
              codec_name: "h264",
              bit_rate: "1800000", // En bits por segundo
            },
            {
              codec_type: "audio",
              codec_name: "aac",
              bit_rate: "192000", // En bits por segundo
              channels: 2,
              sample_rate: "44100",
            },
          ],
        }),
      });

      // Ejecutar el método a probar
      const info = await enhancedTranscoder.getMediaInfo("/path/to/test.mp4");

      // Verificar que se llamó al comando correcto
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("ffprobe")
      );

      // Verificar el resultado
      expect(info).toEqual(
        expect.objectContaining({
          path: "/path/to/test.mp4",
          format: "mp4",
          duration: 120500, // En milisegundos
          width: 1280,
          height: 720,
          videoCodec: "h264",
          videoBitrate: 1800, // En kbps
          audioCodec: "aac",
          audioBitrate: 192, // En kbps
          audioChannels: 2,
          audioSampleRate: 44100,
        })
      );
    });

    test("debería manejar errores si el archivo no existe", async () => {
      // Simular que el archivo no existe
      fs.existsSync.mockReturnValueOnce(false);

      // Verificar que se produce una excepción
      await expect(
        enhancedTranscoder.getMediaInfo("/nonexistent/file.mp4")
      ).rejects.toThrow("Archivo no encontrado");
    });
  });

  describe("generateThumbnail", () => {
    test("debería generar una miniatura correctamente con FFmpeg", async () => {
      // Configurar los mocks necesarios
      fs.existsSync.mockImplementation((path) => {
        // El archivo de entrada existe, el transcodificador no
        if (path.includes("transcodificador") || path.includes("streamvio_transcoder")) {
          return false;
        }
        // La miniatura también existe después de crearla
        return true;
      });

      // Configurar el mock para simular la ejecución del comando ffmpeg
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // Para 'ffmpeg -version'
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // Para el comando ffmpeg principal

      // Ejecutar el método a probar
      const thumbnailPath = await enhancedTranscoder.generateThumbnail(
        "/path/to/test.mp4",
        5
      );

      // Verificar que se llamó al ejecutable con los parámetros correctos
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("ffmpeg")
      );

      // Verificar la ruta de la miniatura
      expect(thumbnailPath).toContain("_thumb.jpg");
    });

    test("debería manejar errores al generar miniatura", async () => {
      // Simular que el archivo no existe
      fs.existsSync.mockReturnValue(false);

      // Verificar que se produce una excepción
      await expect(
        enhancedTranscoder.generateThumbnail("/nonexistent/video.mp4")
      ).rejects.toThrow("Archivo no encontrado");
    });
  });

  // Tests adicionales sólo para mejorar la cobertura
  describe("Perfiles de transcodificación", () => {
    test("debería tener perfiles predefinidos", () => {
      expect(enhancedTranscoder.profiles).toBeDefined();
      expect(Object.keys(enhancedTranscoder.profiles).length).toBeGreaterThan(0);
    });
  });
});
