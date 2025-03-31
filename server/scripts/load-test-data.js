// server/scripts/load-test-data.js
const db = require("../config/database");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");

/**
 * Script para cargar datos de prueba para las pruebas
 */
async function loadTestData() {
  console.log("Cargando datos de prueba para tests...");

  try {
    // Crear directorios para archivos de prueba si no existen
    const testDataDir = path.join(__dirname, "../data/test");
    const testThumbsDir = path.join(__dirname, "../data/thumbnails/test");
    const testTranscodedDir = path.join(__dirname, "../data/transcoded/test");

    [testDataDir, testThumbsDir, testTranscodedDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Crear usuario de prueba si no existe
    const existingUser = await db.asyncGet(
      "SELECT id FROM users WHERE email = ?",
      ["test@example.com"]
    );

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash("testpassword", 10);
      await db.asyncRun(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        ["testuser", "test@example.com", hashedPassword]
      );
      console.log("Usuario de prueba creado");
    }

    // Crear bibliotecas de prueba
    const libraries = [
      {
        name: "Test Movies",
        path: path.join(testDataDir, "movies"),
        type: "movies",
      },
      {
        name: "Test Series",
        path: path.join(testDataDir, "series"),
        type: "series",
      },
      {
        name: "Test Music",
        path: path.join(testDataDir, "music"),
        type: "music",
      },
    ];

    for (const lib of libraries) {
      // Crear directorio si no existe
      if (!fs.existsSync(lib.path)) {
        fs.mkdirSync(lib.path, { recursive: true });
      }

      // Verificar si la biblioteca ya existe
      const existingLibrary = await db.asyncGet(
        "SELECT id FROM libraries WHERE name = ? AND path = ?",
        [lib.name, lib.path]
      );

      if (!existingLibrary) {
        // Crear la biblioteca
        const result = await db.asyncRun(
          "INSERT INTO libraries (name, path, type, scan_automatically) VALUES (?, ?, ?, ?)",
          [lib.name, lib.path, lib.type, 1]
        );

        console.log(
          `Biblioteca de prueba "${lib.name}" creada con ID ${result.lastID}`
        );

        // Crear algunos archivos de prueba según el tipo
        if (lib.type === "movies") {
          await createSampleMovies(lib.path, result.lastID);
        } else if (lib.type === "series") {
          await createSampleSeries(lib.path, result.lastID);
        } else if (lib.type === "music") {
          await createSampleMusic(lib.path, result.lastID);
        }
      }
    }

    console.log("Datos de prueba cargados exitosamente");
  } catch (error) {
    console.error("Error al cargar datos de prueba:", error);
    process.exit(1);
  }
}

/**
 * Crea películas de prueba
 */
async function createSampleMovies(dirPath, libraryId) {
  // Crear archivos de vídeo simulados (0-byte)
  const movies = [
    {
      title: "Test Movie 1",
      filename: "test_movie_1.mp4",
      duration: 5400,
      size: 1024000,
    },
    {
      title: "Test Movie 2",
      filename: "test_movie_2.mp4",
      duration: 7200,
      size: 2048000,
    },
  ];

  for (const movie of movies) {
    const filePath = path.join(dirPath, movie.filename);
    // Crear archivo vacío
    fs.writeFileSync(filePath, "");

    // Crear entrada en la base de datos
    await db.asyncRun(
      `INSERT INTO media_items 
       (library_id, title, type, file_path, duration, size) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [libraryId, movie.title, "movie", filePath, movie.duration, movie.size]
    );

    console.log(`  Película de prueba "${movie.title}" creada`);
  }
}

/**
 * Crea series de prueba
 */
async function createSampleSeries(dirPath, libraryId) {
  // Crear una serie con episodios
  const seriesTitle = "Test Series 1";
  const seriesPath = path.join(dirPath, "test_series_1");

  if (!fs.existsSync(seriesPath)) {
    fs.mkdirSync(seriesPath, { recursive: true });
  }

  // Crear la serie
  const seriesResult = await db.asyncRun(
    `INSERT INTO media_items 
     (library_id, title, type, year) 
     VALUES (?, ?, ?, ?)`,
    [libraryId, seriesTitle, "series", 2023]
  );

  const seriesId = seriesResult.lastID;
  console.log(`  Serie de prueba "${seriesTitle}" creada con ID ${seriesId}`);

  // Crear episodios
  const episodes = [
    {
      title: "Episode 1",
      filename: "episode_1.mp4",
      season: 1,
      episode: 1,
      duration: 1800,
    },
    {
      title: "Episode 2",
      filename: "episode_2.mp4",
      season: 1,
      episode: 2,
      duration: 1800,
    },
  ];

  for (const ep of episodes) {
    const filePath = path.join(seriesPath, ep.filename);
    // Crear archivo vacío
    fs.writeFileSync(filePath, "");

    // Crear entrada en la base de datos
    await db.asyncRun(
      `INSERT INTO media_items 
       (library_id, parent_id, title, type, file_path, duration, season_number, episode_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        libraryId,
        seriesId,
        `${seriesTitle} - ${ep.title}`,
        "episode",
        filePath,
        ep.duration,
        ep.season,
        ep.episode,
      ]
    );

    console.log(`    Episodio "${ep.title}" creado`);
  }
}

/**
 * Crea música de prueba
 */
async function createSampleMusic(dirPath, libraryId) {
  // Crear archivos de audio simulados (0-byte)
  const songs = [
    {
      title: "Test Song 1",
      filename: "test_song_1.mp3",
      duration: 180,
      size: 5000,
    },
    {
      title: "Test Song 2",
      filename: "test_song_2.mp3",
      duration: 210,
      size: 6000,
    },
  ];

  for (const song of songs) {
    const filePath = path.join(dirPath, song.filename);
    // Crear archivo vacío
    fs.writeFileSync(filePath, "");

    // Crear entrada en la base de datos
    await db.asyncRun(
      `INSERT INTO media_items 
       (library_id, title, type, file_path, duration, size) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [libraryId, song.title, "music", filePath, song.duration, song.size]
    );

    console.log(`  Canción de prueba "${song.title}" creada`);
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  loadTestData()
    .then(() => {
      console.log("Script completado exitosamente");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error en el script:", error);
      process.exit(1);
    });
}

module.exports = loadTestData;
