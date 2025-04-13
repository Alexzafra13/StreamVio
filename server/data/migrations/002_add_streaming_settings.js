// server/data/migrations/002_add_streaming_settings.js
const db = require("../db");

/**
 * Migración para añadir configuraciones de streaming y mejoras en el seguimiento de progreso
 */
const up = async () => {
  console.log("Ejecutando migración: 002_add_streaming_settings - UP");

  // Iniciar transacción
  await db.asyncRun("BEGIN TRANSACTION");

  try {
    // 1. Añadir tabla para trabajos de transcodificación
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS transcoding_jobs (
        id TEXT PRIMARY KEY, -- UUID generado para cada trabajo
        media_id INTEGER NOT NULL,
        user_id INTEGER,
        status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
        progress INTEGER DEFAULT 0,
        input_path TEXT NOT NULL,
        output_path TEXT,
        profile TEXT,
        options TEXT, -- JSON con opciones de transcodificación
        error TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `);

    // 2. Añadir tabla para formatos disponibles de cada elemento
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS media_formats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_id INTEGER NOT NULL,
        format_type TEXT NOT NULL CHECK(format_type IN ('original', 'transcoded', 'hls')),
        file_path TEXT NOT NULL,
        mime_type TEXT,
        bitrate INTEGER,
        resolution TEXT,
        size INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE,
        UNIQUE(media_id, format_type)
      )
    `);

    // 3. Añadir campos para seguimiento de transmisión en watch_history
    // Verificar primero si la columna ya existe para evitar errores
    const columnsResult = await db.asyncAll("PRAGMA table_info(watch_history)");
    const columnNames = columnsResult.map((col) => col.name);

    if (!columnNames.includes("last_played")) {
      await db.asyncRun(
        "ALTER TABLE watch_history ADD COLUMN last_played TIMESTAMP"
      );
    }

    if (!columnNames.includes("play_count")) {
      await db.asyncRun(
        "ALTER TABLE watch_history ADD COLUMN play_count INTEGER DEFAULT 1"
      );
    }

    if (!columnNames.includes("device_info")) {
      await db.asyncRun(
        "ALTER TABLE watch_history ADD COLUMN device_info TEXT"
      );
    }

    // 4. Añadir nuevas configuraciones de streaming
    await db.asyncRun(`
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('hls_segment_duration', '2', 'Duración de cada segmento HLS en segundos'),
        ('transcoding_thread_count', '2', 'Número de trabajos de transcodificación simultáneos'),
        ('default_streaming_quality', 'auto', 'Calidad de streaming por defecto (auto, low, medium, high)'),
        ('enable_direct_play', '1', 'Permitir reproducción directa si el dispositivo es compatible'),
        ('enable_hardware_acceleration', '1', 'Usar aceleración por hardware para transcodificación si está disponible'),
        ('preferred_audio_codec', 'aac', 'Códec de audio preferido para transcodificación'),
        ('preferred_video_codec', 'h264', 'Códec de video preferido para transcodificación')
    `);

    // 5. Crear índices para las nuevas tablas
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_transcoding_jobs_media ON transcoding_jobs(media_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_transcoding_jobs_status ON transcoding_jobs(status)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_transcoding_jobs_user ON transcoding_jobs(user_id)"
    );

    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_formats_media ON media_formats(media_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_formats_type ON media_formats(format_type)"
    );

    // 6. Añadir campo para ruta de streaming HLS en media_items
    const mediaColumnsResult = await db.asyncAll(
      "PRAGMA table_info(media_items)"
    );
    const mediaColumnNames = mediaColumnsResult.map((col) => col.name);

    if (!mediaColumnNames.includes("hls_path")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN hls_path TEXT");
    }

    // Confirmar transacción
    await db.asyncRun("COMMIT");

    console.log("Migración 002_add_streaming_settings completada con éxito.");
    return true;
  } catch (error) {
    // Revertir cambios en caso de error
    await db.asyncRun("ROLLBACK");
    console.error("Error en migración 002_add_streaming_settings:", error);
    throw error;
  }
};

/**
 * Eliminar los cambios de la migración (operación inversa)
 */
const down = async () => {
  console.log("Ejecutando migración: 002_add_streaming_settings - DOWN");

  // Iniciar transacción
  await db.asyncRun("BEGIN TRANSACTION");

  try {
    // 1. Eliminar nuevas tablas
    await db.asyncRun("DROP TABLE IF EXISTS transcoding_jobs");
    await db.asyncRun("DROP TABLE IF EXISTS media_formats");

    // 2. Eliminar configuraciones añadidas
    await db.asyncRun(
      "DELETE FROM settings WHERE key IN ('hls_segment_duration', 'transcoding_thread_count', 'default_streaming_quality', 'enable_direct_play', 'enable_hardware_acceleration', 'preferred_audio_codec', 'preferred_video_codec')"
    );

    // 3. No podemos eliminar columnas en SQLite fácilmente, así que las dejamos
    // En una implementación más avanzada, habría que recrear la tabla sin esas columnas

    // Confirmar transacción
    await db.asyncRun("COMMIT");

    console.log(
      "Rollback de migración 002_add_streaming_settings completado con éxito."
    );
    return true;
  } catch (error) {
    // Revertir cambios en caso de error
    await db.asyncRun("ROLLBACK");
    console.error(
      "Error en rollback de migración 002_add_streaming_settings:",
      error
    );
    throw error;
  }
};

module.exports = { up, down };
