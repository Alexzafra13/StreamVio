// server/scripts/add-streaming-tokens.js
/**
 * Script para añadir la tabla de tokens de streaming a la base de datos
 */
const db = require("../config/database");

async function addStreamingTokensTable() {
  console.log("Añadiendo tabla de tokens de streaming...");

  try {
    // Verificar si la tabla ya existe
    const tableExists = await db.asyncGet(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='streaming_tokens'"
    );

    if (tableExists) {
      console.log("La tabla streaming_tokens ya existe, omitiendo creación");
      return;
    }

    // Crear tabla de tokens de streaming
    await db.asyncRun(`
      CREATE TABLE streaming_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        media_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
      )
    `);

    // Crear índice para búsquedas rápidas
    await db.asyncRun(`
      CREATE INDEX idx_streaming_tokens_token ON streaming_tokens(token);
    `);

    await db.asyncRun(`
      CREATE INDEX idx_streaming_tokens_media_user ON streaming_tokens(media_id, user_id);
    `);

    console.log("Tabla streaming_tokens creada exitosamente");
  } catch (error) {
    console.error("Error al crear tabla streaming_tokens:", error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  addStreamingTokensTable()
    .then(() => {
      console.log("Migración completada exitosamente");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error en la migración:", error);
      process.exit(1);
    });
}

module.exports = addStreamingTokensTable;
