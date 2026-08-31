# A-076: Statutory Reporting & VAT Return Monolith Deepening, Pure Computation Engines & Feature Slices

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-09-01  
> **Érintett komponensek:** `src/features/annual-report/`, `src/features/vat/`, `src/pages/AnnualReportPage.tsx`, `src/pages/VatReturnPage.tsx`, `src/components/ui/date-picker.tsx`  
> **Kapcsolódó PRD:** [P-060](../../product/decisions/P-060-statutory-reporting-and-vat-return-modular-ux.md)  
> **Kapcsolódó ADR-ek:** [A-051](./A-051-vat-return-auto-seed-and-date-fallback.md), [A-062](./A-062-invoices-feature-slice-modularization.md), [A-063](./A-063-unified-document-engine-architecture.md)

---

## 1. Context

Az eaisybill-prod kódbázis auditja során két kritikus frontend monolit azonosításra került a törvényi és adózási riporting területen:
1. `src/pages/AnnualReportPage.tsx` (2,164 sor): Tartalmazta a 6-lépéses Éves beszámoló varázsló teljes UI-ját, a mérleg és eredménykimutatás aggregációit, a bérköltség számításokat, a tárgyi eszköz mozgástáblát, a saját tőke változás kimutatást, a társasági adó 50%-os veszteségelhatárolási képleteit, a sablon-helyettesítést és a validációs sentineleket egyetlen fájlban.
2. `src/pages/VatReturnPage.tsx` (2,212 sor): Tartalmazta a NAV 2665 ÁFA bevallás számítási formuláit, a magyar CDV modulo 10 ellenőrzőösszeg algoritmust, az ÁNYK 2665 XML validációt és számszaki egyezőségi vizsgálatot, az A60 közösségi összesítőt, a 12 hónapos trendeket, a soronkénti fúrásokat (drilldowns), a NAV 65 űrlap replikát és a kalkulátort.

**Problémák a refaktorálás előtt:**
- A pénzügyi és adózási formulák erősen összekapcsolódtak a React komponens lifecycle-lel és DOM-mal, így nem voltak izoláltan unit tesztelhetők.
- A 2000+ soros fájlok nehezen voltak karbantarthatók, magas kognitív terhelést okoztak.
- A natív HTML5 `<input type="date">` elemek OS-függő, a sötét témát megtörő fehér naptárakat jelenítettek meg.

---

## 2. Decision

Elvégeztük a két monolit teljes architekturális mélyítését és domain szeletekre (`feature slices`) bontását:

### A. Tiszta Számítási Motorok (Pure Computation Engines)
Különválasztottuk a számítási és validációs logikát React és DOM függőségek nélküli tiszta TypeScript függvényekbe:
- **`src/features/annual-report/core/annualReportEngine.ts`**:
  - `calculateFinancialMetrics`: Mérleg és eredménykimutatás kimutatások, ROE %, likviditási ráta.
  - `calculateSalaryMetrics`: Bérszámfejtési összesítés (létszám, bérek, járulékok).
  - `calculateAssetMovement`: Tárgyi eszközök bruttó/nettó nyitó/záró és értékcsökkenési mozgásai.
  - `extractEquityRows`: Saját tőke 'D' sorok dinamikus kinyerése.
  - `calculateTaxLossCarryforward`: 50%-os Sztv./TAO veszteségelhatárolási maximum korlát és felhasználható veszteség.
  - `replaceTemplateVariables`: Kiegészítő melléklet sablon változók és automatikus HTML táblázatok injektálása.
  - `isStepCompleted`: Varázsló lépés lezárási invariánsok ellenőrzése.
- **`src/features/vat/core/vatEngine.ts`**:
  - `validateHungarianTaxNumber`: Magyar 8 és 11 számjegyű adószám validáció CDV modulo 10 algoritmussal (`[9, 7, 3, 1, 9, 7, 3, 1]`) és áfakód besorolással.
  - `runXmlValidation`: ÁNYK 2665 XML fejlécek, CDV és 76. sor vs 105. sor M-lap számszaki egyezőség ellenőrzése.
  - `calculateVatBalances`: 83., 84., 85., 86. sor egyenlegek (fizetendő / visszaigényelhető / átvihető).
  - `calculateA60Aggregations`: Közösségi termék/szolgáltatás beszerzések és értékesítések aggregációja és eltérés vizsgálata.
  - `calculateDeadlineCountdown`: Havi (tárgyhót követő hó 20.), negyedéves és éves bevallási határidő visszaszámlálás.

### B. Dedikált Domain Hookok & Állapotkezelés
- `src/features/annual-report/hooks/useAnnualReportData.ts`: Enkapszulálja az éves jelentések lekérdezéseit, mentési és véglegesítési mutációit, a debounced mezőszerkesztést, a `freeze_annual_data` RPC hívást és az élő PDF előnézet debounce generálását.
- `src/features/vat/hooks/useVatReturnData.ts`: Kezeli az időszakválasztást (Havi/Negyedéves/Éves), az ÁFA sorok inline szerkesztésének debouncingját, az A60 VIES ellenőrzést és az ÁNYK XML validációt.

### C. Dekomponált Komponensek & Thin Facade Architektúra
- **`src/features/annual-report/components/steps/`**: 6 dedikált lépéskomponens (`Step1Alapadatok`, `Step2Adatimport`, `Step3Validacio`, `Step4KiegMelleklet`, `Step5Osztalek`, `Step6Export`).
- **`src/features/vat/components/`**: Moduláris részkomponensek (`VatNav65Replica`, `VatA60Table`, `VatXmlValidationDialog`, `VatCalculatorView`, `VatReturnViewTab`, `VatReturnContainer`).
- **`src/pages/AnnualReportPage.tsx`** & **`src/pages/VatReturnPage.tsx`**: Vékony (~8-10 soros) orchestrator facade-okká alakítva, teljes visszamenőleges kompatibilitással (függvény és típus re-exportok a külső hívók és meglévő tesztek felé).

### D. Egységesített Popover Dátumválasztó (`DatePicker`)
Létrehoztuk a `src/components/ui/date-picker.tsx` komponenst, amely Radix `Popover` és `Calendar` (DayPicker) segítségével biztosít modern, sötét témához illeszkedő, magyar formátumú (`date-fns/locale/hu`) dátumbevitelt az űrlapokon.

---

## 3. Consequences

### Pozitív:
- **100%-os Izolált Tesztelhetőség**: A pénzügyi és adózási motorok Vitest unit tesztekkel (`annualReportEngine.test.ts`, `vatEngine.test.ts`, `date-picker.test.tsx`) 0.05s alatt futtathatók böngésző vagy mock környezet nélkül.
- **Karbantarthatóság & Skálázhatóság**: A 2000+ soros fájlok helyett 50-200 soros, szigorú felelősségi körű modulok jöttek létre.
- **Nulla Regresszió**: Az összes meglévő integrációs és permit teszt (1031 teszt 73 fájlban) és a production build hibamentesen lefut.
- **Egységes UX**: Megszűnt az OS-függő natív naptár felugró ablak a kritikus űrlapokon.

### Negatív / Trade-off:
- Több külön fájl és mappa kezelése a feature slice-on belül, amelyet szigorú barrel exporttal (`index.ts`) fogunk össze.
