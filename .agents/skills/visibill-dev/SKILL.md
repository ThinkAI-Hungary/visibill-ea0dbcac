---
name: visibill-dev
description: Lightweight TDD + spec-driven development workflow for general Visibill/eaisybill tasks — NOT simple 1-2 file tweaks (those the spec-lookup handles) and NOT complex new features (those the feature-planner handles). Use for bug fixes, behavior changes, small enhancements, component improvements, or any 2-5 file modifications where the pattern is known but discipline matters. Triggers on "javítsd", "fix", "csináld meg", "implementáld", "oldj meg", "módosítsd", "változtasd meg", "add hozzá", "vezess be", "fejleszd", "tedd lehetővé", "egészítsd ki", or general feature requests on the Visibill/eaisybill codebase that the agent determines are medium complexity. Also triggers on "tdd", "test-driven", "spec-driven", "teszteld", "verifikálj", "ellenőrizd" in the context of implementing Visibill features. Triggers on project names: "visibill", "eaisybill", "eaisybill-prod", "vsweb".
---

# Visibill Dev — Spec-First, Test-Driven Development (Lite)

> **Ez a skill az általános fejlesztési munkamenetet strukturálja.**  
> Komplexebb esetekre (új modul, architektúra döntés, 5+ fájl) → `visibill-feature-planner`.  
> DB érintettségnél → `visibill-db-checklist` is kötelező.

---

## Workflow — 5 lépés

```
SPEC → BASELINE → IMPLEMENT → VERIFY → GATE → DOCS
  ↓        ↓           ↓          ↓        ↓      ↓
Lépés 1  Lépés 2    Lépés 3   Lépés 4  Lépés 5  (visibill-doc-sync)
```

---

## LÉPÉS 1: Spec & Pattern Lookup (NE kódolj!)

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

### 1.3 Pattern ellenőrzés — kötelező átfutni

| Érintett elem | Kérdés | Meglévő pattern |
|---|---|---|
| Hook | `useXxxData(companyId)` → React Query? | Nézd meg: `src/hooks/useInvoices.ts` |
| Lista UI | DataTable + szűrő bar? | Nézd meg: `src/pages/InvoicesPage.tsx` |
| Dialog | Sheet (széles) vs Dialog (megerősítés)? | `docs/design/12-dialogs-modals.md` |
| Toast | `toast({ title, description })` pattern? | Bármely mutation hook |
| Error handling | Error Boundary + toast? | `docs/design/09-error-handling-feedback.md` |
| State | URL state (szűrők) vs React Query vs Context? | `docs/design/06-state-management.md` |
| DB | RLS policy szükséges? | `visibill-db-checklist` skill KÖTELEZŐ |

### 1.4 DB érintettség → db-checklist betöltés

> Ha a feladat bármilyen DB műveletet érint (migration, RPC, RLS, Edge Function query, frontend Supabase query):  
> **KÖTELEZŐ beolvasni a `visibill-db-checklist` skillt!**
> ```
> view_file C:\Users\Morfi\.gemini\config\skills\visibill-db-checklist\SKILL.md
> ```

### 1.5 Összefoglaló a usernek (jóváhagyás előtt)

```markdown
## 📋 Terv

**Amit megértettem:** [kérés 1 mondatban]

**Érintett fájlok:**
- `src/xxx/Yyy.tsx` — [mit módosítunk]
- `src/hooks/useZzz.ts` — [mit módosítunk]

**Követett pattern:** [melyik meglévő pattern-t követjük]

**Spec forrás:** [P-xxx / A-xxx / design/xx — vagy: nincs spec, de az xyz pattern alapján]

**Nyitott kérdések:** [ha van döntési pont → kérd a usert MIELŐTT implementálsz]

**DB érintett:** igen / nem → [ha igen: db-checklist lefut]
```

> ⚠️ **Ha van döntési pont → STOP. Kérd a user döntését MIELŐTT kódolsz.**

---

## LÉPÉS 2: Build Baseline

```bash
npm run build
```

**Ha HIBÁS:** Javítsd a MEGLÉVŐ hibákat először. Ne adj hozzá újakat.  
**Ha SIKERES:** Jegyezd meg (`git stash` vagy HEAD commit) → implementálhatsz.

> **Az AI NEM kezd kódolni amíg a baseline build nem SIKERES.**

---

## LÉPÉS 3: Implementáció

### Kódolási szabályok

- **Pattern-first:** A doc-okban talált pattern-t kövesd. Ha el kell térni → kérd a user jóváhagyását.
- **Atomic commits:** Logikailag összetartozó változások egy commit-ban.
- **No silent decisions:** Ha implementáció közben döntési pont derül ki → STOP → kérd a usert.
- **TypeScript szigor:** Minden típus explicit. Nincs `any` hacsak nem elkerülhetetlen.
- **Skálázhatóság:** Nincs N+1, kliens-oldali szűrés nagy adathalmazon, felesleges re-render.

### DB/EF változásnál extra szabályok

> DB módosításnál a `visibill-db-checklist` előírásai kötelezők (SECURITY DEFINER, RLS, index, stb.)

---

## LÉPÉS 4: Verify (minden esetben KÖTELEZŐ)

### 4.1 Build verify

```bash
npm run build
```

→ Ha HIBÁS: javítsd az összes hibát → futtasd újra → ismételd amíg SIKERES.  
→ **Az AI NEM jelzi a usernek "kész"-t amíg a build nem SIKERES.**

### 4.2 Smoke test — típus szerint

| Érintett modul | Smoke test | Evidence |
|---|---|---|
| **React UI (hook/component/page)** | Browser subagent → screenshot | Az elem renderelődik, tényleges adat látszik (NEM skeleton/loading) |
| **Edge Function** | `curl` vagy `supabase functions invoke` | 200 + valid JSON body |
| **DB migration / RPC** | `execute_sql` | Tábla/oszlop/index létezik, RLS aktív |
| **Auth flow** | Browser subagent → teljes flow | Login/redirect/token kezelés helyes |
| **Trigger/cron** | `INSERT + SELECT` verify | Trigger side-effect ellenőrzés |

### 4.3 False positive tiltólista

```
❌ Hook undefined/üres tömböt returnál mikor van DB adat
❌ Edge Function 200-at ad de body üres ({})
❌ Build SIKERES de runtime error van a konzolban
❌ "Nincs console error" → lehet silent failure
❌ Üres tömböt / skeletont "sikernek" tekinteni
❌ "A build sikeres, tehát működik" → BUILD ≠ MŰKÖDIK
```

### 4.4 Browser verify (UI érintettségnél kötelező)

```
1. Browser subagent indítás
2. Login: http://localhost:5173 | balazs@thinkai.hu | Nincsapellata1'
3. Navigáció a releváns oldalra
4. Screenshot készítés
5. Konzol ellenőrzés (errors/warnings)
6. Ellenőrzés: tényleges adat jelenik meg (NEM skeleton/loading)
7. Ha interakció kell → hajtsd végre és ellenőrizd az eredményt
```

---

## LÉPÉS 5: User Gate

**STOP — Várd a user visszajelzését MIELŐTT docs-ot frissítesz.**

```markdown
## ✅ Implementáció kész — Verifikálva

**Módosított fájlok:**
- `src/xxx/Yyy.tsx` — [mit változtattunk]
- `src/hooks/useZzz.ts` — [mit változtattunk]

**Build:** ✅ SIKERES
**Smoke test:** ✅ PASS — [evidence: screenshot link / SQL output / curl response]

**Kérlek teszteld:** [mit és hogyan kell ellenőrizni a böngészőben]

Ha rendben van, frissítem a releváns dokumentációt.
```

---

## Dokumentáció Frissítés (user jóváhagyás UTÁN)

Aktiváld a `visibill-doc-sync` skillt:

```
view_file d:\ThinkAI\Visibill\eaisybill-prod\.agents\skills\visibill-doc-sync\SKILL.md
```

**Gyors döntési fa:**

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
- Több sub-rendszer érintett (pl. frontend + edge function + worker + DB egyszerre)
- A spec lookup során kiderül hogy nincs dokumentált döntés az adott területre

---

## Tiltott viselkedés

```
❌ Kódolás spec lookup előtt
❌ "A build sikeres, tehát működik"
❌ Smoke test kihagyása
❌ Browser screenshot nélküli UI modul késznek jelölése
❌ Döntési pont silent megoldása (kérdezz!)
❌ "Kész" jelzés a user gate előtt
❌ Docs frissítés user validáció előtt
❌ N+1 query vagy kliens-oldali szűrés nagy adathalmazon
```
