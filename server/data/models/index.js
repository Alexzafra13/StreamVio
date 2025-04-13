// server/data/models/index.js
const User = require("./User");
const Library = require("./Library");
const MediaItem = require("./MediaItem");
const WatchHistory = require("./WatchHistory");
const Session = require("./Session");
const Setting = require("./Setting");

// Exportar todos los modelos
module.exports = {
  User,
  Library,
  MediaItem,
  WatchHistory,
  Session,
  Setting,
};
