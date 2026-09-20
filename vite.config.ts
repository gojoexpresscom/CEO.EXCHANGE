import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    // Split large vendors so the auth-critical path can load faster on mobile
    cssCodeSplit: true,
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("lightweight-charts")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("tesseract") || id.includes("@mediapipe")) return "heavy-ml";
          if (id.includes("react-dom") || id.includes("/react/")) return "react";
        },
      },
    },
  },
});
