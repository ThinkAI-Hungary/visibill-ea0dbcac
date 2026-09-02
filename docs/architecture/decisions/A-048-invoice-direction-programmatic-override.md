# A-048: Invoice Direction Detection — Programmatic Override Safety Net

**Status:** Decided
**Date:** 2026-08-06
**Utoljára frissítve:** 2026-09-02

## Context

Az AI extraction (LLM) határozza meg a számla irányát (`invoice_direction`: INBOUND/OUTBOUND) a 
`COMPANY_NAME` és `COMPANY_TAX` kontextus alapján. Azonban az AI időnként hibásan dönt:

1. **AI hallucinates OUTBOUND** — az eladó adószáma ≠ cég adószáma, de az AI mégis OUTBOUND-ot mond
2. **AI hallucinates seller data** — az eladó és a vevő adatait is azonos cégként tölti ki (hallucination)
3. **Name match false positive** — a programmatic fallback substring name matchet használt, ami
   false positive-ot adott hasonló nevű, de különböző cégeknél (pl. "Victoria Bt." vs "Victoria Music Kft.")
4. **Grafikus fejléc & operátor monogram (2026-09-02 Ván Iroda support eset)** — Ha a számlázó rendszer (pl. SUP) a Szállító fejlécet képi formában ágyazza be a PDF-be, a szövegben pedig a láblécben lévő operátori monogram (`Kiállító:ZG`) szerepel, az AI eladónak `ZG`-t olvasott, a vevő adószámát az eladóhoz rendelte, és tévesen INBOUND besorolást adott.

A `_verify_or_determine_direction()` egy robusztus, többszintű safety net-et kapott.

---

## Decision

### 0. Tier 0: Authoritative NAV Online Számla Cross-Check (`_check_nav_invoice_info`)

A legfelsőbb hitelességi forrás a NAV Online Számla rendszere:
- Ha a számla sorszáma (`bizonylatsorszam` / `szamlaszam`) létezik a feltöltő cég `nav_invoices` rekordjai között, a NAV hivatalos `invoice_direction` értéke **100%-os bizonyossággal érvényesül**.
- Ha a NAV-ban `OUTBOUND`, a rendszer felülbírálja az AI téves `INBOUND` döntését, és a NAV adataiból helyreállítja a hivatalos szállítónevet (`supplier_name`) és adószámot (`supplier_tax_number`).

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

### 3. Noisy Seller Recovery — Zajos operátornév helyreállítása (NAV nélküli fallback)

Ha az AI által adott `elado_nev` zajos (pl. `<= 3` karakter vagy `"ZG"`, `"Ismeretlen eladó"`), az adószám hiányzik, de a vevő harmadik fél (vevő adószám ≠ company_tax):
- A rendszer felismeri, hogy a számla a feltöltő cég saját kibocsátása, visszaállítja az eladónevet és adószámot a cég profiljából, és `OUTBOUND` irányt állít be.

### 4. VAT ID Zipcode Sanitization

A 4 számjegyű irányítószámok (pl. `6400`, `1037`) automatikusan kiszűrésre kerülnek a `vevo_vat_id` és `elado_vat_id` mezőkből, megakadályozva az adatbázis VAT integritásának sérülését.

### Prioritási sorrend a `_verify_or_determine_direction()`-ben

```
0. NAV Online Számla egyezés (OUTBOUND/INBOUND) → NAV hatósági adat győz + eladó/vevő helyreállítás
1. AI OUTBOUND + seller ≠ company + buyer = company → INBOUND (override)
2. AI OUTBOUND + seller == buyer (hallucination) → INBOUND (override)
3. AI INBOUND + seller zaj ('ZG') + buyer ≠ company → OUTBOUND (recovery)
4. AI bármi + programmatic eltér → trust AI (log warning)
5. AI nincs → programmatic fallback
```

---

## Consequences

**Pozitív:**
- A NAV Online Számla hatósági adatai teljes bizonyosságot adnak
- A grafikus fejlécű és szoftveres operátori monogramos (`Kiállító:ZG`) számlák automatikusan helyreállnak
- A 4-jegyű irányítószámok nem korrumpálják az adószám mezőket
- Zero regresszió a meglévő tesztcsomagon

---

## Implementáció

- **Fájl:** `worker/db.py` — `_check_nav_invoice_info()`, `_verify_or_determine_direction()`, `_determine_direction_by_tax()`, `_buyer_tax_matches_company()`, `_seller_buyer_same_tax()`
- **Promptok:** `worker/prompts/sima_szamla.md`, `vegszamla.md`, `dijbekero_proforma.md`, `egyszerusitett_szamla.md` (Kiállító tiltás, logó kizárás, irányítószám tiltás)
- **Tesztek:** `worker/test/unit_test/test_direction_detection.py` — 14 unit teszt (100% PASS)

## Kapcsolódó

- [A-008: OCR Pipeline](./A-008-ocr-pipeline.md)
- [A-006: Python Worker](./A-006-python-worker.md)
- [A-025: Cross-Company Routing](./A-025-cross-company-routing.md)
- [A-035: Three-way Fallback](./A-035-three-way-fallback-redirection.md)
