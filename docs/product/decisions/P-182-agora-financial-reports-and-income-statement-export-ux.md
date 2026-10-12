# P-182: Agora és Novitax Formátumhű Főkönyvi Kivonat és Eredménykimutatás („A” változat) PDF és Excel Export UX

**Status:** Decided  
**Date:** 2026-10-11  
**Category:** UI / Reporting / Export  
**Question:** Hogyan tehető elérhetővé és formátumhűvé a Novitax / Agora szabványú Főkönyvi kivonat és 48 tételsoros Eredménykimutatás export a felhasználói felületen anélkül, hogy a felület zsúfolttá válna vagy felesleges szerverterhelést okozna?  
**Decision:** Kliensoldali (jsPDF és ExcelJS) azonnali generáló motorok integrálása az eszköztár "Export" legördülő menüjébe, debounce védelemmel (`isExporting`) és a hivatalos beszámolói szabványok (Ezer HUF mértékegység, 2 oldalas kötött elrendezés, cégfejléc mérlegfordulónappal és vezetői aláírási blokk) 1:1 arányú vizuális megvalósításával.  
**Current Implementation:**
- A Főkönyv oldalon (`GeneralLedgerPage.tsx`, `GlToolbar.tsx`, `GeneralLedgerTable.tsx`) az Export menüből közvetlenül indítható az Agora formátumú PDF és Excel export 0-egyenlegű szűréssel és multi-currency védelemmel.
- Az Eredménykimutatás oldalon (`ProfitAndLoss.tsx`) az Export gomb legördülő menüjében megjelent az "Eredménykimutatás PDF (Hivatalos „A” változat)", az "Eredménykimutatás Excel (Hivatalos „A” változat)", a "Részletes P&L Excel" és a "Nyomtatási nézet".
- A fájlletöltés a háttérben azonnal elindul, toast értesítéssel kísérve.
**Rationale:** A magyar könyvelők és könyvvizsgálók a Novitax/Agora rendszerekből ismert 2 oldalas tagolást és elrendezést keresik; a kliensoldali vektoros renderelés azonnali (<100ms) visszajelzést ad, elkerülve a szerveroldali PDF queue várakozást és a memóriaszivárgást.

## Kapcsolódó
- [A-248: Agora / Novitax Formátumhű Pénzügyi Kimutatások Export Architektúra](../../architecture/decisions/A-248-agora-statutory-financial-reports-export-architecture.md)
- [A-239: Procont General Ledger Export Architektúra](../../architecture/decisions/A-239-procont-general-ledger-export-and-reconciliation-architecture.md)
- [P-177: Procont Főkönyvi Kivonat Export UX](./P-177-procont-general-ledger-export-and-reconciliation-ux.md)
- `tests/docs/eb0148/Eredménykimutatás_export.pdf`
- `tests/docs/eb0148/FokonyviKivonat.pdf`
