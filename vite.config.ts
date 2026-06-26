/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  // Pre-bundle recharts + d3 together to avoid TDZ circular dependency errors
  // when they are split into separate manual chunks at build time.
  optimizeDeps: {
    include: ["recharts"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React framework — shared by every page
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-core';
          }
          // Supabase client — used widely but not by every page
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // NOTE: Do NOT manually chunk recharts / d3 / victory-vendor.
          // Forcing them into a single chunk triggers a TDZ
          // "Cannot access 'S' before initialization" error at runtime
          // because of circular deps between recharts and d3 submodules.
          // Let Rollup's default code-splitting handle these.
          // Radix UI primitives — shared across many components
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // TanStack React Query
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    exclude: ["tests/**", "node_modules/**"],
  },
}));
