# 🦕 Deno — TypeScript/JavaScript Runtime & Edge Security

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [EF — Edge Functions](./ef-edge-functions.md) | [Node.js Runtime](./nodejs-runtime.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Deno** egy modern, biztonságos **JavaScript és TypeScript futtatókörnyezet (Runtime Environment)**, amelyet Ryan Dahl (a Node.js eredeti alkotója) hozott létre a Node.js tervezési hiányosságainak és biztonsági problémáinak kijavítására.

A Deno a Chrome V8 motorjára és a Rust nyelvre épül. Beépített TypeScript támogatással, webes szabványos API-kkal (`fetch`, `WebSocket`, `Streams`) és **alapértelmezetten zárt (secure-by-default)** biztonsági architektúrával rendelkezik.

---

## 🔑 Deno vs Node.js Összehasonlítás

| Jellemző | Deno | Node.js |
|---|---|---|
| **Biztonság (Security)** | Alapértelmezetten zárt. Engedély kell a fájlrendszer, hálózat vagy env eléréshez (`--allow-net`, `--allow-env`). | Alapértelmezetten minden kódrészlet hozzáférhet a szerver fájljaihoz és hálózatához. |
| **TypeScript** | Native TypeScript támogatás fordítás (`tsc`) nélkül. | Külön fordítót (`tsc`, `babel`, `ts-node`) igényel. |
| **Modulkezelés** | ES Modules & URL alapú importok (`https://...` vagy `npm:`). Nincs `node_modules` mappa és `package.json`. | CommonJS (`require`) & ES Modules (`import`). Hatalmas `node_modules` mappa. |
| **Web API Szabványok** | Natív `fetch()`, `WebAssembly`, `Blob`, `crypto`, `CustomEvent`. | Korábban saját modulok (`http`, `crypto`), fokozatosan átvevő Polyfill-ek. |

---

## 💡 A Deno Szerepe a Visibill Architektúrában

A Visibill összes Supabase **Edge Function-je (`management-stats`, `send-email`, `nav-sync`, `accounty-*`) Deno futtatókörnyezetben fut**.

### Példa Deno Edge Function Importra (`management-stats/index.ts`):

```typescript
// Nincs package.json vagy node_modules — URL és npm: specifier alapú importok
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 🛡️ Miért Előnyös ez a Visibillnek?

1. **Magas Biztonság Serverless Környezetben:** A Deno izolált homokozója (sandbox) garantálja, hogy egy harmadik féltől származó függőség (package) ne tudjon észrevétlenül adatot szivárogtatni a szerverről.
2. **Ultragyors Cold Start:** Mivel nem kell `node_modules` mappát betölteni a memóriába, az Edge Function-ök indítási ideje (cold start) mindössze **20-30 milliszekundum**.
