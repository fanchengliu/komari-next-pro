import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: command === "build" ? "/themes/komari-ds/dist/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/sw.js": { target: "http://127.0.0.1:5174" },
      "/api": {
        target: process.env.KOMARI_DEV_ORIGIN || "http://127.0.0.1:5174",
        ws: true,
      },
      "/komari-ds-api": { target: "http://127.0.0.1:5175" },
      "/admin": { target: "http://127.0.0.1:5174" },
      "/terminal": { target: "http://127.0.0.1:5174" },
    },
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
}));
