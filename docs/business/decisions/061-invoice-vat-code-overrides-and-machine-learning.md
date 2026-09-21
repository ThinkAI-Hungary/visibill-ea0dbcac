# Decision 061: Számlatétel Áfakód Felülbírálat és Gépi Tanulási (ML) Szabályrendszer

**Status:** Decided  
**Category:** Számlázás, ÁFA és Gépi Tanulás  
**Date:** 2026-09-21  

---

## Question
Hogyan biztosítható a könyvelők számára a számlatételek egyedi és kötegelt áfakód felülbírálata úgy, hogy a rendszer megjegyezze a kézi módosításokat, és a jövőbeli számlákon automatikusan felajánlja vagy alkalmazza a megtanult áfakódokat?

---

## Decision

A rendszer a számlatételek áfakódjainak szerkesztésére és tanulására 4-lépcsős intelligens prioritási kaszkádot és audit naplózási szabályrendszert vezet be:

### 1. Kézi Szerkeszthetőség & Vizuális Kódrendszer
- A számlák tételes nézetében (`InvoiceItemsDialog`) a könyvelő minden számlatételhez (akár NAV Online Számla, akár manuálisan feltöltött tétel) közvetlenül hozzárendelhet vagy megváltoztathat egy érvényes ÁFA gyűjtőkódot (`vat_code`).
- Támogatott mind az **egyedi cella szintű szerkesztés** (inline popover), mind a **több kijelölt tétel kötegelt (batch) módosítása**.
- A felület támogatja a kettős megjelenítési módot a cég beállításai (`vat_code_display_mode`) szerint:
  - **Konvencionális könyvelői kódok** (pl. `25`, `18`, `05`, `FAD`, `EXP`, `TAM`, `EU`).
  - **Hivatalos NAV 2665 kódok** (pl. `BE_27_LEV`, `BE_5_LEV`, `BE_FORD_27`, `KIM_27`).
- Az inline badge színe és tooltipje egyértelműen jelzi az áfakód forrását (kézi felülírás, ML partner szabály, ML tételszabály, vagy automatikus törvényi heurisztika).

### 2. A 4-Lépcsős Feloldási Kaszkád (Decision Cascade)
Egy tétel áfakódjának meghatározásakor a rendszer szigorúan az alábbi prioritási sorrendben értékeli ki a szabályokat:
1. **Kézi tétel felülírás (`manual_override`):** Ha az adott tétel `vat_code` mezője a bázisban ki van töltve, az abszolút prioritást élvez.
2. **Partner-specifikus megtanult szabály (`partner_learned`):** Ha ugyanazon partner adószáma (`partner_tax_number`) és azonos áfakulcsa mellett korábban már történt felülírás azonos vagy hasonló tételleírásra (normalizált szövegegyezés), a rendszer automatikusan a megtanult partneri kódot rendeli hozzá.
3. **Cégszintű tételszabály (`company_learned`):** Ha az adott partnernél még nincs előzmény, de a cégnél az adott terméknévre/leírásra (pl. "Betonacél", "Mobiltelefon flotta") már létezik felülírás, a rendszer felajánlja a cég szintjén megtanult kódot.
4. **Törvényi heurisztikus fallback (`legacy_default`):** Ha nincs sem kézi felülírás, sem tanulási előzmény, a rendszer az adómérték és teljesítési feltételek alapján törvényi alapértelmezést alkalmaz (`matchItemToVatCode`).

### 3. Audit Naplózás és Adatvédelem
- Minden kézi módosítást a `public.vat_code_overrides_log` tábla rögzít felhasználói azonosítóval (`created_by`), időbélyeggel, eredeti és új kóddal, partner adószámmal és tételleírással.
- A gépi tanulási memória multi-tenant elszigetelt: egy cég könyvelési döntései kizárólag a saját cégén belül képeznek tanulási szabályt, más cégek adatait nem befolyásolják.

---

## Rationale
A könyvelők napi munkájában az automatikus ÁFA besorolás kulcsfontosságú hatékonysági tényező, de a törvényi kivételek (pl. fordított adózású acéltermékek, nem levonható tételek, speciális szolgáltatások) miatt a kézi felülbírálat elengedhetetlen. A tanulási folyamat nélkül a könyvelőnek havonta ugyanazon partnerek ugyanazon tételeit újra és újra kézzel kellene átkódolnia. A 4-lépcsős kaszkád megszünteti a redundáns manuális munkát és megakadályozza a könyvelési hibákat.

---

## Kapcsolódó
- **ADR**: [A-135: Kettős Áfa Kódrendszer és F.AFA Fordított Adózási Felismerés](../../architecture/decisions/A-135-dual-vat-code-system-and-reverse-charge-recognition.md)
- **ADR**: [A-136: Számlatételek Áfakód Szerkeszthetősége és Gépi Tanulási (Machine Learning) Memória](../../architecture/decisions/A-136-invoice-vat-code-overrides-and-machine-learning.md)
- **PRD**: [P-101: Számlatételek Áfakód Szerkesztése, Kettős Áfakód Megjelenítés és Tömeges Módosítás UX](../../product/decisions/P-101-invoice-vat-code-overrides-and-dual-display-ux.md)
- **Kapcsolódó BRD**: [Decision 060: NAV 2665 ÁFA Bevallási Szabályok és Acélipari Kötelezettség](./060-nav-2665-vat-rules-and-steel-reporting.md)
