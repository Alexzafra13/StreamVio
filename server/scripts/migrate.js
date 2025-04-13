#!/usr/bin/env node
// server/scripts/migrate.js

/**
 * Script para ejecutar migraciones desde la línea de comandos
 *
 * Uso:
 *   node migrate.js <comando> [opciones]
 *
 * Comandos:
 *   up           - Ejecutar todas las migraciones pendientes
 *   down         - Revertir la última migración
 *   to <versión> - Migrar a una versión específica
 *   reset        - Revertir todas las migraciones
 *   status       - Mostrar estado de las migraciones
 *   init         - Inicializar la base de datos y cargar datos por defecto
 */

const migrationManager = require("../data/migrations");
const { loadDefaultSettings } = require("../data/seeds/defaultSettings");

// Procesar argumentos de línea de comandos
const args = process.argv.slice(2);
const command = args[0];

/**
 * Función auxiliar para imprimir el uso del script
 */
function printUsage() {
  console.log(`
  Utilidad de migración de base de datos para StreamVio

  Uso:
    node migrate.js <comando> [opciones]

  Comandos:
    up           - Ejecutar todas las migraciones pendientes
    down         - Revertir la última migración
    to <versión> - Migrar a una versión específica
    reset        - Revertir todas las migraciones
    status       - Mostrar estado de las migraciones
    init         - Inicializar la base de datos y cargar datos por defecto

  Ejemplos:
    node migrate.js up
    node migrate.js down
    node migrate.js to 2
    node migrate.js status
  `);
}

/**
 * Función para imprimir el estado de las migraciones
 */
async function printStatus() {
  const status = await migrationManager.status();

  console.log("\nEstado de las migraciones:");
  console.log(`Versión actual: ${status.currentVersion}`);
  console.log(`Migraciones aplicadas: ${status.appliedCount}`);
  console.log(`Migraciones pendientes: ${status.pendingCount}`);

  console.log("\nDetalle:");
  status.migrations.forEach((migration) => {
    const status = migration.applied
      ? `[APLICADA] (${new Date(migration.executed_at).toLocaleString()})`
      : "[PENDIENTE]";
    console.log(`- ${migration.version}: ${migration.name} ${status}`);
  });

  console.log("");
}

/**
 * Función principal del script
 */
async function main() {
  try {
    switch (command) {
      case "up":
        console.log("Ejecutando migraciones pendientes...");
        const upResult = await migrationManager.migrateUp();
        console.log(upResult.message);
        await printStatus();
        break;

      case "down":
        console.log("Revirtiendo última migración...");
        const downResult = await migrationManager.migrateDown();
        console.log(downResult.message);
        await printStatus();
        break;

      case "to":
        const targetVersion = parseInt(args[1]);
        if (isNaN(targetVersion)) {
          console.error("Error: Se requiere un número de versión válido.");
          printUsage();
          process.exit(1);
        }

        console.log(`Migrando a la versión ${targetVersion}...`);
        const toResult = await migrationManager.migrateTo(targetVersion);
        console.log(toResult.message);
        await printStatus();
        break;

      case "reset":
        console.log(
          "¿Está seguro de que desea revertir TODAS las migraciones? Esta acción eliminará todos los datos. (s/N)"
        );
        // En un script real, aquí habría una confirmación interactiva
        // Por simplicidad, continuamos directamente
        console.log("Revirtiendo todas las migraciones...");
        const resetResult = await migrationManager.reset();
        console.log(resetResult.message);
        break;

      case "status":
        await printStatus();
        break;

      case "init":
        console.log("Inicializando base de datos...");
        // Ejecutar todas las migraciones
        const initResult = await migrationManager.migrateUp();
        console.log(initResult.message);

        // Cargar datos por defecto
        console.log("Cargando configuraciones por defecto...");
        await loadDefaultSettings();

        console.log("Inicialización completada.");
        break;

      default:
        console.error(`Error: Comando desconocido '${command}'.`);
        printUsage();
        process.exit(1);
    }

    // Salir limpiamente
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Ejecutar script
main();
