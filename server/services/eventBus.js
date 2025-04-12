// server/services/eventBus.js
const EventEmitter = require("events");

/**
 * Bus de eventos centralizado para el sistema
 * Permite desacoplar componentes y servicios mediante mensajes
 */
class EventBus extends EventEmitter {
  constructor() {
    super();

    // Aumentar el límite de listeners para evitar advertencias
    this.setMaxListeners(50);

    // Registro de eventos para debugging
    this.debugEnabled = process.env.NODE_ENV === "development";

    // Capturar y registrar todos los eventos si está en modo debug
    if (this.debugEnabled) {
      const originalEmit = this.emit;
      this.emit = function (type, ...args) {
        console.log(`[EVENT] ${type}`, args.length > 0 ? args[0] : "");
        return originalEmit.apply(this, [type, ...args]);
      };
    }
  }

  /**
   * Emitir un evento con estructura estandarizada
   * @param {string} eventName - Nombre del evento
   * @param {any} payload - Datos asociados al evento
   * @param {Object} options - Opciones adicionales
   */
  emitEvent(eventName, payload = {}, options = {}) {
    const event = {
      name: eventName,
      timestamp: new Date().toISOString(),
      payload,
      ...options,
    };

    this.emit(eventName, event);

    // Además, emitir un evento genérico 'event' para suscriptores globales
    this.emit("event", event);

    return event;
  }
}

// Exportar una única instancia del bus de eventos
const eventBus = new EventBus();

module.exports = eventBus;
