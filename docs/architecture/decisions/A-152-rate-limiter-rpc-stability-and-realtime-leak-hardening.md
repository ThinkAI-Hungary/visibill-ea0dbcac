# A-152: Analytical RPC Stability & Realtime Notification Leak Hardening

**Status:** Accepted  
**Date:** 2026-09-25  
**Context:** PostgREST Rate Limiter (`check_request`), RPC volatility (`STABLE`), and Realtime event isolation  

---

## 1. Context and Problem Statement
During background NAV invoice imports across multiple companies, users navigating the dashboard and financial pages encountered recurring HTTP 429 errors on read-only queries such as `get_vat_breakdown` and `get_gl_balances`:
```
Failed to load resource: the server responded with a status of 429 () get_vat_breakdown:1
POST https://.../rest/v1/rpc/get_vat_breakdown 429 (Too Many Requests)
"message": "Túl sok kérés érkezett. Kérjük próbáld újra 1 perc múlva."
```

### Root Cause Analysis:
1. **Adatbázis Rate Limiter téves riasztása (`check_request`)**:
   - Migration `20260906183000_block_external_script_automations.sql` introduced `public.check_request()` which enforces a 500 mutation/5-minute limit on POST/PATCH/DELETE calls.
   - PostgREST invokes all stored procedures via HTTP `POST`.
   - Read-only procedures (`get_gl_balances`, `get_gl_categorized_items`, `get_vat_breakdown`, `get_pnl_report`) were defined without `STABLE`, defaulting to PostgreSQL `VOLATILE`.
   - Consequently, PostgreSQL ran them in read-write transactions, bypassing `current_setting('transaction_read_only', true) = 'on'`, and `check_request()` counted each execution towards the mutating rate limit.
2. **Keresztcéges Realtime szivárgás (`LiveNotificationProvider.tsx`)**:
   - `nav_invoice_items` and `invoice_items` table change listeners omitted the `isMyCompany(payload)` check.
   - When background batch jobs inserted items for other companies, all connected browser sessions received Realtime events.
   - In addition, `queryClient.invalidateQueries({ queryKey: ['glBalances'] })` was invoked synchronously outside the 500ms debounce loop for each row event, generating hundreds of simultaneous queries.
3. **Nem hatékony főkönyvi számlanév lekérdezés (`JournalView.tsx`)**:
   - `JournalView.tsx` called the heavy analytical aggregation query `fetchAllGlBalances` merely to construct `glMap` (account code and name), instead of querying static preset metadata via `fetchAllGlAccountsByPreset`.

---

## 2. Decision and Implementation

### 1. RPC Volatility Fix (`20260925031000_mark_read_only_rpcs_stable.sql`)
Marked all read-only reporting RPC functions as `STABLE`:
```sql
ALTER FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) STABLE;
ALTER FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) STABLE;
ALTER FUNCTION public.get_pnl_report(uuid, uuid, date, date, jsonb) STABLE;
ALTER FUNCTION public.get_vat_breakdown(uuid, date, date) STABLE;
```
This ensures PostgREST executes them in read-only transactions (`transaction_read_only = 'on'`), exempting them from the mutating request rate limiter.

### 2. Realtime Company Isolation & Debounce Hardening (`LiveNotificationProvider.tsx`)
- Added `if (!isMyCompany(payload)) return;` guards to `nav_invoice_items` and `invoice_items`.
- Unified `glBalances` and `glItems` into the debounced `invalidate(...)` pipeline (500ms buffer).

### 3. Lightweight GL Account Mapping (`JournalView.tsx`)
- Replaced `fetchAllGlBalances` with `fetchAllGlAccountsByPreset(presetId)`.
- Replaced 1.8-second aggregation with a 2ms static account query cached for 5 minutes.

---

## 3. Verification & Results
- **Rate Limit Exemption**: Verified `provolatile = 's'` in `pg_proc` for all four functions.
- **Unit & Integration Tests**: `src/components/general-ledger/__tests__/JournalView.test.tsx` (4 tests) and all 7 general ledger test suites (21 tests) passed.
- **Production Build**: Verified via `npm run build` (exit code 0, 17.39s).
