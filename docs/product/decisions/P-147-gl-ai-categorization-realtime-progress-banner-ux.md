# P-147: Főkönyvi AI Tételbesorolás Valós Idejű Folyamatjelző és Státusz-sáv UX

**Status:** Decided  
**Date:** 2026-09-30  
**Category:** UI / Workflow  
**Question:** Hogyan jelenítsük meg a könyvelő számára az AI tételbesorolás folyamatát anélkül, hogy a felület pollinggal terhelné az adatbázist, és hogyan különböztessük meg a futó feladatot a cég szintű könyvelési lefedettségtől?  

---

## Decision

Úgy döntöttünk, hogy egy kétszintű, dinamikus és vizuálisan tiszta folyamatjelző rendszert vezetünk be a Főkönyvi Kivonat (`/general-ledger`) oldalon:

### 1. Lebegő / Átmeneti Folyamatjelző Sáv (Transient Live Progress Banner)
* Közvetlenül a főkönyvi táblázat felett jelenik meg, amint a háttérben elindul az AI besorolás (`processing_status: 'processing'`).
* **Vizuális elemek:**
  * Kék pulzáló / forgó Sparkles ikon.
  * Folyamat címe: `AI tételbesorolás folyamatban...`.
  * Százalékos badge (pl. `17%`).
  * Számított darabszámos lefedettség: `51 / 307 tétel besorolva`.
  * Animált, folyamatosan kitöltődő Progress csík.
* **Életciklus:** Amint a folyamat befejeződik (`completed` vagy `error`), a sáv azonnal, animációval eltűnik, és helyette egy zöld siker-toast értesíti a könyvelőt.

### 2. GlToolbar AI Gomb Élő Számláló és Letiltott Állapot
* Az eszköztár AI Besorolás gombja futás közben automatikusan letiltott (`disabled`) állapotba kerül, megelőzve a párhuzamos job-indításokat.
* Felirata dinamikusan felveszi a háttérmunka állását: `AI Fut... (51/307)` egy forgó spinner kíséretében.

### 3. Vizuális Szétválasztás: Aktív AI Munka vs. KPI Lefedettségi Kártya
* **Felső Sáv (Live Job Banner):** Kizárólag az *éppen futó job* haladását méri (pl. 51/307). Amint a job véget ér, eltűnik.
* **Alsó KPI Kártya:** A cég *teljes évre vagy időszakra vonatkozó könyvelési lefedettségét* mutatja permanensen (pl. 1710/1936, 88%). Korábban a polling ezt próbálta másodpercenként frissíteni. Az új logikában a KPI kártya értékei csak a job lezárásakor invalidálódnak és frissülnek, megőrizve a stabilitást.

### 4. 15 Perces Beragadás-védelem (Stale Task Timeout UX)
* Ha egy worker folyamat összeomlik vagy a szerver újraindul, a könyvelő nem ragad be az "AI Fut..." állapotba: 15 percnél régebbi függő rekordok esetén a gomb automatikusan aktív marad, és a banner nem jelenik meg.

---

## Current Implementation

* `src/pages/GeneralLedgerPage.tsx`: Supabase Realtime feliratkozás a `gl_upload_notifications` táblára és a `Live AI Progress Banner` renderelése.
* `src/components/general-ledger/GlToolbar.tsx`: `aiProgress` prop kezelése, gomb letiltása és dinamikus darabszám megjelenítése.
* `src/components/general-ledger/GeneralLedgerTable.tsx`: Polling mentes, stabilizált táblázatmegjelenítés.

---

## Rationale

* **Átláthatóság és Megnyugtató Visszajelzés:** A könyvelőnek nem kell találgatnia, hogy a háttérben történik-e valami; pontos százalékos és tételszámos előrehaladást lát másodperces késleltetés nélkül.
* **Zero Resource Waste:** A felület úgy viselkedik mint egy modern reaktív applikáció, miközben nem bombázza a szervert másodpercenként 100-200 ms-os SQL RPC hívásokkal.

---

## Kapcsolódó
* [A-184: Real-time AI Categorization Progress Streaming](../../architecture/decisions/A-184-realtime-ai-progress-streaming-and-matching-idempotency.md)
* [P-019: GL kategorizálás javaslat](./P-019-gl-suggestion.md)
* [P-105: Főkönyvi Kivonat 2-Tier Eszköztár UX](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md)
* [P-113: Főkönyvi Kivonat Kontírok vs. Tételes Nézetváltó UX](./P-113-general-ledger-granularity-kontirok-teteles-view.md)
