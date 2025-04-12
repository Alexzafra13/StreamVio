// server/data/db.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");

// Cargar configuración del entorno
const environment = require("../config/environment");
const { DATA_DIR } = require("../config/paths");

// Definir la ruta de la base de datos
const dbPath = environment.isDevelopment
  ? path.resolve(DATA_DIR, "streamvio-dev.db")
  : environment.isTest
  ? ":memory:"
  : path.resolve(DATA_DIR, "streamvio.db");

// Asegurar que el directorio existe
if (dbPath !== ":memory:") {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

// Crear conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al conectar a la base de datos SQLite:", err.message);
    process.exit(1);
  } else {
    console.log(`Conexión exitosa a la base de datos SQLite: ${dbPath}`);

    // Habilitar foreign keys
    db.run("PRAGMA foreign_keys = ON;");
  }
});

// Añadir soporte para promesas
db.asyncAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

db.asyncGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

db.asyncRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
};

// Cerrar la conexión cuando la aplicación se cierre
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error(
        "Error al cerrar la conexión de la base de datos:",
        err.message
      );
    } else {
      console.log("Conexión a la base de datos cerrada.");
    }
    process.exit(0);
  });
});

module.exports = db;
