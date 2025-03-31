// server/jest.config.js
module.exports = {
  testEnvironment: "node",
  coverageDirectory: "./coverage/",
  collectCoverage: true,
  collectCoverageFrom: [
    "routes/**/*.js",
    "services/**/*.js",
    "middleware/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**",
  ],
  // cambiar a futuro
  coverageThreshold: {
    global: {
      statements: 7,
      branches: 9,
      functions: 12,
      lines: 7,
    },
  },
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["./tests/setup.js"],
};
