---
name: visibill-feature-planner
description: Use when planning a COMPLEX new feature, module, or significant architectural change in Visibill/eaisybill/eaisyBooks — NOT for simple modifications. Triggers on "új feature", "új modul", "tervezzünk", "feature plan", "modul tervezés", "építsünk", "hozzunk létre", "fejlesszünk ki", "plan new", "design new", "add module", "milyen döntéseket kell meghozni", "mit kell eldönteni", "decision list", "döntési mátrix", "eaisybooks", "accounty". Also triggers when visibill-spec-lookup determines the task is complex (3+ files, new functionality, architecture decision). This skill ensures ZERO silent decisions, implements automated Spec Reviewer auditing, Parallel Subagent Swarm execution, and Maker-Checker verification loops.
---

# Visibill Feature Planner — Zero Silent Decisions & Subagent Swarm

## Filozófia

> **1. Az AI asszisztens SOHA nem hoz technikai döntéseket egyedül.**  
> Minden döntést — legyen az UI pattern, adatmodell, API design, vagy edge function struktúra — explicit módon a felhasználó elé kell tárni jóváhagyásra.  
> **"Silent decision" = a legrosszabb dolog ami történhet.** Ha az AI választ A és B között anélkül hogy kérdezne → az a rendszer hibája.

> **2. Skálázhatóság és maximális optimalizáltság.**  
> A Visibill/eaisybill több ezer aktív ügyfél kiszolgálására készül. Ezért a skálázhatóság, az RLS multi-tenancy védelem, az indexelés és a lekérdezések optimális futási ideje kritikus fontosságú.

> **3. Subagent Swarm & Maker–Checker architektúra.**  
> A tervezés és a kódolás elválik a minőségbiztosítástól. A kódoló soha nem ellenőrzi egyedül a saját kódját: a tervet **Spec Reviewer Subagent**, a megírt kódot pedig független **Verifier Subagent (Checker)** auditálja, míg a független feladatok **Párhuzamos Subagent Swarmban** futnak.

## Előfeltétel

> **A `visibill-spec-lookup` skill MINDIG lefut előtte!**  
> Mire ez a skill aktiválódik, a releváns spec-ek már be vannak olvasva.

---

## Teljes Feature Életciklus

```
TERVEZÉS ──► DÖNTÉSEK ──► SPEC REVIEWER ──► DEKOMP. ──► PARALLEL SWARM & MAKER-CHECKER ──► INTEGR. VERIFY ──► USER GATE ──► DOCS ──► GRAPHIFY
   ↓            ↓              ↓              ↓                     ↓                         ↓              ↓          ↓        ↓
 Fázis 1     Fázis 2       Fázis 2.1      Fázis 2.5             Fázis 2.6 & 3              Fázis 3.7      Fázis 3.7.4  Fázis 4  Fázis 5
(kontextus)  (mátrix)    (terv-audit)    (micro-mod)       (párhuzamos kódolás & checker)   (e2e smoke)    (user valid) (BRD/..) (gráf)
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
* **Izolált munkakörnyezet:** Ha a feladat nagy volumenű, komplex, vagy külön ágon fog futni:
  * Olvasd be a `using-git-worktrees` skillt (`view_file C:\Users\Morfi\.gemini\config\skills\using-git-worktrees\SKILL.md`).
  * Kérj megerősítést a felhasználótól izolált worktree létrehozásához.

**ASSUMPTIONS I'M MAKING** (rögzítsd mielőtt bármit tervezel):
```
ASSUMPTIONS I'M MAKING:
1. [Feltételezés — pl. auth Supabase-alapú marad]
2. [Feltételezés — pl. ez az eaisybill-prod, nem a worker]
3. [Feltételezés — pl. csak owner lát majd új adatot]
→ Jelezz ha bármelyik téves, mielőtt tervezek.
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
Ha a user olyan fogalmat használ, ami eltér a meglévő PRD/ADR terminológiájától → **azonnal flag-eld**:
| Vague/ütköző | Pontos Visibill fogalom | Hol definiált |
|---|---|---|
| "számla" | invoice (bejövő) vs. outbound_invoice (kimenő) | P-010, P-012 |
| "partner" / "ügyfél" | company (cég entitás) | A-003 |
| "könyvelő" | accountant (eaisyBooks) vs. admin (eaisybill) | A-009 |
| "belép" | login (auth) vs. join-company (céghez csatlakozás) | A-009 |
| "email megerősítés" | verify-email (custom) vs. email_confirmed_at (Supabase natív) | A-021 |

### 1.4 KÖTELEZŐ: Design Pattern Kontextus Betöltése
Ha a funkció új felületi elemet (dialógus, táblázat, modal, gomb, badge, skeleton) vezet be vagy módosít, az AI **KÖTELES** a tervezési szakaszban áttanulmányozni a megfelelő `docs/design/` dokumentációt!

#### Mindig olvasandó:
| Dokumentum | Tartalom |
|---|---|
| `docs/design/00-overview.md` | Design filozófia, vizuális elvek |
| `docs/design/01-tech-stack.md` | Provider stack, projekt struktúra |
| `docs/design/05-layout-navigation.md` | Sidebar, scoped routing, app shell |
| `docs/design/06-state-management.md` | Context-ek, React Query, URL state |
| `docs/design/12-dialogs-modals.md` | Async Modal UX (API → await refetch → close → toast) |

### 1.4b KÖTELEZŐ: Vercel React Best Practices & Composition Minták Betöltése
Ha a tervezett funkció bármilyen React frontend kódot érint (komponensek, oldalak, hookok, állapotkezelés, modálok):
- **KÖTELEZŐ beolvasni a `vercel-react-best-practices` skillt:**  
  `view_file C:\Users\Morfi\.gemini\config\skills\react-best-practices\SKILL.md`
- **KÖTELEZŐ beolvasni a `vercel-composition-patterns` skillt:**  
  `view_file C:\Users\Morfi\.gemini\config\skills\composition-patterns\SKILL.md`
- Ennek mentén tervezendő a renderelési teljesítmény (felesleges re-renderek kizárása, memoizáció, stabil hook dependencyk) és a tiszta kompozíció (anti-boolean prop explosion, explicit variánsok, compound components).

---

## FÁZIS 2: Döntési Mátrix

Készíts egy **teljes döntési mátrixot** — minden döntéspontot listázz ki.

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

### 🔐 Biztonság (STRIDE)
| # | Kérdés | Opciók | Meglévő pattern | Ajánlás |
|---|--------|--------|-----------------|---------| 
| D-7 | Ki férhet hozzá? | a) Mindenki b) Owner c) Admin+ | ADR A-009 | ... |
```

---

## FÁZIS 2.1: Spec Reviewer Subagent (Terv-Auditáló Swarm)

> 🤖 **KÖTELEZŐ LÉPÉS a user jóváhagyás kérése ELŐTT!**  
> Mielőtt a Fő Agens a felhasználó elé tárná a Döntési Mátrixot és a tervet, **köteles elindítani egy Spec Reviewer Subagentet egy tiszta kontextusban**.

### 2.1.1 Spec Reviewer Mandátum
A Spec Reviewer feladata, hogy független, kritikus szemmel átvizsgálja a Fő Agens által készített tervet az alábbi 6 dimenzióban:

1. **ADR & Architektúra Konzisztencia:**
   - Nem sérti-e meg az A-003 (Multi-tenancy `company_id` RLS), A-009 (RBAC szerepkörök), A-005 (Edge Functions) előírásait?
2. **Zero Silent Decisions ellenőrzés:**
   - Nincs-e a tervben elrejtve olyan technikai vagy üzleti feltételezés, amit valójában a felhasználónak kell eldöntenie?
3. **Skálázhatóság & Adatbázis kockázatok:**
   - Hiányzó indexek az idegen kulcsokon?
   - N+1 query kockázat vagy kliens-oldali szűrés nagy adathalmazon?
4. **Biztonság & Multi-tenancy (STRIDE check):**
   - Garantált-e, hogy egyetlen cég adata sem szivároghat át egy másikhoz?
5. **Vercel React & Composition Minőség:**
   - Nincs-e re-render kockázat vagy felesleges state duplikáció?
   - Tiszta kompozíciós mintákat követ-e a komponenshierarchia (anti-boolean prop explosion)?
6. **Dekompozíciós megfelelőség:**
   - Elég atomiak-e a micro-modulok? Van-e egy lépésben túl sok fájl?

### 2.1.2 Spec Reviewer Integráció
A Fő Agens megvárja a Spec Reviewer visszajelzését, beépíti a javasolt javításokat a tervbe, és **csak a már auditált, letisztult döntési mátrixot tárja a felhasználó elé**.

---

## FÁZIS 2.5: Micro-Module Dekomponálás

A teljes implementációs tervet **atomikus micro-modulokra** bontjuk.

**Standard méretosztályok:**
| Méret | Fájlok | Leírás | Példa |
|---|---|---|---|
| **XS** | 1 | Egyetlen függvény, config változás | RLS policy hozzáadás |
| **S** | 1-2 | Egy hook vagy endpoint | `useRegisters.ts` + types |
| **M** | 3-5 | Egy feature slice | Hook + component + page szekció |
| **L** | 5-8 | Multi-component feature | Teljes oldal új layouttal |
| **XL** | 8+ | **TÚL NAGY — bontsd tovább!** | — |

> **And rule:** Ha az „és" szerepel a modul nevében → szedd szét két modulra!

---

## FÁZIS 2.6: Dependency Graph & Párhuzamos Subagent Swarm

> ⚡ **A sebesség és a kontextus-tisztaság kulcsa.**

A Fő Agens elemzi a micro-modulok közötti függőségi fát:
1. **Szekvenciális láncok:** Amik szigorúan egymásra épülnek (pl. `DB Migration` → `Hook`). Ezek egymás után futnak.
2. **Független modulok (Parallel Tracks):** Amik nem függenek egymástól (pl. független UI komponensek, helper függvények, típusdefiníciók, mock adatok).

### Párhuzamos Indítás Szabálya:
Az Orchestrator az egymástól független micro-modulok implementálására **egyazon turn-ben elindítja a párhuzamos Subagent Swarmot**. Minden worker subagent külön, tiszta kontextusban dolgozik a saját fájljain.

---

## FÁZIS 3: Implementáció — Maker–Checker Sub-Agent Loop

> 🛡️ **A kódoló soha nem minősíti késznek a saját munkáját.**  
> Minden modul megvalósításakor érvényesül a **Maker–Checker** elv.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   MAKER–CHECKER MODUL VÉGREHAJTÁSI CIKLUS                │
│                                                                          │
│  1. BRIEF ──────► Fő Agens részletes briefet ad a MAKER Subagentnek     │
│  2. MAKER ──────► Kódoló Subagent megírja a kódot + npm run build check  │
│  3. CHECKER ────► Fő Agens indít egy független VERIFIER Subagentet       │
│                   (SQL teszt, browser screenshot, konzol hiba audit)    │
│  4. VERDICT ────► • Ha FAIL: Git rollback + Enhanced Brief új Makernek  │
│                   • Ha PASS: Evidence rögzítés task.md-be               │
│  5. NEXT ───────► Továbblépés a következő szekvenciális/párhuzamos láncra│
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Sub-Agent Brief Sablon (Maker felé)

```markdown
## Sub-Agent Brief — Module [N]: [Modul neve]
### Cél
[1 mondat — mit kell implementálni]
### Kontextus & Függőségek
- Feature: [feature neve] | Előző modulok: [kész fájlok]
### Módosítandó fájlok
- [pontos fájl elérési utak]
### Meglévő pattern-ek (KÖTELEZŐ követni)
- [hivatkozott design és hook pattern-ek]
- **React Frontend moduloknál KÖTELEZŐ betölteni & követni:**
  - `vercel-react-best-practices` (`view_file C:\Users\Morfi\.gemini\config\skills\react-best-practices\SKILL.md`)
  - `vercel-composition-patterns` (`view_file C:\Users\Morfi\.gemini\config\skills\composition-patterns\SKILL.md`)
  - *Anti-Boolean Prop szabály:* Kerüld a sok boolean flaget, használj compound kompozíciót vagy explicit variánsokat.
  - *Render Teljesítmény:* Memoizáld a callbackeket (`useCallback`), izoláld a gyorsan változó állapotokat.
### Verifikációs szerződés
- BUILD: `npm run build` → SIKERES
- SMOKE: [specifikus elvárás amit a Checker ellenőrizni fog]
```

### 3.2 Verifier Subagent (Checker) Szerepe és Tesztmátrix

A Checker független kontextusban fut, és az alábbi objektív bizonyítékokat gyűjti:

| Modul típus | Checker Kötelező Ellenőrzése | Siker Feltétel (PASS) |
|---|---|---|
| **DB / Migration** | `execute_sql` lekérdezések futtatása | Tábla/oszlop létezik, index aktív, RLS tiltja az idegen `company_id`-t |
| **RPC / Edge Function** | `curl` vagy `supabase functions invoke` | 200 státusz + NEM üres, valid JSON válasz |
| **React Hook** | Browser / Node környezet ellenőrzés | Hook nem `undefined`/üres tömböt ad, ha van adat az adatbázisban; stabil dependencyk (nincs loop) |
| **UI Komponens / Oldal** | **Browser Subagent** (`http://localhost:5173`) + Kód Ellenőrzés | **Screenshot készül:** az elem tényleges adattal renderelődik (nem skeleton), 0 db console error, nincs felesleges re-render vagy boolean prop proliferáció |

### 3.3 Retry Loop — Új Sub-Agent Tanulságokkal

Ha a Checker hibát talál:
1. **Rollback:** `git checkout` az adott modul fájljaira.
2. **Analyze & Learn:** Hiba rögzítése a `task.md`-ben.
3. **Enhanced Brief:** Új Maker brief összeállítása a korábbi hiba explicit megnevezésével (*"Attempt 1 hiba: ... NE ismételd!"*).
4. **Új Maker Subagent indítása:** Friss kontextussal, maximum 5 próbálkozásig.

### 3.4 False Positive Tiltólista

```
❌ Hook undefined/üres tömböt returnál mikor van DB adat
❌ Edge Function 200-at ad de a body üres ({})
❌ UI renderelődik de nincs benne adat (skeleton stuck)
❌ Teszt PASS gyenge assertion-nel (toBeTruthy, toBeDefined)
❌ Build SIKERES de runtime error van a böngésző konzolban
❌ "A build sikeres, tehát működik" → BUILD ≠ MŰKÖDIK
```

---

## FÁZIS 3.7: Integration Verify (Minden modul ✅ után)

1. **Teljes Build:** `npm run build`
2. **End-to-End Smoke Test:** Browser Subagenttel a teljes user flow végigkattintása, képernyőmentések rögzítése.
3. **Regressziós Gyors-Check:** Dashboard, Számlák oldal és Navigáció épségének ellenőrzése.
4. **User Gate:** Az AI megáll és bemutatja az összegyűjtött bizonyítékokat (screenshotok, logok). **Nem lép tovább a dokumentáció frissítésére, amíg a felhasználó jóvá nem hagyta.**

---

## FÁZIS 4: Dokumentáció Frissítés (User validáció UTÁN)

A felhasználói jóváhagyás után automatikusan frissítendő:
- **BRD / PRD:** `docs/business/decisions/` és `docs/product/decisions/`
- **ADR:** `docs/architecture/decisions/A-XXX-*.md` (új technikai döntés esetén)
- **Design Docs:** `docs/design/` (új komponensek, route-ok, state minták esetén)
- **DB Séma:** `database-schema.md` (ha migráció futott le — `npm run gen-db-docs`)

---

## FÁZIS 5: Graphify Update

```bash
graphify update .
```

---

## ⚠️ Végső Minőségi Szabályok

1. **Zero Silent Decisions:** Minden elágazásnál a felhasználó dönt.
2. **Tervet mindig a Spec Reviewer auditál** a user elé tárás előtt.
3. **Független modulok Párhuzamos Subagent Swarmban futnak.**
4. **Kódot mindig független Checker Subagent ellenőriz** konkrét bizonyítékokkal (screenshot / SQL log).
5. **BUILD ≠ MŰKÖDIK:** Bizonyíték nélkül nincs kész feladat!
