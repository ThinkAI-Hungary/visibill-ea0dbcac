# A-036: Pénztárbizonylat (Cash Voucher) Processing

**Status:** Decided
**Date:** 2026-07-14
**Utoljára frissítve:** 2026-07-14

## Context

Petty cash registers (házipénztár) track cash inflows and outflows. These are documented using cash vouchers (pénztárbizonylatok):
1. **Bevételi pénztárbizonylat** (receipt, cash inflow)
2. **Kiadási pénztárbizonylat** (payment, cash outflow)

We need to support manual upload of these documents, parse them using AI, store them in the database, and automatically sync them to the flattened `petty_cash_entries` table.

## Decision

We chose to reuse the existing `invoices` table and OCR pipeline instead of introducing a separate document table for cash vouchers.

1. **Storage in Invoices Table:** Cash vouchers are stored with `invoice_type = 'penztarbizonylat'`. The database check constraint `invoices_type_check` was updated to permit this type.
2. **Field Mapping:**
   - `bizonylatsorszam` -> `bizonylatsorszam` and `dokumentum_azonosito`
   - `kibocsatas_datuma` -> `kibocsatas_datuma`, `teljesites_datuma`, `fizetesi_hatarido`
   - `brutto_vegosszeg` -> `brutto_vegosszeg`, `fizetendo_osszeg`, `adoalap_osszesen`
   - `leiras` -> `adojogi_megjegyzes`
   - `partner_nev` -> If kiadás (INBOUND), mapped as `elado_nev`. If bevétel (OUTBOUND), mapped as `vevo_nev`.
3. **Petty Cash Synchronization:**
   We updated `sync_petty_cash_entries` to:
   - Exclude `'penztarbizonylat'` invoices from the generic cash expense step (step ④).
   - Sync `OUTBOUND` cash vouchers into `petty_cash_entries` as `'cash_sale'` with a positive amount.
   - Sync `INBOUND` cash vouchers into `petty_cash_entries` as `'cash_expense'` with a negative amount.
4. **Trigger-based Automation:**
   - Attached an `AFTER INSERT OR UPDATE OR DELETE` trigger `trg_sync_petty_cash_on_invoice` on the `invoices` table.
   - Triggers run `sync_petty_cash_entries` automatically on row insertion or deletion, and update synced details while preserving manual routing configuration (`register_id` and `routed_by`) on updates.

## Consequences

**Pozitív:**
- **Instant sync:** Realtime UI updates occur automatically when document processing completes or data is manually updated, without requiring manual trigger execution.
- **Preserved routing:** Manual changes by accountants to entries registers are maintained during updates.
- **Zero code duplication:** No new tables, triggers, or queues are needed for ingestion.
- **Easy UI reuse:** Vouchers can be rendered in the document lists with minimal frontend modifications.
- **Predefined RLS:** Reuses all robust tenant-isolation RLS rules defined on the `invoices` table.

**Negatív:**
- Storing cash vouchers in the `invoices` table makes the table semantically broader (contains both invoices and internal cash vouchers).

## Kapcsolódó
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
- [A-016: PostgreSQL query stratégia](./A-016-postgresql-query-strategy.md)
- [20260714164500_auto_sync_petty_cash_trigger.sql](../supabase/migrations/20260714164500_auto_sync_petty_cash_trigger.sql)
