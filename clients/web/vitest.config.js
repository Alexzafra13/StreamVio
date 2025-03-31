// clients/web/playwright.config.js
const { devices } = require("@playwright/test");

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: "./tests/e2e",
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    // Especificar configuración base para todos los proyectos
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Configurar los proyectos para varios navegadores/dispositivos
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  // Configurar servidor web local para pruebas
  webServer: [
    {
      command: "cd ../../server && npm run dev",
      port: 3000,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      port: 4321,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
  ],
};

module.exports = config;
