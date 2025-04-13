// server/media/transcoder/formatConverter.js
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const fs = require("fs");
const environment = require("../../config/environment");
const logger = require("../../utils/logger");
const filesystem = require("../../utils/filesystem");
const { InternalServerError } = require("../../utils/errors");

// Promisificar operaciones async
const execPromise = promisify(exec);
const mkdir = promisify(fs.mkdir);

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("FormatConverter");

/**
 * Clase especializada en conversión de formatos multimedia
 * Proporciona métodos para convertir archivos entre diferentes formatos con FFmpeg
 */
class FormatConverter {
  constructor() {
    // Configuración
    this.ffmpegPath = environment.FFMPEG_PATH || "ffmpeg";
    this.ffprobePath = environment.FFPROBE_PATH || "ffprobe";

    // Verificar disponibilidad de herramientas
    this.checkTools();
  }

  /**
   * Verifica la disponibilidad de las herramientas necesarias
   * @returns {Promise<boolean>} - true si todas las herramientas están disponibles
   */
  async checkTools() {
    try {
      // Verificar FFmpeg
      const { stdout: ffmpegVersion } = await execPromise(
        `${this.ffmpegPath} -version`
      );
      log.info("FFmpeg disponible:", { version: ffmpegVersion.split("\n")[0] });

      return true;
    } catch (error) {
      log.error("Error al verificar herramientas de conversión:", { error });
      return false;
    }
  }

  /**
   * Convierte un archivo a un formato diferente
   * @param {string} inputPath - Ruta del archivo de entrada
   * @param {string} outputPath - Ruta de salida (opcional, se genera si no se proporciona)
   * @param {Object} options - Opciones de conversión
   * @returns {Promise<string>} - Ruta del archivo convertido
   */
  async convertFormat(inputPath, outputPath = null, options = {}) {
    try {
      // Validar entrada
      if (!inputPath || !(await filesystem.exists(inputPath))) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      // Configurar opciones por defecto
      const {
        format = "mp4",
        videoCodec = "libx264",
        audioCodec = "aac",
        videoBitrate = "2000k",
        audioBitrate = "128k",
        resolution = null,
        preset = "medium",
        crf = 23,
        copyVideo = false,
        copyAudio = false,
        fastStart = true,
        stripMetadata = false,
      } = options;

      // Generar ruta de salida si no se proporciona
      const finalOutputPath =
        outputPath || this.generateOutputPath(inputPath, format);

      // Asegurar que el directorio de destino existe
      await filesystem.ensureDir(path.dirname(finalOutputPath));

      // Construir comando FFmpeg
      const cmd = [
        "-y", // Sobrescribir sin preguntar
        "-i",
        `"${inputPath}"`, // Entrada
      ];

      // Opciones de video
      if (copyVideo) {
        cmd.push("-c:v", "copy"); // Copiar stream de video sin recodificar
      } else {
        // Codec de video
        cmd.push("-c:v", videoCodec);

        // Preset de calidad (para x264, x265)
        if (preset && (videoCodec === "libx264" || videoCodec === "libx265")) {
          cmd.push("-preset", preset);
        }

        // Calidad (CRF)
        if (videoCodec === "libx264" || videoCodec === "libx265") {
          cmd.push("-crf", crf.toString());
        }

        // Bitrate de video
        if (videoBitrate) {
          cmd.push("-b:v", videoBitrate);
        }

        // Resolución
        if (resolution) {
          cmd.push("-vf", `scale=${resolution}`);
        }
      }

      // Opciones de audio
      if (copyAudio) {
        cmd.push("-c:a", "copy"); // Copiar stream de audio sin recodificar
      } else {
        // Codec de audio
        cmd.push("-c:a", audioCodec);

        // Bitrate de audio
        if (audioBitrate) {
          cmd.push("-b:a", audioBitrate);
        }
      }

      // Faststart para MP4 (mejora streaming)
      if (format === "mp4" && fastStart) {
        cmd.push("-movflags", "+faststart");
      }

      // Eliminar metadatos si se solicita
      if (stripMetadata) {
        cmd.push("-map_metadata", "-1");
      }

      // Ruta de salida
      cmd.push(`"${finalOutputPath}"`);

      // Ejecutar FFmpeg
      log.info(`Convirtiendo ${inputPath} a ${format}`);
      const ffmpegCmd = `${this.ffmpegPath} ${cmd.join(" ")}`;
      log.debug(`Comando FFmpeg: ${ffmpegCmd}`);

      const { stdout, stderr } = await execPromise(ffmpegCmd);

      // Verificar que se generó el archivo
      if (!(await filesystem.exists(finalOutputPath))) {
        throw new Error(
          `La conversión no generó el archivo de salida: ${finalOutputPath}`
        );
      }

      log.info(`Conversión completada: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      log.error(`Error al convertir formato: ${error.message}`);
      throw new InternalServerError(
        `Error al convertir formato: ${error.message}`,
        "FORMAT_CONVERSION_ERROR"
      );
    }
  }

  /**
   * Extrae pista de audio de un archivo multimedia
   * @param {string} inputPath - Ruta del archivo de entrada
   * @param {string} outputPath - Ruta de salida (opcional)
   * @param {Object} options - Opciones de extracción
   * @returns {Promise<string>} - Ruta del archivo de audio
   */
  async extractAudio(inputPath, outputPath = null, options = {}) {
    try {
      // Validar entrada
      if (!inputPath || !(await filesystem.exists(inputPath))) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      // Configurar opciones por defecto
      const {
        format = "mp3",
        codec = format === "mp3" ? "libmp3lame" : "aac",
        bitrate = "192k",
        channels = 2,
        sampleRate = 44100,
        normalize = false,
        stripMetadata = false,
      } = options;

      // Generar ruta de salida si no se proporciona
      const finalOutputPath =
        outputPath || this.generateOutputPath(inputPath, format);

      // Asegurar que el directorio de destino existe
      await filesystem.ensureDir(path.dirname(finalOutputPath));

      // Construir comando FFmpeg
      const cmd = [
        "-y", // Sobrescribir sin preguntar
        "-i",
        `"${inputPath}"`, // Entrada
        "-vn", // No video
        "-c:a",
        codec, // Codec de audio
        "-b:a",
        bitrate, // Bitrate
        "-ar",
        sampleRate.toString(), // Sample rate
        "-ac",
        channels.toString(), // Canales
      ];

      // Normalización de audio
      if (normalize) {
        cmd.push("-af", "loudnorm=I=-16:TP=-1.5:LRA=11");
      }

      // Eliminar metadatos si se solicita
      if (stripMetadata) {
        cmd.push("-map_metadata", "-1");
      }

      // Ruta de salida
      cmd.push(`"${finalOutputPath}"`);

      // Ejecutar FFmpeg
      log.info(`Extrayendo audio de ${inputPath} a ${format}`);
      const ffmpegCmd = `${this.ffmpegPath} ${cmd.join(" ")}`;
      log.debug(`Comando FFmpeg: ${ffmpegCmd}`);

      const { stdout, stderr } = await execPromise(ffmpegCmd);

      // Verificar que se generó el archivo
      if (!(await filesystem.exists(finalOutputPath))) {
        throw new Error(
          `La extracción no generó el archivo de salida: ${finalOutputPath}`
        );
      }

      log.info(`Extracción de audio completada: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      log.error(`Error al extraer audio: ${error.message}`);
      throw new InternalServerError(
        `Error al extraer audio: ${error.message}`,
        "AUDIO_EXTRACTION_ERROR"
      );
    }
  }

  /**
   * Extrae una sección de un archivo multimedia
   * @param {string} inputPath - Ruta del archivo de entrada
   * @param {string} outputPath - Ruta de salida (opcional)
   * @param {Object} options - Opciones de recorte
   * @returns {Promise<string>} - Ruta del archivo recortado
   */
  async trimMedia(inputPath, outputPath = null, options = {}) {
    try {
      // Validar entrada
      if (!inputPath || !(await filesystem.exists(inputPath))) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      // Validar opciones requeridas
      if (options.startTime === undefined && options.endTime === undefined) {
        throw new Error(
          "Se requiere especificar al menos un tiempo de inicio o fin"
        );
      }

      // Configurar opciones por defecto
      const {
        startTime = 0,
        endTime = null,
        duration = null,
        format = path.extname(inputPath).substring(1) || "mp4",
        copyCodecs = true,
      } = options;

      // Generar ruta de salida si no se proporciona
      const finalOutputPath =
        outputPath || this.generateTrimmedPath(inputPath, startTime, endTime);

      // Asegurar que el directorio de destino existe
      await filesystem.ensureDir(path.dirname(finalOutputPath));

      // Construir comando FFmpeg
      const cmd = [
        "-y", // Sobrescribir sin preguntar
        "-i",
        `"${inputPath}"`, // Entrada
      ];

      // Tiempo de inicio
      if (startTime !== 0) {
        cmd.push("-ss", this.formatTimeParam(startTime));
      }

      // Duración o tiempo de fin
      if (duration !== null) {
        cmd.push("-t", this.formatTimeParam(duration));
      } else if (endTime !== null) {
        // Si se proporciona un tiempo de fin, calculamos la duración
        const durationValue = endTime - startTime;
        if (durationValue > 0) {
          cmd.push("-t", this.formatTimeParam(durationValue));
        }
      }

      // Configurar codecs
      if (copyCodecs) {
        cmd.push("-c", "copy");
      } else {
        cmd.push("-c:v", "libx264", "-c:a", "aac");
      }

      // Ruta de salida
      cmd.push(`"${finalOutputPath}"`);

      // Ejecutar FFmpeg
      log.info(
        `Recortando ${inputPath} desde ${startTime}s hasta ${
          endTime !== null ? endTime + "s" : "final"
        }`
      );
      const ffmpegCmd = `${this.ffmpegPath} ${cmd.join(" ")}`;
      log.debug(`Comando FFmpeg: ${ffmpegCmd}`);

      const { stdout, stderr } = await execPromise(ffmpegCmd);

      // Verificar que se generó el archivo
      if (!(await filesystem.exists(finalOutputPath))) {
        throw new Error(
          `El recorte no generó el archivo de salida: ${finalOutputPath}`
        );
      }

      log.info(`Recorte completado: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      log.error(`Error al recortar medio: ${error.message}`);
      throw new InternalServerError(
        `Error al recortar medio: ${error.message}`,
        "MEDIA_TRIM_ERROR"
      );
    }
  }

  /**
   * Concatena múltiples archivos multimedia
   * @param {Array} inputPaths - Rutas de los archivos de entrada
   * @param {string} outputPath - Ruta de salida (opcional)
   * @param {Object} options - Opciones de concatenación
   * @returns {Promise<string>} - Ruta del archivo concatenado
   */
  async concatenateMedia(inputPaths, outputPath = null, options = {}) {
    try {
      // Validar entrada
      if (!inputPaths || !Array.isArray(inputPaths) || inputPaths.length < 2) {
        throw new Error("Se requieren al menos dos archivos para concatenar");
      }

      // Validar que todos los archivos existen
      for (const inputPath of inputPaths) {
        if (!(await filesystem.exists(inputPath))) {
          throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
        }
      }

      // Configurar opciones por defecto
      const {
        format = "mp4",
        method = "concat", // 'concat' o 'filter_complex'
        transcodeInputs = false,
      } = options;

      // Generar ruta de salida si no se proporciona
      const finalOutputPath =
        outputPath || this.generateConcatPath(inputPaths, format);

      // Asegurar que el directorio de destino existe
      await filesystem.ensureDir(path.dirname(finalOutputPath));

      let ffmpegCmd = "";

      // Método 1: Usando el protocolo concat (archivos deben ser del mismo códec)
      if (method === "concat" && !transcodeInputs) {
        // Crear archivo temporal de lista
        const listFile = await this.createConcatListFile(inputPaths);

        ffmpegCmd = `${this.ffmpegPath} -y -f concat -safe 0 -i "${listFile}" -c copy "${finalOutputPath}"`;
      }
      // Método 2: Usando filter_complex (más flexible, permite diferentes códecs)
      else {
        // Construir comando con inputs
        let cmd = ["-y"];

        // Añadir cada entrada
        inputPaths.forEach((input, index) => {
          cmd.push("-i", `"${input}"`);
        });

        // Construir filtro de concatenación
        let filter = "";
        let inputStreams = "";

        for (let i = 0; i < inputPaths.length; i++) {
          inputStreams += `[${i}:v:0][${i}:a:0]`;
        }

        filter = `${inputStreams}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`;

        // Añadir filtro y mapeo
        cmd.push(
          "-filter_complex",
          `"${filter}"`,
          "-map",
          '"[outv]"',
          "-map",
          '"[outa]"'
        );

        // Configurar codecs si es necesario
        if (transcodeInputs) {
          cmd.push("-c:v", "libx264", "-c:a", "aac");
        } else {
          cmd.push("-c", "copy");
        }

        // Ruta de salida
        cmd.push(`"${finalOutputPath}"`);

        ffmpegCmd = `${this.ffmpegPath} ${cmd.join(" ")}`;
      }

      // Ejecutar FFmpeg
      log.info(`Concatenando ${inputPaths.length} archivos a ${format}`);
      log.debug(`Comando FFmpeg: ${ffmpegCmd}`);

      const { stdout, stderr } = await execPromise(ffmpegCmd);

      // Verificar que se generó el archivo
      if (!(await filesystem.exists(finalOutputPath))) {
        throw new Error(
          `La concatenación no generó el archivo de salida: ${finalOutputPath}`
        );
      }

      log.info(`Concatenación completada: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      log.error(`Error al concatenar medios: ${error.message}`);
      throw new InternalServerError(
        `Error al concatenar medios: ${error.message}`,
        "MEDIA_CONCAT_ERROR"
      );
    }
  }

  /**
   * Crea un archivo de texto para el protocolo concat de FFmpeg
   * @param {Array} inputPaths - Rutas de los archivos a concatenar
   * @returns {Promise<string>} - Ruta del archivo de lista
   */
  async createConcatListFile(inputPaths) {
    try {
      // Crear directorio temporal si no existe
      const tempDir = path.join(
        require("../../config/paths").TEMP_DIR,
        "concat"
      );
      await filesystem.ensureDir(tempDir);

      // Crear nombre de archivo único
      const listFilePath = path.join(tempDir, `concat_${Date.now()}.txt`);

      // Generar contenido del archivo
      let content = "";

      for (const inputPath of inputPaths) {
        // Escapar comillas en la ruta
        const escapedPath = inputPath.replace(/'/g, "\\'");
        content += `file '${escapedPath}'\n`;
      }

      // Escribir archivo
      await filesystem.writeToFile(listFilePath, content);

      return listFilePath;
    } catch (error) {
      log.error(
        `Error al crear archivo de lista para concatenación: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Añade una marca de agua a un video
   * @param {string} inputPath - Ruta del archivo de entrada
   * @param {string} watermarkPath - Ruta de la imagen de marca de agua
   * @param {string} outputPath - Ruta de salida (opcional)
   * @param {Object} options - Opciones de marca de agua
   * @returns {Promise<string>} - Ruta del archivo con marca de agua
   */
  async addWatermark(
    inputPath,
    watermarkPath,
    outputPath = null,
    options = {}
  ) {
    try {
      // Validar entrada
      if (!inputPath || !(await filesystem.exists(inputPath))) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      if (!watermarkPath || !(await filesystem.exists(watermarkPath))) {
        throw new Error(
          `Imagen de marca de agua no encontrada: ${watermarkPath}`
        );
      }

      // Configurar opciones por defecto
      const {
        position = "bottomright", // topleft, topright, bottomleft, bottomright, center
        opacity = 0.5, // 0.0 - 1.0
        margin = 10, // margen en píxeles
        scale = 0.2, // escala de la marca de agua (proporción del ancho del video)
        copyCodecs = true,
      } = options;

      // Generar ruta de salida si no se proporciona
      const finalOutputPath =
        outputPath || this.generateWatermarkedPath(inputPath);

      // Asegurar que el directorio de destino existe
      await filesystem.ensureDir(path.dirname(finalOutputPath));

      // Configurar posición de la marca de agua
      let overlay = "";
      switch (position) {
        case "topleft":
          overlay = `${margin}:${margin}`;
          break;
        case "topright":
          overlay = `main_w-overlay_w-${margin}:${margin}`;
          break;
        case "bottomleft":
          overlay = `${margin}:main_h-overlay_h-${margin}`;
          break;
        case "bottomright":
          overlay = `main_w-overlay_w-${margin}:main_h-overlay_h-${margin}`;
          break;
        case "center":
          overlay = "(main_w-overlay_w)/2:(main_h-overlay_h)/2";
          break;
        default:
          overlay = `main_w-overlay_w-${margin}:main_h-overlay_h-${margin}`; // por defecto bottomright
      }

      // Construir filtro complejo para la marca de agua
      const filter =
        `[1:v]scale=iw*${scale}:-1,format=rgba,colorchannelmixer=aa=${opacity}[watermark];` +
        `[0:v][watermark]overlay=${overlay}[out]`;

      // Construir comando FFmpeg
      const cmd = [
        "-y", // Sobrescribir sin preguntar
        "-i",
        `"${inputPath}"`, // Video original
        "-i",
        `"${watermarkPath}"`, // Marca de agua
        "-filter_complex",
        `"${filter}"`, // Filtro para marca de agua
        "-map",
        '"[out]"', // Mapear salida del filtro
        "-map",
        "0:a", // Mapear audio original
      ];

      // Configurar codecs
      if (copyCodecs) {
        cmd.push("-c:a", "copy"); // Copiar audio sin recodificar
      } else {
        cmd.push("-c:v", "libx264", "-c:a", "aac");
      }

      // Ruta de salida
      cmd.push(`"${finalOutputPath}"`);

      // Ejecutar FFmpeg
      log.info(`Añadiendo marca de agua a ${inputPath}`);
      const ffmpegCmd = `${this.ffmpegPath} ${cmd.join(" ")}`;
      log.debug(`Comando FFmpeg: ${ffmpegCmd}`);

      const { stdout, stderr } = await execPromise(ffmpegCmd);

      // Verificar que se generó el archivo
      if (!(await filesystem.exists(finalOutputPath))) {
        throw new Error(
          `No se generó el archivo con marca de agua: ${finalOutputPath}`
        );
      }

      log.info(`Marca de agua añadida: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      log.error(`Error al añadir marca de agua: ${error.message}`);
      throw new InternalServerError(
        `Error al añadir marca de agua: ${error.message}`,
        "WATERMARK_ERROR"
      );
    }
  }

  /**
   * Genera una vista previa de un video (clip corto con tamaño reducido)
   * @param {string} inputPath - Ruta del archivo de entrada
   * @param {string} outputPath - Ruta de salida (opcional)
   * @param {Object} options - Opciones de la vista previa
   * @returns {Promise<string>} - Ruta del archivo de vista previa
   */
  async generateVideoPreview(inputPath, outputPath = null, options = {}) {
    try {
      // Validar entrada
      if (!inputPath || !(await filesystem.exists(inputPath))) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      // Configurar opciones por defecto
      const {
        startTime = 30, // segundos desde el inicio
        duration = 10, // duración en segundos
        width = 640, // ancho en píxeles
        height = 360, // alto en píxeles
        videoBitrate = "500k",
        audioBitrate = "64k",
        format = "mp4",
      } = options;

      // Generar ruta de salida si no se proporciona
      const finalOutputPath = outputPath || this.generatePreviewPath(inputPath);

      // Asegurar que el directorio de destino existe
      await filesystem.ensureDir(path.dirname(finalOutputPath));

      // Construir comando FFmpeg
      const cmd = [
        "-y", // Sobrescribir sin preguntar
        "-ss",
        this.formatTimeParam(startTime), // Posición de inicio
        "-i",
        `"${inputPath}"`, // Entrada
        "-t",
        this.formatTimeParam(duration), // Duración
        "-vf",
        `scale=${width}:${height}`, // Escalar
        "-c:v",
        "libx264", // Codec de video
        "-c:a",
        "aac", // Codec de audio
        "-b:v",
        videoBitrate, // Bitrate de video
        "-b:a",
        audioBitrate, // Bitrate de audio
        "-movflags",
        "+faststart", // Optimizar para streaming
      ];

      // Ruta de salida
      cmd.push(`"${finalOutputPath}"`);

      // Ejecutar FFmpeg
      log.info(`Generando vista previa de ${inputPath}`);
      const ffmpegCmd = `${this.ffmpegPath} ${cmd.join(" ")}`;
      log.debug(`Comando FFmpeg: ${ffmpegCmd}`);

      const { stdout, stderr } = await execPromise(ffmpegCmd);

      // Verificar que se generó el archivo
      if (!(await filesystem.exists(finalOutputPath))) {
        throw new Error(
          `No se generó el archivo de vista previa: ${finalOutputPath}`
        );
      }

      log.info(`Vista previa generada: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      log.error(`Error al generar vista previa: ${error.message}`);
      throw new InternalServerError(
        `Error al generar vista previa: ${error.message}`,
        "PREVIEW_GENERATION_ERROR"
      );
    }
  }

  /**
   * Formatea un parámetro de tiempo para FFmpeg
   * @param {number|string} time - Tiempo en segundos o string con formato
   * @returns {string} - Tiempo formateado para FFmpeg
   */
  formatTimeParam(time) {
    // Si ya es un string, verificar si tiene formato correcto
    if (typeof time === "string") {
      // Si tiene formato HH:MM:SS.mmm, devolverlo sin cambios
      if (/^\d+:\d+:\d+(\.\d+)?$/.test(time)) {
        return time;
      }

      // Si no, convertir a número
      time = parseFloat(time);
    }

    // Convertir a formato HH:MM:SS.mmm
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = (time % 60).toFixed(3);

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(6, "0")}`;
  }

  /**
   * Genera una ruta de salida para un archivo convertido
   * @param {string} inputPath - Ruta del archivo original
   * @param {string} format - Formato de salida
   * @returns {string} - Ruta de salida
   */
  generateOutputPath(inputPath, format) {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));

    return path.join(dir, `${baseName}.${format}`);
  }

  /**
   * Genera una ruta para un archivo recortado
   * @param {string} inputPath - Ruta del archivo original
   * @param {number} startTime - Tiempo de inicio en segundos
   * @param {number} endTime - Tiempo de fin en segundos (opcional)
   * @returns {string} - Ruta de salida
   */
  generateTrimmedPath(inputPath, startTime, endTime) {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const ext = path.extname(inputPath);

    // Formatear tiempos para el nombre de archivo
    const start = startTime ? `_${Math.floor(startTime)}s` : "";
    const end = endTime ? `_to_${Math.floor(endTime)}s` : "";

    return path.join(dir, `${baseName}${start}${end}${ext}`);
  }

  /**
   * Genera una ruta para un archivo concatenado
   * @param {Array} inputPaths - Rutas de archivos originales
   * @param {string} format - Formato de salida
   * @returns {string} - Ruta de salida
   */
  generateConcatPath(inputPaths, format) {
    // Usar el directorio del primer archivo
    const dir = path.dirname(inputPaths[0]);

    // Extraer nombres base sin extensión
    const baseNames = inputPaths.map((filePath) =>
      path.basename(filePath, path.extname(filePath))
    );

    // Si hay más de 3 archivos, usar solo los primeros y añadir "y más"
    let baseName = "";
    if (baseNames.length <= 3) {
      baseName = baseNames.join("_");
    } else {
      baseName = `${baseNames.slice(0, 2).join("_")}_and_${
        baseNames.length - 2
      }_more`;
    }

    return path.join(dir, `${baseName}_combined.${format}`);
  }

  /**
   * Genera una ruta para un archivo con marca de agua
   * @param {string} inputPath - Ruta del archivo original
   * @returns {string} - Ruta de salida
   */
  generateWatermarkedPath(inputPath) {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const ext = path.extname(inputPath);

    return path.join(dir, `${baseName}_watermarked${ext}`);
  }

  /**
   * Genera una ruta para un archivo de vista previa
   * @param {string} inputPath - Ruta del archivo original
   * @returns {string} - Ruta de salida
   */
  generatePreviewPath(inputPath) {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));

    return path.join(dir, `${baseName}_preview.mp4`);
  }

  /**
   * Añade subtítulos a un video
   * @param {string} videoPath - Ruta del archivo de video
   * @param {string} subtitlePath - Ruta del archivo de subtítulos
   * @param {string} outputPath - Ruta de salida (opcional)
   * @param {Object} options - Opciones para los subtítulos
   * @returns {Promise<string>} - Ruta del archivo con subtítulos
   */
  async addSubtitles(videoPath, subtitlePath, outputPath = null, options = {}) {
    try {
      // Validar entradas
      if (!videoPath || !(await filesystem.exists(videoPath))) {
        throw new Error(`Archivo de video no encontrado: ${videoPath}`);
      }

      if (!subtitlePath || !(await filesystem.exists(subtitlePath))) {
        throw new Error(`Archivo de subtítulos no encontrado: ${subtitlePath}`);
      }

      // Configurar opciones por defecto
      const {
        embed = true, // incorporar subtítulos al video o solo mapearlos
        language = "spa", // código de idioma
        default: setDefault = true, // establecer como subtítulos por defecto
        copyCodecs = true, // copiar codecs sin recodificar
        fontName = null, // nombre de la fuente
        fontSize = null, // tamaño de la fuente
        fontColor = null, // color de la fuente
        backgroundColor = null, // color de fondo
      } = options;

      // Generar ruta de salida si no se proporciona
      const finalOutputPath =
        outputPath || this.generateSubtitledPath(videoPath);

      // Asegurar que el directorio de destino existe
      await filesystem.ensureDir(path.dirname(finalOutputPath));

      // Construir comando FFmpeg
      const cmd = [
        "-y", // Sobrescribir sin preguntar
        "-i",
        `"${videoPath}"`, // Video original
      ];

      // Determinar el tipo de subtítulos por extensión
      const subtitleExt = path.extname(subtitlePath).toLowerCase();

      // Si se van a incorporar (burn-in), usar filtro
      if (embed) {
        // Añadir archivo de subtítulos como entrada
        cmd.push("-i", `"${subtitlePath}"`);

        // Configurar filtro según formato de subtítulos
        let subtitleFilter = "";

        // Construir opciones de estilo
        let styleOptions = "";
        if (fontName) styleOptions += `:force_style='FontName=${fontName}'`;
        if (fontSize) styleOptions += `:force_style='FontSize=${fontSize}'`;
        if (fontColor)
          styleOptions += `:force_style='PrimaryColour=${fontColor}'`;
        if (backgroundColor)
          styleOptions += `:force_style='BackColour=${backgroundColor}'`;

        // Diferentes filtros según formato
        if (
          subtitleExt === ".srt" ||
          subtitleExt === ".ass" ||
          subtitleExt === ".ssa"
        ) {
          subtitleFilter = `subtitles='${subtitlePath.replace(
            /\\/g,
            "\\\\"
          )}'${styleOptions}`;
        } else if (subtitleExt === ".vtt") {
          subtitleFilter = `webvtt='${subtitlePath.replace(
            /\\/g,
            "\\\\"
          )}'${styleOptions}`;
        } else {
          throw new Error(`Formato de subtítulos no soportado: ${subtitleExt}`);
        }

        // Añadir filtro de video
        cmd.push("-vf", `"${subtitleFilter}"`);

        // Configurar codecs
        if (copyCodecs) {
          cmd.push("-c:a", "copy"); // Copiar audio sin recodificar
        } else {
          cmd.push("-c:v", "libx264", "-c:a", "aac");
        }
      }
      // Si no se incorporan, solo mapearlos como stream adicional
      else {
        // Añadir archivo de subtítulos como entrada
        cmd.push("-i", `"${subtitlePath}"`);

        // Mapear streams
        cmd.push(
          "-map",
          "0:v", // Video del archivo original
          "-map",
          "0:a", // Audio del archivo original
          "-map",
          "1:0" // Subtítulos del segundo archivo
        );

        // Metadatos para subtítulos
        cmd.push(
          "-metadata:s:s:0",
          `language=${language}`,
          "-disposition:s:0",
          setDefault ? "default" : "0"
        );

        // Configurar codecs
        if (copyCodecs) {
          cmd.push("-c", "copy"); // Copiar todo sin recodificar
        } else {
          cmd.push("-c:v", "libx264", "-c:a", "aac");
        }
      }

      // Ruta de salida
      cmd.push(`"${finalOutputPath}"`);

      // Ejecutar FFmpeg
      log.info(`Añadiendo subtítulos a ${videoPath}`);
      const ffmpegCmd = `${this.ffmpegPath} ${cmd.join(" ")}`;
      log.debug(`Comando FFmpeg: ${ffmpegCmd}`);

      const { stdout, stderr } = await execPromise(ffmpegCmd);

      // Verificar que se generó el archivo
      if (!(await filesystem.exists(finalOutputPath))) {
        throw new Error(
          `No se generó el archivo con subtítulos: ${finalOutputPath}`
        );
      }

      log.info(`Subtítulos añadidos: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      log.error(`Error al añadir subtítulos: ${error.message}`);
      throw new InternalServerError(
        `Error al añadir subtítulos: ${error.message}`,
        "SUBTITLE_ERROR"
      );
    }
  }

  /**
   * Genera una ruta para un archivo con subtítulos
   * @param {string} inputPath - Ruta del archivo original
   * @returns {string} - Ruta de salida
   */
  generateSubtitledPath(inputPath) {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const ext = path.extname(inputPath);

    return path.join(dir, `${baseName}_with_subs${ext}`);
  }

  /**
   * Ajusta la velocidad de reproducción de un video
   * @param {string} inputPath - Ruta del archivo de entrada
   * @param {string} outputPath - Ruta de salida (opcional)
   * @param {Object} options - Opciones para el ajuste de velocidad
   * @returns {Promise<string>} - Ruta del archivo con velocidad ajustada
   */
  async changeSpeed(inputPath, outputPath = null, options = {}) {
    try {
      // Validar entrada
      if (!inputPath || !(await filesystem.exists(inputPath))) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      // Configurar opciones por defecto
      const {
        speed = 1.0, // factor de velocidad (1.0 = normal, <1 = más lento, >1 = más rápido)
        adjustAudio = true, // ajustar también el audio
        preservePitch = true, // preservar tono del audio
      } = options;

      // Validar velocidad
      if (speed <= 0 || speed > 100) {
        throw new Error("El factor de velocidad debe estar entre 0 y 100");
      }

      // Generar ruta de salida si no se proporciona
      const finalOutputPath =
        outputPath || this.generateSpeedPath(inputPath, speed);

      // Asegurar que el directorio de destino existe
      await filesystem.ensureDir(path.dirname(finalOutputPath));

      // Construir filtros para ajustar velocidad
      const videoFilter = `setpts=${1.0 / speed}*PTS`;
      let audioFilter = "";

      if (adjustAudio) {
        audioFilter = preservePitch
          ? `atempo=${speed}`
          : `asetrate=r=${44100 * speed},aresample=44100`;
      }

      // Construir comando FFmpeg
      const cmd = [
        "-y", // Sobrescribir sin preguntar
        "-i",
        `"${inputPath}"`, // Entrada
        "-vf",
        `"${videoFilter}"`, // Filtro de video
      ];

      // Añadir filtro de audio si es necesario
      if (adjustAudio) {
        cmd.push("-af", `"${audioFilter}"`);
      }

      // Configurar codecs
      cmd.push("-c:v", "libx264", "-c:a", "aac");

      // Ruta de salida
      cmd.push(`"${finalOutputPath}"`);

      // Ejecutar FFmpeg
      log.info(`Ajustando velocidad de ${inputPath} por factor ${speed}`);
      const ffmpegCmd = `${this.ffmpegPath} ${cmd.join(" ")}`;
      log.debug(`Comando FFmpeg: ${ffmpegCmd}`);

      const { stdout, stderr } = await execPromise(ffmpegCmd);

      // Verificar que se generó el archivo
      if (!(await filesystem.exists(finalOutputPath))) {
        throw new Error(
          `No se generó el archivo con velocidad ajustada: ${finalOutputPath}`
        );
      }

      log.info(`Velocidad ajustada: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      log.error(`Error al ajustar velocidad: ${error.message}`);
      throw new InternalServerError(
        `Error al ajustar velocidad: ${error.message}`,
        "SPEED_CHANGE_ERROR"
      );
    }
  }

  /**
   * Genera una ruta para un archivo con velocidad ajustada
   * @param {string} inputPath - Ruta del archivo original
   * @param {number} speed - Factor de velocidad
   * @returns {string} - Ruta de salida
   */
  generateSpeedPath(inputPath, speed) {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const ext = path.extname(inputPath);

    // Formatear velocidad como string (ej: 0.5x, 2.0x)
    const speedStr = speed === 1.0 ? "" : `_${speed.toFixed(1)}x`;

    return path.join(dir, `${baseName}${speedStr}${ext}`);
  }
}

module.exports = new FormatConverter();
