# A-201: NAV 2665 ÁFA Bevallás: 43. (Tárgyi eszköz értékesítés) és 45. (Előleg) Sorok Adóösszeg Implementációja

**Status:** Decided  
**Date:** 2026-10-05  
**Utoljára frissítve:** 2026-10-05  
**Kapcsolódó döntések:** [A-051: ÁFA Bevallás Kalkuláció Robusztusság](./A-051-vat-return-auto-seed-and-date-fallback.md) · [A-080: NAV ÁNYK 2665 ÁFA-Bevallás](./A-080-nav-anyk-vat-return-xml-standardization.md) · [A-131: NAV 2665 ÁFA Bevallás Sormegfeleltetés](./A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md) · [A-167: NAV 2665 Hivatalos Nyomtatvány Digitális Replika](./A-167-nav-2665-official-tax-form-digital-replica.md) · [P-160: NAV 2665 43. és 45. Sorok Adóösszeg UX](../../product/decisions/P-160-nav-2665-vat-return-row43-and-row45-tax-amount-ux.md)

---

## Context

Az EB-0117-es ügyfélszolgálati hibajegyben (Kiss-Százi Emese, VBV Vision Kft., `5364d0be-e92a-4b94-9704-f457cf71f140`) a felhasználó jelezte, hogy a 2665-ös ÁFA bevallásban a 43. sorban (tárgyi eszköz értékesítés az augusztusi időszakra) és a 45. sorban (értékesítéshez kapott előleg a februári időszakra) a rendszer nem jeleníti meg az ÁFA összeget, kizárólag a nettó adóalapot.

A korábbi vizsgálat során tévesen az a feltevés rögzült, hogy a NAV 2665A-01-02-es lapján a 43. és 45. sorok mint tájékoztató rovatok kizárólag `(a)/(b) Az adó alapja` oszloppal rendelkeznek, és az adó összege rovat az ÁNYK-ban le van zárva. E feltételezés alapján a `vat_form_rows` táblában `has_tax = false` került beállításra, és a `calculate_hungarian_vat_return` adatbázis RPC-ben a `tax_amount` fix 0 értékkel került beszúrásra a `vat_return_lines`-ba.

A hivatalos Nemzeti Adó- és Vámhivatal (NAV) 2665 nyomtatvány (2665A-01-02 lap) és a hivatalos kitöltési útmutató tüzetes vizsgálata azonban cáfolta ezt:
1. A 2665A-01-02 lapon a 43. sorhoz két ÁNYK mezőkód tartozik: `0C0001C0043BA` (adó alapja) és `0C0001C0043CA` (adó összege).
2. A 45. sorhoz szintén két ÁNYK mezőkód tartozik: `0C0001C0045BA` (adó alapja) és `0C0001C0045CA` (adó összege).
3. A kitöltési útmutató (63. oldal) egyértelműen kimondja, hogy a 36. összesen sorból a tárgyi eszköz értékesítést a 43. sorban adóalap és adó bontásban, a 05–07. és 110. sorokból az előleg címén kapott összeget pedig a 45. sorban adóalap és adó bontásban kiemelten fel kell tüntetni. (Ezzel szemben a 46. sor [01. és 04. export/mentes előleg] valóban csak adóalapot tartalmaz, mert nincs hozzá tartozó adó).

---

## Decision

1. **Adatbázis séma metaadatok frissítése (`vat_form_rows`):**
   A `public.vat_form_rows` táblában a `row_number = '43'` és `row_number = '45'` soroknál a `has_tax` mezőt `true` értékre állítottuk a magyar joghatóságra (`country_code = 'HU'`).

2. **Számítási motor kibővítése (`calculate_hungarian_vat_return`):**
   - Változók bevezetése: `v_line43_tax NUMERIC := 0;` és `v_line45_tax NUMERIC := 0;`.
   - Tételszintű akkumuláció:
     - Kifejezett ÁFA kód / sor felülbírálásnál (`vat_row_override = '43'` vagy `'45'`), valamint `vat_code_target_rows` feldolgozásakor a nettó alap mellett a tétel tényleges adóját (`v_tax_huf`) hozzáadjuk `v_line43_tax`-hoz, illetve `v_line45_tax`-hoz.
     - Automatikus felismerésnél (`inv_rec.is_advance` és `inv_rec.is_tangible_asset`) a `v_line43_tax` és `v_line45_tax` gyűjtésre kerül.
   - Sorbeszúrás: a `vat_return_lines` beszúrásakor a korábbi hardkódolt `0` adó helyett `tax_amount = v_line43_tax` és `tax_amount = v_line45_tax`, valamint azok kerekített eFt értékei (`ROUND(v_tax/1000)::int`) kerülnek mentésre.

3. **Duplakönyvelés és fizetendő ÁFA védelem (Invariáns):**
   A 43. és 45. sorok szigorúan tájékoztató / részletező jellegűek, amelyek a 07. (és 05/06.) sorokból, valamint a 36. összesítő sorból emelnek ki forgalmat. Ezért a `v_line43_tax` és `v_line45_tax` **nem adódik hozzá** a `v_total_payable_tax`-hoz (36. sor), megakadályozva a fizetendő ÁFA duplikálódását.

4. **Frontend szinkronizáció:**
   - `Nav2665Sheet0102.tsx`: a digitális űrlap replikában a 43. és 45. soroknál `hasTax={true}` és `taxVal={getVal('43'|'45', 'tax')}` került beállításra.
   - `VatCollectorAnalyticsView.tsx`: az analitikai tételes bontásban a 43-as és 45-ös sorhoz rendelésnél `vat: vat` kerül átadásra a korábbi `vat: 0` helyett.

---

## Consequences

### Pozitív
- A 2665-ös ÁFA bevallás felületén és a letöltött nyomtatványokon (ÁNYK XML / PDF) mindkét tájékoztató sorban megjelenik a valós adóösszeg.
- A VBV Vision Kft.-nél a februári 45. sorban forintra pontosan megjelent a 15 000 eFt alaphoz tartozó 4 050 eFt ÁFA (`VBV-2026-6`), az augusztusi 43. sorban pedig a 13 780 eFt alaphoz tartozó 3 720 eFt ÁFA (`VBV-2026-28`).
- A könyvelők számára a NAV ÁNYK ellenőrzése során nincs eltérés a Visibill által generált adatok és a hivatalos nyomtatvány elvárt rovatai között.

### Negatív / Kockázatok
- Korábbi időszakok megnyitásakor az automatikus újraszámítás kitölti a korábban üresen hagyott ÁFA cellákat; a fizetendő ÁFA végösszeg (83. sor) azonban változatlan marad, így könyvelési egyenleget nem borít fel.

---

## Kapcsolódó
- [P-160: NAV 2665 43. és 45. Sorok Adóösszeg UX](../../product/decisions/P-160-nav-2665-vat-return-row43-and-row45-tax-amount-ux.md)
- [A-167: NAV 2665 Hivatalos Nyomtatvány Digitális Replika](./A-167-nav-2665-official-tax-form-digital-replica.md)
- [A-080: NAV ÁNYK 2665 ÁFA-Bevallás](./A-080-nav-anyk-vat-return-xml-standardization.md)
- [A-131: NAV 2665 ÁFA Bevallás Sormegfeleltetés](./A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md)
