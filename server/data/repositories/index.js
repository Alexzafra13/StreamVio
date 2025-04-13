// server/data/repositories/index.js
const userRepository = require("./userRepository");
const libraryRepository = require("./libraryRepository");
const mediaRepository = require("./mediaRepository");
const watchHistoryRepository = require("./watchHistoryRepository");
const settingRepository = require("./settingRepository");

// Exportar todos los repositorios
module.exports = {
  userRepository,
  libraryRepository,
  mediaRepository,
  watchHistoryRepository,
  settingRepository,
};
