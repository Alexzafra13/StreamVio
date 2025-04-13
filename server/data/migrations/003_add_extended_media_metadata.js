// server/data/migrations/003_add_extended_media_metadata.js
const db = require("../db");

/**
 * Migración para añadir campos extendidos de metadatos multimedia
 */
const up = async () => {
  console.log("Ejecutando migración: 003_add_extended_media_metadata - UP");

  // Iniciar transacción
  await db.asyncRun("BEGIN TRANSACTION");

  try {
    // Verificar si la tabla media_items existe
    const tableCheck = await db.asyncGet(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='media_items'"
    );

    if (!tableCheck) {
      throw new Error(
        "La tabla media_items no existe, ejecute las migraciones anteriores primero"
      );
    }

    // 1. Obtener información actual de columnas
    const columnsInfo = await db.asyncAll("PRAGMA table_info(media_items)");
    const columnNames = columnsInfo.map((col) => col.name);

    // 2. Añadir los nuevos campos si no existen

    // Campos técnicos de video
    if (!columnNames.includes("width")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN width INTEGER");
    }

    if (!columnNames.includes("height")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN height INTEGER");
    }

    if (!columnNames.includes("codec")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN codec TEXT");
    }

    if (!columnNames.includes("bitrate")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN bitrate INTEGER");
    }

    if (!columnNames.includes("frame_rate")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN frame_rate REAL");
    }

    if (!columnNames.includes("aspect_ratio")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN aspect_ratio TEXT");
    }

    // Campos de audio
    if (!columnNames.includes("artist")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN artist TEXT");
    }

    if (!columnNames.includes("album")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN album TEXT");
    }

    if (!columnNames.includes("audio_codec")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN audio_codec TEXT");
    }

    if (!columnNames.includes("channels")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN channels INTEGER");
    }

    if (!columnNames.includes("sample_rate")) {
      await db.asyncRun(
        "ALTER TABLE media_items ADD COLUMN sample_rate INTEGER"
      );
    }

    // Campos específicos para series
    if (!columnNames.includes("season_count")) {
      await db.asyncRun(
        "ALTER TABLE media_items ADD COLUMN season_count INTEGER"
      );
    }

    if (!columnNames.includes("episode_count")) {
      await db.asyncRun(
        "ALTER TABLE media_items ADD COLUMN episode_count INTEGER"
      );
    }

    // Campos adicionales para metadatos enriquecidos
    if (!columnNames.includes("overview")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN overview TEXT");
    }

    if (!columnNames.includes("tagline")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN tagline TEXT");
    }

    if (!columnNames.includes("external_id")) {
      await db.asyncRun("ALTER TABLE media_items ADD COLUMN external_id TEXT");
    }

    if (!columnNames.includes("external_source")) {
      await db.asyncRun(
        "ALTER TABLE media_items ADD COLUMN external_source TEXT"
      );
    }

    // 3. Crear índices para mejorar consultas

    // Índice para búsqueda por título
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_title ON media_items(title)"
    );

    // Índice para estructura de series/episodios
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_parent ON media_items(parent_id)"
    );
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_season_episode ON media_items(season_number, episode_number)"
    );

    // Índice para metadatos externos
    await db.asyncRun(
      "CREATE INDEX IF NOT EXISTS idx_media_items_external_id ON media_items(external_id)"
    );

    // Confirmar transacción
    await db.asyncRun("COMMIT");

    console.log(
      "Migración 003_add_extended_media_metadata completada con éxito."
    );
    return true;
  } catch (error) {
    // Revertir cambios en caso de error
    await db.asyncRun("ROLLBACK");
    console.error("Error en migración 003_add_extended_media_metadata:", error);
    throw error;
  }
};

/**
 * No se pueden eliminar columnas en SQLite fácilmente, así que esta migración
 * no es realmente reversible, pero podemos documentar cómo se haría en una BD que lo permita
 */
const down = async () => {
  console.log("Ejecutando migración: 003_add_extended_media_metadata - DOWN");
  console.log("NOTA: SQLite no permite eliminar columnas directamente.");
  console.log(
    "La migración down es solo para documentación y no realiza cambios."
  );

  // En SQLite tendríamos que:
  // 1. Crear una tabla temporal con la estructura anterior
  // 2. Copiar los datos de la tabla actual a la temporal
  // 3. Eliminar la tabla actual
  // 4. Renombrar la tabla temporal a la original

  return true;
};

module.exports = { up, down };
