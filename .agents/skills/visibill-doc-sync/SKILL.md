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
