# A-051: ÁFA Bevallás Kalkuláció Robusztusság (Auto-Seed & Date Fallback)

**Status:** Decided  
**Date:** 2026-08-25  
**Utoljára frissítve:** 2026-08-25  

## Context
Az ÁFA bevallás (2665) generálásakor a `calculate_vat_return` RPC aggregálta a `nav_invoices` és `nav_invoice_items` tételeket a `vat_codes` táblában definiált ÁFA kulcsok és sor-hozzárendelések alapján. 
Két kritikus hiba miatt az újonnan létrehozott vagy bizonyos NAV szinkronizációval rendelkező cégeknél (pl. SportsBase Hungary Kft.) a számítás `0 Ft` eredménnyel zárult:
1. **Hiányzó `vat_codes`:** Ha a cégnél nem futott le expliciten a `seed_default_vat_codes` és `seed_fad_vat_codes`, a számítási ciklus 0 iterációt végzett.
2. **Kizárólagos `invoice_delivery_date` szűrés:** Olyan számláknál, ahol a teljesítés dátuma NULL volt (mert a NAV API-ból a kibocsátás / kelt dátuma `invoice_issue_date` hordozta a releváns időpontot), a sorok kiestek az időszaki szűrőből.

## Decision
1. **Automatikus ÁFA Kód Seedelés a Kalkulációban:**
   - A `calculate_vat_return` RPC legelején ellenőrzi, hogy léteznek-e `vat_codes` sorok a megadott `p_company_id`-hoz.
   - Ha nem talál rekordot, automatikusan meghívja a `seed_default_vat_codes(p_company_id)` és `seed_fad_vat_codes(p_company_id)` determinisztikus SQL függvényeket.
   - Az `ON CONFLICT (company_id, code) DO NOTHING` védi a könyvelők által testreszabott egyedi ÁFA kódokat.

2. **Intelligens Dátumfeloldás (Date Fallback Hierarchy):**
   - A `nav_invoices` szűrésekor és az M-lapok összeállításakor a következő prioritást használjuk:
     `COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)`
   - Így garantált, hogy a folyamatos teljesítésű felülbírálatok (`ti_override`, `calculated_ti`), a tényleges teljesítés (`invoice_delivery_date`), vagy annak hiányában a kibocsátás (`invoice_issue_date`) alapján a számlák a pontos adózási időszakba kerülnek.

3. **Meglévő Adatok Tisztítása (`20260825010000_fix_vat_return_calculation_and_codes.sql`):**
   - Minden korábbi cégnél, ahol nem létezett `vat_codes`, megtörtént az alapértelmezett kódok beültetése.
   - A `nav_invoices` táblában a NULL `invoice_delivery_date` értékeket pótoltuk az `invoice_issue_date` értékkel.

## Consequences
**Pozitív:**
- A számítás gomb megnyomásakor minden cég azonnal pontos, valós ÁFA analitikát és M-lapokat kap.
- Megszűnnek a csendes 0 Ft-os kalkulációs hibák.
- 100%-ban determinisztikus, jogszabály-konform működés NAV 2665 struktúra szerint.

## Kapcsolódó
- [A-003: Multi-tenancy RLS alapon](./A-003-multi-tenancy-rls.md)
- [A-012: NAV Online Számla integráció](./A-012-nav-integration.md)
- [A-026: Support Admin Ideiglenes Hozzáférés](./A-026-support-impersonation-access.md)
