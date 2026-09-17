# A-080: NAV ÁNYK 2665 ÁFA-Bevallás (2665A) és 65M Összesítő Jelentés (2665M) Szabványos XML Export Architektúra

**Status:** Decided  
**Date:** 2026-09-01  
**Utoljára frissítve:** 2026-09-17 (EB-0044: AbevJava 65A/65M Pozíciókód és Alnyomtatvány Szabványosítás)

## Context
A Visibill / eaisyBooks rendszer ÁFA moduljában a 65-ös ÁFA-bevallás XML letöltése korábban fiktív szöveges mezőneveket használt (`sor_01_alap`, `01_0001_adoszam_torzs`), és az azonosítója `2665` volt az ÁNYK által megkövetelt `2665A` (Főlap) és `2665M` (Alnyomtatványok) helyett. Továbbá az M-lapok belföldi összesítő adatai nem önálló `<nyomtatvany>` blokkokként, hanem a főnyomtatvány mezői közé ágyazva jelentek meg.

Ennek következtében az Általános Nyomtatványkitöltő (ÁNYK / AbevJava) a fájl importálásakor azonnali elutasítást adott (EB-0044 hibajegy):  
> *„Hibás típusú adatfile! Az alnyomtatvány nem a főnyomtatványhoz tartozik!”*

A hiteles NAV ÁNYK XML referenciaminta (`docs/think_ai_2465_11.xml`) alapján a teljes generálási architektúra szabványosításra került.

## Decision
1. **Hivatalos ÁNYK Burkoló (Envelope) és Névtér:**
   - A generált XML gyökéreleme: `<nyomtatvanyok xmlns="http://www.apeh.hu/abev/nyomtatvanyok/2005/01">`.
   - Kötelező `<abev>` blokk beépítése: `<hibakszama>0</hibakszama>`, `<hash>...</hash>`, `<programverzio>v.3.50.0</programverzio>`.
   - **Főnyomtatvány azonosító:** `${periodYear % 100}65A` (pl. 2026-ra `2665A`, 2025-re `2565A`, 2024-re `2465A`), nyomtatványverzió: `4.0`.
   - **Alnyomtatvány azonosító:** `${periodYear % 100}65M` (pl. 2026-ra `2665M`), nyomtatványverzió: `4.0`.
   - **Dátumformátum:** Szigorúan kötőjel nélküli 8 számjegyű dátum: `YYYYMMDD` (pl. `20260701`, `20260731`).

2. **Hivatalos Pozíció-alapú Mezőkódolás (`eazon`):**
   - **0A lap (Főlap azonosítás & keltezés):**  
     `0A0001E001A` (11 jegyű adószám), `0A0001E006A` (cégnév), `0A0001E007A` (képviselő), `0A0001E008A` (telefon), `0A0001F001A` (időszak tól), `0A0001F002A` (időszak ig), `0A0001F006A` (gyakoriság: H/N/E), `0A0001F021A` (M-lapok száma), `0A0001I001A` (keltezés helye), `0A0001I002A` (keltezés ideje).
   - **0B lap (Fizetendő adó - 01..36. sorok):**  
     Fejléc `0B0001B001A`. Adóalap: `0B0001C` + `padStart(sor, 4, '0')` + `BA`. Adó: `0B0001C` + `padStart(sor, 4, '0')` + `CA` (pl. 07. sor: `0B0001C0007BA` és `0B0001C0007CA`).
   - **0C lap (Levonható adó - 37..75. sorok):**  
     Fejléc `0C0001B001A`. Adóalap: `0C0001C` + `padStart(sor, 4, '0')` + `BA`. Adó: `0C0001C` + `padStart(sor, 4, '0')` + `CA` (pl. 64. sor: `0C0001C0064BA` és `0C0001C0064CA`).
   - **0D lap (Elszámolás - 76..86. sorok):**  
     Fejléc `0D0001B001A`. 76. sor: `0D0001C0076BA` (alap), `0D0001C0076CA` (adó). 82..86. sorok: `0D0001D` + `padStart(sor, 4, '0')` + `CA` (pl. 83. sor különbözet: `0D0001D0083CA`, 84. fizetendő: `0D0001D0084CA`).
   - **0F lap (M-lap Összesítő a Főlapon):**  
     Fejléc `0F0001B001A`. 105. sor (összes számlatétel): `0F0001D0105BA` (partnerek száma), `0F0001D0105CA` (számlák darabszáma), `0F0001D0105DA` (összes alap eFt), `0F0001D0105EA` (összes adó eFt). 106. sor (korrekciók: 0). 108. sor (mindösszesen: 105 + 106).
   - **Záró lapok:** `0E`, `0K`, `0N` lapok szabályos fejléc-regisztrációja.

3. **65M Alnyomtatványok Strukturális Elkülönítése & Oldaltördelés:**
   - Minden belföldi partner önálló `<nyomtatvany>` blokként kerül kódolásra a gyökérelemben.
   - Fejléc tartalmazza az `<albizonylatazonositas>` blokkot a partner nevével és 8 számjegyű törzsszámával.
   - **0A lap (M-01):** Partner-szintű összesítés (`0A0001C001A` adózó adószám, `0A0001C005A` partner törzsszám, `0A0001E0004BA`..`DA` és `0A0001E0007BA`..`DA`).
   - **0B lap (M-02) Tételes Számlák és 36 Soros Oldaltördelés:** Tételes számlasorok a `vat_return_m_lines.invoice_details` rekordból. Az ÁNYK fizikai lapkorlátjának megfelelően 36 számlánként új M-02 oldal nyílik (`0B0001`, `0B0002` stb.), oldalankénti záró összesítő sorral (`0B{pagePad}C0037CA` és `DA`).
   - **Mértékegység & Mikroszámla Kezelés (`convertToEFt`):** Az adatbázisban tárolt valós Forint összegeket a `convertToEFt` kerekíti E Ft-ra. A mikroszámlák (< 500 Ft) szabályosan 0 E Ft értéket kapnak ahelyett, hogy heurisztikusan tévesen százezer forintos nagyságrendűnek minősülnének. Támogatott az explicit `amount_unit: 'E_FT'` / `is_e_ft: true` jelölő is.
   - **Számtani Koherencia:** Az M-02 oldalak 37. sorainak összege garantáltan és matematikailag megegyezik az M-01 lap (0A) 04. és 07. soraival, valamint a főlap (65A) 0F lapjának 105. és 108. soraival.

4. **DocumentEngine & Felületi Integráció:**
   - A `vatReturnTemplate.ts` DocumentEngine sablon közvetlenül a szabványos `buildVatReturnXml` motort futtatja, garantálva a 100%-os séma-egyezséget mind a közvetlen letöltésnél, mind a DocumentEngine exportnál.
   - A letöltési fájlnév szabványosított: `NAV_${formId}_${year}_${monthStr}_${safeName}.xml` (pl. `NAV_2665_2026_07_TS_Consult_Kft.xml`).

## Consequences
**Pozitív:**
- Az exportált XML fájlok hiba nélkül, azonnal importálhatók az ÁNYK 2665 / 2565 / 2465 nyomtatványába.
- Megszűnt az *„alnyomtatvány nem a főnyomtatványhoz tartozik”* importálási hiba.
- A 65M lapok tételes számlaszintű részletezést kapnak a NAV előírásai szerint, 36 számlánként automatikus oldaltördeléssel.
- A mikroszámlák és kisösszegű tételek matematikai kerekítése hibátlan, kizárva a téves E Ft felülértékelést.
- Teljes számszaki összhang a főlap 0F összesítő lapja, az M-01 lapok és az M-02 oldalak között.

## Kapcsolódó
- [A-063: Egységes DocumentEngine & Export Architektúra](./A-063-unified-document-engine-architecture.md)
- [A-076: Statutory Reporting & VAT Return Modularization](./A-076-statutory-reporting-and-vat-return-monolith-modularization.md)
- [A-078: Telefonszámla ÁFA Részleges Levonhatóság](./A-078-telecom-vat-deductibility-rules.md)
- [P-032: ÁFA Bevallás Workflow](../../product/decisions/P-032-vat-return-workflow.md)
