---
name: visibill-doc-sync
description: Synchronize Visibill/eaisybill documentation (ADR/BDR/PRD/Design/Worker docs) with code changes. Use when completing features, before commit/push, or when asked to "frissítsd a doksit", "docs update", "docs frissítés", "documentation sync", "update docs", "írj ADR-t", "dokumentáld le", "dokumentáljuk", "session dokumentáció", "push előtt", "kész a fejlesztés". Triggers on "visibill", "eaisybill", "eaisybill-prod", "vsweb", "worker docs".
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

### 3.5 lépés: ⭐ Doc Self-Review (javaslat bemutatása ELŐTT — kötelező)

> Mielőtt bármilyen dokumentációs javaslatot a user elé terjesztesz, futtasd le ezt a belső ellenőrzést.  
> Ez a lépés **NEM látható a usernek** — csak az agent végzi saját maga számára.

```
ÖNELLENŐRZÉSI LISTA (minden módosítandó / új doc-ra):

1. Placeholder scan
   ❌ "TBD", "TODO", "FIXME", "...", hiányos szekciók → javítsd fel
   ❌ Üres táblázat cellák ahol tartalom kellene
   ✅ Minden szekció tartalmaz tényleges döntést / leírást

2. Kód konzisztencia cross-check
   → Olvasd be az érintett fájl(ok) jelenlegi tartalmát
   → Hasonlítsd a doc-ba kerülő leírással
   ❌ Ha eltérés van: NE dokumentáld a "kívánt" verziót
   ✅ Ha eltér: jelezd a usernek ("A kód X-et csinál, de a doc Y-t mondana — melyik helyes?")

3. Cross-reference check
   ❌ Új ADR-t linka kapcsolódó PRD / BRD nélkül hagysz
   ❌ Új PRD-ből nem mutat link az ADR-re (ha van tech döntés)
   ✅ Minden új doc be van linkelve az index.md-be
   ✅ Minden "Kapcsolódó" szekció ki van töltve

4. Számok és verziók
   ❌ Edge function count, migration szám, context count elavult
   ✅ Index.md-ben a következő szám helyes (nem becsülted, hanem megnézted)
   ✅ ADR/PRD/BRD sorszám ütközésmentes

5. ADR minőségi szűrő (ha ADR-t írsz)
   Mindháromnak teljesülnie kell:
   □ Hard to reverse? (fájdalmas visszacsinálni?)
   □ Surprising without context? (egy jövőbeli dev megkérdezné "miért?")
   □ Real trade-off? (volt értelmes alternatíva?)
   → Ha bármelyik NEM → nem kell ADR, elég kód komment vagy doc frissítés
```

> **Miért:** 30 másodperces befektetés ami megelőzi az elavult, inkonzisztens vagy fél-kész dokumentációt.

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

## 📂 Projekt Dokumentációs Könyvtárstruktúra

A dokumentumoknak szigorúan az alábbi mappastruktúrába kell kerülniük:

```
d:\ThinkAI\Visibill\eaisybill-prod\docs\
├── business\                           # Üzleti & Használati követelmények (BRD)
│   ├── decisions\                      # Számozott üzleti döntések (pl. 001-*.md, index.md)
│   ├── overview.md                     # Üzleti áttekintés
│   ├── brd.md                          # Részletes Business Requirements Document
│   ├── use-cases.md                    # Üzleti Use-Case-ek katalógusa
│   └── user-journeys.md                # Felhasználói útvonalak leírása
│
├── product\                            # Termékspecifikáció & UI/UX (PRD)
│   ├── decisions\                      # Számozott termék döntések (pl. P-001-*.md, index.md)
│   ├── prd.md                          # Részletes Product Requirements Document
│   └── information-architecture.md     # Oldalstruktúra, menüpontok és route-ok
│
├── architecture\                       # Rendszerarchitektúra & Technikai specifikáció (ADR)
│   ├── decisions\                      # Számozott technikai döntések (pl. A-001-*.md, index.md)
│   ├── database\                       # Adatbázis sémák és magyarázatok (01-auth.md, 04-invoices.md, stb.)
│   ├── database-schema.md              # Teljes adatbázis sémaleíró generált index
│   └── overview.md                     # Technikai architektúra áttekintő és adatfolyamok
│
└── design\                             # UI/UX minták és tervezési szabályrendszer
    ├── 00-overview.md                  # Design rendszer áttekintés
    ├── 05-layout-navigation.md         # Layout és navigációs minták
    └── [számozott-design-fájlok].md    # Különböző komponens-szintű design specifikációk

d:\ThinkAI\Visibill\worker\docs\        # A Python háttér-worker saját dokumentációja
├── ARCHITECTURE.md                     # Worker architektúra, queue listeners
└── PROMPTS.md                          # LLM prompt specifikációk és verziók
```

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

### ⭐ ADR minőségi szűrő — Mikor VALÓBAN kell ADR?

> Inspiráció: `grill-with-docs` skill ADR-sparing elve.

**ADR-t CSAK akkor írj, ha mindhárom feltétel teljesül:**

| # | Feltétel | Kérdés amit feltesz magadnak |
|---|---|---|
| 1 | **Hard to reverse** | Ha valaki holnap visszafordítja ezt a döntést, fájdalmas lesz? |
| 2 | **Surprising without context** | Egy jövőbeli AI agent / fejlesztő megkérdezné: „miért csinálták így?" |
| 3 | **Real trade-off** | Volt értelmes alternatíva és konkrét okból választottuk ezt |

**Ha bármelyik HIÁNYZIK → NEM kell új ADR.** Elég a meglévő doc frissítése vagy egy kód komment.

**⭐ Extra trigger — „Repeat-Explain" jel:**  
Ha ugyanazt az architekturális döntést **kétszer kellett elmagyarázni** egy session-ben → valószínűleg ADR kell. Ha egy döntést újra meg újra elmagyarázol, a következő agent session ugyanolyan kérdéseket fog feltenni. Írj ADR-t, és ne kelljen többé.

**ADR életciklus státuszok:**

| Státusz | Mikor |
|---------|-------|
| `Decided` | Aktív, érvényes döntés |
| `Superseded` | Felváltotta egy újabb ADR (add `Superseded by: A-XXX` sort) |
| `Deprecated` | Már nem releváns, de nem helyettesítette semmi |

**Példák:**
```
✅ ADR kell:  "Miért skipeli a send-email a signup-ot?"
              → Hard to reverse (email flow), Surprising (miért nem küld?), Real trade-off (2 email vs 1)

✅ ADR kell:  "Miért kötelező kijelentkeztetni email change után?"
              → Hard to reverse (security), Surprising (más appok nem teszik), Real trade-off (UX vs security)

✅ ADR kell:  Egy döntést ma másodszor kellett elmagyarázni → Repeat-Explain trigger

❌ ADR FELESLEGES: "A badge piros"
              → NOT hard to reverse, NOT surprising, NOT real trade-off

❌ ADR FELESLEGES: "Verziószám frissítés v22-re"
              → Nem döntés, csak implementáció
```


### Kód konzisztencia cross-check (doc írás ELŐTT kötelező)

> Inspiráció: `grill-with-docs` skill "Cross-reference with code" elve.

**Mielőtt bármilyen doc-ot írsz — ellenőrizd:** a leírni kívánt viselkedés egyezik-e a tényleges kóddal?

```
1. Olvasd be az érintett fájl(ok) jelenlegi tartalmát
2. Hasonlítsd a doc-ban leírni kívánt viselkedéssel
3. Ha eltérés van → NE dokumentáld a "kívánt" verziót
   → Szólj a usernek: "A kód X-et csinál, de te Y-t szeretnél dokumentálni — melyik a helyes?"
```

**Tipikus eltérési helyek:**
- Edge Function verziószám a kódban vs doc-ban
- Trigger chain lépéseinek sorrendje
- sessionStorage kulcsnevei
- RLS policy feltételek

### Aktuális számozás (mindig ellenőrizd az index.md-t!)

```
ADR:  docs/architecture/decisions/index.md  → utolsó: A-025 → következő: A-026
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
<!-- Ha egy korábbi döntést vált fel: -->
<!-- **Superseded by:** A-YYY -->
<!-- **Supersedes:** A-ZZZ -->

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

### Új Adatbázis Séma (DB Schema) sablon
```markdown
# 📄 [Modul / Funkciócsoport neve]

> [Rövid, egysoros leírás a táblák céljáról.]

**Táblák ebben a csoportban:** [táblák száma]

---

### `[tábla_neve]`

**RLS:** [✅ vagy ❌] | **Sorok:** [sorok becsült száma, pl. ~1000 vagy 'Teszt adatok']

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| [oszlop_neve] | [típus] | [✓ ha nullable, — ha NOT NULL] | [default érték] |

**FK:** `[oszlop_neve]` → `[másik_tábla.id]`

**Indexek:** `[index_neve_1]`, `[index_neve_2]`
```

