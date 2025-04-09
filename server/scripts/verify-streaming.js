// server/scripts/verify-streaming.js
// Script para verificar la configuración de streaming
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
require("dotenv").config();

// Promisificar operaciones de fs
const access = promisify(fs.access);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Colores para la salida
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

// Ubicación de la base de datos
const dbPath = path.resolve(__dirname, "../data/streamvio.db");

// Función principal
async function main() {
  try {
    console.log(
      `${colors.blue}=========================================${colors.reset}`
    );
    console.log(
      `${colors.blue}    Verificación de sistema de streaming    ${colors.reset}`
    );
    console.log(
      `${colors.blue}=========================================${colors.reset}\n`
    );

    // Verificar conexión a la base de datos
    console.log(`${colors.yellow}Verificando base de datos...${colors.reset}`);
    const db = await connectToDatabase();

    // Funciones asíncronas para la base de datos
    db.asyncGet = promisify(db.get.bind(db));
    db.asyncAll = promisify(db.all.bind(db));
    db.asyncRun = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    };

    // Verificar tabla streaming_tokens
    await verifyTokenTable(db);

    // Obtener medios de la base de datos
    console.log(
      `\n${colors.yellow}Verificando elementos multimedia...${colors.reset}`
    );
    const media = await db.asyncAll("SELECT * FROM media_items LIMIT 10");

    if (!media || media.length === 0) {
      console.log(
        `${colors.red}✗ No se encontraron elementos multimedia en la base de datos${colors.reset}`
      );
    } else {
      console.log(
        `${colors.green}✓ Se encontraron ${media.length} elementos multimedia${colors.reset}`
      );

      // Verificar archivos
      let fileIssues = 0;

      for (const item of media) {
        const filePath = item.file_path;

        console.log(
          `\n${colors.yellow}Verificando archivo: ${filePath}${colors.reset}`
        );

        try {
          // Verificar si el archivo existe
          await access(filePath, fs.constants.R_OK);
          console.log(
            `${colors.green}✓ El archivo existe y es legible${colors.reset}`
          );

          // Obtener información del archivo
          const fileStats = await stat(filePath);
          console.log(
            `${colors.blue}ℹ Información del archivo:${colors.reset}`
          );
          console.log(
            `   - Tamaño: ${fileStats.size} bytes (${(
              fileStats.size /
              1024 /
              1024
            ).toFixed(2)} MB)`
          );
          console.log(`   - Última modificación: ${fileStats.mtime}`);
          console.log(`   - Permisos: ${fileStats.mode.toString(8)}`);
          console.log(`   - UID: ${fileStats.uid}, GID: ${fileStats.gid}`);

          // Verificar tamaño en la base de datos
          if (item.size !== fileStats.size && item.size !== null) {
            console.log(
              `${colors.yellow}⚠ El tamaño en la base de datos (${item.size} bytes) no coincide con el tamaño real (${fileStats.size} bytes)${colors.reset}`
            );
          }

          // Verificar MIME type
          const ext = path.extname(filePath).toLowerCase();
          console.log(
            `${colors.blue}ℹ Extensión del archivo: ${ext}${colors.reset}`
          );

          // Verificar transcoding disponible
          const fileName = path.basename(filePath, path.extname(filePath));
          const hlsDir = path.join(
            process.cwd(),
            "server/data/transcoded",
            `${fileName}_hls`
          );
          const hasHLS =
            fs.existsSync(hlsDir) &&
            fs.existsSync(path.join(hlsDir, "master.m3u8"));

          if (hasHLS) {
            console.log(
              `${colors.green}✓ Versión HLS disponible: ${hlsDir}${colors.reset}`
            );
          } else {
            console.log(
              `${colors.yellow}ℹ No hay versión HLS disponible${colors.reset}`
            );
          }
        } catch (fileError) {
          fileIssues++;
          console.log(
            `${colors.red}✗ Error con el archivo: ${fileError.message}${colors.reset}`
          );

          if (fileError.code === "ENOENT") {
            console.log(`${colors.red}  ► El archivo no existe${colors.reset}`);
          } else if (fileError.code === "EACCES") {
            console.log(
              `${colors.red}  ► No tienes permisos para acceder al archivo${colors.reset}`
            );
            console.log(
              `${colors.magenta}  ► Solución: chmod 644 "${filePath}" ${colors.reset}`
            );
          }
        }
      }

      if (fileIssues > 0) {
        console.log(
          `\n${colors.red}⚠ Se encontraron problemas en ${fileIssues} de ${media.length} archivos${colors.reset}`
        );
      } else {
        console.log(
          `\n${colors.green}✓ Todos los archivos verificados están accesibles${colors.reset}`
        );
      }
    }

    // Verificar permisos de directorios
    console.log(
      `\n${colors.yellow}Verificando permisos de directorios...${colors.reset}`
    );
    await verifyDirectories();

    console.log(`\n${colors.blue}Verificación completada${colors.reset}`);
    db.close();
  } catch (error) {
    console.error(
      `${colors.red}Error durante la verificación: ${error.message}${colors.reset}`
    );
    console.error(error);
  }
}

// Conectar a la base de datos
async function connectToDatabase() {
  return new Promise((resolve, reject) => {
    console.log(`Conectando a: ${dbPath}`);

    if (!fs.existsSync(dbPath)) {
      console.log(
        `${colors.red}✗ Base de datos no encontrada en: ${dbPath}${colors.reset}`
      );
      reject(new Error("Base de datos no encontrada"));
      return;
    }

    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.log(
          `${colors.red}✗ Error al conectar a la base de datos: ${err.message}${colors.reset}`
        );
        reject(err);
        return;
      }

      console.log(
        `${colors.green}✓ Conexión exitosa a la base de datos${colors.reset}`
      );
      resolve(db);
    });
  });
}

// Verificar tabla de tokens de streaming
async function verifyTokenTable(db) {
  console.log(
    `\n${colors.yellow}Verificando tabla de tokens de streaming...${colors.reset}`
  );

  try {
    // Verificar si la tabla existe
    const tableCheck = await db.asyncGet(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='streaming_tokens'"
    );

    if (!tableCheck) {
      console.log(
        `${colors.yellow}⚠ La tabla streaming_tokens no existe, intentando crearla...${colors.reset}`
      );

      try {
        // Crear la tabla
        await db.asyncRun(`
          CREATE TABLE IF NOT EXISTS streaming_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            revoked BOOLEAN DEFAULT 0,
            revoked_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
          )
        `);

        console.log(
          `${colors.green}✓ Tabla streaming_tokens creada correctamente${colors.reset}`
        );

        // Crear índices
        await db.asyncRun(
          "CREATE INDEX IF NOT EXISTS idx_streaming_tokens_token ON streaming_tokens(token)"
        );
        await db.asyncRun(
          "CREATE INDEX IF NOT EXISTS idx_streaming_tokens_user_media ON streaming_tokens(user_id, media_id)"
        );
        await db.asyncRun(
          "CREATE INDEX IF NOT EXISTS idx_streaming_tokens_expires ON streaming_tokens(expires_at)"
        );

        console.log(
          `${colors.green}✓ Índices creados correctamente${colors.reset}`
        );
      } catch (createError) {
        console.log(
          `${colors.red}✗ Error al crear tabla: ${createError.message}${colors.reset}`
        );
      }
    } else {
      console.log(
        `${colors.green}✓ La tabla streaming_tokens existe${colors.reset}`
      );

      // Verificar cantidad de tokens
      try {
        const tokenCount = await db.asyncGet(
          "SELECT COUNT(*) as count FROM streaming_tokens"
        );
        console.log(
          `${colors.blue}ℹ La tabla contiene ${tokenCount.count} tokens${colors.reset}`
        );

        // Verificar tokens expirados
        const expiredCount = await db.asyncGet(
          "SELECT COUNT(*) as count FROM streaming_tokens WHERE expires_at < datetime('now')"
        );
        if (expiredCount.count > 0) {
          console.log(
            `${colors.yellow}⚠ Hay ${expiredCount.count} tokens expirados que deberían ser limpiados${colors.reset}`
          );

          // Realizar limpieza
          try {
            const result = await db.asyncRun(
              "DELETE FROM streaming_tokens WHERE expires_at < datetime('now')"
            );
            console.log(
              `${colors.green}✓ Se eliminaron ${result.changes} tokens expirados${colors.reset}`
            );
          } catch (cleanupError) {
            console.log(
              `${colors.red}✗ Error al limpiar tokens expirados: ${cleanupError.message}${colors.reset}`
            );
          }
        }
      } catch (countError) {
        console.log(
          `${colors.red}✗ Error al contar tokens: ${countError.message}${colors.reset}`
        );
      }
    }
  } catch (error) {
    console.log(
      `${colors.red}✗ Error al verificar tabla de tokens: ${error.message}${colors.reset}`
    );
  }
}

// Verificar permisos de directorios
async function verifyDirectories() {
  const dirsToCheck = [
    {
      path: path.resolve(__dirname, "../data"),
      desc: "Directorio principal de datos",
    },
    {
      path: path.resolve(__dirname, "../data/thumbnails"),
      desc: "Directorio de miniaturas",
    },
    {
      path: path.resolve(__dirname, "../data/transcoded"),
      desc: "Directorio de archivos transcodificados",
    },
    { path: "/opt/pelis", desc: "Directorio de videos" },
  ];

  for (const dir of dirsToCheck) {
    console.log(
      `\n${colors.yellow}Verificando: ${dir.desc} (${dir.path})${colors.reset}`
    );

    try {
      // Verificar si existe
      if (!fs.existsSync(dir.path)) {
        console.log(`${colors.red}✗ El directorio no existe${colors.reset}`);

        // Intentar crear si es un directorio del sistema
        if (!dir.path.startsWith("/opt")) {
          try {
            fs.mkdirSync(dir.path, { recursive: true });
            console.log(
              `${colors.green}✓ Directorio creado correctamente${colors.reset}`
            );
          } catch (mkdirError) {
            console.log(
              `${colors.red}✗ Error al crear directorio: ${mkdirError.message}${colors.reset}`
            );
          }
        }
        continue;
      }

      // Verificar permisos
      const dirStats = await stat(dir.path);
      const perms = dirStats.mode.toString(8).slice(-3);
      console.log(
        `${colors.blue}ℹ Permisos: ${perms} (UID: ${dirStats.uid}, GID: ${dirStats.gid})${colors.reset}`
      );

      // Comprobar si los permisos son adecuados
      const firstDigit = parseInt(perms[0]);
      const canRead = (firstDigit & 4) === 4;
      const canWrite = (firstDigit & 2) === 2;
      const canExecute = (firstDigit & 1) === 1;

      if (!canRead || !canExecute) {
        console.log(
          `${colors.red}✗ El directorio no tiene permisos suficientes para el usuario${colors.reset}`
        );
        console.log(
          `${colors.magenta}  ► Solución: chmod 755 "${dir.path}"${colors.reset}`
        );
      } else if (!canWrite && !dir.path.startsWith("/opt")) {
        console.log(
          `${colors.yellow}⚠ El directorio no tiene permisos de escritura${colors.reset}`
        );
      } else {
        console.log(
          `${colors.green}✓ Los permisos son adecuados${colors.reset}`
        );
      }

      // Intentar listar el contenido
      try {
        const files = await readdir(dir.path);
        console.log(
          `${colors.green}✓ Se puede listar el contenido (${files.length} elementos)${colors.reset}`
        );
      } catch (readdirError) {
        console.log(
          `${colors.red}✗ No se puede listar el contenido: ${readdirError.message}${colors.reset}`
        );
      }

      // Para directorios de datos, verificar si se puede escribir
      if (!dir.path.startsWith("/opt")) {
        try {
          const testFile = path.join(dir.path, `.test-${Date.now()}`);
          fs.writeFileSync(testFile, "test");
          fs.unlinkSync(testFile);
          console.log(
            `${colors.green}✓ Se puede escribir en el directorio${colors.reset}`
          );
        } catch (writeError) {
          console.log(
            `${colors.red}✗ No se puede escribir en el directorio: ${writeError.message}${colors.reset}`
          );
        }
      }
    } catch (error) {
      console.log(
        `${colors.red}✗ Error al verificar directorio: ${error.message}${colors.reset}`
      );
    }
  }
}

// Ejecutar la función principal
main().catch((err) => {
  console.error(`${colors.red}Error fatal: ${err.message}${colors.reset}`);
  process.exit(1);
});
