/**
 * Script para inicializar la base de datos de StreamVio
 * Este script crea todas las tablas necesarias si no existen
 * y también inserta configuraciones por defecto si la base de datos es nueva.
 */
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Definir la ruta de la base de datos
const dbDir = path.resolve(__dirname, "../data");
const dbPath = path.resolve(dbDir, "streamvio.db");

// Asegurarse de que el directorio data existe
if (!fs.existsSync(dbDir)) {
  console.log("Creando directorio de datos...");
  fs.mkdirSync(dbDir, { recursive: true });
}

// Verificar si la base de datos ya existe
const dbExists = fs.existsSync(dbPath);

// Conectar a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al conectar a la base de datos:", err.message);
    process.exit(1);
  }
  console.log("Conectado a la base de datos SQLite.");

  // Ejecutar transacción
  db.serialize(() => {
    // Activar foreign keys
    db.run("PRAGMA foreign_keys = ON");

    // Habilitar modo de transacción
    db.run("BEGIN TRANSACTION");

    try {
      // Tabla de usuarios
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        force_password_change BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Añadir la columna force_password_change si no existe
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
          console.error("Error al verificar la estructura de la tabla users:", err);
          return;
        }
        
        // Comprobar si la columna force_password_change existe
        const hasColumn = rows.some(row => row.name === "force_password_change");
        
        if (!hasColumn) {
          console.log("Añadiendo columna force_password_change a la tabla users...");
          db.run("ALTER TABLE users ADD COLUMN force_password_change BOOLEAN DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error("Error al añadir la columna force_password_change:", alterErr);
            } else {
              console.log("Columna force_password_change añadida con éxito.");
            }
          });
        }
      });

      // Tabla de configuraciones globales
      db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabla de configuraciones por usuario
      db.run(`CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, key)
      )`);

      // Tabla de bibliotecas multimedia
      db.run(`CREATE TABLE IF NOT EXISTS libraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('movies', 'series', 'music', 'photos')),
        scan_automatically BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabla de elementos multimedia
      db.run(`CREATE TABLE IF NOT EXISTS media_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id INTEGER,
        title TEXT NOT NULL,
        original_title TEXT,
        description TEXT,
        type TEXT NOT NULL CHECK(type IN ('movie', 'series', 'episode', 'music', 'photo')),
        file_path TEXT,
        duration INTEGER,
        size INTEGER,
        thumbnail_path TEXT,
        year INTEGER,
        genre TEXT,
        director TEXT,
        actors TEXT,
        rating REAL,
        parent_id INTEGER, -- Para episodios que pertenecen a series
        season_number INTEGER, -- Para episodios
        episode_number INTEGER, -- Para episodios
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (library_id) REFERENCES libraries (id) ON DELETE SET NULL,
        FOREIGN KEY (parent_id) REFERENCES media_items (id) ON DELETE CASCADE
      )`);

      // Tabla de historial de visualización
      db.run(`CREATE TABLE IF NOT EXISTS watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        media_id INTEGER NOT NULL,
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        position INTEGER DEFAULT 0, -- Posición en segundos
        completed BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
      )`);

      // Tabla de favoritos
      db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        media_id INTEGER NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE,
        UNIQUE(user_id, media_id)
      )`);

      // Tabla de tareas de transcoding
      db.run(`CREATE TABLE IF NOT EXISTS transcoding_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        target_format TEXT NOT NULL,
        target_resolution TEXT,
        output_path TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (media_id) REFERENCES media_items (id) ON DELETE CASCADE
      )`);

      // Tabla para sesiones/tokens
      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        device_info TEXT,
        ip_address TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`);

      // Insertar configuraciones por defecto si la base de datos es nueva
      if (!dbExists) {
        console.log(
          "Base de datos nueva detectada. Insertando configuraciones por defecto..."
        );

        db.run(`INSERT INTO settings (key, value, description) VALUES 
          ('transcoding_enabled', '1', 'Habilitar o deshabilitar el transcodificado automático'),
          ('default_transcoding_format', 'mp4', 'Formato por defecto para transcodificación'),
          ('max_bitrate', '8000', 'Bitrate máximo para streaming en kbps'),
          ('scan_interval', '3600', 'Intervalo entre escaneos automáticos en segundos'),
          ('thumbnail_generation', '1', 'Generar miniaturas automáticamente'),
          ('metadata_language', 'es', 'Idioma preferido para metadatos')
        `);

        // Crear usuario admin por defecto
        const createAdminUser = async () => {
          try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash("admin", salt);
            
            db.run(`INSERT INTO users (username, email, password, is_admin, force_password_change) 
                   VALUES (?, ?, ?, ?, ?)`,
                   ["admin", "admin@streamvio.local", hashedPassword, 1, 1],
                   (err) => {
                     if (err) {
                       console.error("Error al crear usuario admin:", err.message);
                     } else {
                       console.log("Usuario admin creado con éxito");
                     }
                   });
          } catch (error) {
            console.error("Error al generar hash de contraseña:", error);
          }
        };
        
        createAdminUser();
      }

      // Confirmar transacción
      db.run("COMMIT", (err) => {
        if (err) {
          console.error("Error al confirmar transacción:", err.message);
          db.run("ROLLBACK");
          finalizeDB(db, 1);
        } else {
          console.log("Base de datos inicializada correctamente.");
          finalizeDB(db, 0);
        }
      });
    } catch (error) {
      console.error("Error al configurar la base de datos:", error);
      db.run("ROLLBACK");
      finalizeDB(db, 1);
    }
  });
});

// Función para cerrar la conexión de manera segura y finalizar el proceso
function finalizeDB(db, exitCode = 0) {
  // Cerrar la conexión
  db.close((err) => {
    if (err) {
      console.error("Error al cerrar la base de datos:", err.message);
      process.exit(1);
    }
    console.log("Conexión a la base de datos cerrada.");
    process.exit(exitCode);
  });
}

// Manejar señales de interrupción de manera adecuada
process.on("SIGINT", () => {
  console.log("Recibida señal de interrupción. Cerrando la base de datos...");
  finalizeDB(db);
});

process.on("exit", (code) => {
  console.log(`Saliendo con código: ${code}`);
});