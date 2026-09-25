---
name: session-summary
description: Use when the user requests a session summary, logs completed pairing work or hours, asks to summarize tasks and bugfixes, or types '/session-summary'.
---

# Session Summary — Munkaidő-elszámolást Segítő Összefoglaló Generáló

Ez a skill segít a felhasználónak abban, hogy a páros programozási session végén egy rendkívül részletes, szakmailag precíz, és **Git commit message** stílusban formázott magyar nyelvű összefoglalót kapjon az elvégzett feladatokról. Ezt az összefoglalót a felhasználó közvetlenül felhasználhatja munkaidő-nyilvántartó rendszerekben (pl. Jira, Toggl, ügyféltájékoztatók).

Emellett a skill **automatikusan archiválja** az elkészült összefoglalót a projekt gyökerében található `session-summary/<Fejlesztő>/YYYY-MM-DD/` mappába. A mappa a Git repository része (nincs gitignore-ban), így a csapattársak egymás összefoglalóit is elérik és a `/visibill-patchnote` skill automatikusan be tudja olvasni a nap végén a teljes csapat munkáját.

---

## 👥 Fejlesztői Környezet & Almappák

A Visibill projekten két fejlesztő dolgozik párhuzamosan:
* **Jani** (almappa: `session-summary/Jani/`)
* **Áron** (almappa: `session-summary/Áron/`)

### Fejlesztő Automatikus Azonosítása (Developer Detection):
Amikor a skill elindul, az alábbi prioritási sorrendben azonosítja a fejlesztőt:
1. **Explicit paraméter:** Ha a hívásban szerepel a név (pl. `/session-summary Áron` vagy `/session-summary Jani`), akkor azt az almappát használja.
2. **Projekt-szintű Git config (`visibill.developer`):**
   - Futtasd le: `git config visibill.developer`.
   - Ha értéke `Jani` $\to$ **`Jani`**, ha `Áron` (vagy `Aron`) $\to$ **`Áron`**.
   *(Ez a legtisztább, 1 parancsos beállítás: `git config visibill.developer Áron`)*
3. **Git felhasználó & Rendszer-környezet (Fallback):**
   - Futtasd le: `git config user.name` és `git config user.email`, valamint vizsgáld meg a rendszer felhasználónevét (`$env:USERNAME` / `$env:USER`).
   - Ha az érték `morfizor`, `notbyalongway@gmail.com`, `Morfi`, `Jani` vagy ezek variációja $\to$ **`Jani`**.
   - Ha az érték `Áron`, `aron` vagy Áron email címe/felhasználóneve $\to$ **`Áron`**.
4. **Kérdés / Fallback:** Ha a fentiek alapján sem dönthető el egyértelműen, egyszerűen kérdezd meg: *"Jani vagy Áron almappájába mentsük el az összefoglalót?"*

---

## 📋 Működési Folyamat

Amikor a felhasználó session összefoglalót kér, vagy meghívja a `/session-summary` parancsot, végezd el az alábbi lépéseket:

### 1. Fejlesztő Azonosítása
Állapítsd meg a fent leírt szabályok alapján, hogy ki a munkamenet fejlesztője (`Jani` vagy `Áron`).

### 2. Kontextus Gyűjtése
Vizsgáld meg a session során végzett változtatásokat az alábbi források alapján:
1. **Git Commits & Status:**
   - Nézd meg a legutóbbi helyi commitokat (`git log -n 5 --oneline`) és a még nem commitolt fájlokat (`git status -s`).
2. **Artifacts & Tervfájlok:**
   - Olvasd be a `<appDataDir>/brain/<conversation-id>/task.md` és `walkthrough.md` fájlokat, ha léteznek.
3. **Kód-változások:**
   - Elemezd a módosított fájlok diffjét vagy tartalmát a legfontosabb logikai változások kinyeréséhez.
4. **Verifikációs Eredmények:**
   - Ellenőrizd a build státuszt (`npm run build` / `npx tsc --noEmit`) és a lefutott teszteket.

### 3. Összefoglaló Generálása
Állítsd össze a strukturált összefoglalót a Git Conventional Commits stílusában az alábbi formázási szabályok szerint.

### 4. Automatikus Mentés Mappába (Persistence & Git Tracking)
1. Keresd meg a projekt gyökerében lévő `session-summary/<Fejlesztő>/` mappát (pl. `session-summary/Jani/` vagy `session-summary/Áron/`).
2. Hozz létre egy aznapi alkönyvtárat a helyi idő alapján `YYYY-MM-DD` formátumban:
   `session-summary/<Fejlesztő>/YYYY-MM-DD/` (pl. `session-summary/Jani/2026-09-25/`).
3. Mentsd el az összefoglalót egy markdown fájlba egyedi azonosítóval (időbélyeg + rövid téma-slug):
   `session-summary/<Fejlesztő>/YYYY-MM-DD/summary-HHMMSS-<tema-slug>.md`
   (Példa: `session-summary/Jani/2026-09-25/summary-161800-cte-refactor-partners-scroll-and-signout-clean.md`).
4. A fájl tartalmazza az összefoglaló fejlécét és a Markdown kódblokkot:
   ```markdown
   # Session Summary — YYYY-MM-DD HH:MM

   ```text
   feat/fix: ...
   ...
   ```
   ```
5. **Git állapot:** Mivel a mappa a repository része, a fájl azonnal követhetővé válik a Git által (`git status`), és commitolható/pusholható a repóba a kóddal együtt.

### 5. Megjelenítés a Felhasználónak
1. Jelenítsd meg az összefoglalót egyetlen másolható Markdown kódblokkban (` ```text `).
2. Írd ki a mentett archívumfájl kattintható markdown hivatkozását (pl. `[session-summary/Jani/2026-09-25/...](file:///...)`).
3. Emlékeztesd a fejlesztőt, hogy a session summary pusholásával a csapattárs (és a nap végi `/visibill-patchnote`) azonnal látni fogja az elvégzett feladatokat.

---

## ✍️ Formázási és Tartalmi Szabályok

### Általános stílus:
* **Nyelv:** Magyar (precíz szakmai kifejezésekkel, pl. *mojibake, pipeline, webhook, upsert, bulk insert, constraint, deployment, layout shift, flex-containment*).
* **Hangnem:** Professzionális, mérnöki stílus, ami világosan kifejezi az elvégzett munka mélységét és üzleti értékét.
* **Formátum:** Egyetlen másolható Markdown kódblokkba (` ```text `) zárd az összefoglalót.

### A Commit Message Felépítése:
A Git Conventional Commits mintáját követve az alábbi szekciókat építsd fel:

1. **Főcím (`feat/fix/refactor/docs/chore: ...`):**
   * Egyetlen tömör, összefoglaló sor a session fő eredményéről.
2. **Részletes pontok (Bulleted list):**
   * **Adatbázis & Backend logikák:** Táblák, RLS policy-k, PGMQ, indexek vagy lekérdezések módosításai (kapcsolódó ADR sorszámmal, pl. A-068).
   * **Hibajavítások:** Milyen crash-eket, validációs hibákat vagy nem várt viselkedést hárítottunk el (gyökérok + megoldás).
   * **UI/UX & Frontend:** Ha a felület, navigáció, modalok vagy design tokenek változtak (érintett komponens megnevezése).
   * **Minőségbiztosítás (QA):** Hozzáadott unit/integrációs tesztek, teszteredmények (pl. "10/10 passed", `npx tsc --noEmit` code 0).
   * **DevOps / Deployment:** Migráció futtatása, élesítés DigitalOcean droplet-re, Docker konténerek újraindítása, log-ellenőrzés.
   * **Dokumentáció (Doc-sync):** Létrehozott/frissített ADR-ek sorszáma és megnevezése, ARCHITECTURE.md/GOTCHAS.md frissítések.

---

## 📖 Példa Kimenet

```text
fix(db, partners, auth): get_management_files CTE refaktorálás (0A000 hiba elhárítása), Partnertörzs görgetés & layout levágás javítás, kijelentkezési URL tisztítás

- PostgreSQL 0A000 Hiba Elhárítása és RPC CTE Refaktorálás (A-068)
  - Hibanapló mélyelemzés (Supabase Postgres logok): `0A000 DROP TABLE is not allowed in a non-volatile function` kivétel azonosítása a `get_management_files` RPC-ben
  - Gyökérok: a függvény `STABLE` volt, mégis futásidőben `CREATE TEMP TABLE ... ON COMMIT DROP` és `DROP TABLE` DDL műveleteket hajtott végre, ami PostgreSQL alatt tiltott nem-VOLATILE kontextusban
  - Architektúrális megoldás: az ideiglenes fizikai táblák teljes felszámolása és kiváltása tiszta, memóriában kiértékelődő CTE-kre (`WITH unioned_files AS (...)`, `filtered AS (...)`, `counted AS (...)`, `paged AS (...)`)
  - Adatbázis migráció létrehozása és élesítése: `supabase/migrations/20260925170000_refactor_get_management_files_to_cte.sql`
  - Kapcsolódó architektúra döntési nyilvántartás frissítése: `docs/architecture/decisions/A-068-management-file-browser-rpc-and-infinite-scroll.md`

- Partnertörzs Felület Görgetés és Tartalom-levágás Hibajavítása (`PartnersPage.tsx`)
  - Felhasználói hibajelentés: a Partnertörzs menüben (`/partners`) nem lehetett lefelé görgetni, a lapozó és az adatok alsó része levágódott
  - Gyökérok: a legkülső konténeren lévő merev `h-full overflow-hidden` osztály zárolta az oldalt a látható viewport magasságára, megakadályozva az `AppLayout` `overflow-y-auto` működését
  - Módosítás: a merev `h-full overflow-hidden` cseréje `min-h-full space-y-4 page-animate flex flex-col pb-8` rugalmas szerkezetre
  - Természetes, sima görgetés biztosítása laptopokon, kis felbontású képernyőkön és mobil/tablet nézetben egyaránt

- Kijelentkezési Célútvonal Tisztítás (`AccountySidebar.tsx`, `ProtectedLayout.tsx`)
  - Kijelentkezési útvonal szanálása: a `handleSignOut` tiszta `/auth` célállomásra navigál

- Minőségbiztosítás, Build és Git Szinkronizáció
  - TypeScript fordítási ellenőrzés: `npx tsc --noEmit` hibamentes (code 0)
  - Unit tesztek: `navPartnerSync.test.ts` (10/10 passed)
  - Production Vite build: `npm run build` sikeres (19.45s)
  - Git commitok és távoli push az `origin/main` ágra (`0ddf0ab5`)
```
