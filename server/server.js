// server/server.js
const app = require("./app");
const os = require("os");
const environment = require("./config/environment");
const { setupDirectories } = require("./init");

// Obtener IP local para información
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "0.0.0.0";
};

// Función para iniciar el servidor
async function startServer() {
  try {
    // Configurar directorios necesarios
    await setupDirectories();

    // Iniciar el servidor
    const PORT = environment.PORT;
    const HOST = environment.HOST;

    app.listen(PORT, HOST, () => {
      const LOCAL_IP = getLocalIP();

      console.log(`\n==============================================`);
      console.log(`StreamVio Server (${environment.NODE_ENV})`);
      console.log(`==============================================`);
      console.log(`Local URL:     http://localhost:${PORT}`);
      console.log(`Network URL:   http://${LOCAL_IP}:${PORT}`);
      console.log(`API URL:       http://${LOCAL_IP}:${PORT}/api`);
      console.log(`==============================================\n`);
    });
  } catch (error) {
    console.error("Error al iniciar el servidor:", error);
    process.exit(1);
  }
}

// Iniciar el servidor si este archivo es el punto de entrada
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
