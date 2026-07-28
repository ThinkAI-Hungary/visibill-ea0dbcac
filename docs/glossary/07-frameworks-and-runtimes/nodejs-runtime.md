# 🟢 Node.js — JavaScript Runtime & Ökoszisztéma

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Deno Runtime](./deno-runtime.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Node.js** egy nyílt forráskódú, platformfüggetlen **JavaScript futtatókörnyezet (Runtime Environment)**, amely a Google Chrome V8 JavaScript motorjára épül. Lehetővé teszi, hogy a JavaScript kódot a böngészőn kívül, szerver oldalon vagy fejlesztői eszközökként futtassuk.

A Node.js egy-szálú (single-threaded), de **nem-blokkoló, eseményvezérelt I/O modellt (Event Loop)** használ, ami rendkívül hatékonnyá teszi hálózati kérések és I/O-intenzív feladatok kezelésére.

---

## 🔑 Főbb Node.js Kifejezések & Eszközök

| Kifejezés | Leírás | Szerepe a Visibillben |
|---|---|---|
| **npm / npx** | Node Package Manager — a világ legnagyobb szoftverregiszter-függőségkezelője és parancsfuttatója. | `package.json` csomagok telepítése és scriptek (`npm run dev`, `npm run build`). |
| **Event Loop** | A Node.js magja, amely az aszinkron visszahívásokat (callbacks, Promises, `async/await`) kezeli anélkül, hogy leblokkolná a főszálat. | Aszinkron kérések és fejlesztői dev szerver kiszolgálása. |
| **Vite** | Node.js alapú ultragyors frontend build tool és dev szerver (ES modules alapon). | A Visibill React frontend dev szervere és bundlere. |
| **Deno / Bun** | A Node.js modern alternatívái. A Deno biztonságos, TypeScript-natív futtatókörnyezet. | A Supabase **Edge Function-ök Deno-t használják** Node.js helyett! |

---

## 💡 A Node.js Szerepe a Visibill Projektben

A Visibill architektúrájában a Node.js két fő területen van jelen:

1. **Frontend Fejlesztés & Build Pipeline:**  
   A React webapp fejlesztése Node.js környezetben történik:
   - `npm run dev`: Vite dev szerver elindítása (HMR - Hot Module Replacement).
   - `npm run build`: TypeScript fordítás (`tsc`) és kódcsomagolás (minified production bundle).

2. **Deno vs Node.js az Edge Function-ökben:**  
   Bár a frontend tooling Node.js-en fut, az adatbázis mögötti **Supabase Edge Function-ök (`management-stats`, `send-email`) Deno-t használják**. A Deno nem igényel `package.json`-t vagy `node_modules` mappát, az importok közvetlenül URL alapon vagy `npm:` specifier-rel történnek (pl. `import { createClient } from "https://esm.sh/@supabase/supabase-js"`).
