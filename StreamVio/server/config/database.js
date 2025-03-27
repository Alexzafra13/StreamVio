// server/config/database.js (si no lo tienes ya)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Asegurar que el directorio data existe
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const dbPath = path.resolve(dataDir, 'streamvio.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    // Crear tabla de videos
    db.run(`CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      path TEXT NOT NULL,
      thumbnail TEXT,
      duration TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Verificar si ya hay datos de ejemplo
    db.get("SELECT COUNT(*) as count FROM videos", [], (err, row) => {
      if (err) {
        console.error(err);
        return;
      }
      
      // Si no hay videos, insertar algunos de ejemplo
      if (row.count === 0) {
        const sampleVideos = [
          {
            title: "Big Buck Bunny",
            description: "Video de prueba de formato abierto",
            thumbnail: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg",
            duration: "09:56",
            path: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4"
          },
          {
            title: "Elephant Dream",
            description: "Primer video abierto de Blender Foundation",
            thumbnail: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Elephants_Dream_s5_both.jpg",
            duration: "10:54",
            path: "https://test-videos.co.uk/vids/elephantsdream/mp4/h264/720/Elephants_Dream_720_10s_1MB.mp4"
          }
        ];
        
        const stmt = db.prepare("INSERT INTO videos (title, description, thumbnail, duration, path) VALUES (?, ?, ?, ?, ?)");
        sampleVideos.forEach(video => {
          stmt.run(video.title, video.description, video.thumbnail, video.duration, video.path);
        });
        stmt.finalize();
        console.log("Inserted sample videos into database");
      }
    });
  });
}

module.exports = db;