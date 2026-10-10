import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      { find: "@saffra/types", replacement: path.resolve(__dirname, "../../packages/types/src/index.ts") },
      { find: "@saffra/config", replacement: path.resolve(__dirname, "../../packages/config/src/index.ts") },
      { find: "@saffra/ui", replacement: path.resolve(__dirname, "../../packages/ui/src/index.ts") },
    ],
  },
  server: {
    port: 5173,
    // In production (and the packaged desktop app) the API is served from
    // the same origin as the page, so the frontend just calls relative
    // `/api/...` and `/socket.io` paths — no env var, no CORS, works from
    // any device on the LAN unmodified. This proxy is what makes that same
    // relative-path code also work against the separate API dev server
    // (:4000) while iterating with `npm run dev`.
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:4000", ws: true, changeOrigin: true },
    },
  },
});
