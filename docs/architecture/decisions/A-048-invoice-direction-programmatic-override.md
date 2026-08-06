# A-048: Invoice Direction Detection — Programmatic Override Safety Net

**Status:** Decided
**Date:** 2026-08-06
**Utoljára frissítve:** 2026-08-06

## Context

Az AI extraction (LLM) határozza meg a számla irányát (`invoice_direction`: INBOUND/OUTBOUND) a 
`COMPANY_NAME` és `COMPANY_TAX` kontextus alapján. Azonban az AI időnként hibásan dönt:

1. **AI hallucinates OUTBOUND** — az eladó adószáma ≠ cég adószáma, de az AI mégis OUTBOUND-ot mond
2. **AI hallucinates seller data** — az eladó és a vevő adatait is azonos cégként tölti ki (hallucination)
3. **Name match false positive** — a programmatic fallback substring name matchet használt, ami
   false positive-ot adott hasonló nevű, de különböző cégeknél (pl. "Victoria Bt." vs "Victoria Music Kft.")

A `_verify_or_determine_direction()` korábban **feltétel nélkül trust-olta az AI döntést** (log-only
mismatch warning). Ez 22+ hibás számlát eredményezett az éles rendszerben, ahol bejövő számlák
kimenőként lettek besorolva.

### Érintett incident

- **Taxology Kft. ticket (2026-08-06):** 2 számla hibásan OUTBOUND (AG-2026-2708 és 100000842273)
- **Retroaktív DB scan:** 22 további hibás számla (Victoria Bt., Vasalat Expressz, MS-TAX, stb.)

## Decision

### 1. Programmatic Override — Tax-based double-check

Ha az AI OUTBOUND-ot mond, de a programmatic check ellentmond:

```
AI = OUTBOUND
  AND seller_tax ≠ company_tax (programmatic = INBOUND)
  AND buyer_tax = company_tax (vevő oldal megerősíti)
→ OVERRIDE to INBOUND (logger.error, nem warning)
```

A kétirányú ellenőrzés (eladó NEM match + vevő MATCH) ad 100%-os bizonyosságot.

### 2. Hallucination Detection — Seller == Buyer guard

Ha az AI azonos adószámot ad az eladónak és a vevőnek:

```
seller_tax == buyer_tax AND AI = OUTBOUND
→ OVERRIDE to INBOUND (feltöltött számláknál ez a biztonságos default)
```

### 3. Name Match — Exact match, nem substring

A korábbi `norm_company in norm_seller or norm_seller in norm_company` substring check
helyett **exact match** (`norm_company == norm_seller`), mert a substring false positive-ot
ad hasonló nevű, de különböző cégeknél.

### Prioritási sorrend a `_verify_or_determine_direction()`-ben

```
1. AI OUTBOUND + seller ≠ company + buyer = company → INBOUND (override)
2. AI OUTBOUND + seller == buyer (hallucination) → INBOUND (override)
3. AI bármi + programmatic eltér → trust AI (log warning)
4. AI nincs → programmatic fallback
```

## Consequences

**Pozitív:**
- Az adószám-alapú objektív check felülírja az AI szubjektív döntését
- 22 meglévő hibás számla retroaktívan javítva
- Hallucination case detektálva és kezelve
- Name match false positive eliminálva

**Negatív:**
- Az `_buyer_tax_matches_company` extra DB hívás (de csak mismatch esetén, ami ritka)
- Ha az AI jogosan mond OUTBOUND-ot de a vevő adószáma = cég adószáma (önszámlázás edge case),
  az override hibásan INBOUND-ot ad. De önszámlázás nagyon ritka és az `onszamlazas` field
  kezelése jövőbeli iteráció tárgya.
- Az exact name match szigorúbb — ha a cég neve kicsit eltér az OCR-ben (pl. "ThinkAI" vs
  "Think AI"), nem matchel. De az adószám match a megbízható (99%+ esetben elérhető).

## Implementáció

- **Fájl:** `worker/db.py` — `_verify_or_determine_direction()`, `_determine_direction_by_tax()`,
  `_buyer_tax_matches_company()` (NEW), `_seller_buyer_same_tax()` (NEW)
- **Tesztek:** `worker/test/unit_test/test_direction_detection.py` — 12 unit teszt

## Kapcsolódó

- [A-008: OCR Pipeline](./A-008-ocr-pipeline.md) — OCR extraction (a direction az extraction része)
- [A-006: Python Worker](./A-006-python-worker.md) — Worker architektúra
- [A-035: Three-way Fallback](./A-035-three-way-fallback-redirection.md) — Invoice routing
