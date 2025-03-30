// test-transcoder.js
const transcoder = require("./build/Release/transcoder");

// Probar inicialización
console.log("Inicializando transcodificador...");
const initialized = transcoder.initialize();
console.log("Inicializado:", initialized);

// Probar obtención de información de archivo
console.log("\nObteniendo información de archivo...");
try {
  const info = transcoder.getMediaInfo("test.mp4");
  console.log("Información del archivo:", info);
} catch (error) {
  console.error("Error:", error.message);
}

console.log("\nTranscodificador listo para usar!");
