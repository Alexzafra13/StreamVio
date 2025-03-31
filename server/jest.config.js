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
      statements: 5,
      branches: 5,
      functions: 5,
      lines: 5,
    },
  },
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["./tests/setup.js"],
};
