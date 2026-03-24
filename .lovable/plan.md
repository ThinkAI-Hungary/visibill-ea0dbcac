

# Fix: `vite.config.ts` build hiba

## Probléma
A `removeAttributes` default importként van behúzva, de a csomag named exportot használ → `removeAttributes is not a function`.

## Javítás
Egyszerűen eltávolítjuk a plugint és az importját. A `data-testid` attribútumok csak lokálisan kellenek (tesztek), és a Lovable tagger már kezeli az eltávolítást production buildnél.

### `vite.config.ts`
- Törölni: `import removeAttributes from "vite-plugin-react-remove-attributes";` (6. sor)
- Törölni: `mode === "production" && removeAttributes({ attributes: ["data-testid"] }),` (16. sor)

Végeredmény:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080 },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    exclude: ["tests/**", "node_modules/**"],
  },
}));
```

