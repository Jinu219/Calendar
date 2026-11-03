import { defineConfig } from "vite";

// Bundles the MCP server and the shared TypeScript it imports into one Node
// script (mcp/dist/calendar-mcp.mjs) that Claude Code runs with `node`.
export default defineConfig({
  // public/ holds app assets; nothing to copy next to a Node script.
  publicDir: false,
  build: {
    ssr: "mcp/server.mjs",
    outDir: "mcp/dist",
    emptyOutDir: true,
    target: "node20",
    minify: false,
    rollupOptions: {
      output: { entryFileNames: "calendar-mcp.mjs", format: "es" },
    },
  },
});
