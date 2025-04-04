// server/config/settings.js
module.exports = {
  port: process.env.PORT || 45000,
  jwtSecret: process.env.JWT_SECRET || "streamvio_secret_key",
  dbPath: process.env.DB_PATH || "./data/streamvio.db",
  serviceUser: process.env.SERVICE_USER || "streamvio",
  serviceGroup: process.env.SERVICE_GROUP || "streamvio",
  apiUrl: process.env.API_URL || "http://localhost:45000",
  // ... otros ajustes
};
