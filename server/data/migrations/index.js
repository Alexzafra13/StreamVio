// server/data/migrations/index.js
const fs = require("fs");
const path = require("path");
const db = require("../db");

/**
 * Gestor de migraciones para la base de datos
 */
class MigrationManager {
  constructor() {
    this.migrationsDir = __dirname;
    this.migrations = [];

    // Cargar todas las migraciones disponibles
    this._loadMigrations();
  }

  /**
   * Cargar todas las migraciones disponibles
   * @private
   */
  _loadMigrations() {
    // Buscar archivos de migración con formato NNN_nombre.js
    const migrationFiles = fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.match(/^\d{3}_.*\.js$/) && file !== "index.js")
      .sort(); // Ordenar por nombre (que incluye el número de secuencia)

    // Cargar cada migración
    this.migrations = migrationFiles.map((file) => {
      const name = path.basename(file, ".js");
      const version = parseInt(name.split("_")[0]);
      const migration = require(path.join(this.migrationsDir, file));

      return {
        version,
        name,
        file,
        up: migration.up,
        down: migration.down,
      };
    });

    // Ordenar migraciones por versión
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Crear la tabla de migraciones si no existe
   * @private
   * @returns {Promise<void>}
   */
  async _ensureMigrationTable() {
    await db.asyncRun(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        name TEXT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Obtener la versión actual de la base de datos
   * @private
   * @returns {Promise<number>} Versión actual (0 si no hay migraciones aplicadas)
   */
  async _getCurrentVersion() {
    await this._ensureMigrationTable();

    const result = await db.asyncGet(
      "SELECT version FROM migrations ORDER BY version DESC LIMIT 1"
    );

    return result ? result.version : 0;
  }

  /**
   * Registrar una migración como aplicada
   * @private
   * @param {Object} migration Información de la migración
   * @returns {Promise<void>}
   */
  async _recordMigration(migration) {
    await db.asyncRun("INSERT INTO migrations (version, name) VALUES (?, ?)", [
      migration.version,
      migration.name,
    ]);
  }

  /**
   * Eliminar registro de una migración
   * @private
   * @param {Object} migration Información de la migración
   * @returns {Promise<void>}
   */
  async _removeMigrationRecord(migration) {
    await db.asyncRun("DELETE FROM migrations WHERE version = ?", [
      migration.version,
    ]);
  }

  /**
   * Ejecutar todas las migraciones pendientes
   * @returns {Promise<Object>} Resultado de la operación
   */
  async migrateUp() {
    await this._ensureMigrationTable();
    const currentVersion = await this._getCurrentVersion();

    const pendingMigrations = this.migrations.filter(
      (m) => m.version > currentVersion
    );

    if (pendingMigrations.length === 0) {
      return {
        success: true,
        message: "No hay migraciones pendientes.",
        migrationsRun: 0,
      };
    }

    let migrationsRun = 0;
    let latestVersion = currentVersion;

    // Ejecutar migraciones pendientes en orden
    for (const migration of pendingMigrations) {
      try {
        console.log(`Ejecutando migración ${migration.name}...`);

        // Ejecutar migración
        await migration.up();

        // Registrar migración
        await this._recordMigration(migration);

        migrationsRun++;
        latestVersion = migration.version;

        console.log(`Migración ${migration.name} completada correctamente.`);
      } catch (error) {
        console.error(`Error al ejecutar migración ${migration.name}:`, error);

        return {
          success: false,
          message: `Error al ejecutar migración ${migration.name}: ${error.message}`,
          migrationsRun,
          latestVersion,
          error,
        };
      }
    }

    return {
      success: true,
      message: `${migrationsRun} migraciones aplicadas correctamente.`,
      migrationsRun,
      latestVersion,
    };
  }

  /**
   * Ejecutar migraciones hasta una versión específica
   * @param {number} targetVersion Versión objetivo
   * @returns {Promise<Object>} Resultado de la operación
   */
  async migrateTo(targetVersion) {
    await this._ensureMigrationTable();
    const currentVersion = await this._getCurrentVersion();

    if (currentVersion === targetVersion) {
      return {
        success: true,
        message: `Ya se encuentra en la versión ${targetVersion}.`,
        migrationsRun: 0,
      };
    }

    // Determinar si debemos subir o bajar versiones
    if (currentVersion < targetVersion) {
      // Migrar hacia arriba hasta la versión objetivo
      const pendingMigrations = this.migrations
        .filter((m) => m.version > currentVersion && m.version <= targetVersion)
        .sort((a, b) => a.version - b.version);

      let migrationsRun = 0;
      let latestVersion = currentVersion;

      for (const migration of pendingMigrations) {
        try {
          console.log(`Ejecutando migración ${migration.name}...`);

          await migration.up();
          await this._recordMigration(migration);

          migrationsRun++;
          latestVersion = migration.version;

          console.log(`Migración ${migration.name} completada correctamente.`);
        } catch (error) {
          console.error(
            `Error al ejecutar migración ${migration.name}:`,
            error
          );

          return {
            success: false,
            message: `Error al ejecutar migración ${migration.name}: ${error.message}`,
            migrationsRun,
            latestVersion,
            error,
          };
        }
      }

      return {
        success: true,
        message: `${migrationsRun} migraciones aplicadas correctamente.`,
        migrationsRun,
        latestVersion,
      };
    } else {
      // Migrar hacia abajo hasta la versión objetivo
      const migrationsToRevert = this.migrations
        .filter((m) => m.version <= currentVersion && m.version > targetVersion)
        .sort((a, b) => b.version - a.version); // Orden inverso para bajar versiones

      let migrationsRun = 0;
      let latestVersion = currentVersion;

      for (const migration of migrationsToRevert) {
        try {
          console.log(`Revirtiendo migración ${migration.name}...`);

          await migration.down();
          await this._removeMigrationRecord(migration);

          migrationsRun++;
          latestVersion = migration.version - 1; // Ajustar versión al revertir

          console.log(`Migración ${migration.name} revertida correctamente.`);
        } catch (error) {
          console.error(
            `Error al revertir migración ${migration.name}:`,
            error
          );

          return {
            success: false,
            message: `Error al revertir migración ${migration.name}: ${error.message}`,
            migrationsRun,
            latestVersion,
            error,
          };
        }
      }

      return {
        success: true,
        message: `${migrationsRun} migraciones revertidas correctamente.`,
        migrationsRun,
        latestVersion,
      };
    }
  }

  /**
   * Revertir la última migración aplicada
   * @returns {Promise<Object>} Resultado de la operación
   */
  async migrateDown() {
    await this._ensureMigrationTable();
    const currentVersion = await this._getCurrentVersion();

    if (currentVersion === 0) {
      return {
        success: true,
        message: "No hay migraciones para revertir.",
        migrationsRun: 0,
      };
    }

    // Buscar la última migración aplicada
    const migrationToRevert = this.migrations.find(
      (m) => m.version === currentVersion
    );

    if (!migrationToRevert) {
      return {
        success: false,
        message: `No se encontró la migración para la versión ${currentVersion}.`,
        migrationsRun: 0,
      };
    }

    try {
      console.log(`Revirtiendo migración ${migrationToRevert.name}...`);

      await migrationToRevert.down();
      await this._removeMigrationRecord(migrationToRevert);

      console.log(
        `Migración ${migrationToRevert.name} revertida correctamente.`
      );

      return {
        success: true,
        message: `Migración ${migrationToRevert.name} revertida correctamente.`,
        migrationsRun: 1,
        latestVersion: currentVersion - 1,
      };
    } catch (error) {
      console.error(
        `Error al revertir migración ${migrationToRevert.name}:`,
        error
      );

      return {
        success: false,
        message: `Error al revertir migración ${migrationToRevert.name}: ${error.message}`,
        migrationsRun: 0,
        latestVersion: currentVersion,
        error,
      };
    }
  }

  /**
   * Reiniciar la base de datos eliminando todas las migraciones
   * @returns {Promise<Object>} Resultado de la operación
   */
  async reset() {
    await this._ensureMigrationTable();
    const currentVersion = await this._getCurrentVersion();

    if (currentVersion === 0) {
      return {
        success: true,
        message: "La base de datos ya está en su estado inicial.",
        migrationsRun: 0,
      };
    }

    // Obtener migraciones aplicadas en orden inverso
    const appliedMigrations = this.migrations
      .filter((m) => m.version <= currentVersion)
      .sort((a, b) => b.version - a.version); // Orden inverso

    let migrationsRun = 0;

    for (const migration of appliedMigrations) {
      try {
        console.log(`Revirtiendo migración ${migration.name}...`);

        await migration.down();
        await this._removeMigrationRecord(migration);

        migrationsRun++;

        console.log(`Migración ${migration.name} revertida correctamente.`);
      } catch (error) {
        console.error(`Error al revertir migración ${migration.name}:`, error);

        return {
          success: false,
          message: `Error al revertir migración ${migration.name}: ${error.message}`,
          migrationsRun,
          latestVersion: appliedMigrations[migrationsRun]
            ? appliedMigrations[migrationsRun].version
            : 0,
          error,
        };
      }
    }

    return {
      success: true,
      message: `${migrationsRun} migraciones revertidas correctamente. Base de datos reiniciada.`,
      migrationsRun,
      latestVersion: 0,
    };
  }

  /**
   * Obtener el estado actual de las migraciones
   * @returns {Promise<Object>} Estado de las migraciones
   */
  async status() {
    await this._ensureMigrationTable();
    const currentVersion = await this._getCurrentVersion();

    // Obtener todas las migraciones aplicadas
    const appliedMigrations = await db.asyncAll(
      "SELECT version, name, executed_at FROM migrations ORDER BY version ASC"
    );

    // Mapear migraciones para mostrar estado
    const migrations = this.migrations.map((migration) => {
      const applied = appliedMigrations.find(
        (m) => m.version === migration.version
      );

      return {
        version: migration.version,
        name: migration.name,
        applied: !!applied,
        executed_at: applied ? applied.executed_at : null,
      };
    });

    const pendingCount = migrations.filter((m) => !m.applied).length;

    return {
      currentVersion,
      migrations,
      pendingCount,
      appliedCount: migrations.length - pendingCount,
    };
  }

  /**
   * Verificar si la base de datos está actualizada
   * @returns {Promise<boolean>} true si todas las migraciones están aplicadas
   */
  async isUpToDate() {
    const status = await this.status();
    return status.pendingCount === 0;
  }
}

// Exportar una instancia única del gestor de migraciones
module.exports = new MigrationManager();
