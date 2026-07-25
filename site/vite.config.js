import { defineConfig } from "vite";

// Relative base so the build works both locally (`vite preview`) and on GitHub
// Pages under /multilingual-oss-map/ without hardcoding the repo path.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
});
