import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the client runs on 5173 and proxies API + WebSocket to the
// Node server on 3000. In production the server serves the built client.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
});
