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
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["./tests/setup.js"],
};
