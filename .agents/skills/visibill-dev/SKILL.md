---
name: visibill-dev
description: Primary development workflow skill for coding, implementing features, fixing bugs, and writing tests in Visibill/eaisybill-prod. Use this workflow for general programming, styling, and script tasks of medium complexity (2-5 files). Triggers on "javíts", "fix", "bug", "hiba", "fejleszt", "implementál", "kódol", "módosít", "szépít", "refaktor", "teszt", "tdd", "dev", "visibill-dev" and any request to modify code in eaisybill-prod, vsweb, or worker codebases. Enforces Zero Silent Decisions and mandatory Pre-Gate Quality Auditor Subagent verification.
---

# Visibill Dev — Spec-First, Test-Driven Development (Lite)

## 📌 Filozófia: Zero Silent Decisions & Quality Auditor Subagent
> **1. Az AI asszisztens SOHA nem hoz technikai, logikai vagy vizuális döntéseket egyedül.**  
> Ha a fejlesztés során bármilyen ponton elágazó logika, nem egyértelmű igény, vagy alternatív megoldási lehetőség merül fel:
> * **STOP!** Az Agent köteles megállni, felvázolni a döntési pontot, és megvárni a felhasználó kifejezett jóváhagyását.
> * **Silent decision = Hiba.** Bármilyen csendben meghozott önálló döntés a szabályzat megsértésének minősül.

> **2. Független Pre-Gate Quality Auditor Subagent.**  
> A kódoló ágens soha nem auditálja egyedül a saját kódját. A kódolás befejezése után kötelező egy független **Quality Auditor Subagent** indítása egy tiszta kontextusban, ami átvilágítja a `git diff`-et, lefuttatja a smoke teszteket és screenshotot készít a böngészőben.

> **Ez a skill az általános fejlesztési munkamenetet strukturálja (1-5 fájl).**  
> Komplexebb esetekre (új modul, architektúra döntés, 5+ fájl) → `visibill-feature-planner`.  
> DB érintettségnél → `visibill-db-checklist` is kötelező.

---

## Workflow — 5 lépés

```
SPEC → BASELINE → IMPLEMENT → QUALITY AUDITOR SUBAGENT → GATE → DOCS
  ↓        ↓           ↓                 ↓                 ↓      ↓
Lépés 1  Lépés 2    Lépés 3           Lépés 4           Lépés 5  (visibill-doc-sync)
```

---

## LÉPÉS 1: Spec & Pattern Lookup (NE kódolj!)

### 1.0 Hypothesis — confidence check (ELSŐ lépés, spec lookup ELŐTT)

Mielőtt bármit keresnél, rögzítsd a jelenlegi megértésedet:

```
HYPOTHESIS: [1 mondatban mit értettél meg a kérésből]
CONFIDENCE: ~X% — hiányzik: [mi nem tiszta még]
```

> Ha confidence < 70% → ne indíts spec lookup-ot. Tegyél fel egy kérdést a usernek MIELŐTT.  
> Ha confidence ≥ 70% → folytasd az 1.1-gyel.

### 1.1 Kérés értelmezése

```markdown
## 🎯 Mit értünk meg
**Kérés:** [1 mondatban]
**Érintett terület:** [auth / számlák / tranzakciók / dashboard / beállítások / stb.]
**Várható fájlok:** [becsült lista]
**Komplexitás:** [egyszerű / közepes / komplex → ha komplex → feature-planner!]
```

### 1.2 Spec keresés (kötelező sorrend)

```
1. docs/ → ADR / PRD / design docs   ← MINDIG ELŐSZÖR
2. graphify query "<kulcsszavak>"     ← Ha a graphify elérhető
3. grep / view_file a kódban         ← Csak ha docs nem elég
```

**Mire keresünk:**
- Van-e meglévő PRD/ADR ami lefedi a területet?
- Mi a jelenlegi implementált viselkedés (spec ↔ kód eltérés)?
- Milyen design pattern-t kell követni?

### 1.2a Terminológia konzisztencia ellenőrzés

Ha a user olyan fogalmat használ, ami eltér a meglévő PRD/ADR terminológiájától → **azonnal flag-eld, mielőtt bármit implementálsz:**

```
"A PRD-ben 'partner'-nek hívjuk ezt, de te 'ügyfél'-t mondasz — melyiket értjük?"
"Az A-009-ben 'company_members' a cégtagság, de te 'team members'-t mondasz — ugyanaz?"
```

**Ismert ütközési pontok:**

| Vague / ütköző | Pontos Visibill fogalom | Hol definiált |
|---|---|---|
| "számla" | `invoice` (bejövő) vs. `outbound_invoice` (kimenő) | P-010, P-012 |
| "partner" / "ügyfél" | `company` (cég entitás) | A-003 |
| "könyvelő" | `accountant` (eaisyBooks) vs. `admin` (eaisybill) | A-009 |
| "belép" | `login` (auth) vs. `join-company` (céghez csatlakozás) | A-009 |
| "email megerősítés" | `verify-email` (custom token) vs. `email_confirmed_at` (Supabase natív) | A-021 |

### 1.2b Kód konzisztencia cross-check

Ha a user leírja hogyan működik valami → **ellenőrizd a kódban** mielőtt arra alapozod az implementációt:

```
1. grep / view_file az érintett fájlon
2. Ha a kód MÁST csinál mint amit a user mond → surface it:
   "A kód jelenleg X-et csinál, de te Y-t szeretnél — melyik a helyes kiindulópont?"
3. Ha spec ↔ kód eltérés van → tisztázd ELŐSZÖR, csak aztán implementálj
```

### 1.4 DB érintettség → db-checklist betöltés
> Ha a feladat bármilyen DB műveletet érint (migration, RPC, RLS, Edge Function query, frontend Supabase query):  
> **KÖTELEZŐ beolvasni a `visibill-db-checklist` skillt!**

### 1.4b React frontend érintettség → vercel-react-best-practices & composition-patterns betöltés
> Ha a feladat bármilyen React kód módosításával jár (komponens, hook, modal, oldal):  
> - **KÖTELEZŐ beolvasni:** `view_file C:\Users\Morfi\.gemini\config\skills\react-best-practices\SKILL.md`
> - **KÖTELEZŐ beolvasni:** `view_file C:\Users\Morfi\.gemini\config\skills\composition-patterns\SKILL.md`
> - *Szabály:* Minimalizáld a re-rendereket (useCallback/useMemo), kövess tiszta kompozíciót (anti-boolean prop explosion).

### 1.4c KÖTELEZŐ: Design Pattern Kontextus Betöltése
> [!IMPORTANT]
> **UI ELEM GENERÁLÁS / MÓDOSÍTÁS KORLÁTOZÁS:**
> Ha a fejlesztés új felületi elemet (dialógus, táblázat, modal, gomb, badge, input, skeleton) vezet be vagy módosít, az Agent **KÖTELES** a tervezési és implementációs szakasz megkezdése előtt áttanulmányozni a megfelelő `docs/design/` dokumentációt!

**Kritikus szabályok:**
- **Badge:** Informatív címke, SOHA nincs `hover:bg-*` vagy `transition-colors`.
- **Button outline hover:** `hover:bg-accent/50` (semleges). Szín override-nál MINDIG kell explicit `hover:text-*`.
- **Dark mode:** Minden új elem KELL hogy működjön dark mode-ban.
- **Design tokenek:** CSS változókat használj (`text-primary`, `bg-destructive/10`), ne hard-coded értékeket.
- **⚡ Async Modal UX — KÖTELEZŐ:** Minden dialog/modal esetén a sorrend: `API hívás → await refetch/invalidate → modal zár → toast`. Loading alatt kizárólag `Loader2` spinner.

### 1.5 Összefoglaló a usernek (jóváhagyás előtt)

```markdown
## 📋 Terv

**Amit megértettem:** [kérés 1 mondatban]

**Érintett fájlok:**
- `src/xxx/Yyy.tsx` — [mit módosítunk]
- `src/hooks/useZzz.ts` — [mit módosítunk]

**Követett pattern:** [melyik meglévő pattern-t követjük]
**Spec forrás:** [P-xxx / A-xxx / design/xx]
**Nyitott kérdések:** [ha van döntési pont → kérd a usert MIELŐTT implementálsz]
**DB érintett:** igen / nem
**OUT OF SCOPE:** [mi NEM változik — explicit felsorolás]
```

---

## LÉPÉS 2: Build Baseline

```bash
npm run build
```

**Ha HIBÁS:** Javítsd a MEGLÉVŐ hibákat először. Ne adj hozzá újakat.  
**Ha SIKERES:** Jegyezd meg (`git stash` vagy HEAD commit) → implementálhatsz.

---

## LÉPÉS 3: Implementáció

### 3.0 Scope Discipline
- Csak azt a kódot érintsd, amit a feladat megkövetel.
- Kerüld a túlbonyolított absztrakciókat.

### 3.1 Bug fix esetén: Prove-It Pattern (kötelező)
```
1. Írj failing testet ami reprodukálja a bug-ot (FAIL = bug megerősített)
2. Implementáld a fix-et
3. A teszt PASS = fix igazolt, regression guard kész
4. Teljes test suite = nincs regresszió
```

### 3.2 Kódolási szabályok
- **Pattern-first:** A meglévő mintákat kövesd.
- **No silent decisions:** Ha döntési pont merül fel → STOP → kérdezz!
- **TypeScript szigor:** Minden típus explicit, nincs `any`.

---

## LÉPÉS 4: Pre-Gate Quality Auditor Subagent (KÖTELEZŐ)

> 🤖 **Minden implementáció / bugfix után a Fő Agens elindít egy független Quality Auditor Subagentet egy tiszta kontextusban!**  
> A kódoló ágens soha nem auditálja egyedül a saját kódját. A Subagent tiszta szemmel, függetlenül vizsgálja át a változtatásokat és futtatja a teszteket.

### 4.0 Quality Auditor Subagent Mandátum & Checklist

A Quality Auditor Subagent az alábbi 4 ellenőrzést végzi el önállóan:

```
✅ QUALITY AUDITOR SUBAGENT CHECKLIST:

1. Git Diff & Code Hygiene Review (`git diff HEAD`):
   □ Nincs ottfelejtett console.log, print, ideiglenes debug kód?
   □ Nincs nem használt import (unused import) vagy változó?
   □ Nincs tiltott any típus a TypeScriptben?
   □ Nincs kikommentelt kódrészlet?
   □ Követi-e a docs/design/ tokeneket (színek, dark mode kompatibilitás)?

2. Build Verifikáció:
   □ npm run build → SIKERES (0 error)

3. Funkcionális & Smoke Verifikáció (Típus szerint):
   □ UI felületek: Browser Subagent indítása (http://localhost:5173) →
     valós screenshot készül + konzol hiba audit (0 console error).
   □ Adatbázis / RPC: execute_sql lekérdezések futtatása (RLS, index, multi-tenancy).
   □ Edge Functions: curl / supabase invoke valid JSON válasz.
   □ Bugfix: Prove-It teszt PASS (korábbi failing teszt zöld).

4. Five-Axis Minőségi Audit:
   □ Correctness (spec-et lefedi, edge case-ek kezelve)
   □ Readability (tiszta elnevezések, érthető kód)
   □ Architecture & Composition (nincs boolean prop proliferáció, tiszta kompozíció)
   □ Security (RLS aktív, input validáció)
   □ Performance & Rendering (nincs N+1, nincs felesleges re-render, stabil hook dependencyk)
```

### 4.1 Subagent Verdikt & Hiba Visszacsatolás

- ❌ **Ha a Quality Auditor FAIL-t ad:**
  - A Subagent egy strukturált hibalistát ad vissza a Fő Agensnek (*"Audit sikertelen: 1. Console warning található az oldalon; 2. Hiányzó dark mode szín override a Gombon"*).
  - A Fő Agens kijavítja a hibákat, majd újraindítja az auditot.
- ✅ **Ha a Quality Auditor PASS-t ad:**
  - A Subagent átadja az összegyűjtött objektív bizonyítékokat (evidence linkek: screenshotok, SQL eredmények, teszt kimenetek).
  - A folyamat továbblép a User Gate-hez (Lépés 5).

### 4.2 False Positive Tiltólista

```
❌ Hook undefined/üres tömböt returnál mikor van DB adat
❌ Edge Function 200-at ad de body üres ({})
❌ UI renderelődik de nincs benne adat (skeleton stuck)
❌ Teszt PASS gyenge assertion-nel (toBeTruthy, toBeDefined)
❌ Build SIKERES de runtime error van a böngésző konzolban
❌ "A build sikeres, tehát működik" → BUILD ≠ MŰKÖDIK
```

---

## LÉPÉS 5: User Gate

**STOP — Várd a user visszajelzését MIELŐTT docs-ot frissítesz.**

```markdown
## ✅ Implementáció kész — Quality Auditor Subagent által Verifikálva

**Build:** ✅ SIKERES
**Smoke test & Audit:** ✅ PASS — [evidence: screenshot link / SQL output / curl response]

### CHANGES MADE:
- `src/xxx/Yyy.tsx` — [mit változtattunk és miért]
- `src/hooks/useZzz.ts` — [mit változtattunk és miért]

### THINGS I DIDN'T TOUCH (intentionally):
- `src/yyy/Zzz.tsx` — [miért scope-on kívül]

### POTENTIAL CONCERNS:
- [kockázat vagy mellékhatás amire figyelni kell]

**Kérlek teszteld:** [mit és hogyan kell ellenőrizni a böngészőben]

Ha rendben van, frissítem a releváns dokumentációt.
```

---

## LÉPÉS 6: Dokumentáció Frissítés (user jóváhagyás UTÁN)

Aktiváld a `visibill-doc-sync` skillt:
```
view_file d:\ThinkAI\Visibill\eaisybill-prod\.agents\skills\visibill-doc-sync\SKILL.md
```

| Változott | Frissítendő |
|---|---|
| Edge Function viselkedés | `A-005-edge-functions.md` |
| Auth flow / session | `frontend-auth-onboarding.md` + ADR |
| DB tábla / RPC / RLS | Kapcsolódó ADR + `A-016` |
| Új route | `information-architecture.md` |
| UI pattern változás | Releváns `docs/design/XX-*.md` |
| Technikai döntés | Új ADR (A-XXX) |

---

## Mikor válts feature-planner-re?

Ha bármelyik teljesül → **STOP, töltsd be a `visibill-feature-planner` skillt:**
- 5+ fájl érintett
- Új DB tábla vagy teljesen új Edge Function szükséges
- Architektúra döntés szükséges (ahol nincs meglévő pattern)
- Több sub-rendszer érintett egyszerre

---

## Tiltott viselkedés

```
❌ Kódolás spec lookup előtt
❌ "A build sikeres, tehát működik"
❌ Quality Auditor Subagent kihagyása
❌ Browser screenshot nélküli UI modul késznek jelölése
❌ Döntési pont silent megoldása (kérdezz!)
❌ "Kész" jelzés a user gate előtt
❌ Docs frissítés user validáció előtt
❌ Bug fix reprodukáló teszt (Prove-It Pattern) NÉLKÜL
```
