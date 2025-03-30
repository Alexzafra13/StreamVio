// server/config/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Definir la ruta de la base de datos desde variables de entorno o usar ruta por defecto
const dbPath = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH) 
  : path.resolve(__dirname, '../data/streamvio.db');

// Asegurarse de que el directorio existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Función para habilitar soporte de fechas en SQLite
const enableDatetimeFunctions = (db) => {
  // Este helper permite manipular fechas con SQLite
  db.run(`
    CREATE TEMP TABLE IF NOT EXISTS datetime_helpers (
      name TEXT PRIMARY KEY,
      sql TEXT
    );
  `);

  db.run(`
    INSERT OR IGNORE INTO datetime_helpers VALUES
      ('now', 'datetime(''now'')'),
      ('timestamp', 'strftime(''%s'', ''now'')');
  `);
};

// Establecer la conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar a la base de datos SQLite:', err.message);
    process.exit(1); // Terminar la aplicación si no se puede conectar a la BD
  } else {
    console.log('Conexión exitosa a la base de datos SQLite');
    
    // Habilitar foreign keys y funciones de fecha
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON;');
      enableDatetimeFunctions(db);
    });
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
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
};

// Cerrar la conexión cuando la aplicación se cierre
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error al cerrar la conexión de la base de datos:', err.message);
    } else {
      console.log('Conexión a la base de datos cerrada.');
    }
    process.exit(0);
  });
});

module.exports = db;