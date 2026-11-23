import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/chat": {
        target: "https://voom-system-nova-ai.suwapat787.workers.dev",
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyRequest) => {
            // Local dev is server-to-server; omit localhost Origin because the Worker
            // intentionally accepts only the approved NOVA UI origins in browsers.
            proxyRequest.removeHeader("origin");
          });
        },
      },
    },
  },
});
