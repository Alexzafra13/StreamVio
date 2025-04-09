// server/scripts/test-access.js
// Script para verificar acceso a archivos multimedia
const fs = require("fs");
const path = require("path");

// Función para probar acceso a un archivo
const testAccess = (filePath) => {
  console.log(`\n========== Probando acceso a: ${filePath} ==========`);

  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      console.error(`❌ ERROR: El archivo ${filePath} no existe`);
      return false;
    }

    console.log(`✅ El archivo existe`);

    // Verificar permisos de lectura
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      console.log(`✅ El archivo tiene permisos de lectura`);
    } catch (err) {
      console.error(`❌ ERROR: No tienes permisos de lectura para el archivo`);
      console.error(`   ${err.message}`);
      return false;
    }

    // Obtener información del archivo
    try {
      const stats = fs.statSync(filePath);
      console.log(`📊 Información del archivo:`);
      console.log(
        `   - Tamaño: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(
          2
        )} MB)`
      );
      console.log(`   - Propietario: UID ${stats.uid}`);
      console.log(`   - Grupo: GID ${stats.gid}`);
      console.log(`   - Permisos: ${stats.mode.toString(8)}`);
      console.log(`   - Es archivo: ${stats.isFile()}`);
      console.log(`   - Es directorio: ${stats.isDirectory()}`);
      console.log(`   - Última modificación: ${stats.mtime}`);

      // Intentar leer los primeros bytes del archivo
      const buffer = Buffer.alloc(1024);
      const fd = fs.openSync(filePath, "r");
      const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);

      console.log(`✅ Se pudieron leer ${bytesRead} bytes del archivo`);

      // Determinar el tipo de archivo basado en los primeros bytes
      let fileType = "Desconocido";
      const magicNumbers = buffer.slice(0, 16);

      if (magicNumbers[0] === 0xff && magicNumbers[1] === 0xd8) {
        fileType = "JPEG image";
      } else if (
        magicNumbers[0] === 0x89 &&
        magicNumbers[1] === 0x50 &&
        magicNumbers[2] === 0x4e &&
        magicNumbers[3] === 0x47
      ) {
        fileType = "PNG image";
      } else if (
        magicNumbers[0] === 0x1a &&
        magicNumbers[1] === 0x45 &&
        magicNumbers[2] === 0xdf &&
        magicNumbers[3] === 0xa3
      ) {
        fileType = "WEBM/MKV video";
      } else if (
        magicNumbers[0] === 0x00 &&
        magicNumbers[1] === 0x00 &&
        magicNumbers[2] === 0x00 &&
        magicNumbers[3] === 0x20
      ) {
        fileType = "MP4/MOV video";
      } else if (
        magicNumbers[0] === 0x52 &&
        magicNumbers[1] === 0x49 &&
        magicNumbers[2] === 0x46 &&
        magicNumbers[3] === 0x46
      ) {
        fileType = "AVI/WAV";
      } else if (
        magicNumbers[0] === 0x49 &&
        magicNumbers[1] === 0x44 &&
        magicNumbers[2] === 0x33
      ) {
        fileType = "MP3 audio";
      }

      console.log(`📋 Tipo de archivo detectado: ${fileType}`);

      return true;
    } catch (err) {
      console.error(`❌ ERROR al leer información del archivo:`);
      console.error(`   ${err.message}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ ERROR inesperado:`);
    console.error(`   ${err.message}`);
    return false;
  }
};

// Información del servidor
console.log(`\n========== Información del servidor ==========`);
console.log(`- Directorio actual: ${process.cwd()}`);
console.log(`- Usuario: ${process.getuid ? process.getuid() : "N/A"}`);
console.log(`- Grupo: ${process.getgid ? process.getgid() : "N/A"}`);
console.log(`- Plataforma: ${process.platform}`);
console.log(`- Node.js: ${process.version}`);

// Verificar el directorio de videos
const videosDir = "/opt/pelis";

try {
  if (!fs.existsSync(videosDir)) {
    console.error(`❌ ERROR: El directorio ${videosDir} no existe`);
  } else {
    console.log(`\n========== Contenido del directorio ==========`);
    const files = fs.readdirSync(videosDir);

    console.log(`Encontrados ${files.length} archivos en ${videosDir}:`);

    files.forEach((file, index) => {
      const filePath = path.join(videosDir, file);
      const stats = fs.statSync(filePath);
      console.log(
        `${index + 1}. ${file} - ${
          stats.isDirectory()
            ? "Directorio"
            : `Archivo (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
        }`
      );
    });

    // Probar acceso a algunos archivos
    if (files.length > 0) {
      // Probar primeros 3 archivos o menos si no hay suficientes
      const testCount = Math.min(3, files.length);
      console.log(`\nProbando acceso a ${testCount} archivos...`);

      for (let i = 0; i < testCount; i++) {
        const filePath = path.join(videosDir, files[i]);
        const stats = fs.statSync(filePath);

        // Solo probar archivos, no directorios
        if (stats.isFile()) {
          testAccess(filePath);
        }
      }
    }
  }
} catch (err) {
  console.error(`❌ ERROR al acceder al directorio de videos:`);
  console.error(`   ${err.message}`);
}

// Verificar rutas específicas de la base de datos
// Si se pasan argumentos, verificarlos como rutas
if (process.argv.length > 2) {
  for (let i = 2; i < process.argv.length; i++) {
    const filePath = process.argv[i];
    testAccess(filePath);
  }
} else {
  console.log(`\nPuedes probar una ruta específica ejecutando:`);
  console.log(`node test-access.js /ruta/del/archivo.mp4`);
}

console.log("\n========== Prueba completada ==========");
