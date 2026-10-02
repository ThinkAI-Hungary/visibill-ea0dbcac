# A-080: NAV ÁNYK 2665 ÁFA-Bevallás (2665A) és 65M Összesítő Jelentés (2665M) Szabványos XML Export Architektúra

**Status:** Decided  
**Date:** 2026-09-01  
**Utoljára frissítve:** 2026-10-02 (NAV ÁNYK 65M-02 Forint vs 65M-01 eFt Kettős Skála & Webes Felület Teljes Forint Nézet - Opció A)

## Context
A Visibill / eaisyBooks rendszer ÁFA moduljában a 65-ös ÁFA-bevallás XML letöltése korábban fiktív szöveges mezőneveket használt (`sor_01_alap`, `01_0001_adoszam_torzs`), és az azonosítója `2665` volt az ÁNYK által megkövetelt `2665A` (Főlap) és `2665M` (Alnyomtatványok) helyett. Továbbá az M-lapok belföldi összesítő adatai nem önálló `<nyomtatvany>` blokkokként, hanem a főnyomtatvány mezői közé ágyazva jelentek meg.

Ennek következtében az Általános Nyomtatványkitöltő (ÁNYK / AbevJava) a fájl importálásakor azonnali elutasítást adott (EB-0044 hibajegy):  
> *„Hibás típusú adatfile! Az alnyomtatvány nem a főnyomtatványhoz tartozik!”*

Később az adómentes export értékesítést (01. sor) tartalmazó bevallásoknál újabb sabloneltérés jelentkezett:
> *„A sablon nem tartalmazza az adatállományban található (0B0001C0001CA mezőkódú) mezőt. Ez az adat nem kerül...”*  
> *„[2010] Az 0. nyomtatványon a nyomtatványinformációs rész nincs összhangban az adatrésszel...”*

A 65M-02 tételes számlarészletező lapon pedig a mértékegységi skála okozott eltérést: ha a 65M-02 tételes számlasorai ezer forintra (eFt) lettek volna kerekítve, az ÁNYK a 37. sor összegét még egyszer elosztotta volna 1000-rel az M-01 laphoz viszonyítva. A NAV ÁNYK 2665M kitöltési útmutatója szerint:
- A **65M-01 lap (0A lap)** fejlécén kifejezetten szerepel: *„Az adatokat ezer forintban kell feltüntetni!”* (eFt mértékegység).
- A **65M-02 lap (0B lap)** tételes számlasorai (01–36. sorok) és a 37. sor lapösszesítője viszont **forintra pontosan (HUF)** kötelezőek.

A hiteles NAV ÁNYK XML referenciaminta (`docs/think_ai_2465_11.xml`) és a hatályos 2665 sablonszabályzat alapján a teljes generálási és megjelenítési architektúra szabványosításra került.

## Decision
1. **Hivatalos ÁNYK Burkoló (Envelope) és Névtér:**
   - A generált XML gyökéreleme: `<nyomtatvanyok xmlns="http://www.apeh.hu/abev/nyomtatvanyok/2005/01">`.
   - Kötelező `<abev>` blokk beépítése: `<hibakszama>0</hibakszama>`, `<hash>...</hash>`, `<programverzio>v.3.50.0</programverzio>`.
   - **Főnyomtatvány azonosító:** `${periodYear % 100}65A` (pl. 2026-ra `2665A`, 2025-re `2565A`, 2024-re `2465A`), dinamikus nyomtatványverzió a NAV aktuális sablonjához: 2026-ra `2.0`, 2025-re `2.0`, 2024-re `4.0`.
   - **Alnyomtatvány azonosító:** `${periodYear % 100}65M` (pl. 2026-ra `2665M`), dinamikus nyomtatványverzió a főlappal egyezően.
   - **Dátumformátum:** Szigorúan kötőjel nélküli 8 számjegyű dátum: `YYYYMMDD` (pl. `20260701`, `20260731`).

2. **Hivatalos Pozíció-alapú Mezőkódolás (`eazon`):**
   - **0A lap (Főlap azonosítás & keltezés):**  
     `0A0001E001A` (11 jegyű adószám), `0A0001E006A` (cégnév), `0A0001E007A` (képviselő), `0A0001E008A` (telefon), `0A0001F001A` (időszak tól), `0A0001F002A` (időszak ig), `0A0001F006A` (gyakoriság: H/N/E), `0A0001F021A` (M-lapok száma), `0A0001I001A` (keltezés helye), `0A0001I002A` (keltezés ideje).
   - **0B lap (Fizetendő adó - 01..36. sorok):**  
     Fejléc `0B0001B001A`. Adóalap: `0B0001C` + `padStart(sor, 4, '0')` + `BA`.  
     **Adó (CA) mezőkód szigorú whitelisting:** A NAV 65A sablonban kizárólag az adókulcsos sorok rendelkeznek `CA` (adó) oszloppal (`ROWS_WITH_TAX_ON_0B`: 05, 06, 07, 09, 10, 12..16, 18..22, 24..31, 35, 36). Az adómentes / fordított soroknál (01 export, 02 intra-EU, 03 új gépjármű, 04 belföldi fordított, 08 TAM, 11, 17, 23) **tilos `CA` mezőt generálni**, még 0 Ft esetén is, mert az ÁNYK sablonja ismeretlen mezőként elutasítja.
   - **0C lap (Levonható adó - 37..75. sorok):**  
     Fejléc `0C0001B001A`. Adóalap: `0C0001C` + `padStart(sor, 4, '0')` + `BA`. Adó: `0C0001C` + `padStart(sor, 4, '0')` + `CA` (pl. 64. sor: `0C0001C0064BA` és `0C0001C0064CA`).
   - **0D lap (Elszámolás - 76..86. sorok):**  
     Fejléc `0D0001B001A`. 76. sor: `0D0001C0076BA` (alap), `0D0001C0076CA` (adó). 82..86. sorok: `0D0001D` + `padStart(sor, 4, '0')` + `CA` (pl. 83. sor különbözet: `0D0001D0083CA`, 84. fizetendő: `0D0001D0084CA`).
   - **0F lap (M-lap Összesítő a Főlapon):**  
     Fejléc `0F0001B001A`. 105. sor (összes számlatétel): `0F0001D0105BA` (partnerek száma), `0F0001D0105CA` (számlák darabszáma), `0F0001D0105DA` (összes alap eFt), `0F0001D0105EA` (összes adó eFt). 106. sor (korrekciók: 0). 108. sor (mindösszesen: 105 + 106).
   - **Záró lapok:** `0E`, `0K`, `0N` lapok szabályos fejléc-regisztrációja.

3. **65M Alnyomtatványok Strukturális Elkülönítése, Kettős Skála (HUF vs eFt) & Oldaltördelés:**
   - Minden belföldi partner önálló `<nyomtatvany>` blokként kerül kódolásra a gyökérelemben.
   - Fejléc tartalmazza az `<albizonylatazonositas>` blokkot a partner nevével és 8 számjegyű törzsszámával.
   - **0A lap (M-01):** Partner-szintű összesítés (`0A0001C001A` adózó adószám, `0A0001C005A` partner törzsszám, `0A0001E0004BA`..`DA` és `0A0001E0007BA`..`DA`). Az adatok a jogszabályi előírás szerint **ezer forintban (eFt)** szerepelnek (`summary.totalBase` és `summary.totalTax`).
   - **0B lap (M-02) Tételes Számlák és 36 Soros Oldaltördelés:** Tételes számlasorok a `vat_return_m_lines.invoice_details` rekordból. Az ÁNYK fizikai lapkorlátjának megfelelően 36 számlánként új M-02 oldal nyílik (`0B0001`, `0B0002` stb.), oldalankénti záró összesítő sorral (`0B{pagePad}C0037CA` és `DA`).
   - **Kettős Mértékegység-kezelés (`convertToHuf` & `convertToEFt`):**
     - Az M-02 tételes számlák adóalap (`CA`) és adó (`DA`) oszlopai, valamint a 37. sor lapösszesítője **forintra pontosan (HUF)** kerülnek exportálásra (pl. `2 219 200` és `599 184`).
     - Az M-01 (0A) és főlap 0F összesítője ezer forintban (eFt) szerepel (`Math.round(totalBaseHuf / 1000)` = `2 219` és `599`).
     - Az ÁNYK belső összefüggés-vizsgálata a 37. sor HUF értékét osztja 1000-rel az M-01 laphoz viszonyítva, így a bevallás hiba és figyelmeztetés nélkül érvényesíthető.
   - **Webes Felület Megjelenítés (Opció A - Konzisztens Forint nézet):**
     - Az M-lap felületeken (`VatMLineMasterDetail`, `VatCalculatorView`, `VatMLineDrillDown`) a felület egységesen és konzisztensen forintra pontosan (Ft) mutatja a levonható adóalap és ÁFA összegeket (`formatCurrency`), kiküszöbölve a korábbi félrevezető kerekített számok (pl. `2219 Ft` vs `599 184 Ft`) anomáliáját.

4. **DocumentEngine & Felületi Integráció:**
   - A `vatReturnTemplate.ts` DocumentEngine sablon közvetlenül a szabványos `buildVatReturnXml` motort futtatja, garantálva a 100%-os séma-egyezséget mind a közvetlen letöltésnél, mind a DocumentEngine exportnál.
   - A letöltési fájlnév szabványosított: `NAV_${formId}_${year}_${monthStr}_${safeName}.xml` (pl. `NAV_2665_2026_07_TS_Consult_Kft.xml`).

5. **Ügyintéző és Telefonszám Perzisztencia (`companies.representative_name`, `companies.phone`):**
   - Az ÁNYK 65A főlapján kötelező az ügyintéző neve (`0A0001E007A`) és telefonszáma (`0A0001E008A`). Enélkül az ÁNYK nem hajlandó elmenteni a bevallást, és a belső konzisztencia-ellenőrzés elbukik ([2010] hiba).
   - A `public.companies` tábla bővítésre került `representative_name TEXT` és `phone TEXT` oszlopokkal.
   - A `formatAnykPhoneNumber` segédfüggvény garantálja az ÁNYK elvárt számjegyes formátumát (pl. a `06...` prefix átkonvertálását `36...`-ra).
   - **VatXmlExportModal (Async Modal UX):** Ha a cégben még nincs elmentve az ügyintéző vagy telefonszám, a rendszer automatikusan felugró ablakban kéri be, és menti el a céghez. Ha mindkettő ki van töltve, a letöltés azonnal végbemegy (Opció B UX), de az Export menüből bármikor elérhető az "Ügyintéző adatai (ÁNYK)" menüpont a szerkesztéshez.
   - **ÁNYK Sablon Felülbírálás (`formIdOverride`):** A könyvelő a modálban szükség esetén expliciten választhat régebbi sablont is (pl. 2565A vagy a 2465A v4.0 referenciát).

6. **ÁNYK Belső Összefüggés-vizsgálatok és Számított Mezők Szabványosítása (2026-10-02):**
   - **Nem létező mezők kizárása (0C0001C0066DA):** A 0C lap 66. sorában kizárólag `0C0001C0066BA` (adóalap) és `0C0001C0066CA` (adó) létezik az ÁNYK sablonban. A korábbi tesztkódokból bent ragadt `0C0001C0066DA` mező generálása véglegesen megszüntetésre került, elhárítva a sablonhibát.
   - **Részletezőkből Számított Összesítők (Round-then-Sum):**
     - **36. sor (Fizetendő áfa összesítés - R621 / R622):** Az ÁNYK megköveteli, hogy a 36b (`0B0001C0036BA`) és 36c (`0B0001C0036CA`) pontosan megegyezzen a 01..35. részletező sorok összegével. A kerekítési eltérések elkerülése érdekében az XML generátor nem az adatbázisban tárolt nyers összesítőt, hanem a kibocsátott 0B részletező sorok összegét írja ki.
     - **76. sor (Levonható áfa összesítés - R767):** Az ÁNYK megköveteli, hogy a 76b (`0D0001C0076BA`) és 76c (`0D0001C0076CA`) pontosan egyezzen a 63..75. és 111. levonható részletező sorok összegével. Az XML generátor a kibocsátott sorok kerekített összegeként képezi.
     - **83. és 84. sor (Elszámolási lánc):** A különbözet (`0D0001D0083CA`) közvetlenül a számított 36c és 76c mezők alapján ($36c - 76c - 82c$), a befizetendő adó (`0D0001D0084CA`) pedig ennek pozitív értékeként kerül kiszámításra.
   - **Kulcskonzisztencia Kikényszerítése (R914):**
     - A 66. sor levonható adójának (66c) egyeznie kell a 66b adóalap 27%-ával. Ha számlaszintű kerekítések miatt eltérés mutatkozna, a generátor a törvényes `Math.round(base * 0.27)` értéket kényszeríti ki (hasonlóan a 65. sornál 18%-ra és 64. sornál 5%-ra).
   - **Főlap 109. sor Törvényi Képlete (R975):**
     - A 109. sor (`0F0001D0109CA`) az áthárított adó számított összege. Az ÁNYK szabálya szerint: $64c - 64a + 65c - 65a + 66c - 66a + 68c - 68a - 31a$. A generátor korábban tévesen ide az M-lapok adóját (`mTotalTax`) írta; ezt felváltotta a fenti törvényi képlet szerinti összeg.

## Consequences
**Pozitív:**
- Az exportált XML fájlok hiba nélkül, azonnal importálhatók és hibátlanul ellenőrizhetők az ÁNYK 2665 / 2565 / 2465 nyomtatványában.
- Megszűntek a kerekítési összeadási hibák az ÁNYK-ban (R621, R622, R767), mivel az összesítő sorok (36., 76.) automatikusan a részletező sorokból származnak.
- Megszűnt a 66. sori kulcseltérési hiba (R914) és a 109. sori képlethiba (R975).
- A 65M-02 tételes számlasorok és a 37. sor pontos Forint (HUF) értéket tartalmaznak, míg a 65M-01 összesítő lap a jogszabálynak megfelelően eFt-ban összesít.
- A webes felületen megszűnt a kerekített eFt számok Forintként való kiírása: a `VatMLineMasterDetail`, `VatCalculatorView` és `VatMLineDrillDown` egységesen, átláthatóan és forintra pontosan jeleníti meg az adatokat.
- Megszűnt az *„alnyomtatvány nem a főnyomtatványhoz tartozik”* és az *„ismeretlen mezőkód (0C0001C0066DA)”* importálási hiba.
- A 65M lapok tételes számlaszintű részletezést kapnak a NAV előírásai szerint, 36 számlánként automatikus oldaltördeléssel.
- Teljes számszaki összhang a főlap 0F összesítő lapja, az M-01 lapok és az M-02 oldalak között.

## Kapcsolódó
- [A-063: Egységes DocumentEngine & Export Architektúra](./A-063-unified-document-engine-architecture.md)
- [A-076: Statutory Reporting & VAT Return Modularization](./A-076-statutory-reporting-and-vat-return-monolith-modularization.md)
- [A-078: Telefonszámla ÁFA Részleges Levonhatóság](./A-078-telecom-vat-deductibility-rules.md)
- [P-032: ÁFA Bevallás Workflow](../../product/decisions/P-032-vat-return-workflow.md)
