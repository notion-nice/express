import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  mode: "production",
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, "api", "pkgs"),
    minify: false,
    lib: {
      entry: "src/html2blocks.js",
      name: "html2blocks",
      formats: ["es"],
      fileName: () => `html2blocks.mjs`
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
