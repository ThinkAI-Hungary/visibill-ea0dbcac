# A-080: NAV ÁNYK 2665 ÁFA-Bevallás és 65M Összesítő Jelentés Szabványos XML Export Architektúra

**Status:** Decided  
**Date:** 2026-09-01  
**Utoljára frissítve:** 2026-09-01  

## Context
A Visibill / eaisyBooks rendszer ÁFA moduljában a 65-ös ÁFA-bevallás XML letöltése korábban egyedi hierarchikus címkéket használt (`<nyomtatvany><fejlec><fobevallas>...`), továbbá az `XmlDocumentAdapter` a számmal kezdődő mezőnevekből érvénytelen XML elemcímkéket generált (pl. `<01_adoszam_torzs>`), ami sértette a W3C XML szabványt és az ÁNYK (Általános Nyomtatványkitöltő / AbevJava) beolvasáskor azonnali hibát (*„hibás a file”*) eredményezett.

Szükségessé vált az ÁFA-bevallási XML export teljes szabványosítása a NAV ÁNYK hivatalos AbevJava sémája és az A-063 Dokumentum Motor (`DocumentEngine`) architektúrája szerint.

## Decision
1. **Hivatalos ÁNYK Burkoló (Envelope) és Mezőkódolás:**
   - A generált XML gyökéreleme a `<nyomtatvanyok xmlns="http://www.nav.gov.hu/nyomtatvanyok" verzio="1.0">`.
   - A fejléc a `<nyomtatvanyinformacio>` blokkban tartalmazza a dinamikus nyomtatványazonosítót (`${periodYear % 100}65`, pl. 2026-ra `2665`, 2025-re `2565`, 2024-re `2465`), verziót és szoftvernevet.
   - Minden adatmező kötelezően a `<mezok>` blokkon belül, `<mezo eazon="KULCS">ÉRTÉK</mezo>` formátumban kerül kódolásra, elkerülve a W3C XML számmal kezdődő tag hibáit.

2. **Főlap, Bevallási Sorok és 65M Belföldi Összesítő Lapok:**
   - **Főlap adatok:** `01_0001_adoszam_torzs`, `01_0002_adoszam_afa`, `01_0003_adoszam_megye`, `01_0004_adoszam_teljes`, `01_0006_adozo_nev`, `01_0007_szekhely_cim`, `01_0010_adoev`, `01_0011_idoszak_tol`, `01_0012_idoszak_ig`, `01_0013_gyakorisag`.
   - **Főbevallási sorok (01..85):** `sor_${row}_alap`, `sor_${row}_ado` ezer Ft-ra kerekített formátumban.
   - **M-lapok (Belföldi Összesítő):** `M_partner_osszesen`, valamint partnerenként `M_${idx}_0001_adoszam`, `M_${idx}_0002_nev`, `M_${idx}_0003_szamlak_szama`, `M_${idx}_0004_alap`, `M_${idx}_0005_afa`, `M_${idx}_0006_afa_5`, `M_${idx}_0007_afa_18`, `M_${idx}_0008_afa_27`.
   - **Nyilatkozat:** `03_0001_nyilatkozat_adat_valos`, `03_0002_kelt_hely`, `03_0003_kelt_datum`.

3. **DocumentEngine Integráció & Egységes Export:**
   - Az `XmlDocumentAdapter` és a `vatReturnTemplate` szinkronizálva lett az ÁNYK mezőleképezéssel.
   - A letöltési fájlnév szabványosítva lett: `NAV_${formId}_${year}_${monthStr}_${companyName}.xml`.
   - Export indításakor a felület egyértelmű Toast visszajelzést ad és ellenőrzi az adószám meglétét.

## Consequences
**Pozitív:**
- Az exportált XML fájlok azonnal, hiba nélkül importálhatók az ÁNYK 2665 / 2565 / 2465 nyomtatványába.
- W3C XML validitás garantált, nincsenek szintaktikai parser hibák.
- Az M-lapok és a főlapi sorok számszakilag egyeznek a könyvelési kalkulációval.

**Negatív:**
- Egy jövőbeli NAV ÁNYK nyomtatvány-struktúra változás (pl. új kötelező mezőkódok) esetén a mezőkód-táblázat frissítése szükséges.

## Kapcsolódó
- [A-063: Egységes DocumentEngine & Export Architektúra](./A-063-unified-document-engine-architecture.md)
- [A-076: Statutory Reporting & VAT Return Modularization](./A-076-statutory-reporting-and-vat-return-monolith-modularization.md)
- [A-078: Telefonszámla ÁFA Részleges Levonhatóság](./A-078-telecom-vat-deductibility-rules.md)
- [P-032: ÁFA Bevallás Workflow](../../product/decisions/P-032-vat-return-workflow.md)
