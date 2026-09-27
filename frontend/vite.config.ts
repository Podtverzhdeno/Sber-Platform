import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === "serve" ? [{
      name: "impulse-dev-csp",
      transformIndexHtml(html: string) {
        // Vite HMR injects imported CSS into a style element in development.
        // Production keeps the strict external-style policy from index.html.
        return html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
      },
    }] : []),
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
  },
}));
