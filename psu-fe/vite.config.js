import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { chartRendererAlias } from "./src/components/widgets/chart/renderers/chartRendererSelection.js";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "psu-chart-renderer": chartRendererAlias,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
