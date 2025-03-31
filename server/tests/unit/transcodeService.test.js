// server/tests/unit/transcodeService.test.js

// Mockear fs y util antes de importar cualquier otro módulo
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Mock para child_process.exec
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: mockExec
}));

// Mock para util.promisify
jest.mock('util', () => ({
  promisify: jest.fn().mockImplementation((fn) => {
    if (fn === mockExec) {
      return jest.fn().mockResolvedValue({
        stdout: JSON.stringify({
          format: {
            duration: '120.5',
            format_name: 'mp4',
            tags: { title: 'Test Video' }
          },
          streams: [
            {
              codec_type: 'video',
              width: 1280,
              height: 720,
              codec_name: 'h264',
              bit_rate: '1800000'
            },
            {
              codec_type: 'audio',
              codec_name: 'aac',
              bit_rate: '192000',
              channels: 2,
              sample_rate: '44100'
            }
          ]
        }),
        stderr: ''
      });
    }
    return fn;
  })
}));

// Ahora importamos fs para configurar los mocks
const fs = require('fs');

// Configurar mocks antes de importar el módulo a testear
fs.existsSync.mockImplementation(path => {
  // Archivo de test siempre existe
  if (path === '/path/to/test.mp4') return true;
  
  // El transcodificador nativo nunca existe
  if (path.includes('streamvio_transcoder')) return false;
  
  // Para el caso de error, depende de la ruta
  if (path === '/nonexistent/file.mp4' || path === '/nonexistent/video.mp4') return false;
  
  // Por defecto, cualquier otro archivo existe
  return true;
});

// Ahora importamos el servicio (después de configurar todos los mocks)
const enhancedTranscoder = require('../../services/enhancedTranscoderService');

describe('TranscoderService', () => {
  // Limpiar mocks antes de cada test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMediaInfo', () => {
    test('debería devolver información del archivo multimedia con FFprobe', async () => {      
      // Ejecutar el método a probar
      const info = await enhancedTranscoder.getMediaInfo('/path/to/test.mp4');

      // Verificar el resultado
      expect(info).toEqual(
        expect.objectContaining({
          path: '/path/to/test.mp4',
          format: 'mp4',
          duration: 120500, // En milisegundos
          width: 1280,
          height: 720,
          videoCodec: 'h264',
          videoBitrate: 1800, // En kbps
          audioCodec: 'aac',
          audioBitrate: 192, // En kbps
          audioChannels: 2,
          audioSampleRate: 44100,
        })
      );
    });

    test('debería manejar errores si el archivo no existe', async () => {
      // Verificar que se produce una excepción
      await expect(
        enhancedTranscoder.getMediaInfo('/nonexistent/file.mp4')
      ).rejects.toThrow('Archivo no encontrado');
    });
  });

  describe('generateThumbnail', () => {
    test('debería generar una miniatura correctamente con FFmpeg', async () => {
      // Ejecutar el método a probar
      const thumbnailPath = await enhancedTranscoder.generateThumbnail(
        '/path/to/test.mp4',
        5
      );

      // Verificar la ruta de la miniatura
      expect(thumbnailPath).toContain('_thumb.jpg');
    });

    test('debería manejar errores al generar miniatura', async () => {
      // Verificar que se produce una excepción
      await expect(
        enhancedTranscoder.generateThumbnail('/nonexistent/video.mp4')
      ).rejects.toThrow('Archivo no encontrado');
    });
  });

  // Tests adicionales sólo para mejorar la cobertura
  describe('Perfiles de transcodificación', () => {
    test('debería tener perfiles predefinidos', () => {
      expect(enhancedTranscoder.profiles).toBeDefined();
      expect(Object.keys(enhancedTranscoder.profiles).length).toBeGreaterThan(0);
    });
  });
});