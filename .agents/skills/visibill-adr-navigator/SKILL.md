---
name: visibill-adr-navigator
description: Use at the START of any development task on the Visibill/eaisybill codebase. Triggers on "fejlesszük", "módosítsuk", "adjunk hozzá", "javítsuk", "refaktoráljuk", "implement", "add feature", "fix bug", "extend", "build", or any coding request involving the eaisybill-prod or worker workspace. Also triggers when the user asks "milyen döntések vannak", "mi releváns", "kontextus", "ADR", "BRD", "PRD", or "döntések". Triggers on project names: "visibill", "eaisybill", "eaisybill-prod", "vsweb". This skill MUST run before writing any code — it gathers all relevant business, product, and architecture decisions so the AI never makes silent technical choices.
---

# Visibill ADR Navigator — Döntés Felderítő

Ez a skill biztosítja, hogy az AI asszisztens **soha ne hozzon csendes technikai döntéseket**.
Minden fejlesztési feladat elején automatikusan összegyűjti a releváns döntéseket
(BRD + PRD + ADR + Worker ADR + Design Pattern-ek), és az AI kontextusába tölti.

## Filozófia

> **A felhasználó MINDEN technikai döntés felett kontrollt akar.**
> Az AI feladata: feltárni, listázni, és jóváhagyásra előterjeszteni — NEM magának eldönteni.

## Workflow — Minden fejlesztési feladat elején

### 1. lépés: Kulcsszavak kinyerése

A user kéréséből azonosítsd a fő témákat:
- "fejlesszük az ÁFA modult" → `ÁFA`, `VAT`, `bevallás`, `vat_return`
- "javítsuk a tranzakció párosítást" → `transaction`, `matching`, `párosítás`

### 2. lépés: Graphify query

```bash
graphify query "<kulcsszó>"
```

### 3. lépés: Döntés-keresés a 4 rétegben

#### a) Business Decisions (BRD)
```
Fájl: docs/business/decisions/index.md
Keresés: grep -i "<kulcsszó>" docs/business/decisions/*.md
Kérdés: Mi az üzleti scope? Mit tartalmaz, mit NEM?
```

#### b) Product Decisions (PRD)
```
Fájl: docs/product/decisions/index.md
Keresés: grep -i "<kulcsszó>" docs/product/decisions/*.md
Kérdés: Hogyan néz ki? Milyen workflow?
```

#### c) Architecture Decisions (ADR)
```
Fájl: docs/architecture/decisions/index.md
Keresés: grep -i "<kulcsszó>" docs/architecture/decisions/*.md
Kérdés: Milyen technikai korlátok, pattern-ek vannak?
```

#### d) Worker Decisions
```
Fájl: worker/docs/DECISIONS.md
Keresés: grep -i "<kulcsszó>" worker/docs/*.md
```

### 4. lépés: ⭐ Design Pattern-ek felderítése

Olvasd be a releváns design dokumentumokat és azonosítsd a meglévő pattern-eket:

**Mindig nézd meg:**
- `docs/design/05-layout-navigation.md` — Sidebar struktúra, scoped routing
- `docs/design/06-state-management.md` — Hook pattern-ek, Context használat

**Feature típustól függően:**
- Lista → `docs/design/11-data-display-tables.md` (DataTable, pagination)
- Dialog → `docs/design/12-dialogs-modals.md` (Dialog vs Sheet vs Drawer)
- Form → `docs/design/09-error-handling-feedback.md` (validation, toast)
- Animáció → `docs/design/08-interactions-animations.md`

**Hasonló meglévő oldal keresése:**
Keresd meg a leginkább hasonló meglévő page/feature-t és használd mintának:
```bash
graphify query "<hasonló feature>"
# Pl. "ÁFA modul" → nézd meg VatReturnPage.tsx mintáját
```

### 5. lépés: ⭐ Open / Partially Decided döntések feltárása

Keresd a nyitott döntéseket amelyek a feladathoz relevánsak:
```bash
grep -l "Open\|Partially Decided" docs/business/decisions/*.md docs/product/decisions/*.md docs/architecture/decisions/*.md
```

Ha van releváns → **javasolj döntést:**
> "A [011-member-permissions] döntés Open státuszú. Releváns a feladathoz.
> Ajánlás: [opciók]. Döntsünk most?"

### 6. lépés: Kontextus összesítő

```markdown
## 📋 Releváns Döntések — [Feature/Task Neve]

### 🎯 Üzleti Scope (BRD)
- [XXX-feature.md] — scope leírás
- Kapcsolódó: [YYY-feature.md] — hasonló feature

### 🖥️ Felületi Workflow (PRD)
- [P-XXX-feature.md] — UI workflow

### 🏗️ Architektúra (ADR)
- [A-XXX] — releváns technikai döntés

### 🎨 Design Pattern-ek (docs/design/)
- **Lista pattern:** DataTable + szűrő bar (11-data-display-tables.md)
- **Hook pattern:** useXxxData(companyId) → useQuery (06-state-management.md)
- **Hasonló oldal:** InvoicesPage.tsx — mintaként használható

### ⚠️ Nyitott Döntések
| Döntés | Státusz | Miért releváns | Ajánlás |
|---|---|---|---|
| [011-member-permissions] | 🔴 Open | Jogosultság kérdés | owner_or_admin |

### 📊 Érintett Fájlok (graphify)
- src/pages/...
- src/hooks/...
```

### 7. lépés: KÖTELEZŐ — Várd meg a jóváhagyást

**SOHA ne kezdj kódolni a kontextus összesítő megmutatása nélkül.**

## Mikor NEM kell futtatni

- Egyszerű szöveg módosítás
- Egyetlen fájl formázása
- Dokumentáció frissítés (docs/)
- Kérdés megválaszolása

## Szabályok

1. **Ne hozz silent döntéseket.** Választás → listázd a lehetőségeket
2. **Hivatkozz a döntésekre.** Kódban komment: `// ADR A-003: RLS policy`
3. **Jelezd ha döntés hiányzik.** "Ehhez nincs dokumentált döntés — hozzuk létre?"
4. **Kövesd a meglévő pattern-eket.** Eltérés → indoklás + jóváhagyás kérés
5. **Open döntéseket hozd felszínre.** Releváns Open → javasolj döntéshozást
