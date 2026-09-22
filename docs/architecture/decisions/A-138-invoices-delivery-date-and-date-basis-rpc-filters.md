# A-138: Számlák Teljesítés Dátuma és Dátum Alap RPC Szűrés

**Status:** Decided  
**Date:** 2026-09-22  
**Category:** Database / Backend / RPC / Performance  
**Releváns jegy:** Kollár Kristóf (Victoria Music Kft., 2026. szept. 21. 22:15)  

---

## Context & Problem
A Visibill szerveroldali számlalistázása (`get_filtered_nav_invoices`, `get_filtered_submitted_invoices`) és KPI összegzése (`get_invoice_kpis`) korábban kizárólag a kiállítás kelte (`p_issue_date_from`, `p_issue_date_to`) alapján tette lehetővé a dátumszűrést.
Amikor egy vállalkozás a cégbeállításokban átváltott "Teljesítés szerint" elszámolásra (`company_settings.gl_date_basis = 'teljesites'`), vagy a könyvelő az ÁFA-bevalláshoz a teljesítési időszak bizonylatait szerette volna leválogatni, a felület nem tudta szűrni a számlákat teljesítés dátuma (`teljesites_datuma` / `invoice_delivery_date`) szerint, ami eltérést eredményezett a könyvelői szoftverek és a Visibill számlanézete között.

## Decision

1. **RPC Szignatúrák Bővítése Alapértelmezett Értékekkel:**
   - A `get_filtered_nav_invoices`, `get_filtered_submitted_invoices` és `get_invoice_kpis` eljárások kiegészültek a következő paraméterekkel:
     - `p_delivery_date_from date DEFAULT NULL`
     - `p_delivery_date_to date DEFAULT NULL`
     - `p_date_basis text DEFAULT 'kibocsatas'`
   - Az alapértelmezett értékek miatt a meglévő hívások és tesztek 100%-ban visszafelé kompatibilisek maradtak.

2. **Szerveroldali Dátumszűrés Logika:**
   - Ha `p_delivery_date_from` vagy `p_delivery_date_to` megadásra kerül, a szűrés közvetlenül a bizonylat teljesítési dátumára (`COALESCE(teljesites_datuma, invoice_delivery_date)`) vonatkozó WHERE feltétellel történik.
   - Ha nincs közvetlen delivery filter, de a `p_date_basis = 'teljesites'` és a felhasználó az általános dátumtartományt adja meg (`p_issue_date_from` / `p_issue_date_to`), a rendszer a teljesítés dátumára alkalmazza az időszaki szűrést (fallback kibocsátásra, ha nincs kitöltve teljesítés).

3. **In-place Függvénycsere és Tranzakcióbiztonság:**
   - A meglévő RPC-k törlése (`DROP FUNCTION IF EXISTS ...`) és újratelepítése tiszta tranzakcióban történt a `20260922154500_add_delivery_date_and_date_basis_to_invoice_filters.sql` migrációban.
   - A production Supabase adatbázison azonnal élesítésre és verifikálásra került.

4. **Kliensoldali Integráció és Cache Kulcsok:**
   - A `useInvoiceFilters.ts` hook TanStack Query kulcsai kibővültek a `deliveryDateFrom`, `deliveryDateTo` és `dateBasis` értékekkel, garantálva az instant cache invalidációt és prefetch konzisztenciát.

## Consequences
- **Pozitív:** A Victoria Music Kft. és minden teljesítés szerint könyvelő cég pontosan megegyező darabszámot és összegeket lát a számlák modulban, mint az ÁFA analitikában és a külső könyvelőprogramban.
- **Pozitív:** Zero breaking change, teljesítménycsökkenés nélkül.
