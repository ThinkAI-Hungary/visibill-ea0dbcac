# A-234: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák Architektúrája

**Status:** Decided  
**Date:** 2026-10-09  
**Utoljára frissítve:** 2026-10-09  

---

## 🏛️ Context
Az általános forgalmi adóról szóló 2007. évi CXXVII. törvény (Áfa tv.) 153/A. § (1) bekezdése és a 137. § rögzíti, hogy az adóalanynak a bejövő számla előzetesen felszámított adójának levonására a teljesítés időpontját követő **két naptári éven belül** van jogosultsága. Nem kötelező tehát a számlát a teljesítés havi bevallásában szerepeltetni; az adózó és a könyvelő dönthet úgy, hogy a levonást későbbre halasztja (pl. amíg a teljesítésigazolás meg nem érkezik, vagy a vitatott költség jogossága tisztázásra nem kerül).

A korábbi rendszerben csak egy bináris `exclude_from_accounting` (boolean) mező létezett mind a `nav_invoices`, mind az `invoices` táblán. Ha egy számlát kizártak, az végleg kiesett a könyvelésből és az ÁFA analitikából, így nem volt lehetőség az elévülési idő követésére, sem pedig a későbbi havi bevallásba történő egyszerű visszahívásra.

---

## 💡 Decision

### 1. Séma Bővítés a Dual-Table Modellben
A `nav_invoices`, `invoices`, valamint a tételsori `nav_invoice_items` és `invoice_items` táblákra kivezetésre kerültek a halasztott elszámolás metaadatai:
- `accounting_exclusion_type`: `text NOT NULL DEFAULT 'PERMANENT'` (`'PERMANENT'` vagy `'DEFERRED_VAT'`).
- `deferred_vat_reason`: `text` (a halasztás felhasználó / könyvelő által megadott indoka).
- `deferred_vat_since`: `timestamp with time zone` (a halasztás rögzítésének időpontja).
- `deferred_vat_target_period`: `text` (a célidőszak `'YYYY-MM'` formátumban, amelyik bevallásba beemelésre került).

### 2. Atomi Tárolt Eljárások (RPC) és Védelmi Mechanizmusok
A PostgreSQL oldalon három dedikált, tranzakcionális RPC került kifejlesztésre:
1. `public.set_invoice_accounting_exclusion(p_company_id, p_invoice_id, p_is_submitted, p_exclusion_type, p_reason)`:
   - Atomi módon frissíti az érintett számlát és annak összes tételsorát.
   - Beállítja az `exclude_from_accounting = true` jelölőt, a típust, az indokot és az időbélyeget.
2. `public.include_deferred_invoice_in_period(p_company_id, p_invoice_id, p_is_submitted, p_target_period)`:
   - A kérdéses számlát beemeli a megadott célidőszakba (`target_period = 'YYYY-MM'`).
   - Törli az `exclude_from_accounting` tiltást (`exclude_from_accounting = false`), rögzíti a célidőszakot, így az bekerül az adott havi ÁFA kalkulációba.
3. `public.get_questionable_invoices(p_company_id)`:
   - Lekérdezi az aktív, még be nem emelt (`target_period IS NULL` és `accounting_exclusion_type = 'DEFERRED_VAT'`) számlákat mind a `nav_invoices`, mind az `invoices` táblákból.
   - Kiszámítja a 2 éves jogvesztő határidőből hátralévő napok számát:
     ```sql
     (date_trunc('year', invoice_delivery_date) + interval '3 years' - interval '1 day')::date - CURRENT_DATE AS days_remaining_statutory
     ```
   - **PostgreSQL Változónév Ütközés Elhárítás:** A visszatérési rekord oszlopnevei és a belső oszlopok közötti névegyezés elkerülésére a függvény a `#variable_conflict use_column` direktívát alkalmazza.

### 3. ÁFA Számítási Motor Integráció (`calculate_hungarian_vat_return`)
A `calculate_hungarian_vat_return` adatbázis-függvény kibővült a halasztott ÁFA logikával:
- Az eredeti teljesítési időszakban a `exclude_from_accounting = true` ÉS `accounting_exclusion_type = 'DEFERRED_VAT'` számlák nem kerülnek levonásba (kiszűrésre kerülnek a 64–66. sorokból és a 65M tételes lapról).
- Ha egy korábbi időszaki halasztott számlát beemeltek a vizsgált időszakra (`deferred_vat_target_period = p_period`), akkor annak adóalapja és ÁFA összege automatikusan bekerül az aktuális időszak levonható soraiba (64–66) és a 65M partnerenkénti összesítőbe.

### 4. Reaktivitás és Kliens Állapotkezelés
- `useQuestionableInvoices` React Query hook kezeli a kérdéses számlák lekérdezését és a cache invalidációt (`['questionable-invoices', companyId]`, `['nav-invoices']`, `['invoices']`, `['vat-return']`).
- A Dashboardon elhelyezett `DeferredInvoicesWidget` valós időben reagál a számlák beemelésére vagy státuszváltására.

---

## ⚡ Consequences

### Pozitív
- **Nulla elveszett ÁFA levonási jog:** A 2 éves jogvesztő határidő visszaszámlálója és a havi bevallás készítésekor megjelenő proaktív figyelmeztetés megakadályozza a határidő túllépését.
- **Transzparens audit trail:** Pontosan nyomon követhető, hogy ki, mikor és miért halasztotta el a számla elszámolását, és melyik időszakban került végül levonásba.
- **Konzisztens kettős könyvvitel:** A célidőszakhoz igazított beemelés garantálja, hogy a főkönyv, az analitika és a 65-ös bevallás egyezzen.

### Negatív & Kockázatok
- Bonyolultabb lekérdezések a bevallási motorban (a teljesítési dátum mellett a `deferred_vat_target_period` oszlopot is vizsgálni kell). Parciális indexekkel optimalizálva.

---

## 🔗 Kapcsolódó
- **BDR:** [065: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák Üzleti Szabályzata](../../business/decisions/065-deferred-vat-deduction-and-questionable-invoices.md)
- **PRD:** [P-172: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák UX](../../product/decisions/P-172-deferred-vat-deduction-and-questionable-invoices-ux.md)
- **ADR:** [A-122: Nem Könyvelt Státusz Szinkronizációja](./A-122-exclude-from-accounting-sync-and-optimistic-ui.md)
- **Adatbázis Séma:** [04-invoices.md](../../architecture/database/04-invoices.md) · [05-nav.md](../../architecture/database/05-nav.md)
