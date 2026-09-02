# A-082: Partially Paid Invoices Status, Server-Side Amount Aggregation & Trigger Alignment

**Status:** Decided  
**Date:** 2026-09-02  
**Category:** Database / Accounting / Invoices / RPC  

## Context

Korábban a számlák (`nav_invoices`, `invoices`) kifizetettségi státusza binárisan működött:
1. Ha egy számlához bármilyen banki tranzakció (`transactions.matched_invoice_id` vagy `transaction_invoice_matches`) kapcsolódott, az adatbázis triggerek automatikusan `paid = true`-ra állították a számlát és az RPC függvények (`get_filtered_nav_invoices`, `get_filtered_submitted_invoices`) `'matched'` státuszt adtak vissza.
2. Amennyiben a partner csak részösszeget fizetett (pl. 179 273 HUF-ból 156 323 HUF-ot), a számla a felületen félrevezetően zöld „Kifizetve” státusszal jelent meg, elfedve a nyitott 22 950 HUF követelést/tartozást.

## Decision

1. **Szerveroldali Dinamikus Összeg-Aggregáció és Státuszmeghatározás:**
   - A `get_filtered_nav_invoices` és `get_filtered_submitted_invoices` RPC-k a kapcsolódó banki tranzakciókból kiszámítják a ténylegesen kifizetett összeget (`paid_amount = SUM(ABS(amount))`) és a hátralévő összeget (`remaining_amount = GREATEST(0, gross_amount - paid_amount)`).
   - Státuszmeghatározási szabályok (0.5 HUF kerekítési toleranciával):
     - Ha `paid_amount >= gross_amount - 0.5` VAGY `is_manual_payment = true` VAGY `payment_method = 'CASH'`: `'matched'` (Teljesen kifizetve).
     - Ha `paid_amount > 0` ÉS `paid_amount < gross_amount - 0.5`: `'partially_paid'` (Részben kifizetve).
     - Ha `paid_amount = 0` és van jóváhagyásra váró tranzakció javaslat: `'suggested'`.
     - Különben: `'unmatched'` (Nyitott).

2. **Szűrők Kiterjesztése:**
   - A `p_paid` paraméter támogatja az `'all'`, `'yes'` / `'paid'`, `'partial'` / `'partially_paid'`, és `'no'` / `'unmatched'` értékeket.
   - A `p_kpi_filter` paraméter támogatja az `'all'`, `'matched'` (amely magában foglalja a teljesen és részben fizetett számlákat), `'partially_paid'`, `'suggested'`, és `'unmatched'` szűrést.

3. **Párosítási Triggerek Szigorítása:**
   - A `mark_nav_invoice_paid_on_transaction_match` és `mark_invoice_paid_on_multi_match` triggerek csak akkor állítják `paid = true`-ra a számlát, ha `total_paid >= gross_amount - 0.5`. Részletfizetésnél a `transaction_id` rögzítésre kerül, de a `paid` flag `false` marad.

## Consequences

- **Pozitív:** Az ügyfél azonnal és pontosan látja a számlák valós pénzügyi teljesítettségét és a fennmaradó összeget. A szerveroldali szűrés pontos és azonnali (<50ms).
- **Konzisztencia:** Az adatbázis triggerek és az RPC kalkulációk összhangban kezelik a részletfizetéseket.

## Kapcsolódó
- [P-064: Partially Paid Invoice Status, Badge & Filter UX](../../product/decisions/P-064-partially-paid-invoice-status-ux.md)
- [A-016: PostgreSQL Query Strategy & RPC Optimization](./A-016-postgresql-query-strategy.md)
- [A-055: Server-Side Invoice Query, KPI Aggregation & GIN Trigram Optimization](./A-055-server-side-invoice-query-kpi-optimization.md)
