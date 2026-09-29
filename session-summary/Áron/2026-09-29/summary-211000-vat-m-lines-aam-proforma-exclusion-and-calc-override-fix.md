# Session Summary — 2026-09-29 21:10

```text
feat(vat, db, replica): 65M belföldi összesítő lap jogszabályi szűrések (AAM, proforma, biztosítás), Számítás gomb vat_row_override hiba vizsgálata & validálása

- 2665M Belföldi Tételes Összesítő Jelentés Jogszabályi Tisztítása (Áfa tv. 10. sz. melléklet)
  - Alanyi adómentes (AAM) partnerek és számlák automatikus kizárása: a magyar adószám 9. jegyében '1'-es áfa-kóddal bíró vagy megnevezésükben alanyi mentes cégek számlái után nem illeti meg az adóalanyt adólevonási jog, így nem képezhetik a 65M bevallási ív részét (`isAamPartnerOrTaxNumber`)
  - Díjbekérők és proforma bizonylatok kizárása: a nem teljesített vagy előzetes fizetési értesítők (díjbekérők, proformák, garanciajegyek) nem minősülnek áfa-törvény szerinti bizonylatnak, szigorúan kizárásra kerültek a bevallási és analitikus tétellistákból (`isProformaInvoice`)
  - Biztosítótársaságok és biztosítási díjak kizárása: az Áfa tv. 86. § (1) a) szerinti tárgyi adómentes, biztosítási adó hatálya alá tartozó díjak és kötvények levonható áfát nem tartalmaznak, így nem szerepelhetnek a 65M lapon (`isInsurancePartnerOrInvoice`)
  - 0 Ft levonható áfájú, nem fordított adózású belföldi számlák kizárása az M-lapos partnerösszesítésből
  - Univerzális védelmi őr (Guard) bevezetése: `shouldExcludeFromMLine()` implementálása a `src/features/vat/types.ts`-ben, alkalmazása a Master-Detail (`VatMLineMasterDetail.tsx`), Drill-Down (`VatMLineDrillDown.tsx`), gyűjtőkódos analitika (`VatCollectorAnalyticsView.tsx`), tételes napló (`VatItemizedJournalView.tsx`), éves mátrix (`VatAnnualMatrixView.tsx`) felületeken és a NAV 2665 XML export motorban (`src/lib/vatReturnXml.ts`)
  - Dedikált adatbázis migráció: `supabase/migrations/20260929200000_exclude_aam_proforma_insurance_from_m_lines.sql`

- ÁFA Bevallás "Számítás" Gomb Hibájának Feltárása & Élő Validáció (`column nii.vat_row_override does not exist`)
  - Felhasználói hibajelentés: az ÁFA bevallás felületen a zöld "Számítás" gomb megnyomásakor a rendszer a fenti hibaüzenetet dobta fel toast formájában
  - Gyökérok analízis: a fejléc szintű `vat_row_override` mező kizárólag a `nav_invoices` (`ni`) és az `invoices` (`inv`) táblákon létezik, míg a tétel szintű `nav_invoice_items` (`nii`) táblán nem. Bármely SQL ág vagy korábbi szkript, amely a tétel aliasát (`nii.vat_row_override`) hivatkozta a fejléc alias (`ni.vat_row_override`) helyett, azonnali PostgreSQL 42703 hibát váltott ki
  - Élő RPC futtatási validáció a távoli Supabase éles adatbázisban:
    * `calculate_vat_return(p_company_id, 2026, 1, 'H', 'all')` (5 paraméteres scope-os RPC): SIKERES (HTTP 200 OK)
    * `calculate_vat_return(p_company_id, 2026, 1, 'H')` (4 paraméteres legacy RPC): SIKERES (HTTP 200 OK)
    * `calculate_hungarian_vat_return(p_company_id, 2026, 1, 'H')`: SIKERES (HTTP 200 OK)
    * Számított adatok: Fizetendő: 928 260 Ft (36. sor), Levonható: 106 860 Ft (76. sor), Egyenleg: 821 400 Ft (83/84. sor), 8 db bevallási sor és 12 db megtisztított 65M partnerlap generálva
  - Helyi és távoli kódbázis audit: igazolva, hogy minden frontend hook (`useVatReturnData.ts`, `useVatScope.ts`) és SQL migráció helyesen a fejléc aliast használja

- Minőségbiztosítás (QA) & Dokumentáció Szinkronizáció
  - Unit tesztek: `src/features/vat/__tests__/vatProformaFilter.test.ts` (8 teszt) sikeresen hozzáadva
  - Teljes ÁFA tesztcsomag: 28/28 teszt sikeresen lefutott (`vatCodeOverride.test.ts`, `vatProformaFilter.test.ts`, `vatEngine.test.ts`)
  - Architektúra és termékdöntési dokumentációk frissítése (A-159, A-167, P-119, P-126)
```
