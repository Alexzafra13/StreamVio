// server/media/transcoder/transcoderInterface.js
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { exec, spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const environment = require("../../config/environment");
const { TRANSCODED_DIR } = require("../../config/paths");
const logger = require("../../utils/logger");
const filesystem = require("../../utils/filesystem");
const eventBus = require("../../services/eventBus");
const { TRANSCODE_PROFILES, MEDIA_TYPES } = require("../../config/constants");
const { DatabaseError, InternalServerError } = require("../../utils/errors");

// Promisificar operaciones async
const execPromise = promisify(exec);
const mkdir = promisify(fs.mkdir);

// Obtener logger específico para este módulo
const log = logger.getModuleLogger("TranscoderInterface");

/**
 * Interfaz para operaciones de transcodificación
 * Maneja la comunicación con el binario de transcodificación (FFmpeg)
 */
class TranscoderInterface {
  constructor() {
    // Configuración
    this.ffmpegPath = environment.FFMPEG_PATH || "ffmpeg";
    this.ffprobePath = environment.FFPROBE_PATH || "ffprobe";
    this.transcodingEnabled = environment.TRANSCODING_ENABLED !== false;
    this.maxBitrate = environment.MAX_BITRATE || 8000; // kbps
    this.threads = environment.TRANSCODE_THREADS || 2;
    this.hwAcceleration = environment.HW_ACCELERATION || "auto";
    this.segmentDuration = environment.HLS_SEGMENT_DURATION || 2; // segundos

    // Mapa de trabajos activos
    this.activeJobs = new Map();

    // Cola de trabajos pendientes
    this.jobQueue = [];
    this.isProcessingQueue = false;
    this.maxConcurrentJobs = this.threads;

    // Configurar directorios
    this.setupDirectories();

    // Verificar disponibilidad de herramientas
    this.checkTools();

    // Configurar listeners de eventos
    this.registerEventListeners();
  }

  /**
   * Configurar directorios necesarios
   */
  async setupDirectories() {
    try {
      await filesystem.ensureDir(TRANSCODED_DIR);
    } catch (error) {
      log.error("Error al crear directorios de transcodificación:", { error });
    }
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
      log.info("FFmpeg disponible:", {
        version: ffmpegVersion.split("\\n")[0],
      });

      // Verificar FFprobe
      const { stdout: ffprobeVersion } = await execPromise(
        `${this.ffprobePath} -version`
      );
      log.info("FFprobe disponible:", {
        version: ffprobeVersion.split("\\n")[0],
      });

      return true;
    } catch (error) {
      log.error("Error al verificar herramientas de transcodificación:", {
        error,
      });
      this.transcodingEnabled = false;
      return false;
    }
  }

  /**
   * Configura listeners para eventos relacionados con transcodificación
   */
  registerEventListeners() {
    // Cuando se complete un trabajo, iniciar el siguiente en cola
    eventBus.on("transcoding:completed", () => {
      this.processNextInQueue();
    });

    // Cuando falle un trabajo, también procesar el siguiente
    eventBus.on("transcoding:failed", () => {
      this.processNextInQueue();
    });
  }

  /**
   * Obtiene información detallada sobre un archivo multimedia
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<Object>} - Información del archivo
   */
  async getMediaInfo(filePath) {
    try {
      // Verificar que el archivo existe
      if (!(await filesystem.exists(filePath))) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }

      // Ejecutar ffprobe para obtener información en formato JSON
      const cmd = `${this.ffprobePath} -v error -show_format -show_streams -print_format json "${filePath}"`;
      const { stdout } = await execPromise(cmd);

      // Parsear la salida JSON
      const probeData = JSON.parse(stdout);

      // Extraer información relevante
      const mediaInfo = {
        format: probeData.format.format_name,
        duration: parseFloat(probeData.format.duration),
        size: parseInt(probeData.format.size),
        bitrate: parseInt(probeData.format.bit_rate),
        streams: [],
      };

      // Procesar cada stream (video, audio, subtítulos)
      if (probeData.streams && probeData.streams.length > 0) {
        for (const stream of probeData.streams) {
          const streamInfo = {
            index: stream.index,
            codecType: stream.codec_type,
            codecName: stream.codec_name,
            codecLongName: stream.codec_long_name,
            language: stream.tags?.language,
          };

          // Agregar información específica según el tipo de stream
          if (stream.codec_type === "video") {
            streamInfo.width = stream.width;
            streamInfo.height = stream.height;
            streamInfo.frameRate = this.calculateFrameRate(stream.r_frame_rate);
            streamInfo.aspectRatio = stream.display_aspect_ratio;
          } else if (stream.codec_type === "audio") {
            streamInfo.channels = stream.channels;
            streamInfo.channelLayout = stream.channel_layout;
            streamInfo.sampleRate = parseInt(stream.sample_rate);
          }

          mediaInfo.streams.push(streamInfo);
        }
      }

      return mediaInfo;
    } catch (error) {
      log.error(`Error al obtener información de ${filePath}:`, { error });
      throw new InternalServerError(
        `Error al analizar archivo multimedia: ${error.message}`,
        "MEDIA_ANALYSIS_ERROR"
      );
    }
  }

  /**
   * Inicia un trabajo de transcodificación
   * @param {Object} job - Información del trabajo
   * @returns {Promise<Object>} - Trabajo creado
   */
  async startTranscodeJob(job) {
    // Verificar si la transcodificación está habilitada
    if (!this.transcodingEnabled) {
      throw new Error(
        "La transcodificación está deshabilitada en la configuración"
      );
    }

    // Validar datos del trabajo
    if (!job.inputPath || !job.mediaId) {
      throw new Error("Se requiere inputPath y mediaId para transcodificar");
    }

    // Asignar ID único si no tiene
    if (!job.id) {
      job.id = uuidv4();
    }

    // Configurar valores por defecto
    const transcode = {
      id: job.id,
      mediaId: job.mediaId,
      userId: job.userId || null,
      status: "pending",
      progress: 0,
      inputPath: job.inputPath,
      outputPath:
        job.outputPath || this.generateOutputPath(job.inputPath, job.profile),
      profile: job.profile || "standard",
      options: job.options || {},
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    // Guardar en la base de datos
    await this.saveJobToDatabase(transcode);

    // Registrar en memoria
    this.activeJobs.set(transcode.id, transcode);

    // Si hay slots disponibles, iniciar inmediatamente
    if (this.activeJobs.size <= this.maxConcurrentJobs) {
      this.executeTranscodeJob(transcode);
    } else {
      // Si no, agregar a la cola
      this.jobQueue.push(transcode);
      log.info(
        `Trabajo de transcodificación ${transcode.id} añadido a la cola (${this.jobQueue.length} en espera)`
      );
    }

    // Emitir evento de inicio
    eventBus.emitEvent("transcoding:queued", {
      jobId: transcode.id,
      mediaId: transcode.mediaId,
      profile: transcode.profile,
      queuePosition: this.jobQueue.length,
    });

    return transcode;
  }

  /**
   * Ejecuta un trabajo de transcodificación con FFmpeg
   * @param {Object} job - Trabajo a ejecutar
   */
  async executeTranscodeJob(job) {
    try {
      log.info(`Iniciando transcodificación para ${job.mediaId} (${job.id})`);

      // Asegurar que el directorio de salida existe
      await filesystem.ensureDir(path.dirname(job.outputPath));

      // Obtener información del archivo
      const mediaInfo = await this.getMediaInfo(job.inputPath);

      // Obtener perfil de transcodificación
      const profile = this.getTranscodeProfile(job.profile, job.options);

      // Configurar opciones de FFmpeg según el perfil
      const ffmpegOptions = await this.buildFFmpegOptions(
        profile,
        mediaInfo,
        job
      );

      // Actualizar estado del trabajo
      job.status = "processing";
      job.mediaInfo = mediaInfo;
      await this.updateJobInDatabase(job);

      // Emitir evento de inicio de procesamiento
      eventBus.emitEvent("transcoding:started", {
        jobId: job.id,
        mediaId: job.mediaId,
        profile: job.profile,
      });

      // Ejecutar FFmpeg como proceso hijo para poder monitorear el progreso
      const process = spawn(this.ffmpegPath, ffmpegOptions);

      // Capturar salida estándar
      process.stdout.on("data", (data) => {
        log.debug(`[FFmpeg stdout] ${data.toString().trim()}`);
      });

      // Capturar salida de error (FFmpeg usa stderr para el progreso)
      process.stderr.on("data", (data) => {
        const output = data.toString().trim();

        // Intentar extraer información de progreso
        const progress = this.parseFFmpegProgress(output, mediaInfo.duration);
        if (progress !== null) {
          job.progress = progress;

          // Emitir evento de progreso (pero no spamear la base de datos)
          eventBus.emitEvent("transcoding:progress", {
            jobId: job.id,
            mediaId: job.mediaId,
            progress: progress,
          });
        }

        // Log de salida de FFmpeg (nivel debug)
        log.debug(`[FFmpeg stderr] ${output}`);
      });

      // Manejar finalización
      process.on("close", (code) => {
        if (code === 0) {
          // Éxito
          job.status = "completed";
          job.progress = 100;
          job.completedAt = new Date().toISOString();

          log.info(
            `Transcodificación completada para ${job.mediaId} (${job.id})`
          );

          // Emitir evento de finalización
          eventBus.emitEvent("transcoding:completed", {
            jobId: job.id,
            mediaId: job.mediaId,
            outputPath: job.outputPath,
            duration:
              (new Date(job.completedAt) - new Date(job.startedAt)) / 1000,
          });
        } else {
          // Error
          job.status = "failed";
          job.error = `FFmpeg falló con código de salida ${code}`;

          log.error(
            `Transcodificación fallida para ${job.mediaId} (${job.id}): ${job.error}`
          );

          // Emitir evento de error
          eventBus.emitEvent("transcoding:failed", {
            jobId: job.id,
            mediaId: job.mediaId,
            error: job.error,
          });
        }

        // Actualizar en base de datos
        this.updateJobInDatabase(job).catch((err) =>
          log.error(`Error al actualizar trabajo en DB: ${err.message}`)
        );

        // Eliminar de trabajos activos
        this.activeJobs.delete(job.id);

        // Procesar siguiente trabajo en cola
        this.processNextInQueue();
      });

      // Manejar errores del proceso
      process.on("error", (err) => {
        job.status = "failed";
        job.error = `Error en proceso FFmpeg: ${err.message}`;
        log.error(`Error en proceso de transcodificación: ${err.message}`);

        // Actualizar en base de datos
        this.updateJobInDatabase(job).catch((dbErr) =>
          log.error(`Error al actualizar trabajo en DB: ${dbErr.message}`)
        );

        // Emitir evento de error
        eventBus.emitEvent("transcoding:failed", {
          jobId: job.id,
          mediaId: job.mediaId,
          error: job.error,
        });

        // Eliminar de trabajos activos
        this.activeJobs.delete(job.id);

        // Procesar siguiente trabajo en cola
        this.processNextInQueue();
      });
    } catch (error) {
      // Manejar errores en la preparación
      job.status = "failed";
      job.error = `Error al iniciar transcodificación: ${error.message}`;
      job.completedAt = new Date().toISOString();

      log.error(`Error al iniciar transcodificación para ${job.mediaId}:`, {
        error,
      });

      // Actualizar en base de datos
      await this.updateJobInDatabase(job);

      // Emitir evento de error
      eventBus.emitEvent("transcoding:failed", {
        jobId: job.id,
        mediaId: job.mediaId,
        error: job.error,
      });

      // Eliminar de trabajos activos
      this.activeJobs.delete(job.id);

      // Procesar siguiente trabajo en cola
      this.processNextInQueue();
    }
  }

  /**
   * Procesa el siguiente trabajo en la cola
   */
  processNextInQueue() {
    // Si no hay trabajos en cola o ya se está procesando, salir
    if (this.jobQueue.length === 0 || this.isProcessingQueue) {
      return;
    }

    // Marcar como procesando para evitar llamadas concurrentes
    this.isProcessingQueue = true;

    try {
      // Contar cuántos trabajos activos hay
      const activeCount = this.activeJobs.size;

      // Si hay espacio para más trabajos, procesar el siguiente
      if (activeCount < this.maxConcurrentJobs) {
        const nextJob = this.jobQueue.shift();

        if (nextJob) {
          log.info(
            `Iniciando trabajo en cola: ${nextJob.id} (${this.jobQueue.length} restantes)`
          );

          // Ejecutar el trabajo
          this.executeTranscodeJob(nextJob);
        }
      }
    } catch (error) {
      log.error("Error al procesar cola de transcodificación:", { error });
    } finally {
      // Marcar como terminado el procesamiento de la cola
      this.isProcessingQueue = false;
    }
  }

  /**
   * Cancela un trabajo de transcodificación
   * @param {string} jobId - ID del trabajo a cancelar
   * @returns {Promise<Object>} - Resultado de la cancelación
   */
  async cancelJob(jobId) {
    // Buscar el trabajo en memoria
    const job = this.activeJobs.get(jobId);

    if (!job) {
      // Buscar en la base de datos
      const dbJob = await this.getJobFromDatabase(jobId);

      if (!dbJob) {
        return { success: false, message: "Trabajo no encontrado" };
      }

      // Si el trabajo ya está completado o cancelado, no hacer nada
      if (dbJob.status === "completed" || dbJob.status === "cancelled") {
        return {
          success: false,
          message: `No se puede cancelar un trabajo en estado ${dbJob.status}`,
        };
      }

      // Si está pendiente en la cola, eliminarlo
      const queueIndex = this.jobQueue.findIndex((job) => job.id === jobId);
      if (queueIndex !== -1) {
        this.jobQueue.splice(queueIndex, 1);

        // Actualizar estado en base de datos
        dbJob.status = "cancelled";
        dbJob.completedAt = new Date().toISOString();
        await this.updateJobInDatabase(dbJob);

        // Emitir evento
        eventBus.emitEvent("transcoding:cancelled", {
          jobId: dbJob.id,
          mediaId: dbJob.mediaId,
        });

        return { success: true, message: "Trabajo en cola cancelado" };
      }

      return { success: false, message: "No se puede cancelar el trabajo" };
    }

    // Si el trabajo está activo, intentar detener el proceso
    try {
      // En una implementación completa, aquí buscaríamos el proceso FFmpeg
      // por PID y lo detendríamos. Pero para simplificar, asumimos que
      // no podemos detener procesos activos.

      // Marcar como cancelado
      job.status = "cancelled";
      job.completedAt = new Date().toISOString();
      await this.updateJobInDatabase(job);

      // Emitir evento
      eventBus.emitEvent("transcoding:cancelled", {
        jobId: job.id,
        mediaId: job.mediaId,
      });

      return { success: true, message: "Trabajo cancelado" };
    } catch (error) {
      log.error(`Error al cancelar trabajo ${jobId}:`, { error });
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  /**
   * Genera un stream HLS adaptativo para un medio
   * @param {Object} options - Opciones para la generación
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async createHLSStream(options) {
    const {
      mediaId,
      inputPath,
      outputDir = null,
      maxHeight = 1080,
      segmentDuration = this.segmentDuration,
      userId = null,
    } = options;

    // Verificar que la transcodificación está habilitada
    if (!this.transcodingEnabled) {
      throw new Error(
        "La transcodificación está deshabilitada en la configuración"
      );
    }

    try {
      // Validar entrada
      if (!inputPath || !mediaId) {
        throw new Error("Se requiere inputPath y mediaId para crear HLS");
      }

      // Generar directorio de salida
      const hlsDir = outputDir || this.generateHLSPath(inputPath);

      // Crear directorio si no existe
      await filesystem.ensureDir(hlsDir);

      // Analizar el archivo para obtener información
      const mediaInfo = await this.getMediaInfo(inputPath);

      // Crear configuración de calidades en función de la resolución original
      const qualities = this.generateHLSQualities(mediaInfo, maxHeight);

      // Generar ID único para el trabajo
      const jobId = uuidv4();

      // Crear trabajo en la base de datos
      const hlsJob = {
        id: jobId,
        mediaId,
        userId,
        status: "pending",
        progress: 0,
        inputPath,
        outputPath: path.join(hlsDir, "master.m3u8"),
        profile: "hls",
        options: {
          qualities,
          segmentDuration,
          maxHeight,
        },
        startedAt: new Date().toISOString(),
        completedAt: null,
        error: null,
      };

      // Guardar en la base de datos
      await this.saveJobToDatabase(hlsJob);

      // Iniciar trabajo de HLS
      await this.startHLSJob(hlsJob);

      return hlsJob;
    } catch (error) {
      log.error(`Error al crear stream HLS para ${mediaId}:`, { error });
      throw error;
    }
  }

  /**
   * Ejecuta la generación de un stream HLS adaptativo
   * @param {Object} job - Trabajo HLS a ejecutar
   */
  async startHLSJob(job) {
    try {
      log.info(`Iniciando generación HLS para ${job.mediaId} (${job.id})`);

      // Actualizar estado del trabajo
      job.status = "processing";
      await this.updateJobInDatabase(job);

      // Obtener información del archivo
      const mediaInfo =
        job.mediaInfo || (await this.getMediaInfo(job.inputPath));

      // Extraer opciones
      const { qualities, segmentDuration = this.segmentDuration } = job.options;

      // Asegurar que el directorio de salida existe
      const outputDir = path.dirname(job.outputPath);
      await filesystem.ensureDir(outputDir);

      // Construir opciones de FFmpeg para HLS
      const ffmpegArgs = await this.buildHLSOptions(
        mediaInfo,
        job.options,
        outputDir
      );

      // Emitir evento de inicio
      eventBus.emitEvent("transcoding:started", {
        jobId: job.id,
        mediaId: job.mediaId,
        profile: "hls",
      });

      // Ejecutar FFmpeg como proceso hijo
      const process = spawn(this.ffmpegPath, ffmpegArgs);

      // Capturar salida estándar
      process.stdout.on("data", (data) => {
        log.debug(`[FFmpeg stdout] ${data.toString().trim()}`);
      });

      // Capturar salida de error (FFmpeg usa stderr para el progreso)
      process.stderr.on("data", (data) => {
        const output = data.toString().trim();

        // Intentar extraer información de progreso
        const progress = this.parseFFmpegProgress(output, mediaInfo.duration);
        if (progress !== null) {
          job.progress = progress;

          // Emitir evento de progreso
          eventBus.emitEvent("transcoding:progress", {
            jobId: job.id,
            mediaId: job.mediaId,
            progress: progress,
          });
        }

        // Log de salida de FFmpeg (nivel debug)
        log.debug(`[FFmpeg stderr] ${output}`);
      });

      // Manejar finalización
      process.on("close", (code) => {
        if (code === 0) {
          // Éxito
          job.status = "completed";
          job.progress = 100;
          job.completedAt = new Date().toISOString();

          log.info(`Generación HLS completada para ${job.mediaId} (${job.id})`);

          // Emitir evento de finalización
          eventBus.emitEvent("transcoding:completed", {
            jobId: job.id,
            mediaId: job.mediaId,
            outputPath: job.outputPath,
            duration:
              (new Date(job.completedAt) - new Date(job.startedAt)) / 1000,
          });

          // Actualizar ruta HLS en la base de datos
          this.updateMediaHLSPath(job.mediaId, job.outputPath).catch((err) =>
            log.error(`Error al actualizar ruta HLS: ${err.message}`)
          );
        } else {
          // Error
          job.status = "failed";
          job.error = `FFmpeg falló con código de salida ${code}`;

          log.error(
            `Generación HLS fallida para ${job.mediaId} (${job.id}): ${job.error}`
          );

          // Emitir evento de error
          eventBus.emitEvent("transcoding:failed", {
            jobId: job.id,
            mediaId: job.mediaId,
            error: job.error,
          });
        }

        // Actualizar en base de datos
        this.updateJobInDatabase(job).catch((err) =>
          log.error(`Error al actualizar trabajo en DB: ${err.message}`)
        );
      });

      // Manejar errores del proceso
      process.on("error", (err) => {
        job.status = "failed";
        job.error = `Error en proceso FFmpeg: ${err.message}`;
        log.error(`Error en proceso de generación HLS: ${err.message}`);

        // Actualizar en base de datos
        this.updateJobInDatabase(job).catch((dbErr) =>
          log.error(`Error al actualizar trabajo en DB: ${dbErr.message}`)
        );

        // Emitir evento de error
        eventBus.emitEvent("transcoding:failed", {
          jobId: job.id,
          mediaId: job.mediaId,
          error: job.error,
        });
      });
    } catch (error) {
      // Manejar errores en la preparación
      job.status = "failed";
      job.error = `Error al iniciar generación HLS: ${error.message}`;
      job.completedAt = new Date().toISOString();

      log.error(`Error al iniciar generación HLS para ${job.mediaId}:`, {
        error,
      });

      // Actualizar en base de datos
      await this.updateJobInDatabase(job);

      // Emitir evento de error
      eventBus.emitEvent("transcoding:failed", {
        jobId: job.id,
        mediaId: job.mediaId,
        error: job.error,
      });
    }
  }

  /**
   * Genera una miniatura para un archivo de video
   * @param {string} videoPath - Ruta del archivo de video
   * @param {Object} options - Opciones para la generación
   * @returns {Promise<string|null>} - Ruta de la miniatura generada o null
   */
  async generateThumbnail(videoPath, options = {}) {
    try {
      const {
        timeOffset = 10, // segundos desde el inicio
        size = "320:-1", // ancho:alto, -1 mantiene aspecto
        outputPath = null,
      } = options;

      // Validar entrada
      if (!videoPath || !(await filesystem.exists(videoPath))) {
        throw new Error(`Archivo de video no encontrado: ${videoPath}`);
      }

      // Generar nombre y ruta si no se proporciona
      const fileName = path.basename(videoPath, path.extname(videoPath));
      const thumbnailPath =
        outputPath ||
        path.join(
          require("../../config/paths").THUMBNAILS_DIR,
          `${fileName}_thumb.jpg`
        );

      // Asegurar que el directorio existe
      await filesystem.ensureDir(path.dirname(thumbnailPath));

      // Construir comando FFmpeg
      const cmd = [
        "-y", // Sobrescribir sin preguntar
        "-ss",
        `00:00:${timeOffset}`, // Posición de tiempo
        "-i",
        videoPath, // Archivo de entrada
        "-vframes",
        "1", // Capturar un solo frame
        "-vf",
        `scale=${size}`, // Escalar
        "-q:v",
        "2", // Calidad (2 es buena calidad, 31 es la peor)
        thumbnailPath, // Salida
      ];

      log.debug(`Generando miniatura para ${videoPath} en ${timeOffset}s`);

      // Ejecutar FFmpeg
      const { stdout, stderr } = await execPromise(
        `${this.ffmpegPath} ${cmd.join(" ")}`
      );

      // Verificar que se creó el archivo
      if (await filesystem.exists(thumbnailPath)) {
        log.info(`Miniatura generada correctamente: ${thumbnailPath}`);
        return thumbnailPath;
      }

      log.warn(
        `FFmpeg no generó error, pero no se encontró la miniatura: ${thumbnailPath}`
      );
      return null;
    } catch (error) {
      log.error(`Error al generar miniatura para ${videoPath}:`, { error });
      return null;
    }
  }

  /**
   * Configura opciones de FFmpeg basadas en el perfil y la información del medio
   * @param {Object} profile - Perfil de transcodificación
   * @param {Object} mediaInfo - Información del archivo
   * @param {Object} job - Trabajo de transcodificación
   * @returns {Array} - Array de opciones para FFmpeg
   */
  async buildFFmpegOptions(profile, mediaInfo, job) {
    // Opciones básicas
    const options = [
      "-y", // Sobrescribir sin preguntar
      "-i",
      job.inputPath, // Archivo de entrada
    ];

    // Configurar aceleración por hardware si está disponible
    if (
      this.hwAcceleration !== "none" &&
      profile.useHardwareAcceleration !== false
    ) {
      const hwaccel = await this.detectHardwareAcceleration();
      if (hwaccel) {
        options.push("-hwaccel", hwaccel);
      }
    }

    // Añadir mapeo de streams (video y audio)
    const videoStream = mediaInfo.streams.find((s) => s.codecType === "video");
    const audioStream = mediaInfo.streams.find((s) => s.codecType === "audio");

    if (videoStream) {
      options.push("-map", `0:${videoStream.index}`);
    }

    if (audioStream) {
      options.push("-map", `0:${audioStream.index}`);
    }

    // Configurar codec de video según el perfil
    options.push("-c:v", profile.videoCodec);

    // Bitrate de video
    const maxBitrate = Math.min(
      profile.videoBitrate || "2000k",
      `${this.maxBitrate}k`
    );
    options.push("-b:v", maxBitrate);

    // Preset de calidad (para x264, x265)
    if (
      profile.preset &&
      (profile.videoCodec === "libx264" || profile.videoCodec === "libx265")
    ) {
      options.push("-preset", profile.preset);
    }

    // Resolución de salida
    if (profile.resolution) {
      options.push("-vf", `scale=${profile.resolution}`);
    }

    // Codec de audio
    options.push("-c:a", profile.audioCodec || "aac");

    // Bitrate de audio
    options.push("-b:a", profile.audioBitrate || "128k");

    // Número de canales de audio (para downmix a estéreo si es necesario)
    if (profile.audioChannels) {
      options.push("-ac", profile.audioChannels);
    }

    // Formato de salida
    options.push("-f", profile.format || "mp4");

    // Ruta de salida
    options.push(job.outputPath);

    return options;
  }

  /**
   * Construye opciones para la generación de HLS
   * @param {Object} mediaInfo - Información del archivo
   * @param {Object} options - Opciones específicas para HLS
   * @param {string} outputDir - Directorio de salida
   * @returns {Array} - Array de opciones para FFmpeg
   */
  buildHLSOptions(mediaInfo, options, outputDir) {
    const { qualities, segmentDuration = 2 } = options;

    // Opciones básicas
    const ffmpegArgs = [
      "-y", // Sobrescribir sin preguntar
      "-i",
      options.inputPath, // Archivo de entrada
      "-preset",
      "fast", // Usar preset rápido para acelerar la transcodificación
    ];

    // Configurar aceleración por hardware si está disponible
    if (this.hwAcceleration !== "none") {
      const hwaccel = this.detectHardwareAcceleration();
      if (hwaccel) {
        ffmpegArgs.unshift("-hwaccel", hwaccel);
      }
    }

    // Añadir filtro para cada calidad
    let filterComplex = "";
    let varStreamMap = "";

    for (let i = 0; i < qualities.length; i++) {
      const quality = qualities[i];

      // Añadir filtro de escala para cada calidad
      filterComplex += `[0:v]scale=${quality.width}:${quality.height}[v${i}];`;

      // Mapear stream de video y audio para cada calidad
      varStreamMap += `v:${i},a:0 `;
    }

    // Quitar último espacio
    varStreamMap = varStreamMap.trim();

    // Añadir filtro complejo si hay múltiples calidades
    if (qualities.length > 1) {
      ffmpegArgs.push("-filter_complex", filterComplex);
      ffmpegArgs.push("-var_stream_map", varStreamMap);
    }

    // Configurar cada calidad
    for (let i = 0; i < qualities.length; i++) {
      const quality = qualities[i];

      // Si solo hay una calidad, no necesitamos mapear el stream
      if (qualities.length === 1) {
        ffmpegArgs.push("-vf", `scale=${quality.width}:${quality.height}`);
      }

      // Codec de video (h264 para mayor compatibilidad)
      ffmpegArgs.push("-c:v", "libx264");

      // Perfil para mejor compatibilidad
      ffmpegArgs.push("-profile:v", "main");

      // Bitrate de video
      ffmpegArgs.push("-b:v", quality.bitrate);

      // Máximo bitrate (para evitar picos)
      ffmpegArgs.push("-maxrate", quality.maxBitrate || quality.bitrate);

      // Buffer size
      ffmpegArgs.push("-bufsize", quality.bufsize || quality.bitrate);
    }

    // Codec de audio (AAC para mayor compatibilidad)
    ffmpegArgs.push("-c:a", "aac");

    // Bitrate de audio
    ffmpegArgs.push("-b:a", "128k");

    // Opciones HLS
    ffmpegArgs.push(
      "-f",
      "hls", // Formato HLS
      "-hls_time",
      segmentDuration.toString(), // Duración de segmentos
      "-hls_playlist_type",
      "vod", // Video on demand (completo)
      "-hls_segment_filename",
      path.join(outputDir, "segment_%v_%03d.ts"), // Patrón de nombres de segmentos
      "-master_pl_name",
      "master.m3u8", // Nombre de la playlist principal
      path.join(outputDir, "stream_%v.m3u8") // Patrón de playlists por calidad
    );

    return ffmpegArgs;
  }

  /**
   * Determina el mejor método de aceleración por hardware disponible
   * @returns {string|null} - Método de aceleración o null si no está disponible
   */
  async detectHardwareAcceleration() {
    // Si está configurado como auto, intentar detectar
    if (this.hwAcceleration === "auto") {
      try {
        // Verificar disponibilidad de NVIDIA NVENC
        const { stdout: nvencInfo } = await execPromise(
          `${this.ffmpegPath} -encoders | grep nvenc`
        );
        if (nvencInfo.includes("nvenc")) {
          return "nvenc";
        }

        // Verificar disponibilidad de Intel QuickSync
        const { stdout: qsvInfo } = await execPromise(
          `${this.ffmpegPath} -encoders | grep qsv`
        );
        if (qsvInfo.includes("qsv")) {
          return "qsv";
        }

        // Verificar disponibilidad de VAAPI (Linux)
        const { stdout: vaapiInfo } = await execPromise(
          `${this.ffmpegPath} -encoders | grep vaapi`
        );
        if (vaapiInfo.includes("vaapi")) {
          return "vaapi";
        }

        // Verificar disponibilidad de VideoToolbox (macOS)
        const { stdout: vtInfo } = await execPromise(
          `${this.ffmpegPath} -encoders | grep videotoolbox`
        );
        if (vtInfo.includes("videotoolbox")) {
          return "videotoolbox";
        }

        return null; // No se encontró aceleración por hardware
      } catch (error) {
        log.warn("Error al detectar aceleración por hardware:", { error });
        return null;
      }
    }

    // Si está configurado manualmente, usar ese valor
    return this.hwAcceleration === "none" ? null : this.hwAcceleration;
  }

  /**
   * Genera niveles de calidad para HLS adaptativo basado en la información del medio
   * @param {Object} mediaInfo - Información del archivo
   * @param {number} maxHeight - Altura máxima permitida
   * @returns {Array} - Array de configuraciones de calidad
   */
  generateHLSQualities(mediaInfo, maxHeight = 1080) {
    const qualities = [];

    // Buscar stream de video
    const videoStream = mediaInfo.streams.find((s) => s.codecType === "video");

    if (!videoStream) {
      // Si no hay video, devolver calidad básica
      return [
        {
          width: 640,
          height: 360,
          bitrate: "800k",
          maxBitrate: "1000k",
          bufsize: "1200k",
        },
      ];
    }

    // Obtener resolución original
    const originalWidth = videoStream.width;
    const originalHeight = videoStream.height;

    // Si no hay información de resolución, usar valores predeterminados
    if (!originalWidth || !originalHeight) {
      return [
        {
          width: 640,
          height: 360,
          bitrate: "800k",
          maxBitrate: "1000k",
          bufsize: "1200k",
        },
      ];
    }

    // Calcular relación de aspecto
    const aspectRatio = originalWidth / originalHeight;

    // Definir alturas estándar (de menor a mayor)
    const standardHeights = [360, 480, 720, 1080];

    // Filtrar alturas que no excedan el máximo o el original
    const applicableHeights = standardHeights.filter(
      (h) => h <= maxHeight && h <= originalHeight
    );

    // Si no hay alturas aplicables, usar la altura original
    if (applicableHeights.length === 0) {
      const height = originalHeight > maxHeight ? maxHeight : originalHeight;
      const width = Math.round((height * aspectRatio) / 2) * 2; // Asegurar que es par

      qualities.push({
        width,
        height,
        bitrate: this.calculateBitrate(width, height),
        maxBitrate: this.calculateBitrate(width, height, 1.5),
        bufsize: this.calculateBitrate(width, height, 2),
      });

      return qualities;
    }

    // Generar calidades para cada altura aplicable
    for (const height of applicableHeights) {
      const width = Math.round((height * aspectRatio) / 2) * 2; // Asegurar que es par

      qualities.push({
        width,
        height,
        bitrate: this.calculateBitrate(width, height),
        maxBitrate: this.calculateBitrate(width, height, 1.5),
        bufsize: this.calculateBitrate(width, height, 2),
      });
    }

    return qualities;
  }

  /**
   * Calcula un bitrate recomendado basado en la resolución
   * @param {number} width - Ancho del video
   * @param {number} height - Alto del video
   * @param {number} multiplier - Multiplicador opcional
   * @returns {string} - Bitrate en formato FFmpeg (ej: "2000k")
   */
  calculateBitrate(width, height, multiplier = 1) {
    // Fórmula simple: ancho * alto * 0.1 bpp * 30fps / 1000 = kbps
    let bpp = 0.1; // bits por pixel

    if (height <= 360) bpp = 0.07;
    else if (height <= 480) bpp = 0.08;
    else if (height <= 720) bpp = 0.1;
    else if (height <= 1080) bpp = 0.12;
    else bpp = 0.15;

    // Cálculo base: ancho * alto * bpp * 30fps / 1000 = kbps
    let bitrate = Math.round((width * height * bpp * 30) / 1000);

    // Aplicar multiplicador
    bitrate = Math.round(bitrate * multiplier);

    // Limitar al máximo configurado
    bitrate = Math.min(bitrate, this.maxBitrate);

    return `${bitrate}k`;
  }

  /**
   * Obtiene un perfil de transcodificación por nombre
   * @param {string} profileName - Nombre del perfil
   * @param {Object} customOptions - Opciones personalizadas
   * @returns {Object} - Perfil de transcodificación
   */
  getTranscodeProfile(profileName = "standard", customOptions = {}) {
    // Obtener perfil base de las constantes
    const baseProfile =
      TRANSCODE_PROFILES[profileName.toUpperCase()] ||
      TRANSCODE_PROFILES.STANDARD;

    // Fusionar con opciones personalizadas
    return {
      ...baseProfile,
      ...customOptions,
    };
  }

  /**
   * Genera una ruta de salida para un archivo transcodificado
   * @param {string} inputPath - Ruta del archivo de entrada
   * @param {string} profile - Nombre del perfil usado
   * @returns {string} - Ruta de salida
   */
  generateOutputPath(inputPath, profile = "standard") {
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const profileSuffix = profile === "standard" ? "" : `_${profile}`;

    return path.join(TRANSCODED_DIR, `${fileName}${profileSuffix}.mp4`);
  }

  /**
   * Genera una ruta para HLS
   * @param {string} inputPath - Ruta del archivo de entrada
   * @returns {string} - Ruta del directorio HLS
   */
  generateHLSPath(inputPath) {
    const fileName = path.basename(inputPath, path.extname(inputPath));
    return path.join(TRANSCODED_DIR, `${fileName}_hls`);
  }

  /**
   * Extrae información de progreso de la salida de FFmpeg
   * @param {string} output - Línea de salida de FFmpeg
   * @param {number} totalDuration - Duración total del archivo
   * @returns {number|null} - Porcentaje de progreso (0-100) o null
   */
  parseFFmpegProgress(output, totalDuration) {
    // Buscar patrones de tiempo
    const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);

    if (timeMatch && totalDuration) {
      // Convertir a segundos
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseFloat(timeMatch[3]);

      const currentTime = hours * 3600 + minutes * 60 + seconds;

      // Calcular porcentaje
      const progress = Math.min(
        Math.round((currentTime / totalDuration) * 100),
        100
      );
      return progress;
    }

    return null;
  }

  /**
   * Calcula framerate a partir de la cadena proporcionada por ffprobe
   * @param {string} rateString - Cadena de tasa de frames (ej: "24000/1001")
   * @returns {number} - Frame rate calculado
   */
  calculateFrameRate(rateString) {
    try {
      if (!rateString || !rateString.includes("/")) {
        return parseFloat(rateString);
      }

      const [numerator, denominator] = rateString.split("/").map(Number);
      return parseFloat((numerator / denominator).toFixed(3));
    } catch (error) {
      return null;
    }
  }

  /**
   * Guarda un trabajo de transcodificación en la base de datos
   * @param {Object} job - Trabajo a guardar
   * @returns {Promise<void>}
   */
  async saveJobToDatabase(job) {
    try {
      const db = require("../../data/db");

      // Convertir opciones a JSON
      const optionsJson = JSON.stringify(job.options);

      // Insertar en la tabla de trabajos
      await db.asyncRun(
        `INSERT INTO transcoding_jobs 
         (id, media_id, user_id, status, progress, input_path, output_path, profile, options, error, started_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          job.id,
          job.mediaId,
          job.userId,
          job.status,
          job.progress,
          job.inputPath,
          job.outputPath,
          job.profile,
          optionsJson,
          job.error,
          job.startedAt,
        ]
      );
    } catch (error) {
      log.error(`Error al guardar trabajo ${job.id} en base de datos:`, {
        error,
      });
      throw new DatabaseError(`Error al guardar trabajo: ${error.message}`);
    }
  }

  /**
   * Actualiza un trabajo de transcodificación en la base de datos
   * @param {Object} job - Trabajo a actualizar
   * @returns {Promise<void>}
   */
  async updateJobInDatabase(job) {
    try {
      const db = require("../../data/db");

      // Convertir opciones a JSON
      const optionsJson = JSON.stringify(job.options);

      // Actualizar en la tabla de trabajos
      await db.asyncRun(
        `UPDATE transcoding_jobs 
         SET status = ?, progress = ?, output_path = ?, options = ?, 
             error = ?, completed_at = ?
         WHERE id = ?`,
        [
          job.status,
          job.progress,
          job.outputPath,
          optionsJson,
          job.error,
          job.completedAt,
          job.id,
        ]
      );
    } catch (error) {
      log.error(`Error al actualizar trabajo ${job.id} en base de datos:`, {
        error,
      });
      throw new DatabaseError(`Error al actualizar trabajo: ${error.message}`);
    }
  }

  /**
   * Obtiene un trabajo de transcodificación de la base de datos
   * @param {string} jobId - ID del trabajo
   * @returns {Promise<Object|null>} - Trabajo encontrado o null
   */
  async getJobFromDatabase(jobId) {
    try {
      const db = require("../../data/db");

      const job = await db.asyncGet(
        "SELECT * FROM transcoding_jobs WHERE id = ?",
        [jobId]
      );

      if (!job) return null;

      // Parsear opciones JSON
      if (job.options) {
        try {
          job.options = JSON.parse(job.options);
        } catch (e) {
          job.options = {};
        }
      }

      return job;
    } catch (error) {
      log.error(`Error al obtener trabajo ${jobId} de la base de datos:`, {
        error,
      });
      throw new DatabaseError(`Error al obtener trabajo: ${error.message}`);
    }
  }

  /**
   * Actualiza la ruta HLS en la tabla de medios
   * @param {number} mediaId - ID del elemento multimedia
   * @param {string} hlsPath - Ruta del archivo HLS master
   * @returns {Promise<void>}
   */
  async updateMediaHLSPath(mediaId, hlsPath) {
    try {
      const db = require("../../data/db");

      await db.asyncRun("UPDATE media_items SET hls_path = ? WHERE id = ?", [
        hlsPath,
        mediaId,
      ]);

      log.info(`Ruta HLS actualizada para mediaId ${mediaId}: ${hlsPath}`);
    } catch (error) {
      log.error(`Error al actualizar ruta HLS para mediaId ${mediaId}:`, {
        error,
      });
      throw new DatabaseError(`Error al actualizar ruta HLS: ${error.message}`);
    }
  }

  /**
   * Obtiene los perfiles de transcodificación disponibles
   * @returns {Array} - Lista de perfiles disponibles
   */
  getAvailableProfiles() {
    const profiles = [];

    // Convertir los perfiles constantes a un formato más amigable
    for (const [key, profile] of Object.entries(TRANSCODE_PROFILES)) {
      profiles.push({
        id: profile.id || key.toLowerCase(),
        name: profile.name || key,
        description:
          profile.description || `Perfil de transcodificación ${key}`,
        videoCodec: profile.videoCodec,
        audioCodec: profile.audioCodec,
        resolution: profile.resolution,
        bitrates: {
          video: profile.videoBitrate,
          audio: profile.audioBitrate,
        },
      });
    }

    return profiles;
  }

  /**
   * Obtiene los trabajos de transcodificación
   * @param {Object} filters - Filtros a aplicar
   * @returns {Promise<Array>} - Lista de trabajos
   */
  async getJobs(filters = {}) {
    try {
      const { status, mediaId, limit = 20, offset = 0 } = filters;

      const db = require("../../data/db");

      let query = "SELECT * FROM transcoding_jobs";
      const params = [];

      // Aplicar filtros
      const whereConditions = [];

      if (status) {
        whereConditions.push("status = ?");
        params.push(status);
      }

      if (mediaId) {
        whereConditions.push("media_id = ?");
        params.push(mediaId);
      }

      if (whereConditions.length > 0) {
        query += " WHERE " + whereConditions.join(" AND ");
      }

      // Ordenar y limitar
      query += " ORDER BY started_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const jobs = await db.asyncAll(query, params);

      // Parsear opciones JSON
      return jobs.map((job) => {
        if (job.options) {
          try {
            job.options = JSON.parse(job.options);
          } catch (e) {
            job.options = {};
          }
        }
        return job;
      });
    } catch (error) {
      log.error("Error al obtener trabajos de transcodificación:", { error });
      throw new DatabaseError(`Error al obtener trabajos: ${error.message}`);
    }
  }

  /**
   * Obtiene un trabajo por su ID
   * @param {string} jobId - ID del trabajo
   * @returns {Promise<Object|null>} - Trabajo encontrado o null
   */
  async getJobById(jobId) {
    return this.getJobFromDatabase(jobId);
  }
}
