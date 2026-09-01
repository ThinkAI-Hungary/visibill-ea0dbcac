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
  1. **Bevallás** — Interaktív kalkulátor & M-lapok nézet + **NAV 65 Nyomtatvány replika (2665-A)**
  2. **Beállítás** — Bevallási gyakoriság (havi/negyedéves/éves), előző időszaki követelés (82. sor) beállítása
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
- **ÁNYK XML & PDF Export (ADR A-080):**
  - 2665 / 2565 / 2465 nyomtatványnak megfelelő hivatalos AbevJava XML generálás és XML struktúra validáció
  - PDF nyomtatási lehetőség a hivatalos formátum szerint

**Rationale:** A tab-alapú és replika megközelítés lehetővé teszi a könyvelőnek a NAV 65-ös nyomtatvány szerinti közvetlen áttekintést. Az A60-as keresztellenőrzés és a tételszintű 70/30-as levonhatósági motor garantálja, hogy a távközlési és közösségi számlák adatai pontosan és automatikusan egyezzenek a bevallás soraival.

## Kapcsolódó
- [A-080: NAV ÁNYK 2665 ÁFA-Bevallás és 65M Összesítő Jelentés Szabványos XML Export](../../architecture/decisions/A-080-nav-anyk-vat-return-xml-standardization.md)
- [A-078: Telefonszámla ÁFA Részleges Levonhatóság](../../architecture/decisions/A-078-telecom-vat-deductibility-rules.md)
- [A-063: Egységes DocumentEngine Architektúra](../../architecture/decisions/A-063-unified-document-engine-architecture.md)

