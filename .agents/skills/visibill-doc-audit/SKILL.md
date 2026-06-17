---
name: visibill-doc-audit
description: Use when auditing Visibill/eaisybill documentation freshness, finding stale references, or checking docs against the actual codebase state. Triggers on "audit", "elavult", "stale docs", "doc review", "documentation check", "frissesség", "docs naprakészek?", "elavult dokumentum", "melyik docs régi", or any request to verify documentation accuracy in the eaisybill-prod workspace. Also use periodically after major refactoring or code removal. Triggers on project names: "visibill", "eaisybill", "eaisybill-prod", "vsweb".
---

# Visibill Doc Audit — Dokumentáció Frissesség Ellenőrzés

Ez a skill összehasonlítja a `docs/` dokumentumokban leírt állapotot a tényleges
kódbázissal, és azonosítja az eltéréseket.

## Mikor futtasd

- Major kód refaktorálás/törlés után
- Ha a felhasználó kérdezi: "naprakészek a docs?"
- Ha "elavult" vagy "stale" szó elhangzik
- Periodikusan (havonta egyszer javasolt)

## Audit Checklist

Futtasd végig az alábbi ellenőrzéseket sorban:

### 1. Provider Stack (App.tsx vs docs)

```bash
# Kérdés: A docs/design/01-tech-stack.md Provider Stack szekciója egyezik az App.tsx-szel?
grep -n "Provider" src/App.tsx
# Hasonlítsd össze a docs/design/01-tech-stack.md "Provider Stack" szekciójával
```

### 2. Context-ek száma

```bash
# Kérdés: docs/design/01-tech-stack.md "X React Context" egyezik a valós számmal?
ls src/contexts/*.tsx | wc -l
```

### 3. Route-ok vs Information Architecture

```bash
# Kérdés: docs/product/information-architecture.md route-jai léteznek az App.tsx-ben?
grep "path=" src/App.tsx
# Cross-ref: docs/product/information-architecture.md sitemap szekció
```

### 4. Edge Functions száma

```bash
# Kérdés: docs/architecture/decisions/A-005-edge-functions.md "42 function" stimmel?
ls -d supabase/functions/*/ | wc -l
```

### 5. Migration count

```bash
# Kérdés: Ha a docs hivatkozik migration számra, az aktuális?
ls supabase/migrations/*.sql | wc -l
```

### 6. Törölt fájl hivatkozások

```bash
# Kérdés: Van-e docs fájl ami nem létező fájlra hivatkozik?
# Keresd a file:// linkeket és src/ hivatkozásokat a docs-ban
grep -rn "SubscriptionContext\|Pricing.tsx\|SubscriptionUsage\|create-checkout\|customer-portal\|check-subscription" docs/
```

### 7. Package.json vs Tech Stack

```bash
# Kérdés: A docs/design/01-tech-stack.md verziói egyeznek a package.json-nal?
grep -E "\"react\"|\"vite\"|\"typescript\"|\"tailwindcss\"" package.json
```

### 8. Business ADR index számok

```bash
# Kérdés: Az index.md összesítő számai (Decided/Open/Superseded) stimmelnek?
grep -c "Decided" docs/business/decisions/index.md
grep -c "Open" docs/business/decisions/index.md
grep -c "Superseded" docs/business/decisions/index.md
```

### 9. Worker docs cross-ref

```bash
# Kérdés: A worker/docs/DECISIONS.md-ben van-e újabb ADR ami nincs az A-007-ben hivatkozva?
grep "## ADR-" worker/docs/DECISIONS.md | wc -l
```

### 10. Elavult Stripe hivatkozások

```bash
# Kérdés: Maradt-e Stripe/subscription hivatkozás a docs-ban?
grep -rni "stripe\|subscription\|előfizetés\|pricing" docs/ --include="*.md" | grep -v "Superseded\|eltávolít\|töröl\|régi\|korábbi"
```

## Output formátum

Az audit eredményét a következő formátumban add:

```markdown
# 📋 Dokumentáció Audit Riport — [dátum]

## ✅ Rendben (X ellenőrzés)
- Provider stack: 4 context ✓
- Route-ok: mind létezik ✓
- ...

## ⚠️ Elavult (X eltérés)
- [01-tech-stack.md:98] „5 React Context" → valójában 4
  **Javítás:** Frissítsd 4-re
- [A-005:L15] „42 function" → valójában 40
  **Javítás:** Frissítsd a számot

## 🔴 Kritikus (X hiba)
- [information-architecture.md:42] hivatkozik /pricing → NEM létezik
  **Javítás:** Töröld a hivatkozást

## 📊 Összesítő
| Ellenőrzés | Rendben | Elavult | Kritikus |
|---|---|---|---|
| Provider Stack | ✅ | | |
| Context-ek | | ⚠️ | |
| Route-ok | | | 🔴 |
| ... | | | |
```

## Javítás

Ha a felhasználó jóváhagyja, az audit után automatikusan javítsd az elavult hivatkozásokat.
Minden javításnál hivatkozz az audit eredményre.
