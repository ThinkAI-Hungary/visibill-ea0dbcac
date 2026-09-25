# A-151: Profit & Loss and Balance Sheet Query Storm Elimination & On-Demand Drilldown

**Status:** Accepted  
**Date:** 2026-09-25  
**Context:** Eredménykimutatás (Profit and Loss) and Mérleg (Balance Sheet) page performance optimization  

---

## 1. Context and Problem Statement
When navigating to the `/profit-and-loss` (Eredménykimutatás) page, users experienced severe loading delays (30–40+ seconds) frequently ending in HTTP 500 errors and PostgreSQL statement timeouts:
```json
{
  "code": "57014",
  "details": null,
  "hint": null,
  "message": "canceling statement due to statement timeout"
}
```
In DevTools, the console was flooded with failed `get_pnl_report` and `glItems` query errors.

### Root Cause Analysis:
1. **Unconditional Monthly Trend Queries (`trendData`)**:
   - `ProfitAndLoss.tsx` divided the fiscal year into 12 monthly intervals.
   - On page mount, even though the visual chart was hidden (`showChart === false`), it executed an unconstrained `Promise.all(periods.map(...))` firing **12 simultaneous `get_pnl_report` RPC calls** at the exact same millisecond.
2. **Unconditional Full-Year Item Fetching (`dbItems`)**:
   - On page mount, `fetchAllGlCategorizedItems` was immediately called for the entire company and entire year, even though the user had not expanded a single GL account (`expandedGl.size === 0`).
   - Simultaneously, `BalanceSheet.tsx` suffered from the same issue: `fetchAllGlCategorizedItems` was requested with `dateFrom: null, dateTo: null` (unbounded history) on initial mount.
3. **Cascading Pool Saturation & Retries**:
   - Total queries hitting PostgREST and the Postgres connection pool on the very first second: **14 heavy aggregation queries**.
   - As queries reached the statement timeout limit, React Query initiated automatic retries (3 attempts per query), escalating the query storm to ~40+ heavy database queries and locking resources.

---

## 2. Decision and Architecture Pattern
We adopted the proven, high-performance on-demand querying pattern established in the Főkönyv (`GeneralLedgerTable.tsx` / `fetchGlItemsForAccount`):

### 1. Lazy & Chunked P&L Trend Queries (`trendData`):
- **Display Gating**: The `trendData` query is now gated behind `showChart`:
  ```typescript
  enabled: !!selectedCompany?.id && !!presetId && !!dateFrom && !!dateTo && showChart
  ```
  On initial page load, **0 trend queries** are dispatched.
- **Concurrency Limiting (Chunking)**: When the chart is toggled ON, queries execute in chunks of `CHUNK_SIZE = 2` rather than 12 in parallel. This keeps PostgREST pool consumption minimal (~50–80ms per RPC) without causing statement timeouts.

### 2. On-Demand GL Drilldown (`fetchGlItemsForAccount`):
- In both `ProfitAndLoss.tsx` and `BalanceSheet.tsx`, the massive initial `dbItems` hook was replaced with per-account on-demand loading:
  - `loadedGlItems: Map<string, GlCategorizedItem[]>`
  - `loadingGlIds: Set<string>`
  - When a user expands a specific GL account row (`toggleGl`), `fetchGlItemsForAccount` is invoked for that single `glAccountId`.
  - Execution time per expanded account is **~30–50 ms**.
  - Visual feedback: inline `<Loader2 className="animate-spin text-primary" />` loader and clear empty state (`no_items`) if no transactions match.

### 3. On-Demand Excel Export Support:
- In `handleExport`, if full transaction details have not yet been fetched by the user, `fetchAllGlCategorizedItems` is called on-demand with a loading toast before generating the Excel workbook.

---

## 3. Verification & Results
- **Page Load Time**: Drops from 30+ seconds (with timeouts) to **<300 ms** (single fast `get_pnl_report` RPC).
- **PostgreSQL Connection Pool**: Query storm completely eliminated (0 idle statement timeouts).
- **Type Safety & Build**: Verified with `npx tsc --noEmit` and `npm run build` (both exit code 0).
- **Browser Automation**: End-to-end smoke test executed via `browser_subagent` (`pnl_perf_verify_1790297216442.webp` and screenshot `profit_loss_verified_1790297333352.png`), confirming instant render, drilldown integrity, chart toggle, and zero console timeouts.
