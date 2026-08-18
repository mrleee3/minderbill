import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// app.html is the canonical build entry. The repo-root index.html is the
// deployed build artifact, written ONLY by CI (.github/workflows/build.yml).
// Never commit a locally built index.html.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "./",
  build: {
    rollupOptions: { input: "app.html" },
  },
  define: {
    __BUILD_ID__: JSON.stringify(
      (process.env.GITHUB_SHA ?? "dev").slice(0, 7)
    ),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as any);
