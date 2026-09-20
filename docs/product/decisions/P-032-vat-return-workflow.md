# P-032: [eaisyBooks] ÁFA Bevallás Workflow

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** Decision 033 (ÁFA bevallás modul)  
**Updated:** 2026-08-26  

**Question:** Hogyan néz ki az ÁFA bevallás elkészítésének UI workflow-ja?

**Decision:** Tab-alapú és nyomtatvány-replika workflow a `VatReturnPage`-en belül automatikus kalkulációval, A60 közösségi ellenőrzéssel és ÁNYK XML exporttal.

**Current Implementation:**
- `VatReturnPage.tsx` — route: `/:companyId/:dateRange/vat-return/:tab?`
- Tab-ok:
  1. **Bevallás (`VatReturnViewTab`)**:
     - **Kalkulátor & M-lapok**: Részletező sorok és 65M partneri összesítők
     - **NAV 65 Nyomtatvány replika (2665-A)**: Nyomtatványhű felület (01, 04, 05, 06, 07, 08, 29, 64, 65, 66. sorok)
     - **6/B Acélipari kimutatás (`VatSteelProductsSection`)**: VTSZ és nettó tömeg (kg) analitika, popover szerkesztés, hivatalos CSV export egész kg kerekítéssel (P-097, A-131)
  2. **Beállítás**: Bevallási gyakoriság (havi/negyedéves/éves), előző időszaki követelés (82. sor) beállítása
- **Univerzális „mentes” kulcsmegjelenítés:** Minden 0%-os tétel és mentes kulcs egységesen `mentes` felirattal jelenik meg (`formatVatRate`).
- **A60 Közösségi összesítő nyilatkozat validáció:**
  - Közösségi EU számlák automatikus szűrése és deviza-átszámítása (eFt)
  - Tételek besorolása termékértékesítés (91+92. sor) és szolgáltatásnyújtás (93+94. sor) kategóriákba
  - Interaktív **"Termék"** / **"Szolg."** típusváltó toggle gombok az egyedi bizonylatok sorában, valós idejű újraszámolással
  - VIES közösségi adószám formátum- és érvényesség-ellenőrzés
- **Áthozat és elszámolás (82-86. sorok):**
  - 82. sor (előző időszaki áthozat) közvetlen szerkesztése és automatikus egyenlegkalkuláció (83. sor különbözet, 84. sor fizetendő, 85-86. sor visszaigényelhető/átvihető)
- **Részleges ÁFA levonhatóság & 70/30 Telefonszámla szabály (ADR A-078):**
  - Tételszintű `deductible_percentage` aránykezelés (`InvoiceItemsDialog`)
  - Távközlési számlák (Telekom, Yettel, Vodafone/One, Digi) automatikus észlelése és egykattintásos 70/30 beállítása a 27%-os telefon tételekre (az 5%-os internet tételek 100%-os levonhatóságának megőrzésével)
  - `calculate_vat_return` motorban a levonható arányos adóalap és adó összegzése a 66. sorba és az M-lapokra
  - Transzparens megjelenítés a `VatRowDrillDown` fúrási nézetben
- **ÁNYK XML & PDF Export (ADR A-080, A-131, P-097):**
  - 2665 / 2565 / 2465 nyomtatványnak megfelelő hivatalos AbevJava XML generálás és XML struktúra validáció
  - Pre-export hiányos 6/B acélipari ellenőrző kapu (`AlertDialog`), közvetlen átirányítással a tételek pótlására
  - PDF nyomtatási lehetőség a hivatalos formátum szerint

**Rationale:** A tab-alapú és replika megközelítés lehetővé teszi a könyvelőnek a NAV 65-ös nyomtatvány szerinti közvetlen áttekintést. Az A60-as keresztellenőrzés, az acélipari 6/B analitika és a tételszintű 70/30-as levonhatósági motor garantálja, hogy a távközlési, acélipari és közösségi számlák adatai pontosan és automatikusan egyezzenek a bevallás soraival.

## Kapcsolódó
- [P-097: NAV 2665 Nyomtatvány Replika, 6/B Acélipari Analitika és ÁNYK Validáció UX](./P-097-nav-2665-replica-steel-analytics-and-anyk-validation-ux.md)
- [A-131: NAV 2665 ÁFA Bevallás Sormegfeleltetés, Gyűjtőkódok Tisztítása, 6/B Acélipari Nyilatkozat és Egész Kilogrammos Kerekítés](../../architecture/decisions/A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md)
- [A-080: NAV ÁNYK 2665 ÁFA-Bevallás és 65M Összesítő Jelentés Szabványos XML Export](../../architecture/decisions/A-080-nav-anyk-vat-return-xml-standardization.md)
- [A-078: Telefonszámla ÁFA Részleges Levonhatóság](../../architecture/decisions/A-078-telecom-vat-deductibility-rules.md)
- [A-063: Egységes DocumentEngine Architektúra](../../architecture/decisions/A-063-unified-document-engine-architecture.md)

