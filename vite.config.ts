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
          // Recharts + all d3/victory deps must stay in ONE chunk to avoid
          // "Cannot access 's' before initialization" TDZ circular dep errors.
          if (id.includes('node_modules/recharts/') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/d3/') ||
              id.includes('node_modules/victory-vendor/')) {
            return 'vendor-charts';
          }
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
