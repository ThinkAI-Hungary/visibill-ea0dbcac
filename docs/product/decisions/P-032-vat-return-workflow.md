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
- **ÁNYK XML & PDF Export:**
  - 2665 nyomtatványnak megfelelő hivatalos XML generálás és XML struktúra validáció
  - PDF nyomtatási lehetőség a hivatalos formátum szerint

**Rationale:** A tab-alapú és replika megközelítés lehetővé teszi a könyvelőnek a NAV 65-ös nyomtatvány szerinti közvetlen áttekintést. Az A60-as keresztellenőrzés és az interaktív típusválasztó garantálja, hogy a közösségi ügyletek adatai pontosan egyezzenek a bevallás soraival.

