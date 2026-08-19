import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync("./192.168.10.101-key.pem"),
      cert: fs.readFileSync("./192.168.10.101.pem"),
    },

    host: true,

    proxy: {
      "/api": {
        target: "http://192.168.10.101:8001",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },

      "/covers": {
        target: "http://192.168.10.101:8001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
