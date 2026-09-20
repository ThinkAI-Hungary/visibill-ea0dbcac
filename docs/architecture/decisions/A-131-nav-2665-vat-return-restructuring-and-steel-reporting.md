# A-131: NAV 2665 ÁFA Bevallás Sormegfeleltetés, Gyűjtőkódok Tisztítása, 6/B Acélipari Nyilatkozat és Egész Kilogrammos Kerekítés

**Status:** Decided  
**Date:** 2026-09-20  
**Utoljára frissítve:** 2026-09-20  
**Érintett komponensek:** `calculate_vat_return` RPC, `vat_codes`, `invoice_items`, `nav_invoice_items`, `VatReturnViewTab.tsx`, `VatSteelProductsSection.tsx`, `useSteelProductsData.ts`, `VatNav65Replica.tsx`, `VatRowDrillDown.tsx`, `InvoiceItemsDialog.tsx`

---

## Context

A hatályos magyar ÁFA bevallási nyomtatvány (NAV 2665, korábban 2565/2465) és az ahhoz kapcsolódó gyűjtőkódos analitika több ponton inkonzisztens vagy elavult volt a jogszabályi előírásokhoz és a könyvelői gyakorlathoz képest:
1. **Sormegfeleltetések eltérései**:
   - A belföldi 5%-os ÁFA tévesen vagy redundánsan szerepelt, miközben a hivatalos nyomtatványon a **05. sorba** tartozik.
   - A belföldi 18%-os ÁFA a hivatalos **06. sorba** tartozik.
   - A belföldi 27%-os ÁFA a **07. sorba** tartozik.
   - A **01. sor** nem tárgyi adómentes értékesítés, hanem *Közösség területén kívülre történő termékértékesítés (3. országos export)*.
   - Hiányzott az önálló **08. sor**: *Közérdekű vagy speciális jellegére tekintettel adómentes tevékenység (TAM)* (egészségügy, oktatás, fogorvos, ingatlan bérbeadás).
   - Az ÁFA területi hatályán kívüli ügyleteknél (91. és 92. sor) kötelező egyértelműen feltüntetni a feliratban, hogy **„SZOLGÁLTATÁSOK”**.
2. **Kód-redundancia és hibás kódok**:
   - `BE_18` és `BE_18_LEV`, `BE_5` és `BE_5_LEV`, `BE_27` és `BE_27_LEV` redundáns kettősséget okozott.
   - A `BE_0_NEM` egy korábbi hibás migrációs maradvány volt, amely nem létezik a jogszabályban.
   - A `FAD_EPIT_5` nem létezik az Áfa törvényben (építőipari fordított adózás kizárólag 27%-os kulccsal lehetséges).
   - A `BE_FORD_27` és `FAD_EPIT_27` egymás redundáns másolatai voltak.
3. **Fordított adózás (FAD) kettős elszámolása**:
   - Minden belföldi fordított adózású beszerzés (`BE_FORD_27`, `FAD_EPIT_27`, `FAD_HULL_27`, `FAD_ACEL_27`) kötelezően mind fizetendő adóként (**29. sor**), mind pedig a levonhatósági hányad arányában levonható adóként (**66. sor**) meg kell jelenjen.
   - Az értékesítési fordított adó a **04. sorban** jelenik meg, ahol a felirat nem lehet „0%”, hanem kötelezően **„mentes”**.
4. **Áfa tv. 6/B. melléklet szerinti vas- és acéltermékek (2665-07 és 2665-08 nyilatkozat)**:
   - A 72-es és 73-as KN/VTSZ kódcsoportok alá tartozó acéltermékek belföldi fordított adózású értékesítése és beszerzése esetén a NAV külön analitikai nyilatkozatot követel meg tételes KN/VTSZ számmal és kerekített egész kilogrammban megadott nettó tömeggel.
   - Korábban sem a `invoice_items`, sem a `nav_invoice_items` táblákban nem létezett tömeg mező, és hiányzott az önálló analitikai felület.

---

## Decision

### 1. Adatbázis Séma & Migráció (`20260920180000_restructure_vat_codes_and_nav65_rows.sql`)
1. **Oszlopbővítés**:
   - Hozzáadásra került a `net_weight_kg NUMERIC` oszlop mindkét tételtáblához (`public.invoice_items` és `public.nav_invoice_items`).
2. **Gyűjtőkód Törzs Tisztítás**:
   - Törlésre kerültek a redundáns és érvénytelen kódok az összes cég alól: `BE_18`, `BE_5`, `BE_27`, `BE_0_NEM`, `FAD_EPIT_5`, `BE_FORD_5`, `KIM_0`, `BE_0`.
   - A bejövő kódok egységesen `_LEV` utótagot kaptak (`BE_27_LEV`, `BE_18_LEV`, `BE_5_LEV`).
   - Sormegfeleltetés frissítve a `vat_codes.target_rows` JSONB mezőben:
     - 5%: `05` sor (alap és adó)
     - 18%: `06` sor (alap és adó)
     - 27%: `07` sor (alap és adó)
     - TAM: `08` sor (alap)
     - Export: `01` sor (alap)
     - Fordított értékesítés: `04` sor (alap)
     - Fordított beszerzések: kettős mapping a `29` (fizetendő) és `66` (levonható) sorokba.
3. **`calculate_vat_return` Motor Átírása**:
   - A tárolt eljárás szigorúan `JSONB` struktúrával tér vissza (`return_id`, `status`, `lines_count`, `m_lines_count`, `summary`).
   - A `vat_returns` tábla valós oszlopneveit célozza (`amount_to_pay`, `amount_reclaimable`, `amount_carryforward`, `prev_period_carryforward`).
   - A státusz szigorúan a kisbetűs CHECK feltételnek felel meg (`'draft'`, `'validated'`, `'finalized'`).
   - Kezeli a részleges egyedi indexet (`vat_returns_period_uq` WHERE `period_month IS NOT NULL`) beillesztés/frissítés esetén.
   - Számítja a 01, 04, 05, 06, 07, 08, 29, 64, 65, 66, 76, 83, 86 sorokat és a partnerenkénti `vat_return_m_lines` sorokat.

### 2. Formázás & Univerzális „mentes” Kezelés
- Bevezetésre került a [`formatVatRate`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/lib/utils.ts) függvény:
  - Bármilyen 0-s érték (`0`, `0.0`, `'0'`, `'0%'`, `'0.00'`, `'0,00'`) és adómentes/fordított kód (`AAM`, `TAM`, `FAD`, `FORD`, `EXPORT`, `EXP`, `DOMESTIC_REVERSE_CHARGE`, `null`, `undefined`) esetén a felirat egységesen és kötelezően: **`mentes`**.
  - Pozitív kulcsok esetén szabályos százalékos kijelzés (`27%`, `18%`, `5%`), beleértve a NAV által visszaadott tizedes törteket is (`0.27` ➔ `27%`).

### 3. Áfa tv. 6/B. Melléklet Acélipari Analitika & Adatkezelés
- Létrehozva a [`useSteelProductsData.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/vat/hooks/useSteelProductsData.ts) központi hook:
  - Automatikus jelölt-felismerés: 72/73 KN/VTSZ kódok, kulcsszavak (acél, betonacél, zártszelvény, gerenda, lemez, háló, fémhulladék) és FAD kulcsok.
  - Teljességi vizsgálat: rendelkezik-e a tétel érvényes VTSZ kóddal és pozitív nettó tömeggel.
- Létrehozva a [`VatSteelProductsSection.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/vat/components/VatSteelProductsSection.tsx) komponens:
  - Önálló nézet a Bevallás fülön (`viewMode === 'steel'`).
  - Összesítő KPI kártyák (tételek száma, nettó tömeg kg/tonna, adóalap Ft/eFt, nyilatkozati státusz).
  - Irány szerinti szűrés: Beszerzés (66. sor / 2665-08) vs. Értékesítés (04. sor / 2665-07).
  - Helyben szerkeszthető VTSZ és kg popover.
  - **Hivatalos CSV Export**: tartalmazza a `NAV 2665 Nettó tömeg (egész kg)` oszlopot (`Math.round(netWeightKg)`) a 2665-07/08 nyomtatványi szabályoknak megfelelően, és a `Pontos tömeg (kg)` oszlopot a könyvviteli egyeztetéshez.
- [`InvoiceItemsDialog.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/InvoiceItemsDialog.tsx):
  - `ItemVtszWeightPopover` beépítése a tételek leírása alá kétirányú ikertétel-szinkronizációval (`nav_invoice_items` ↔ `invoice_items`).
  - Tájékoztató szöveg a popoverben: egész kg szükséges a NAV 2665 nyilatkozathoz.

### 4. ÁNYK XML Pre-Export Guard Védelem
- A [`VatReturnViewTab.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/vat/components/VatReturnViewTab.tsx) komponensben az ÁNYK XML letöltés gomb megnyomásakor a rendszer ellenőrzi, hogy van-e hiányos 6/B acélipari tétel.
- Ha van, egy felugró `AlertDialog` jelenik meg az érintett számlák és partnerek felsorolásával, amelyből a felhasználó vagy közvetlenül átválthat a 6/B lapra az adatok azonnali pótlásához („Tételek kiegészítése”), vagy dönthet a fájl hiányos letöltéséről („Letöltés hiányosan is”).

---

## Consequences

### Pozitív
- **100% NAV 2665 Nyomtatványi Konzisztencia**: A sorok, feliratok és kulcsok tökéletesen lefedik a hivatalos adóhatósági lapokat (01, 04, 05, 06, 07, 08, 29, 64, 65, 66).
- **Megszűnt redundancia és hibás kódok**: A törzsadatbázis tiszta, nincsenek duplikált kódok, a `BE_0_NEM` és `FAD_EPIT_5` törölve.
- **Acélipari Megfelelőség**: A 6/B melléklet hatálya alá tartozó cégek azonnal exportálható analitikát kapnak a 2665-07 és 2665-08 nyilatkozatok kitöltéséhez.
- **Biztonsági Háló**: A könyvelő nem tud véletlenül hiányos acélipari adatokkal bevallási XML-t letölteni anélkül, hogy a rendszer ne figyelmeztetné.

### Trade-off / Megfontolások
- **Kettős tömeg megjelenítés a CSV-ben**: A NAV 2665-07/08 szigorúan kerekített egész kg-ot kér, míg a számlákon és mérlegjegyeken tizedes pontosságú tömegek szerepelhetnek. Ezt a CSV exportban két külön oszloppal oldottuk fel (`NAV 2665 Nettó tömeg (egész kg)` és `Pontos tömeg (kg)`).

---

## Kapcsolódó
- [P-097: NAV 2665 Nyomtatvány Replika, 6/B Acélipari Analitika és ÁNYK Validáció UX](../../product/decisions/P-097-nav-2665-replica-steel-analytics-and-anyk-validation-ux.md)
- [P-032: [eaisyBooks] ÁFA Bevallás Workflow](../../product/decisions/P-032-vat-return-workflow.md)
- [Decision 060: NAV 2665 ÁFA Bevallási Szabályok, Gyűjtőkódok és 6/B Acélipari Kötelezettség](../../business/decisions/060-nav-2665-vat-rules-and-steel-reporting.md)
- [A-080: NAV ÁNYK 2665 ÁFA-Bevallás és 65M Összesítő Jelentés Szabványos XML Export](./A-080-nav-anyk-vat-return-xml-standardization.md)
- [A-078: Telefonszámla ÁFA Részleges Levonhatóság](./A-078-telecom-vat-deductibility-rules.md)
- [A-051: ÁFA Bevallás Automatikus Gyűjtőkód Inicializálás és Dátum Fallback](./A-051-vat-return-auto-seed-and-date-fallback.md)
