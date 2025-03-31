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
      statements: 5,      // 5% cobertura mínima de statements
      branches: 0.40,     // 0.40% cobertura mínima de branches (ramas)
      functions: 5,       // 5% cobertura mínima de funciones
      lines: 5,           // 5% cobertura mínima de líneas
    },
  },
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["./tests/setup.js"],
};
