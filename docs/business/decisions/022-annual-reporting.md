# Decision 022: Éves Beszámoló

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan támogatja a rendszer az éves beszámoló összeállítást?

**Decision:**

A prod kódbázisban **3 külön oldal** szolgálja a pénzügyi riportolást (ezek a VSWEB-ben nem léteznek):

1. **Eredménykimutatás** (`/profit-and-loss`) — ProfitAndLoss.tsx (33,926 bytes)
2. **Mérleg** (`/balance-sheet`) — BalanceSheet.tsx (36,494 bytes)
3. **Beszámoló** (`/annual-report`) — AnnualReportPage.tsx (50,056 bytes)

**DB struktúra:**
- Workflow: draft → validated → finalized → submitted
- Mérleg struktúra (bs_structure, bs_mapping) + Eredménykimutatás struktúra (pnl_structure, pnl_mapping)
- Előző évi adatok kezelése (bs_prior_year)
- Kiegészítő melléklet sablonok (19 db, kategóriák: general_info, valuation, asset_details, equity, other)
- Frozen data snapshot a véglegesítéskor (frozen_bs_data, frozen_pnl_data JSONB)
- Osztalék kezelés (dividend_amount, retained_earnings, resolution date/number)
- Kettős könyvvitel (accounting_method default: 'kettős könyvvitel')

**Rationale:** Az éves beszámoló összeállítás a könyvelési ciklus lezáró lépése. Három külön oldal biztosítja az áttekinthetőséget. A frozen data biztosítja, hogy a véglegesített beszámoló ne változzon utólag.
