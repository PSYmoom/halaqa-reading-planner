import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the whole app down to a single self-contained dist/index.html
// (JS + CSS inlined) so it can be double-clicked or shared as one file.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
