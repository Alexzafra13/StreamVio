import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: [
      "./src/**/*.{test,spec}.{js,jsx}",
      "./tests/unit/**/*.{test,spec}.{js,jsx}",
    ],
    exclude: ["./tests/e2e/**/*", "node_modules"],
  },
});
