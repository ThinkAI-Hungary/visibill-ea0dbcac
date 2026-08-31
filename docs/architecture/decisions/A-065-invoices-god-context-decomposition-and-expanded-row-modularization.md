# A-065 — Invoice God Context Dekompozíció és Expanded Invoice Row Modularizáció

## Státusz
✅ **Decided** (2026-08-31)

## Kontextus
A Visibill számlakezelő moduljának két kulcsfontosságú eleme jelentős technikai adóssággal bírt a funkciók fokozatos bővülése miatt:
1. **`InvoiceContext.tsx` (962 sor, 45+ exportált mező)**: Egyetlen monolitikus God Contextben tartotta a teljes szűrési (`filters`, `kpiFilter`, `sortField`), lapozási (`navPageSize`, `submittedCurrentPage`, `paginatedInvoices`), kiválasztási (`selectedInvoiceIds`, `expandedRowIds`), valamint adat- és mutációs állapotot. Ez felesleges re-rendereléseket okozott az izolált komponensekben (pl. egyetlen szűrő gépelése miatt újrarajzolódtak a dialógusok és az akció sávok).
2. **`ExpandedInvoiceRow.tsx` (1,569 sor)**: Egyetlen monolitikus fájlban valósította meg a főkönyvi számok, kompenzálási javaslatok, folyamatos szolgáltatási adatok, kapcsolt bizonylatok, párosított beküldött és NAV számlák, banki tranzakciók, futárjelentések és számlajegyzetek megjelenítését és dialógusait.

## Döntés

### 1. InvoiceContext Dekompozíció Sub-Context Hubbá
A monolitikus kontextust 3 fókuszált sub-kontextusra és egy gyökér kompozit kontextusra bontottuk:
- **`InvoiceFilterContext`** (`src/features/invoices/context/InvoiceFilterContext.tsx`): Szűrők, rendezés, keresés, KPI szűrők állapota (`useInvoiceFilterContext()`).
- **`InvoicePaginationContext`** (`src/features/invoices/context/InvoicePaginationContext.tsx`): Kettős tábla (NAV / Beküldött) lapozási állapota (`useInvoicePaginationContext()`).
- **`InvoiceSelectionContext`** (`src/features/invoices/context/InvoiceSelectionContext.tsx`): Kijelölt sorok és kinyitott sorok állapota (`useInvoiceSelectionContext()`).
- **`InvoiceContext` (Root Facade)** (`src/features/invoices/context/InvoiceContext.tsx`): Composing provider, amely mindhárom al-providert biztosítja a fa számára, miközben a meglévő `useInvoiceContext()` hookon keresztül 100%-os visszamenőleges kompatibilitást garantál minden létező komponens számára.

### 2. ExpandedInvoiceRow Modularizáció
A 1,569 soros monolitot felbontottuk fókuszált, tesztelhető subkomponensekre a `src/features/invoices/components/expanded-row/` könyvtárban:
- `types.ts`: Tipizálás (`MatchedSubmittedInvoice`, `MatchedNavInvoice`, `MatchedTransaction`, `LinkedInvoice`, `MatchedCourierReport`, `ExpandedInvoiceRowProps`).
- `GeneralLedgerBadgeSection.tsx`: Hozzárendelt főkönyvi számok és végleges/ideiglenes státusz badge-ek.
- `NettingCardSection.tsx`: Kompenzálási javaslatok, ellenirányú tételek és nettó különbözet.
- `ContinuousServiceCardSection.tsx`: Folyamatos szolgáltatás (Áfa tv. 58.§) és TI számítási módszerek.
- `LinkedInvoicesSection.tsx`: Hivatkozott és hivatkozó bizonylatok láncolata + hiányzó láncszem figyelmeztetés.
- `MatchedSubmittedInvoicesSection.tsx`: Párosított beküldött számlák kategória/projekt badge-ekkel és inline unmatch akcióval.
- `MatchedNavInvoicesSection.tsx`: Párosított NAV számlák fizetési és beküldési státusz jelzőkkel.
- `MatchedTransactionsSection.tsx`: Standalone banki tranzakciók, AI megbízhatósági szint és kézi összerendelő dialógus.
- `MatchedCourierReportsSection.tsx`: Futárjelentések csomagszám és utánvét adatokkal.
- `InvoiceNotesSection.tsx`: Csatolt privát és közös cégjegyzetek + jegyzet hozzáadási dialógus.
- `InlineTransactionList.tsx`: Kártyán belüli kompakt lenyíló tranzakciólista.
- `ExpandedInvoiceRow.tsx`: Tiszta orchestrator konténer.
- `src/components/ExpandedInvoiceRow.tsx`: Visszamenőlegesen kompatibilis, vékony 15 soros re-export facade.

## Következmények

### Pozitív
- **Teljesítmény**: Az izolált sub-kontextusok révén megelőzhetők a felesleges re-renderelések.
- **Karbantarthatóság**: Minden expanded row szekció külön, önállóan módosítható és tesztelhető fájlba került (< 150-250 sor/fájl).
- **Tesztlefedettség**: 20/20 dedikált egységteszt fedi le a sub-kontextusok és az expanded row szekciók működését.
- **Nulla Breaking Change**: Minden meglévő import és `useInvoiceContext()` hívás változatlanul működik.

### Kapcsolódó ADR-ek
- [A-054](./A-054-strict-nav-submitted-pairing.md) — Szigorított NAV ↔ Beküldött Számla Összerendelés
- [A-059](./A-059-transaction-matching-core-and-modular-ui.md) — TransactionMatchingCore & Moduláris UI Architektúra
- [A-062](./A-062-invoices-feature-slice-modularization.md) — Számla Feature Szelet Modularizáció és Dekompozíció
- [A-064](./A-064-multi-channel-upload-engine-modularization.md) — Multi-Channel Document Upload Engine és Feature Szelet Modularizáció
