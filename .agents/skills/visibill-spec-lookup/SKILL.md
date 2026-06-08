---
name: visibill-spec-lookup
description: Use for ANY task touching the Visibill/eaisybill codebase — always the first step before any code change. Triggers on project names "visibill", "eaisybill", "eaisybill-prod", "vsweb" and ANY modification verb — "módosítsd", "javítsd", "add hozzá", "változtasd meg", "hozzányúl", "implementáld", "oldd meg", "fix", "improve", "change", "modify", "update", "build", "develop", "fejleszt", "refaktoráld", "deployold", "szűrés", "szűrjük". Lightweight lookup — reads relevant specs before any work.
---

# Visibill Spec Lookup — Specification-Driven Development

> **Szabály:** Bármilyen Visibill kérés előtt — legyen az új feature vagy egyszerű módosítás — az AI KÖTELES megkeresni és beolvasni a releváns dokumentációt.

## Mikor aktiválódik

- Bármilyen kód módosítás a Visibill/eaisybill workspace-ben
- Bármilyen kérdés a meglévő funkcionalitásról
- Bármilyen tervezési/architekturális kérdés

---

## 1. Kulcsszó → Dokumentum Mapping

| User kulcsszavak | Releváns dokumentumok |
|---|---|
| "számlák", "invoices", "bizonylat", "invoice" | P-010, P-012, P-015, A-012, design/11 |
| "sidebar", "menü", "navigáció", "menu" | P-006, design/05 |
| "dashboard", "irányítópult" | P-005, P-009, design/05 |
| "tranzakciók", "matching", "párosítás" | P-016, P-017, P-018 |
| "feltöltés", "upload", "OCR" | P-013, A-008, A-011 |
| "könyvelés", "főkönyv", "GL", "ledger" | P-019, P-020 |
| "beállítások", "settings" | P-025, P-026, P-027 |
| "auth", "bejelentkezés", "jogosultság" | A-009, design/13 |
| "tábla", "lista", "table", "grid" | design/11 |
| "dialog", "modal", "popup" | design/12 |
| "animáció", "transition", "hover" | design/08 |
| "export", "CSV", "Excel" | P-021, design/11 |
| "ÁFA", "bevallás", "VAT" | P-032 |
| "bér", "payroll", "járulék" | P-033 |
| "hibajegy", "ticket" | P-035, A-018 |
| "árazás", "pricing", "terv" | P-028, P-029, P-030 |
| "partner", "partnertörzs" | PRD prd.md, P-xxx partner |
| "kintlévőség", "receivables" | Releváns P-xxx |
| "házipénztár", "petty cash" | Releváns P-xxx |
| "kategória", "categories" | Releváns P-xxx |
| "projekt", "projects" | Releváns P-xxx |
| "TENY", "fixed assets", "eszközök" | Releváns P-xxx |
| "management", "admin" | P-036, A-019 |
| "email", "mailgun", "webhook" | A-011, A-005 |
| "NAV", "online számla" | A-012, A-005 |
| "edge function", "EF" | A-005 (teljes EF katalógus) |
| "RPC", "function", "SQL" | A-016 (teljes RPC katalógus) |

## 2. Dokumentumok Beolvasása

**KÖTELEZŐ:** `view_file`-lal olvasd be az azonosított dokumentumokat. Prioritás:

```
1. Product decision (P-xxx) — mit csináljon a funkció?
2. Architecture decision (A-xxx) — milyen technikai korlátok vannak?
3. Design spec (design/XX-*) — milyen pattern-eket kell követni?
4. Business doc (BRD, use-cases) — mi az üzleti kontextus?
```

**Dokumentum útvonalak:**
- PRD: `d:\ThinkAI\Visibill\eaisybill-prod\docs\product\decisions\P-XXX-*.md`
- ADR: `d:\ThinkAI\Visibill\eaisybill-prod\docs\architecture\decisions\A-XXX-*.md`
- Design: `d:\ThinkAI\Visibill\eaisybill-prod\docs\design\XX-*.md`
- BRD: `d:\ThinkAI\Visibill\eaisybill-prod\docs\business\decisions\XXX-*.md`

## 3. Graphify Query

Ha `graphify-out/graph.json` létezik, használd a graphify-t az érintett kód megértéséhez:

```bash
graphify query "<feature/módosítás kulcsszavak>"
graphify path "<ComponentA>" "<ComponentB>"
graphify explain "<fogalom>"
```

## 4. Összefoglaló a Usernek

Mielőtt bármit csinálnál, közöld a felhasználóval:

```markdown
## 📋 Spec-Driven Kontextus

**Releváns specifikációk:**
- [P-xxx]: [mit mond a spec]
- [A-xxx]: [milyen korlátok vannak]
- [design/xx]: [milyen pattern-t kell követni]

**Graphify eredmény:** [érintett fájlok/komponensek]

**Nincs meglévő spec:** [ha nincs → jelezd expliciten]
**Spec ↔ kód eltérés:** [ha a spec mást mond mint a kód → flag-eld]
```

## 5. Komplexitás Döntés — Mi Következik?

A spec lookup után döntsd el a feladat komplexitását:

### ✅ Egyszerű módosítás (1-2 fájl, nincs döntési pont)

**Implementáció előtt — Build Baseline:**
```bash
npm run build
```
→ Ha a build HIBÁS: **javítsd először a meglévő hibákat**, ne adj hozzá újakat.
→ Ha a build SIKERES: jegyezd meg mint baseline → implementálj.

**Implementáció után — Build Verify (rekurzív):**
```bash
npm run build
```
→ Ha HIBÁS: **javítsd az összes hibát** → futtasd újra `npm run build` → ismételd amíg SIKERES.
→ Ha SIKERES: **csak ezután** kérd a user validációt.

> ⚠️ **Az AI NEM jelzi a usernek hogy "kész" amíg a build nem SIKERES.** Rekurzívan javít amíg tiszta a build.

→ User validáció után frissítsd a releváns docs-okat:
  - Ha EF/RPC érintett: `A-005` és/vagy `A-016` frissítés
  - Ha UI érintett: releváns design doc frissítés
  - Ha route változott: `information-architecture.md` frissítés

### ⚠️ DB/SQL érintettség (migration, RPC, RLS, Edge Function query, Supabase query)
→ **KÖTELEZŐ: Olvasd be a `visibill-db-checklist` skillt:**
```
view_file ~/.gemini/config/skills\visibill-db-checklist\SKILL.md
```
→ Használd a megfelelő checklist-et (új tábla / RPC / frontend query / EF query / migration)

### 🔴 Komplex változás (3+ fájl, új funkció, architektúra döntés, új modul)
→ **KÖTELEZŐ: Olvasd be a `visibill-feature-planner` skillt:**
```
view_file ~/.gemini/config/skills\visibill-feature-planner\SKILL.md
```
→ Kövesd a teljes workflow-t: Döntési Mátrix → Implementáció → User Validáció → Docs Frissítés → Graphify

### 🔴 Komplex + DB érintettség
→ **KÖTELEZŐ: Olvasd be mindkettőt:**
```
view_file ~/.gemini/config/skills\visibill-feature-planner\SKILL.md
view_file ~/.gemini/config/skills\visibill-db-checklist\SKILL.md
```

> **FONTOS:** A skillek betöltése `view_file` hívással történik, nem opcionális. Ha a komplexitás megköveteli, a skill beolvasása KÖTELEZŐ — enélkül az implementáció nem kezdhető el.

---

## Skálázhatóság Emlékeztető

> A Visibill/eaisybill egy folyamatosan növekvő projekt, amelyet több ezer aktív ügyfél kiszolgálására tervezünk.
> Kerülni kell a naiv megoldásokat (pl. N+1 lekérdezések, kliens-oldali szűrések nagy adathalmazokon, felesleges state re-renderek).

