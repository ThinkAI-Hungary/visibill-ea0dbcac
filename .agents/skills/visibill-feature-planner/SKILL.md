---
name: visibill-feature-planner
description: Use when planning a COMPLEX new feature, module, or significant architectural change in Visibill/eaisybill/eaisyBooks — NOT for simple modifications. Triggers on "új feature", "új modul", "tervezzünk", "feature plan", "modul tervezés", "építsünk", "hozzunk létre", "fejlesszünk ki", "plan new", "design new", "add module", "milyen döntéseket kell meghozni", "mit kell eldönteni", "decision list", "döntési mátrix", "eaisybooks", "accounty". Also triggers when visibill-spec-lookup determines the task is complex (3+ files, new functionality, architecture decision). This skill ensures ZERO silent decisions and implements atomic micro-module execution with retry-on-failure verification.
---

# Visibill Feature Planner — Zero Silent Decisions

## Filozófia

> **1. Az AI asszisztens SOHA nem hoz technikai döntéseket egyedül.**
> Minden döntést — legyen az UI pattern, adatmodell, API design, vagy edge function struktúra —
> explicit módon a felhasználó elé kell tárni jóváhagyásra.
>
> **"Silent decision" = a legrosszabb dolog ami történhet.**
> Ha az AI választ A és B között anélkül hogy kérdezne → az a rendszer hibája.

> **2. Skálázhatóság és maximális optimalizáltság.**
> A Visibill/eaisybill egy folyamatosan növekvő projekt, amelyet több ezer aktív ügyfél kiszolgálására tervezünk.
> Ezért minden funkció tervezése és a kódgenerálás során a skálázhatóság, az erőforrás-hatékonyság és a lekérdezések/algoritmusok optimális futási ideje kritikus fontosságú.

## Előfeltétel

> **A `visibill-spec-lookup` skill MINDIG lefut előtte!**  
> Mire ez a skill aktiválódik, a releváns spec-ek már be vannak olvasva.

---

## Teljes Feature Életciklus

```
TERVEZÉS → DÖNTÉSEK → DEKOMP. → IMPLEMENTÁCIÓ → INTEGR. VERIFY → USER GATE → DOCS → GRAPHIFY
   ↓           ↓          ↓           ↓               ↓              ↓          ↓        ↓
 Fázis 1    Fázis 2   Fázis 2.5   Fázis 3        Fázis 3.7      Fázis 3.7.4  Fázis 4  Fázis 5
(kontextus) (mátrix) (micro-mod) (module loop)  (e2e smoke)    (user valid) (BRD/..) (gráf)
                                  ↓
                          ┌───────────────────┐
                          │ Per-module loop:  │
                          │ BRIEF → SUB-AGENT │
                          │ → REVIEW          │
                          │ ↓ FAIL? ROLLBACK  │
                          │ → NEW SUB-AGENT   │
                          └───────────────────┘
```

---

## FÁZIS 1: Kontextus Gyűjtés (NE kódolj!)

### 1.0 Hypothesis — confidence check (Spec lookup ELŐTT)

```
HYPOTHESIS: [1 mondatban mit értettél meg a kérésből]
CONFIDENCE: ~X% — hiányzik: [mi nem tiszta még]
```

> Ha confidence < 70% → kérdezz MIELŐTT spec lookupot indítasz.

### 1.0a Izoláció — Git Worktree Check
* **Izolált munkakörnyezet:** Ha a feladat nagy volumenű, komplex, vagy külön ágon (branch) fog futni, és szeretnéd megóvni a meglévő munkakönyvtárat / futó dev szervert:
  * Olvasd be a **`using-git-worktrees`** skillt:
    ```
    view_file C:\Users\Morfi\.gemini\config\skills\using-git-worktrees\SKILL.md
    ```
  * Kérj megerősítést a felhasználótól egy izolált worktree létrehozásához a fejlesztés megkezdése előtt.

**ASSUMPTIONS I'M MAKING** (rögzítsd mielőtt bármit tervezel):
```
ASSUMPTIONS I'M MAKING:
1. [Feltételezés — pl. auth Supabase-alapú marad]
2. [Feltételezés — pl. ez az eaisybill-prod, nem a worker]
3. [Feltételezés — pl. csak owner lát majd új adatot]
→ Jelezz ha bármelyik téves, mielőtt tervezek.
```

**Reframe as Success Criteria** (elvont igény → mérhető feltétel):
```
Kérés: "Legyen gyorsabb / jobb / szebb"
→ Konkretizálva: "Dashboard LCP < 2s / API p95 < 300ms / 0 console error"
→ Ez a helyes cél?
```

### 1.1 User kérés értelmezése
```markdown
## 🎯 Feature összefoglaló
**Amit megértettem:** [saját szavakkal összefoglalás]
**Amit NEM értek még:** [kérdések listája]
```

### 1.2 Graphify query — érintett kód
```bash
graphify query "<feature kulcsszavak>"
```


### 1.2a Terminológia konzisztencia ellenőrzés

> Inspiráció: `grill-with-docs` skill "Challenge against the glossary" elve.

Ha a user olyan fogalmat használ, ami eltér a meglévő PRD/ADR terminológiájától → **azonnal flag-eld**:

```
"A PRD-ben 'partner'-nek hívjuk ezt a fogalmat, de te 'ügyfél'-t mondasz — melyiket értjük?"
"Az A-009 ADR-ben 'company_members' a cégtagság táblája, de te 'team members'-t mondasz — ugyanaz?"
```

**Visibill fogalomkészlet — ismert ütközési pontok:**

| Vague/ütköző | Pontos Visibill fogalom | Hol definiált |
|---|---|---|
| "számla" | invoice (bejövő) vs. outbound_invoice (kimenő) | P-010, P-012 |
| "partner" / "ügyfél" | company (cég entitás) | A-003 |
| "könyvelő" | accountant (eaisyBooks) vs. admin (eaisybill) | A-009 |
| "belép" | login (auth) vs. join-company (céghez csatlakozás) | A-009 |
| "email megerősítés" | verify-email (custom) vs. email_confirmed_at (Supabase natív) | A-021 |

Ha fuzzy fogalmat találsz → **pontosítsd MIELŐTT a döntési mátrixba viszel bármit.**

### 1.2b Kód konzisztencia cross-check

> Inspiráció: `grill-with-docs` skill "Cross-reference with code" elve.

Ha a user leírja hogyan kellene valaminek működnie → **ellenőrizd a kódban**, hogy a jelenlegi implementáció egyezik-e:

```
1. grep / view_file az érintett kód területen
2. Ha a kód MÁST csinál mint amit a user mond → surface it:
   "A kód jelenleg X-et csinál, de te Y-t szeretnél — melyik a helyes kiindulópont?"
3. Ha spec ↔ kód eltérés van → döntsd el ELŐSZÖR, csak aztán tervezz
```

**Miért kritikus:** Fázis 2 döntési mátrixát a meglévő tényleges viselkedésre kell alapozni, nem a user fejében élő (esetleg téves) képre.

Keresd végig mind a 4 döntési réteget (BRD, PRD, ADR, Worker docs).

### 1.4 KÖTELEZŐ: Design Pattern Kontextus Betöltése

> [!IMPORTANT]
> **UI ELEM GENERÁLÁS / MÓDOSÍTÁS KORLÁTOZÁS:**
> Ha a funkció új felületi elemet (pl. új dialógus, táblázat, modal, gomb, badge, input, skeleton, sidebar menüpont, stb.) vezet be vagy módosít, az AI **KÖTELES** a tervezési szakaszban betölteni és részletesen áttanulmányozni a megfelelő `docs/design/` dokumentációt!
> Az ad-hoc, egyéni vizuális vagy interakciós minták használata TILOS. Minden komponensnek tökéletesen illeszkednie kell a meglévő design tokens, typography és component library elvekhez.

Az AI **köteles** a meglévő design pattern-eket betölteni és követni.

#### Mindig olvasandó (minden feature-nél):
| Dokumentum | Tartalom |
|---|---|
| `docs/design/00-overview.md` | Design filozófia, vizuális elvek |
| `docs/design/01-tech-stack.md` | Provider stack, projekt struktúra |
| `docs/design/05-layout-navigation.md` | Sidebar, scoped routing, app shell |
| `docs/design/06-state-management.md` | Context-ek, React Query, URL state |
| `vercel-react-best-practices` | [react-best-practices/SKILL.md](file:///C:/Users/Morfi/.gemini/config/skills/react-best-practices/SKILL.md) — Vercel és React teljesítmény-optimalizálás |

#### Feature típustól függően olvasandó:
| Ha a feature tartalmaz... | Olvasd el |
|---|---|
| Lista/táblázat | `docs/design/11-data-display-tables.md` |
| Dialógus/modal | `docs/design/12-dialogs-modals.md` |
| Betöltési állapot | `docs/design/07-loading-patterns.md` |
| Form/input | `docs/design/09-error-handling-feedback.md` |
| Animáció | `docs/design/08-interactions-animations.md` |
| Auth/jogosultság | `docs/design/13-auth-onboarding.md` |
| Színek/téma | `docs/design/02-design-tokens.md` |
| Ikonok | `docs/design/03-typography-icons.md` |
| Komponens | `docs/design/04-component-library.md` |
| Perf. kritikus | `docs/design/14-performance.md` |

#### Betöltött pattern-ek KÖTELEZŐ követése:
Az AI **nem térhet el** a meglévő pattern-ektől, hacsak nincs jó oka. Ha el akar térni:
1. Nevesítse a meglévő pattern-t
2. Indokolja miért kell eltérni
3. Kérje a felhasználó jóváhagyását

**Meglévő pattern-ek:**
- **Lista oldal:** DataTable + szűrő bar + DateRangePicker
- **Hook pattern:** `useXxxData(companyId)` → React Query `useQuery`
- **Sidebar navigáció:** `navigation.ts` groupok, scoped routing
- **Error handling:** `toast` értesítés, Error Boundary wrapper
- **Dialógus:** Sheet (széles adat) vs Dialog (megerősítés) vs Drawer (mobil)
- **State:** URL state (szűrők) + React Query (szerver adat) + Context (globális)

### 1.5 KÖTELEZŐ: Open Döntések Felszínre Hozása

Keresd meg az **Open** és **Partially Decided** státuszú döntéseket:

```bash
grep -l "Open\|Partially Decided" docs/business/decisions/*.md docs/product/decisions/*.md docs/architecture/decisions/*.md
```

Ha van releváns nyitott döntés → **terjeszd elő a felhasználónak.**

---

## FÁZIS 2: Döntési Mátrix

Készíts egy **teljes döntési mátrixot** — minden döntéspontot listázz ki.

### Kötelező döntési kategóriák:

```markdown
## 🔍 Döntési Mátrix — [Feature Neve]

### 📊 Adatmodell Döntések
| # | Kérdés | Opciók | Meglévő pattern | Ajánlás |
|---|--------|--------|-----------------|---------|
| D-1 | Hol tároljuk? | a) Új tábla b) Bővítés | invoices: külön tábla | a) |
| D-2 | RLS policy? | a) Igen b) Nem | ADR A-003: mindig RLS | a) |

### 🏗️ Architektúra Döntések
| # | Kérdés | Opciók | Meglévő pattern | Ajánlás |
|---|--------|--------|-----------------|---------|
| D-3 | Frontend/Edge/Worker? | a) Client b) Edge c) Worker | ADR A-005/A-006 | ... |
| D-4 | Real-time? | a) Realtime b) Polling c) Nem | GL: Realtime | ... |

### 🖥️ Frontend Döntések
| # | Kérdés | Opciók | Meglévő pattern | Ajánlás |
|---|--------|--------|-----------------|---------|
| D-5 | Page vagy dialog? | a) Új page b) Modal | InvoicesPage: page | ... |
| D-6 | Lista pattern? | a) DataTable b) Cards c) Timeline | DataTable | a) |

### 🔐 Biztonság
| # | Kérdés | Opciók | Meglévő pattern | Ajánlás |
|---|--------|--------|-----------------|---------| 
| D-7 | Ki férhet hozzá? | a) Mindenki b) Owner c) Admin+ | ADR A-009 | ... |

**⚡ STRIDE gyorscheck** (5 perc, security-érintett feature előtt):

| Threat | Kérdés | Visibill kontextus |
|--------|--------|--------------------|
| **S**poofing | Valaki megszemélyesíthet user-t/cég-t? | JWT token kezelés, RLS company_id |
| **T**ampering | Megváltoztatható adat átvitel/tárolás közben? | Input validáció EF-ben |
| **R**epudiation | Tagadható-e egy action? | Audit log szükséges? |
| **I**nformation disclosure | Szivároghat-e adat más céghez? | RLS policy → multi-tenancy! |
| **D**enial of service | Túlterhelhető az endpoint? | Rate limit, payload méret |
| **E**levation of privilege | Kaphat valaki jogosulatlan hozzáférést? | Role check, SECURITY DEFINER |

> Ha bármelyik sor „Igen"-t kap → adja hozzá D-8+, D-9+ sorokként a mátrixba.


### 🤖 AI/Worker (ha releváns)
| # | Kérdés | Opciók | Meglévő pattern | Ajánlás |
|---|--------|--------|-----------------|---------|
| D-8 | AI feldolgozás? | a) Igen b) Nem | Invoice: classify→extract | ... |
```

### "Meglévő pattern" oszlop — kötelező kitölteni
Minden döntésnél az AI **köteles** megmutatni hogyan oldja meg ezt a meglévő app.

### Implicit döntések feltárása

**Gyakori implicit döntések amikről a user nem beszél:**
- „Legyen egy lista" → Rendezés? Pagination? Keresés? Export?
- „Töltsük fel a fájlt" → Duplikátum? Max méret? Típus szűrés?
- „AI feldolgozás" → Error? Timeout? Retry? Partial result?
- „Módosítható" → Ki? Undo? Optimistic update? Audit log?
- „Szűrjünk" → Server/client? URL persist? Default értékek?
- „Exportáljuk" → Formátum? Oszlopok? Dátumformátum?
- „Számoljuk ki" → Kerekítés? Pénznem? Null? Negatív?

### DB/SQL érintettség
> Ha a feature bármilyen DB műveletet érint (új tábla, migration, RPC, RLS policy, Edge Function query, frontend Supabase query):
> **KÖTELEZŐ: Olvasd be a `visibill-db-checklist` skillt:**
> ```
> view_file ~/.gemini/config/skills\visibill-db-checklist\SKILL.md
> ```
> Fűzd a DB checklist eredményeit a döntési mátrixhoz.

---

## FÁZIS 2.5: Micro-Module Dekomponálás (döntések UTÁN, implementáció ELŐTT)

**KÖTELEZŐ lépés mielőtt bármilyen kódot írnál.**

Az agent a teljes implementációs tervet **atomikus micro-modulokra** bontja. A cél: minden modul elég kicsi ahhoz, hogy **biztonságosan és megbízhatóan verifikálható** legyen mielőtt a következő modulra lépnél.

### Modul méret meghatározás

Az agent **saját maga határozza meg** a modul méretét a következők alapján:
- **Fájlok komplexitása** — egy 10-soros utility vs egy 300-soros page component
- **Dependency depth** — mennyi másik fájltól függ
- **Verifikálhatóság** — tudjuk-e izoláltan tesztelni

**Standard méretosztályok:**

| Méret | Fájlok | Leírás | Példa |
|-------|--------|--------|-------|
| **XS** | 1 | Egyetlen függvény, config változás | RLS policy hozzáadás |
| **S** | 1-2 | Egy hook vagy endpoint | `useRegisters.ts` + types |
| **M** | 3-5 | Egy feature slice | Hook + component + page szekció |
| **L** | 5-8 | Multi-component feature | Teljes oldal új layouttal |
| **XL** | 8+ | **TÚL NAGY — bontsd tovább!** | — |

> **And rule:** Ha az „és" szó szerepel a modul nevében → valójában két modul. Bontsd szét.  
> ✅ `Module 3: Hook — useRegisters`  
> ❌ `Module 3: Hook + UI — useRegisters és RegisterSelector` → két modul legyen.

> **Alapelv:** Egy modul annyi fájlt tartalmazzon, amennyit **egyetlen verifikációs lépésben** megbízhatóan ellenőrizni tudsz. Ha kétséges → kisebb modulra bontsd.


### Modul terv formátum

```markdown
## 🧱 Micro-Module Terv — [Feature Neve]

### Module 1: [Rövid név]
- **Fájlok:** [lista]
- **Függőség:** Nincs (első modul) / Module X
- **Verifikáció:**
  - BUILD: `npm run build` → SIKERES
  - SMOKE: [specifikus teszt — NEM csak build!]
  - EVIDENCE: [mi a bizonyíték hogy működik]

### Module 2: [Rövid név]
- **Fájlok:** [lista]
- **Függőség:** Module 1
- **Verifikáció:**
  - BUILD: `npm run build` → SIKERES
  - SMOKE: [specifikus teszt]
  - EVIDENCE: [bizonyíték]

[... további modulok ...]
```

### Modul sorrend szabály

**Dependency order** — mindig a legalsó rétegtől felfelé:
```
1. DB (migration, RLS, trigger)
2. RPC / Edge Function
3. Types / shared utilities
4. Hooks (data fetching)
5. UI Components (atomikus)
6. Page assembly (összerakás)
```

### Példa — "Házipénztár multi-regiszter" feature:

```markdown
Module 1: DB — petty_cash_registers tábla + RLS
  Fájlok: 1 migration file
  Verify: execute_sql "SELECT * FROM petty_cash_registers" → tábla létezik, RLS aktív
  Evidence: SQL output screenshot

Module 2: DB — petty_cash_entries FK + index módosítás
  Fájlok: 1 migration file
  Verify: execute_sql "SELECT indexname FROM pg_indexes WHERE tablename='petty_cash_entries'" → FK index létezik
  Evidence: index lista output

Module 3: Hook — useRegisters(companyId) + types
  Fájlok: useRegisters.ts, types.ts bővítés
  Verify: npm run build + böngésző konzol: hook returnál data tömböt (NEM üres, NEM undefined)
  Evidence: console.log output screenshot

Module 4: UI — RegisterSelector dropdown
  Fájlok: RegisterSelector.tsx, PettyCashPage.tsx módosítás
  Verify: npm run build + browser screenshot: dropdown renderelődik, opciók megjelennek
  Evidence: browser screenshot a renderelt dropdown-ról
```

---

## FÁZIS 3: Implementáció — Sub-Agent Orchestrator Pattern

**CSAK a felhasználó jóváhagyása után (döntési mátrix + modul terv jóváhagyva).**

### Architektúra: Orchestrator + Sub-Agent

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FŐ AGENT (Orchestrator)                         │
│                                                                     │
│  Feladatai:                                                         │
│  • Modul terv kezelés (sorrend, dependency-k)                      │
│  • Sub-agent brief készítés (kontextus, fájlok, pattern-ek)       │
│  • Sub-agent eredmény REVIEW (nem vak bizalom!)                    │
│  • Retry döntés (új sub-agent, módosított brief-fel)               │
│  • Integration verify (cross-cutting, E2E)                         │
│  • User kommunikáció (progress, evidence, gate)                    │
│  • task.md frissítés                                                │
│                                                                     │
│  NEM csinál:                                                        │
│  • Kód írás (azt a sub-agent csinálja)                             │
│  • Fájl módosítás (azt a sub-agent csinálja)                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Module 1 ──→ [Sub-Agent A] ──→ Eredmény ──→ Review ──→ ✅/❌    │
│  Module 2 ──→ [Sub-Agent B] ──→ Eredmény ──→ Review ──→ ✅/❌    │
│  Module 3 ──→ [Sub-Agent C] ──→ ...                                │
│                                                                     │
│  Ha ❌ → Új Sub-Agent (lessons learned brief-fel)                  │
│                                                                     │
│  *MEGJEGYZÉS:* Ha a futtató környezetben nincs natív kódoló         │
│  sub-agent eszköz, a Fő Agent maga végzi a kódolást, de szigorúan   │
│  izoláltan: modulonként haladva, sikertelen tesztnél git rollbackel │
│  és a brief alapú megközelítést szimulálva.                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Miért sub-agent per modul?**
- **Context izolácó** — minden sub-agent tiszta kontextussal indul, nincs "szennyezés" az előző modul vagy retry kódjából
- **Tisztább retry** — ha FAIL, a sub-agent kontextusa eldobódik → az új sub-agent NEM emlékszik a rossz kódra, nem másol belőle
- **Orchestrator fókusz** — a fő agent megőrzi a felülnézeti képet, nem merül el implementáció részleteiben
- **Context window védelem** — komplex feature (8+ modul) nem terheli túl a fő agent kontextusát

### 3.0 Build Baseline (implementáció ELŐTT)
```bash
npm run build
```
→ Ha a build HIBÁS: **javítsd először a meglévő hibákat** mielőtt bármit hozzáadnál.
→ Ha a build SIKERES: jegyezd meg mint baseline → `git stash` vagy jegyezd meg a HEAD commit-ot.

> **Az AI NEM kezd kódolni amíg a build nem SIKERES.** Tiszta kiindulási állapot szükséges.

### 3.1 Module Execution Loop (Orchestrator szint)

**MINDEN MODULE-RA (sorrendben):**

```
┌──────────────────────────────────────────────────────────────────┐
│                ORCHESTRATOR MODULE LOOP                           │
│                                                                  │
│  1. BRIEF — sub-agent brief összeállítása (ld. 3.1.1)          │
│  2. DELEGATE — sub-agent indítása a modul implementálásához     │
│  3. REVIEW — sub-agent eredményének ellenőrzése (ld. 3.1.2)    │
│     └─ FAIL → RETRY (ld. 3.2) — ÚJ sub-agent, tanulságokkal   │
│  4. EVIDENCE — bizonyíték rögzítés (sub-agent output/screenshot) │
│  5. LOG — task.md-ben modul ✅ jelölés + evidence link           │
│  6. NEXT MODULE — csak ha 1-5 mind PASS                         │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1.1 Sub-Agent Brief Sablon

A fő agent KÖTELES minden sub-agent-nek részletes brief-et adni. A brief tartalmazza:

```markdown
## Sub-Agent Brief — Module [N]: [Modul neve]

### Cél
[1 mondat — mit kell implementálni]

### Kontextus
- **Feature:** [a teljes feature neve és célja]
- **Előző modulok:** [milyen modulok már kész vannak, milyen fájlokat hoztak létre/módosítottak]
- **Függőségek:** [milyen fájlokra/típusokra/hookra épít ez a modul]

### Módosítandó/létrehozandó fájlok
- [pontos fájl nevek és elérési utak]

### Meglévő pattern-ek (KÖTELEZŐ követni)
- [relevans design pattern-ek, pl. "Hook pattern: useXxxData(companyId) → React Query useQuery"]
- [relevans kód példa, pl. "Nézd meg: src/hooks/useInvoices.ts — ugyanígy csináld"]

### Verifikációs szerződés
- BUILD: `npm run build` → SIKERES
- SMOKE: [specifikus smoke test lépés — NEM csak build!]
- EVIDENCE: [milyen bizonyítékot kell visszaadni]

### eaisyBill login (ha browser verify kell)
- URL: `http://localhost:5173`
- **Sima user:** Email: `balazs@thinkai.hu` | Jelszó: `Nincsapellata1'`
- **Management Dashboard:** Email: `management@thinkai.hu` | Jelszó: `v6Fo#RrG>]gEkGP]EZRB`

### Visszatérési formátum
A sub-agent KÖTELES ezzel a struktúrával visszatérni:
1. **Módosított fájlok listája** (path + rövid leírás)
2. **Build eredmény** (PASS/FAIL + output)
3. **Smoke test eredmény** (PASS/FAIL + evidence)
4. **Ha FAIL:** mi a hiba és mi a feltételezett ok
```

### 3.1.2 Sub-Agent Eredmény Review (Orchestrator feladata)

A fő agent **NEM bízik vakon** a sub-agent eredményében. Review checklist:

```
✅ REVIEW CHECKLIST — minden sub-agent visszatérés után:

□ Build PASS — a sub-agent tényleg futtatta? (output-ban látszik?)
□ Smoke test PASS — specifikus evidence van? (screenshot/SQL output/console)
□ False positive check — az evidence tényleges adatot mutat?
  - NEM üres tömb, NEM undefined, NEM skeleton, NEM "Loading..."
□ A kód konzisztens az előző modulokkal?
□ A meglévő pattern-eket követte?
□ Nincs "gyors hack" ami később problémát okoz?
□ Git diff review — futtasd: `git diff HEAD` az érintett fájlokon:
  - Nincs maradék debug output? (console.log, print, logger.debug temp kód)
  - Nincs unused import vagy unused variable?
  - Változók/függvények neve értelmes és konzisztens?
  - Nincs kikommentelt kód ami nem kellene?
```

**Ha a review FAIL → NE javítsd saját kezűleg** → spawn új sub-agent a tanulságokkal (ld. 3.2).

### 3.2 Retry Loop — Új Sub-Agent Tanulságokkal

> ⚠️ **Ez az agent legfontosabb viselkedési szabálya.**
> Ha bármilyen verifikáció vagy review FAIL → NE haladj tovább, NE próbálj saját kezűleg javítani.

```
┌──────────────────────────────────────────────────────────────────┐
│                    RETRY LOOP (Sub-Agent)                         │
│                                                                  │
│  1. ROLLBACK — git checkout a modul fájljaira                   │
│     → visszaáll a legutóbbi MŰKÖDŐ állapot                      │
│                                                                  │
│  2. ANALYZE — a fő agent elemzi mi ment rosszul                 │
│     → Mi volt a hiba az előző sub-agent-nél?                    │
│     → Rossz pattern? Hiányzó kontextus? Logikai hiba?           │
│                                                                  │
│  3. LEARN — rögzítsd a hibát                                    │
│     → task.md-ben: "Module X — Attempt Y: [hiba leírás]"       │
│                                                                  │
│  4. ENHANCED BRIEF — új sub-agent brief készítése:              │
│     → Az eredeti brief + "KORÁBBI HIBÁK" szekció:              │
│       "Attempt 1: [hiba]. NE ismételd! Helyette: [javaslat]"  │
│     → Plusz kontextus ha hiányzott (pattern példa, API docs)   │
│                                                                  │
│  5. NEW SUB-AGENT — friss sub-agent a bővített brief-fel       │
│     → Tiszta kontextus — NEM emlékszik az előző próbálkozásra  │
│     → DE tudja a tanulságokat az enhanced brief-ből             │
│                                                                  │
│  6. REVIEW — az új sub-agent eredményének ellenőrzése           │
│     → FAIL → vissza az 1. lépésre                               │
│     → PASS → folytatás a következő modullal                     │
│                                                                  │
│  ⛔ MAX 5 RETRY — ha 5 sub-agent próbálkozás után sem sikerül: │
│     → STOP. Jelezd a usernek:                                   │
│       - Mi a modul                                              │
│       - Mi volt az 5 próbálkozás és a hibák                    │
│       - Mi a feltételezésed a gyökérokról                       │
│       - Kérj user inputot mielőtt folytatnád                    │
└──────────────────────────────────────────────────────────────────┘
```

**A Retry Loop a task.md-ben így néz ki:**

```markdown
- [x] Module 1: DB — petty_cash_registers
  - Sub-Agent A (Attempt 1): ❌ RLS policy syntax error (`USING` hiányzott)
  - Sub-Agent B (Attempt 2): ✅ Tábla + RLS kész, verify PASS
  - Evidence: [SQL output](link)

- [/] Module 2: Hook — useRegisters
  - Sub-Agent C (Attempt 1): ❌ Hook üres tömböt returnált (RLS blokkolta, company_id nem volt set)
  - Sub-Agent D (Attempt 2): ❌ TypeScript error — PettyCashRegister type nem exportálva
  - Sub-Agent E (Attempt 3): ✅ Hook returnál data-t, types rendben
  - Evidence: [console screenshot](link)
```

### 3.3 Verifikációs Szerződés — típusonként

Minden modulhoz **specifikus** verify lépések kellenek. A `npm run build` szükséges de **SOHA NEM ELÉGSÉGES egyedül**.

| Modul típus | BUILD verify | SMOKE verify (false positive check) |
|------------|-------------|-------------------------------------|
| **DB migration** | `npm run build` | `execute_sql` → tábla/oszlop/index létezik, RLS aktív |
| **RPC function** | `npm run build` | `execute_sql "SELECT func(params)"` → eredmény ≠ error, ≠ üres |
| **Edge Function** | `npm run build` | `supabase functions invoke` vagy `curl` → 200 + valid JSON body |
| **React Hook** | `npm run build` | **Browser subagent** → konzol check: hook returnál érvényes data-t |
| **UI Component** | `npm run build` | **Browser subagent** → screenshot: element renderelődik, adat megjelenik |
| **Page assembly** | `npm run build` | **Browser subagent** → full page screenshot: layout helyes, adat megjelenik |
| **Trigger** | migration deploy | `execute_sql INSERT → SELECT` → trigger side-effect ellenőrzés |
| **Worker pipeline** | pytest | Specifikus pipeline teszt parancs |

### 3.4 False Positive Detekció

> **A false positive a legveszélyesebb hiba.** Az agent azt hiszi "kész", a user talál 3 bugot → trust erosion.

**FALSE POSITIVE JELEK — ha bármelyiket látod → NE haladj tovább:**

```
❌ Hook returnál `undefined` vagy üres tömböt mikor van adat a DB-ben
❌ RPC function "success" de 0 sor returnálva (RLS blokkolja!)
❌ Build SIKERES de TypeScript import nem talál exportot (lazy loaded, nem futott)
❌ Edge Function 200-at ad de a body üres vagy `{}`
❌ UI renderelődik de nincs adat benne (skeleton stuck állapotban)
❌ Teszt PASS de assertion túl gyenge (ld. tiltólista lent)
❌ Console error van a böngészőben de a build "sikeres"
❌ A mutation "sikeres" de a DB-ben nem változott semmi
❌ A query lefut de rossz company_id-vel (multi-tenancy bug)
```

**Ha false positive gyanú van → KÖTELEZŐ deep verify:**
1. Nyisd meg a böngészőt, ellenőrizd a konzolt (errors, warnings)
2. Ellenőrizd a Network tab-ot (API hívások, response body-k)
3. Ellenőrizd a DB-t közvetlenül (`execute_sql`)
4. Hasonlítsd össze az elvárt és a tényleges eredményt

### 3.5 Gyenge Assertion Tiltólista

**TILTOTT assertion pattern-ek (tesztekben és manuális verify-ban is):**

```
❌ expect(result).toBeTruthy()           → MIT vársz pontosan?
❌ expect(result).toBeDefined()          → Lehet üres tömb, üres object
❌ expect(result).not.toBeNull()         → Lehet undefined, üres string
❌ expect(response.ok).toBe(true)        → Body tartalmat is ellenőrizd!
❌ expect(array.length).toBeGreaterThan(0) → Seed adat nélkül ez FAIL
❌ "a build sikeres tehát működik"       → BUILD ≠ MŰKÖDIK
❌ "nincs error a konzolban"             → Lehet silent failure
```

**KÖTELEZŐ erős assertion pattern-ek:**

```
✅ expect(result.id).toBe("expected-uuid")
✅ expect(result.name).toEqual("Teszt Cég Kft.")
✅ expect(response.data).toHaveLength(3)
✅ expect(response.data[0]).toMatchObject({ field: "value" })
✅ expect(error.message).toContain("specific error text")
✅ Screenshot-on LÁTSZIK a konkrét adat (nem skeleton, nem "Loading...")
✅ DB query-vel ELLENŐRIZD hogy a sor tényleg bekerült
✅ Network tab-on a response body tartalmazza az elvárt mezőket
```

### 3.6 KÖTELEZŐ: Browser UI Verifikáció

**Minden UI-t érintő modulnál KÖTELEZŐ a browser subagent-tel történő verifikáció.**

A browser subagent feladata:
1. Navigálj a releváns oldalra
2. Készíts screenshot-ot
3. Ellenőrizd hogy az elvárt elemek renderelődnek-e
4. Ellenőrizd a konzolt error-ökre
5. Ha interakció szükséges (kattintás, form kitöltés) → hajtsd végre és ellenőrizd az eredményt

**eaisyBill bejelentkezési adatok (lokális dev / staging):**

| Mező | Érték |
|------|-------|
| URL | `http://localhost:5173` (dev) vagy a staging URL |
| Email (Sima) | `balazs@thinkai.hu` |
| Jelszó (Sima) | `Nincsapellata1'` |
| Email (Management) | `management@thinkai.hu` |
| Jelszó (Management) | `v6Fo#RrG>]gEkGP]EZRB` |

> ⚠️ Mindig fejlesztői szerveren (`npm run dev`) tesztelj, NE production-ön!

**Browser verify flow:**
```
1. Ha dev szerver nem fut → indítsd el: `npm run dev`
2. Browser subagent → navigálj az eaisybill-re
3. Ha nincs bejelentkezve → login a fenti adatokkal
4. Navigálj a tesztelendő oldalra
5. Screenshot készítés
6. Konzol ellenőrzés (error-ök, warning-ok)
7. Ha adat kell → ellenőrizd hogy tényleges adat jelenik meg (nem skeleton/loading)
8. Eredmény rögzítése a task.md-ben
```

---

## FÁZIS 3.7: Integration Verify (MINDEN modul ✅ után)

Miután az összes micro-module ✅ jelölést kapott:

### 3.7.1 Full Build
```bash
npm run build
```

### 3.7.2 End-to-End Integration Smoke Test

A teljes feature end-to-end tesztelése browser subagent-tel és Playwright-tal:
```
1. Bejelentkezés → Navigáció a feature oldalára
2. Fő happy path végrehajtása (create/read/update/delete ha releváns)
3. Adatok megjelenésének ellenőrzése
4. Mutáció → oldal frissítés → adat megjelenik
5. Screenshot a végállapotról
```

**Playwright automatizált tesztek futtatása (ha releváns):**
- Futtasd a meglévő E2E teszteket a regressziók kizárása érdekében:
  ```bash
  npm run test:e2e
  ```
- Ha az új funkcióhoz írtál E2E tesztet, ellenőrizd annak sikeres lefutását.

### 3.7.3 Regressziós Gyors-Check

A meglévő funkciók nem törtek el:
```
1. Dashboard betölt-e (nem blank, adat megjelenik)
2. Számlák oldal renderelődik-e (táblázat, szűrők)
3. Sidebar navigáció működik-e (kattintás → oldal váltás)
4. Ha eaisyBooks érintett → /accounty/ portfólió betölt-e
```

### 3.7.4 User Gate

> **GATE:** Az AI várja a felhasználó megerősítését hogy az implementáció működik.
> **NEM lép tovább Fázis 4-re amíg a user nem validálta!**

**Mit mond az AI:**

```markdown
## ✅ Implementáció kész — Összes modul verifikálva ✅

**Modulok:**
- [x] Module 1: [név] — [X] attempt, evidence: [link]
- [x] Module 2: [név] — [X] attempt, evidence: [link]
- [x] Module N: [név] — [X] attempt, evidence: [link]

**Integration test:** ✅ PASS — [evidence: screenshot/output]
**Regresszió:** ✅ Dashboard, Számlák, Navigáció — mind OK

**OUT OF SCOPE (nem változott):** [explicit felsorolás — pl. "a worker pipeline érintetlen"]

**Kérlek teszteld:** [mit és hogyan kell tesztelni a böngészőben]

⚠️ Ha működik, frissítem az összes releváns dokumentációt (BRD/PRD/ADR/Design docs).
```

**Rollout döntési thresholdok** (objektív rollback döntéshez):

| Metrika | 🟢 Folytat | 🟡 Vár és vizsgál | 🔴 Rollback |
|---------|-----------|-------------------|-------------|
| Error rate | ≤ baseline | 10-100% feletti | >2× baseline |
| P95 latency | ≤ 20% feletti | 20-50% feletti | >50% feletti |
| Client JS hibák | Nincs új típus | Új hiba <0.1% session | Új hiba >0.1% session |
| Üzleti metrika | Semleges / pozitív | Csökkenés <5% | Csökkenés >5% |

> **Rollback feltételei:** Error rate >2×, P95 latency >50%, adatintegritási probléma, vagy biztonsági sérülékenység.



---

## FÁZIS 4: Automatikus Dokumentáció Frissítés (user validáció UTÁN)

**KÖTELEZŐ — CSAK miután a user megerősítette hogy az implementáció működik.**

### 4.1 BRD frissítés (ha üzleti scope változott)
- Új BRD fájl (`docs/business/decisions/XXX-feature.md`) HA új üzleti képesség
- Vagy meglévő BRD státusz frissítés (`Open` → `Decided`)
- Index frissítés: `docs/business/decisions/index.md`

### 4.2 PRD frissítés (ha UI változott)
- Új PRD fájl (`docs/product/decisions/P-XXX-feature.md`) HA új felületi elem
- Vagy meglévő PRD frissítés
- Index frissítés: `docs/product/decisions/index.md`
- **Information architecture** frissítés ha új route

### 4.3 ADR frissítés (ha technikai döntés született)
- Új ADR fájl (`docs/architecture/decisions/A-XXX-feature.md`) HA új arch döntés
- Vagy meglévő ADR bővítése
- Index frissítés: `docs/architecture/decisions/index.md`
- **Cross-referenciák** hozzáadása (BRD ↔ ADR ↔ PRD)

### 4.4 Design docs frissítés (ha UI pattern változott)
- Provider stack: `docs/design/01-tech-stack.md`
- Komponens könyvtár: `docs/design/04-component-library.md`
- Navigation: `docs/design/05-layout-navigation.md`
- State management: `docs/design/06-state-management.md`

### 4.5 Worker docs frissítés (ha worker kód változott)
- `worker/docs/DECISIONS.md`
- `worker/docs/ARCHITECTURE.md`
- `worker/docs/PROMPTS.md`

### 4.6 Edge Function / RPC Function registry frissítés (ha új EF vagy RPC készült)
- `docs/architecture/decisions/A-005-edge-functions.md` — új EF hozzáadása
- `docs/architecture/decisions/A-016-postgresql-query-strategy.md` — új RPC hozzáadása
- `docs/architecture/overview.md` — darabszám frissítés
- `docs/architecture/decisions/index.md` — leírás frissítés

### 4.6a Adatbázis sémadokumentáció frissítése (CSAK user megerősítés után!)
- **Kritikus szabály:** Ha a fejlesztés során módosult a DB séma (migrációk lefutottak), a dokumentációt (`database-schema.md` és `database/*.md`) KIZÁRÓLAG azután szabad regenerálni, hogy a felhasználó megerősítette: a megvalósított funkciók működnek.
- **Folyamat:**
  1. Töltsd le a friss metaadatokat a Supabase-ből a `.temp-db-metadata/` könyvtárba (columns.json, constraints.json, accurate_fks.json, indexes.json, comments.json, tables.json).
  2. Futtasd a `npm run gen-db-docs` parancsot a dokumentáció automatikus újragenerálásához.
  3. Töröld le a `.temp-db-metadata/` könyvtárat.

### 4.7 Frissítési javaslat formátum

```markdown
## 📝 Dokumentáció Frissítés — [Feature Neve]

### Automatikusan frissítendő:
| Fájl | Változás |
|---|---|
| `docs/product/decisions/index.md` | P-xxx hozzáadás, count frissítés |
| `docs/design/05-layout-navigation.md` | Sidebar: új menüpont |

### Új fájlok:
| Fájl | Tartalom |
|---|---|
| `docs/product/decisions/P-xxx-feature.md` | UI workflow dokumentáció |

### Nem szükséges frissíteni:
- BRD: Meglévő scope fedi le
- Worker docs: Nem érint worker kódot
```

---

## FÁZIS 5: Graphify Update (utolsó lépés)

```bash
graphify update .
```

---

## Template-ek

### BRD döntés sablon
```markdown
# Decision XXX: [Feature Neve]
**Status:** Decided
**Category:** [Kategória]
**Question:** [Üzleti kérdés]
**Decision:** [Döntés]
**Rationale:** [Indoklás]
## Kapcsolódó
- ADR: [link]
- PRD: [link]
```

### PRD döntés sablon
```markdown
# P-XXX: [Feature Neve] UX
**Status:** Decided
**Category:** [Kategória]
**Question:** [Felületi kérdés]
**Decision:** [Döntés]
**Current Implementation:** [Jelenlegi állapot]
**Rationale:** [Indoklás]
```

### ADR döntés sablon
```markdown
# A-XXX: [Technikai Döntés Neve]
**Status:** Decided
**Date:** [dátum]
## Context
[Miért kellett dönteni]
## Decision
[Mit döntöttünk]
## Consequences
**Pozitív:** ...
**Negatív:** ...
## Kapcsolódó
- BRD: [link]
- PRD: [link]
```

## Számozás

- BRD: utolsó + 1 (jelenleg 035 → következő 036)
- PRD: figyelj a gap-ekre (P-036 létezik, P-039 is → következő P-040)
- ADR: utolsó + 1 (jelenleg A-019 → következő A-020)

## ⚠️ VÉGSŐ SZABÁLY

**Az AI SOHA nem kezd implementálni amíg:**
1. ✅ `npm run build` SIKERES (Build Baseline — Fázis 3.0)
2. ✅ Design pattern-ek betöltve és egyeztetve
3. ✅ Open döntések felszínre hozva
4. ✅ A döntési mátrix minden sora ki van töltve (meglévő pattern oszloppal)
5. ✅ A felhasználó minden döntést jóváhagyott
6. ✅ A micro-module terv elkészült és jóváhagyva (Fázis 2.5)

**Az AI (orchestrator) SOHA nem lép a következő modulra amíg:**
1. ✅ Sub-agent visszatérés review-olva (3.1.2 checklist)
2. ✅ `npm run build` SIKERES az aktuális modulra
3. ✅ Modul-specifikus SMOKE TEST PASS — evidence a sub-agent-től (nem csak "pass" szó!)
4. ✅ False positive check PASS (tényleges adat, nem üres/undefined)
5. ✅ Evidence rögzítve (screenshot/output/SQL eredmény)
6. ✅ Ha FAIL → git checkout + ÚJ sub-agent enhanced brief-fel (3.2)

**Az AI SOHA nem jelenti késznek a feature-t amíg:**
1. ✅ MINDEN micro-module ✅ jelölést kapott a task.md-ben
2. ✅ Integration smoke test PASS (E2E a teljes feature-re — Fázis 3.7.2)
3. ✅ Regressziós gyors-check PASS (Dashboard, Számlák, Navigáció — Fázis 3.7.3)
4. ✅ Browser screenshot BIZONYÍTJA hogy a UI renderelődik adat-tal
5. ✅ A user validálta hogy az implementáció működik (User Gate — Fázis 3.7.4)
6. ✅ BRD/PRD/ADR frissítve (Fázis 4)
7. ✅ EF/RPC registry frissítve ha releváns (Fázis 4.6)
8. ✅ Design docs frissítve (ha releváns)
9. ✅ Cross-referenciák hozzáadva
10. ✅ Graphify update lefutott (Fázis 5)

**TILTOTT viselkedés:**
- ❌ "A build sikeres, tehát működik" → BUILD ≠ MŰKÖDIK
- ❌ Gyenge assertion-nel "pass"-nak jelölni (toBeTruthy, toBeDefined)
- ❌ Üres tömb/undefined visszatérést "sikernek" tekinteni
- ❌ Smoke test kihagyása mert "a build sikeres"
- ❌ Screenshot nélkül UI modult késznek jelölni
- ❌ Retry loop kihagyása (quickfix a hibán → hamis "pass")
- ❌ Több modul egyszerre implementálása verifikáció nélkül
- ❌ Orchestrator maga ír kódot (sub-agent feladata!)
- ❌ Sub-agent eredményét review nélkül elfogadni ("a sub-agent mondta hogy kész")
- ❌ Sikertelen sub-agent kontextusát újra felhasználni (tiszta sub-agent kell!)


