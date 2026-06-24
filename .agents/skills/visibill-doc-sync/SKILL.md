---
name: visibill-doc-sync
description: Use after completing code changes in the eaisybill-prod or worker workspace to synchronize documentation with the codebase. Triggers on "frissítsd a doksit", "szinkronizáld a dokumentumokat", "docs update", "docs frissítés", "documentation sync", "update docs", "graphify update", or at the end of any development session that modified code files. Also triggers when the user says "kész a fejlesztés", "commitolok", "lezárom a session-t", "push előtt", "dokumentáljuk", "dokumentáld le a változtatásokat", "dokumentáld a döntéseket", "rögzítsd a döntéseket", "írj ADR-t", "write ADR", "dokumentáljuk amit csináltunk", "frissítsd a dokumentációt", "ADR kell", "döntések dokumentálása", "session dokumentáció". Triggers on project names: "visibill", "eaisybill", "eaisybill-prod", "vsweb".
---

# Visibill Doc Sync — Automatikus Dokumentáció Szinkronizáció

Ez a skill biztosítja, hogy kód módosítás után az érintett dokumentáció (BRD/PRD/ADR/Design/Worker)
automatikusan frissüljön. A cél: a dokumentáció SOHA ne legyen elavult.

## ⚠️ FONTOS: Ez a skill a `visibill-feature-planner` Fázis 4-5-ével is futhat

Ha a `visibill-feature-planner` aktív volt, ez a skill automatikusan az implementáció
végén aktiválódik. Ha standalone futtatod (pl. "docs update"), ugyanaz a workflow.

## Mikor futtasd

- ⭐ Feature implementáció végén (KÖTELEZŐ — a feature nem kész nélküle)
- Commit/push előtt
- Ha a felhasználó kéri: "frissítsd a doksit"
- Bármilyen session végén ahol kód módosult

## Workflow

### 1. lépés: Módosított fájlok azonosítása

```bash
# Git-ből
git diff --name-only HEAD~1
# Vagy még nem commitolt:
git diff --name-only
git diff --name-only --staged
```

### 2. lépés: Fájl → Docs mapping

| Módosított fájl pattern | Érintett docs |
|---|---|
| `src/App.tsx` | `01-tech-stack.md` (providers), `information-architecture.md` (routes) |
| `src/contexts/*.tsx` | `06-state-management.md`, `01-tech-stack.md` (context count) |
| `src/pages/*Page.tsx` | Kapcsolódó PRD (P-xxx), `information-architecture.md` |
| `src/components/AppSidebar.tsx` | `P-006-sidebar-structure.md`, `05-layout-navigation.md` |
| `src/lib/navigation.ts` | `A-013-scoped-routing.md`, `05-layout-navigation.md` |
| `supabase/functions/*/index.ts` | `A-005-edge-functions.md` (function count) |
| `supabase/migrations/*.sql` | Kapcsolódó ADR (tábla nevéből), `A-003-multi-tenancy-rls.md` |
| `worker/*.py` | `034-worker-pipeline.md`, `worker/docs/ARCHITECTURE.md` |
| `worker/prompts/*.md` | `worker/docs/PROMPTS.md` |
| `package.json` | `01-tech-stack.md` (verziók) |

### 3. lépés: Változás analízis és javaslat

Minden érintett docs-nál elemezd:

```markdown
## 📝 Docs Frissítési Javaslat

### Módosított kód fájlok:
- `src/pages/NewFeaturePage.tsx` (ÚJ)
- `src/hooks/useNewFeature.ts` (ÚJ)

### Frissítendő dokumentáció:

1. **[docs/product/information-architecture.md]**
   - Változás: Új route `/new-feature`
   - Módosítás: Sitemap szekció bővítés

2. **[docs/product/decisions/index.md]**
   - Változás: Új P-XXX hozzáadás
   - Módosítás: Count frissítés, tábla bővítés

3. **[docs/design/05-layout-navigation.md]**
   - Változás: Sidebar menüpont
   - Módosítás: Nav group-ok szekció

### Új fájlok (ha szükséges):
| Fájl | Típus | Tartalom |
|---|---|---|
| `docs/product/decisions/P-035-*.md` | PRD | UI workflow |
| `docs/architecture/decisions/A-016-*.md` | ADR | Tech döntések |

### ⚠️ Hiányzó dokumentáció:
- Nincs BRD ehhez → Létre kell hozni?
- Open döntés releváns: [011-member-permissions]

### Nem szükséges:
- `01-tech-stack.md` — meglévő tech stack fedi
```

### 4. lépés: Végrehajtás (jóváhagyás után)

A felhasználó jóváhagyja → végezd el:
1. **Docs fájlok módosítása** — számok, route-ok, provider-ek
2. **Index fájlok frissítése** — BRD/PRD/ADR index.md-k (count, státusz)
3. **Cross-referenciák** — BRD ↔ ADR ↔ PRD linkek
4. **Design docs** — ha UI pattern változott
5. **Worker docs** — ha worker kód változott

### 5. lépés: ⭐ Graphify update (MINDIG az utolsó lépés)

```bash
graphify update .
```

## Feature készség checklist

A feature / módosítás **CSAK AKKOR kész** ha:
- [ ] Kód implementálva és tesztelve
- [ ] BRD frissítve (ha üzleti scope változott)
- [ ] PRD frissítve (ha UI változott)
- [ ] ADR frissítve (ha technikai döntés született)
- [ ] Design docs frissítve (ha pattern változott)
- [ ] Worker docs frissítve (ha worker kód változott)
- [ ] Cross-referenciák hozzáadva
- [ ] Index fájlok count-jai naprakészek
- [ ] Graphify update lefutott

## Szabályok

1. **SOHA ne frissítsd jóváhagyás nélkül** — mindig javaslatot terjessz elő
2. **Jelezd ha új ADR/BRD/PRD kell** — ha implicit döntés született kódolás közben
3. **Tartsd karban a számokat** — edge function, migration, context count-ok
4. **graphify update MINDEN session végén** — a gráf maradjon aktuális

---

## Dokumentáció Taxonómia — Mi mibe kerül?

### Rétegek és felelősségek

| Típus | Mappa | Mi kerül bele? | Trigger |
|---|---|---|---|
| **ADR** (Architecture Decision Record) | `docs/architecture/decisions/A-XXX-*.md` | Technikai döntések, miért választottunk valamit, trade-off-ok. Edge function viselkedés, DB séma döntés, auth flow, caching stratégia. | Technikai döntés született (nem csak implementáció) |
| **PRD** (Product Decision Record) | `docs/product/decisions/P-XXX-*.md` | UI/UX döntések, felhasználói workflow, képernyő viselkedés. Mikor jelenik meg egy modal, hogyan működik egy szűrő. | Felhasználói felület logika változott |
| **BRD** (Business Decision Record) | `docs/business/decisions/XXX-*.md` | Üzleti szabályok, jogosultsági politikák, árazás, üzleti folyamatok. | Üzleti szabály változott vagy új létrejött |
| **Design docs** | `docs/design/XX-*.md` | UI pattern-ek, komponens viselkedés, animáció, layout szabályok. | Pattern változott, nem egyszeri implementáció |
| **Architecture overview** | `docs/architecture/frontend-auth-onboarding.md` stb. | Rendszer szintű folyamatok, flow diagramok, több komponenst érintő viselkedés leírása. | Cross-cutting flow változott |
| **Worker docs** | `worker/docs/ARCHITECTURE.md` stb. | Worker pipeline, prompt stratégia, Python kód döntések. | Worker kód módosult |

### Döntési fa — Új fájl vagy meglévő frissítése?

```
Változás érkezett
      │
      ├─ Van már meglévő doc amely pontosan ezt a területet fedi?
      │      ├─ IGEN → Meglévő frissítése (új szekció vagy szekció update)
      │      └─ NEM → Új doc létrehozása (ld. sablon lent)
      │
      ├─ Döntés született (technikai/üzleti/UI)?
      │      └─ IGEN → KÖTELEZŐ: Döntés rögzítése (ADR/PRD/BRD) — implicit döntés tilos!
      │
      └─ Cross-cutting (több réteg érintett)?
             └─ IGEN → Minden érintett rétegben frissítés + cross-referencia linkek
```

### Mikor kell ÚJ ADR/PRD/BRD?

**Új ADR ha:**
- Eddig nem dokumentált technikai döntés született
- Egy meglévő ADR döntése megváltozott (→ új ADR az előző felváltásával)
- Új edge function viselkedés, auth flow, caching stratégia, DB séma döntés

**Meglévő ADR frissítése ha:**
- A döntés ugyanaz, de implementációs részlet változott (pl. verziószám, viselkedés pontosítás)
- Cross-reference hozzáadása (egy másik ADR-rel kapcsolódik)

**Új PRD ha:**
- Teljesen új UI felület vagy workflow jött létre
- Meglévő workflow alapvetően megváltozott

**Design doc frissítése (szinte soha új file) ha:**
- Meglévő pattern változott (pl. badge variant, modal méret szabály)
- Új pattern-t vezettünk be amit mások is fognak használni

### Aktuális számozás (mindig ellenőrizd az index.md-t!)

```
ADR:  docs/architecture/decisions/index.md  → utolsó: A-021 → következő: A-022
PRD:  docs/product/decisions/index.md       → utolsó: ellenőrizd a fájlt
BRD:  docs/business/decisions/index.md      → utolsó: ellenőrizd a fájlt
```

> **FONTOS:** Mindig olvasd be az `index.md`-t a következő szám meghatározásához — ne becsüld meg!

### Cross-reference szabályok

**Kötelező linkelni ha:**
- Új ADR → link a kapcsolódó PRD-re (ha az üzleti szál is dokumentált)
- Új PRD → link a mögöttes ADR-re (technikai megvalósítás)
- Bármely doc → link az index.md-re (szám regisztráció)

**Tipikus cross-reference példa:**
```markdown
## Kapcsolódó
- [A-009: Auth RBAC](./A-009-auth-rbac.md)      ← ha auth érintett
- [A-021: Email Auth Flow](./A-021-*.md)          ← specifikus döntés
- [P-010: Invoice Status](../product/...)         ← ha UI döntés is van
```

### Döntés minősítése — Melyik rétegbe tartozik?

| Változtatás típusa | Réteg |
|---|---|
| "Miért nem küldünk dupla emailt" | **ADR** (tech döntés) |
| "A badge piros legyen" | **PRD** (UI döntés) |
| "A lejárt számla 30 nap után kap fizetési felszólítást" | **BRD** (üzleti szabály) |
| "Minden badge `variant='destructive'` piros esetén" | **Design doc** (pattern) |
| "Az email change flow így működik lépésről-lépésre" | **Architecture overview** (cross-cutting flow) |
| "A `send-email` EF signup-ot skipeli" | **ADR** (tech döntés) + **A-005 frissítés** (registry) |

---

## Sablonok

### Új ADR sablon
```markdown
# A-XXX: [Döntés neve]

**Status:** Decided
**Date:** [YYYY-MM-DD]
**Utoljára frissítve:** [YYYY-MM-DD]

## Context
[Miért kellett dönteni? Mi volt a probléma?]

## Decision
[Mit döntöttünk? Pontosan, konkrétan.]

## Consequences
**Pozitív:** ...
**Negatív:** ...

## Kapcsolódó
- [A-YYY: ...](./A-YYY-*.md)
- [P-ZZZ: ...](../product/P-ZZZ-*.md)
```

### Új PRD sablon
```markdown
# P-XXX: [Feature neve] UX

**Status:** Decided
**Category:** [UI / Workflow / Navigation / stb.]
**Question:** [Milyen UI kérdés merült fel?]
**Decision:** [Mit döntöttünk?]
**Current Implementation:** [Hogyan néz ki jelenleg?]
**Rationale:** [Miért ez a döntés?]

## Kapcsolódó
- [A-XXX: ...](../../architecture/decisions/A-XXX-*.md)
```

### Új BRD sablon
```markdown
# Decision XXX: [Feature neve]

**Status:** Decided
**Category:** [Business Rule / Pricing / Access Control / stb.]
**Question:** [Milyen üzleti kérdés merült fel?]
**Decision:** [Mit döntöttünk?]
**Rationale:** [Miért ez az üzleti döntés?]

## Kapcsolódó
- ADR: [link]
- PRD: [link]
```
