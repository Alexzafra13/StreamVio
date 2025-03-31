// vitest.config.mjs
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["./tests/unit/**/*.test.{js,jsx}"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/"],
    },
  },
});
