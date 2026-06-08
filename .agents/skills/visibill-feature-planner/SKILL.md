---
name: visibill-feature-planner
description: Use when planning a COMPLEX new feature, module, or significant architectural change in Visibill/eaisybill — NOT for simple modifications. Triggers on "új feature", "új modul", "tervezzünk", "feature plan", "modul tervezés", "építsünk", "hozzunk létre", "fejlesszünk ki", "plan new", "design new", "add module", "milyen döntéseket kell meghozni", "mit kell eldönteni", "decision list", "döntési mátrix". Also triggers when visibill-spec-lookup determines the task is complex (3+ files, new functionality, architecture decision). This skill ensures ZERO silent decisions.
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
TERVEZÉS → DÖNTÉSEK → IMPLEMENTÁCIÓ → VALIDÁCIÓ → DOCS FRISSÍTÉS → GRAPHIFY
   ↓           ↓           ↓              ↓             ↓              ↓
 Fázis 1    Fázis 2     Fázis 3       Fázis 3.5      Fázis 4       Fázis 5
(kontextus) (mátrix)   (kódolás)   (user tesztel)  (BRD/PRD/ADR)  (gráf sync)
```

---

## FÁZIS 1: Kontextus Gyűjtés (NE kódolj!)

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

### 1.3 Meglévő döntések felderítése — 4 réteg
Keresd végig mind a 4 döntési réteget (BRD, PRD, ADR, Worker docs).

### 1.4 KÖTELEZŐ: Design Pattern Kontextus Betöltése

Az AI **köteles** a meglévő design pattern-eket betölteni és követni.

#### Mindig olvasandó (minden feature-nél):
| Dokumentum | Tartalom |
|---|---|
| `docs/design/00-overview.md` | Design filozófia, vizuális elvek |
| `docs/design/01-tech-stack.md` | Provider stack, projekt struktúra |
| `docs/design/05-layout-navigation.md` | Sidebar, scoped routing, app shell |
| `docs/design/06-state-management.md` | Context-ek, React Query, URL state |

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

## FÁZIS 3: Implementáció (döntések UTÁN)

**CSAK a felhasználó jóváhagyása után.**

### 3.0 Build Baseline (implementáció ELŐTT)
```bash
npm run build
```
→ Ha a build HIBÁS: **javítsd először a meglévő hibákat** mielőtt bármit hozzáadnál.
→ Ha a build SIKERES: jegyezd meg mint baseline → kezdheted az implementációt.

> **Az AI NEM kezd kódolni amíg a build nem SIKERES.** Tiszta kiindulási állapot szükséges.

### Checkpoint rendszer
Komplex feature-eknél:
```
Checkpoint 1: Migration kész → user ellenőrzi a sémát
Checkpoint 2: Hook + API kész → user teszteli a data flow-t
Checkpoint 3: UI kész → user megnézi a kinézetet
```

---

## FÁZIS 3.5: Build Verify + User Validáció (implementáció UTÁN, docs ELŐTT)

### 3.5.1 Build Verify (rekurzív — user NEM lát semmit amíg nem SIKERES)

```bash
npm run build
```

**Ha a build HIBÁS:**
1. Elemezd a hibákat
2. Javítsd az összes hibát
3. Futtasd újra: `npm run build`
4. **Ismételd amíg a build SIKERES** (max 5 iteráció — ha utána sem sikerül, jelezd a usernek a maradék hibákat)

> ⚠️ **Az AI NEM jelzi a usernek hogy "kész" amíg a build nem SIKERES.**
> A build fix loop teljesen belső — a user nem látja a köztes hibákat.

### 3.5.2 User Validáció (build SIKERES után)

> **GATE:** Az AI várja a felhasználó megerősítését hogy az implementáció működik.
> **NEM lép tovább Fázis 4-re amíg a user nem validálta!**

### Workflow:
1. Az AI jelzi: „Az implementáció kész. **Build sikeres.** Kérlek teszteld / validáld."
2. A user teszteli az éles funkciót (böngészőben, API-n, stb.)
3. User visszajelez:
   - ✅ **Működik** → Az AI automatikusan elindítja a Fázis 4-et (docs frissítés)
   - ❌ **Nem működik** → Az AI javít → `npm run build` → újra Fázis 3.5

### Mit mond az AI:
```markdown
## ✅ Implementáció kész — Build sikeres ✅

**Változtatások:**
- [lista a módosított fájlokról és a változásokról]

**Kérlek teszteld:** [mit és hogyan kell tesztelni]

⚠️ Ha működik, frissítem az összes releváns dokumentációt (BRD/PRD/ADR/Design docs).
```

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
6. ✅ Az implementációs terv elfogadva

**Az AI SOHA nem jelenti késznek a feature-t amíg:**
1. ✅ `npm run build` SIKERES (Build Verify — Fázis 3.5.1)
2. ✅ A user validálta hogy az implementáció működik (Fázis 3.5.2)
3. ✅ BRD/PRD/ADR frissítve (Fázis 4)
4. ✅ EF/RPC registry frissítve ha releváns (Fázis 4.6)
5. ✅ Design docs frissítve (ha releváns)
6. ✅ Cross-referenciák hozzáadva
7. ✅ Graphify update lefutott (Fázis 5)
