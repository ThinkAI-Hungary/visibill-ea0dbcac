---
name: visibill-codebase-audit
description: Use when auditing the Visibill codebase for bugs, inconsistent rendering, broken routes, type safety issues, dead code, trigger chain problems, and architectural issues. Covers React frontend, Supabase integration, auth flows, DB triggers, Edge Functions, data consistency, and UI/UX coherence across the full-stack. Triggers on "codebase audit", "kód átvizsgálás", "minőség ellenőrzés", "frontend audit", "codebase health", "bug hunt", "code review", "kód audit", "teljes átvizsgálás".
license: MIT
metadata:
  author: Visibill Team
  version: "1.1.0"
  date: June 2026
  abstract: Comprehensive codebase quality audit framework for the Visibill platform. Covers 12 audit layers from routing and type safety through data flow, error handling, auth, UI consistency, dead code, Supabase integration, DB triggers, and Edge Functions. Uses graphify knowledge graph for dependency discovery and references related Visibill-specific skills for deep-dive analysis.
---

# Visibill Codebase Audit

Systematic framework for auditing the entire Visibill codebase for bugs, inconsistencies, and architectural problems.

## When to Use

- Before a major release or demo
- After significant refactoring
- When bug reports increase without clear cause
- Periodic codebase health check (monthly)
- When onboarding new developers (establishes baseline)
- When features "work but feel broken" — inconsistent UX, stale data, flash of wrong content
- After a production incident (post-mortem audit)

## Prerequisites — Load Related Skills First

Before starting the audit, read these skills for methodology context:

1. **`vercel-react-best-practices`** — Component patterns, hook rules, state management
2. **`systematic-debugging`** — Root cause methodology for any bugs found
3. **`verification-before-completion`** — Verify each fix before marking done
4. **`webapp-testing`** — What should be tested, testing strategy
5. **`frontend-design`** — UI/UX consistency baseline
6. **`vercel-composition-patterns`** — Component composition, prop drilling detection

**Visibill-specifikus skillek (KÖTELEZŐ cross-referencia):**

7. **`visibill-db-audit`** — RLS, indexek, SECURITY DEFINER, trigger audit (→ Layer 11)
8. **`visibill-db-checklist`** — Migration, RPC, RLS checklist, naming convention (→ Layer 11)
9. **`visibill-spec-lookup`** — Specifikációk betöltése bármilyen módosítás előtt

**Rule:** Read each skill's SKILL.md before starting the relevant audit layer. Don't skip — each skill has nuances that affect how you evaluate findings.

---

## Graphify Integráció

> **A graphify a codebase audit legfontosabb eszköze.** Mielőtt bármilyen réteget auditálsz, futtasd a releváns graphify lekérdezéseket a komponens-kapcsolatok megértéséhez.

### Használat minden audit layer előtt

```bash
# Graphify query — szöveges kereséssel releváns node-ok
graphify query "<audit layer kulcsszavak>"

# Graphify path — két komponens közti kapcsolat
graphify path "<ComponentA>" "<ComponentB>"

# Graphify explain — egy node összes kapcsolata
graphify explain "<NodeName>"
```

### Tipikus audit lekérdezések

```bash
# Routing audit: összes route és navigáció
graphify query "Route navigate Link useNavigate App.tsx"

# Auth audit: auth flow komponensek
graphify query "AuthContext useAuth signUp signIn session"

# Data flow: hook-ok és context-ek
graphify query "useQuery useMutation useState CompanyContext"

# Supabase: összes DB-interakció
graphify query "supabase from rpc select insert"

# Dead code: orphan komponensek keresése
graphify query "pages components unused orphan"
```

### Community-based audit

A graphify **community detection** algoritmusa csoportosítja az összefüggő komponenseket. Ha két komponens különböző community-be tartozik, de szorosan kapcsolódnak, az **architekturális probléma** jele lehet.

```bash
# Ellenőrizd, hogy a critical path node-ok azonos community-ben vannak-e
graphify explain "AuthContext"   # → community: 93
graphify explain "CompanyContext" # → community: ?
# Ha eltérő community → potenciális coupling probléma
```

> **⚠️ Graphify limitáció:** A graphify az AST-t elemzi (frontend kód). A SQL triggerek, Edge Function-ök és migrációk **NEM** részei a gráfnak. Ezekhez a `visibill-db-audit` skill-t és a Supabase MCP tool-okat használd.

---

## The Audit Layers

```
┌──────────────────────────────────────────────┐
│  Layer 1:  ROUTING & NAVIGATION              │
│  Layer 2:  TYPE SAFETY                       │
│  Layer 3:  DATA FLOW & STATE                 │
│  Layer 4:  ERROR HANDLING                    │
│  Layer 5:  AUTH & AUTHORIZATION              │
│  Layer 6:  UI CONSISTENCY                    │
│  Layer 7:  SUPABASE INTEGRATION              │
│  Layer 8:  DEAD CODE & IMPORTS               │
│  Layer 9:  ENVIRONMENT & CONFIG              │
│  Layer 10: LOCALIZATION & HARDCODED STRINGS  │
│  Layer 11: DB TRIGGERS & MIGRATIONS          │
│  Layer 12: EDGE FUNCTIONS                    │
└──────────────────────────────────────────────┘
```

**Iron Rule:** Don't fix while auditing. Document everything first, then prioritize, then fix. Mixing audit and fix leads to missed issues and half-done repairs.

**Audit eredmény mentése:** Az audit eredményét **artifact-ként** mentsd el (ne a chat-be írd ki az egészet). Használd az Audit Output Template-et.

## Severity Classification

| Severity | Definition | Examples |
|----------|-----------|----------|
| 🔴 **Critical** | App crashes, data loss, security hole | Unprotected route, uncaught promise, data overwrite, trigger chain hiba |
| 🟡 **High** | Feature broken or misleading | Wrong data displayed, stale cache, broken navigation |
| 🟠 **Medium** | UX degradation, maintenance burden | Inconsistent styling, prop drilling, any types, nagy fájlméret |
| 🟢 **Low** | Code quality, future risk | Dead code, missing types on internal utils, style nits |

---

## Layer 1: Routing & Navigation

**Related skill:** `vercel-react-best-practices` (routing patterns)  
**Visibill ADR:** [A-013: Scoped URL Routing](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-013-scoped-routing.md)

### 1.0 — Graphify: Routing térkép

```bash
graphify query "Route navigate Link App.tsx ScopedLayout ProtectedRoute ProtectedLayout"
graphify explain "App.tsx"
```

### 1.1 — Scoped Routing Pattern (Visibill-specifikus)

A Visibill `/:companyId/:dateRange/*` scoped URL routing pattern-t használ.

**Checklist:**
- [ ] Minden protected route a `ScopedLayout` wrapperben van
- [ ] A `CompanyContext` az URL `companyId` paraméteréből töltődik
- [ ] A `DateRangeContext` az URL `dateRange` paraméteréből töltődik
- [ ] `useAppReady()` gate blokkolja a renderelést amíg session + company + profile nincs betöltve
- [ ] Accounty modul saját layout-ot használ (`AccountyLayout.tsx`) — nem a standard `ScopedLayout`-ot

### 1.2 — Route Definition Audit

```bash
# Használd a grep_search tool-t (Windows-kompatibilis):
# Route definíciók keresése
grep_search Query="<Route" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]

# ProtectedRoute wrapper keresése
grep_search Query="ProtectedRoute" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
```

**Checklist:**
- [ ] Minden page fájl `src/pages/`-ben rendelkezik route-tal
- [ ] Nincs orphan page (fájl route nélkül)
- [ ] Nincs duplikált route path
- [ ] 404/catch-all route létezik (`NotFound.tsx`)
- [ ] Nested route-ok rendelkeznek `<Outlet />` parent-tel

### 1.3 — Lazy Loading & Suspense

```bash
grep_search Query="React.lazy" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
grep_search Query="<Suspense" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
```

**Red flags:**
- 🟡 Pages imported directly (not lazy) in main router — increases initial bundle
- 🔴 Lazy import without `<Suspense>` wrapper — crashes on slow networks
- 🟡 No fallback UI in `<Suspense fallback={...}>` — blank screen flash

### 1.4 — Protected Route Coverage

```bash
grep_search Query="ProtectedRoute" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
grep_search Query="useAuth" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src\pages" Includes=["*.tsx"]
```

**Red flags:**
- 🔴 Page accessible without authentication that should require it
- 🔴 Admin/Management page without role check
- 🟡 Inconsistent guard component usage
- 🔴 Accounty route-ok nem ellenőrzik az accountant role-t

---

## Layer 2: Type Safety

### 2.0 — Graphify: Type kapcsolatok

```bash
graphify query "interface type Database Tables"
```

### 2.1 — `any` Usage Audit

```bash
grep_search Query=": any" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.ts", "*.tsx"]
grep_search Query="as any" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.ts", "*.tsx"]
```

**Severity by location:**
- 🔴 `any` in API response types — data shape unknown, silent bugs
- 🔴 `any` in props — component contract broken
- 🟡 `any` in internal utils — maintenance risk
- 🟢 `any` in test files — acceptable

### 2.2 — Supabase Query Types

```bash
grep_search Query=".from(" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.ts", "*.tsx"]
grep_search Query="createClient(" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.ts", "*.tsx"]
```

**Red flags:**
- 🟡 `supabase.from('table').select('*')` without type parameter
- 🟡 `createClient(url, key)` without `Database` generic
- 🔴 Manual type casting on Supabase responses (`as MyType` without validation)

### 2.3 — Interface Consistency

```bash
grep_search Query="^export interface " SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.ts", "*.tsx"] IsRegex=true
grep_search Query="^export type " SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.ts", "*.tsx"] IsRegex=true
```

**Red flags:**
- 🟡 Same entity typed differently in different files
- 🟡 Interface defined inline instead of shared
- 🔴 Frontend type doesn't match Supabase schema (field missing/extra)

### 2.4 — Null/Undefined Handling

```bash
grep_search Query="!." SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🔴 `object!.property` — crashes at runtime if null
- 🟡 Excessive `?.` chaining — might be masking a data flow bug

---

## Layer 3: Data Flow & State Management

**Related skills:** `vercel-react-best-practices`, `vercel-composition-patterns`

### 3.0 — Graphify: Data flow térkép

```bash
graphify query "useState useQuery useMutation CompanyContext DateRangeContext AuthContext"
graphify query "useDashboardData useInvoiceData useTransactionData useAccountyData"
```

### 3.1 — State Location Audit

```bash
grep_search Query="useState" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
grep_search Query="useContext" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
grep_search Query="useQuery" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
```

**Red flags:**
- 🟡 Component with > 8 `useState` calls — needs refactoring (useReducer or split)
- 🟡 Same data fetched from Supabase in multiple components independently
- 🔴 Global state (Context) storing data that should be in React Query cache
- 🟡 Props drilled through > 3 levels

### 3.2 — Fájlméret audit (Visibill-specifikus)

**Flageld a túlméretezett fájlokat:**
- 🟠 Hook > 30KB (pl. `useAccountyData.ts` 59KB, `usePayrollData.ts` 37KB)
- 🟠 Page > 50KB (pl. `InvoicesPage.tsx` 87KB, `VatReturnPage.tsx` 79KB)
- 🟡 Component > 20KB

```bash
# Fájlméret listing (PowerShell)
Get-ChildItem d:\ThinkAI\Visibill\eaisybill-prod\src\pages\*.tsx | Sort-Object Length -Descending | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB)}} | Format-Table
Get-ChildItem d:\ThinkAI\Visibill\eaisybill-prod\src\hooks\*.ts | Sort-Object Length -Descending | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB)}} | Format-Table
```

### 3.3 — Data Fetching Consistency

```bash
grep_search Query="supabase.from" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src\pages" Includes=["*.tsx"]
grep_search Query="supabase.rpc" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src\pages" Includes=["*.tsx"]
```

**Red flags:**
- 🟡 Supabase calls directly in component body (not in custom hook or React Query)
- 🔴 `useEffect` + `setState` for data fetching instead of React Query
- 🟡 Same query repeated in multiple components without shared queryKey
- 🔴 Missing loading/error states for async operations

### 3.4 — Stale Data & Cache Issues

```bash
grep_search Query="invalidateQueries" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
grep_search Query="staleTime" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🟡 Mutation without `onSuccess: invalidateQueries` — stale list after create/update
- 🔴 `setQueryData` used to optimistically update but no rollback on error
- 🟡 No `staleTime` set globally — every focus re-fetches everything

---

## Layer 4: Error Handling

**Related skill:** `systematic-debugging`

### 4.1 — Supabase Error Check Coverage

```bash
grep_search Query="supabase." SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
# Ellenőrizd: minden supabase hívás után van-e .error check
```

**Red flags:**
- 🔴 `await supabase.from(...).select()` without checking `.error`
- 🔴 Promise without `.catch()` or try-catch
- 🟡 Catching error but not showing user feedback (silent swallow)

### 4.2 — Error Boundaries

```bash
grep_search Query="ErrorBoundary" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
```

**Red flags:**
- 🔴 No Error Boundary at route level — entire app crashes on any render error
- 🟡 Error Boundary without recovery action (just shows "something went wrong")
- 🟡 No Error Boundary around heavy/complex components (charts, tables, PDF)

### 4.3 — User Feedback Consistency

```bash
grep_search Query="toast" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
grep_search Query="console.log" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🟡 Error logged to console but no toast/alert shown to user
- 🟡 Inconsistent toast library usage (mixing toast systems)
- 🟡 Success/error messages in different languages (HU/EN mix)

---

## Layer 5: Auth & Authorization

**Visibill ADR-ek:**
- [A-009: Auth és RBAC](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-009-auth-rbac.md)
- [A-020: Auth Trigger Chain Incident](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-020-auth-trigger-chain-incident.md)

### 5.0 — Graphify: Auth flow

```bash
graphify query "AuthContext useAuth signUp signIn ProtectedRoute ProtectedLayout useSessionGuard"
graphify path "Auth()" "AuthContext"
graphify explain "useSessionGuard.ts"
```

### 5.1 — Auth State Management

```bash
grep_search Query="useAuth" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
grep_search Query="useUserRole" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
```

**Red flags:**
- 🔴 Page renders content before auth check completes (flash of unauthorized content)
- 🔴 Role check only on frontend, not enforced by RLS on backend
- 🟡 Auth state duplicated between Context and Supabase client
- 🔴 JWT token expiry not handled (silent auth failure)

### 5.2 — Signup Trigger Chain Audit (A-020)

> ⚠️ **Kritikus tanulság:** A regisztráció egy DB trigger chain-t indít el. Ha bármelyik trigger hibázik, az egész tranzakció ROLLBACK-el. Részletek: [A-020](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-020-auth-trigger-chain-incident.md)

```
auth.users INSERT
  └── on_auth_user_created → handle_new_user()
        └── profiles INSERT
              ├── on_profile_created_init_email_prefs → initialize_email_preferences()
              └── on_profile_created_initialize_subscription → initialize_user_subscription()
```

**Checklist (MCP `execute_sql` tool-lal):**
- [ ] Minden trigger function `SECURITY DEFINER`
- [ ] `search_path` tartalmazza `'extensions'`-t ha extension function-t hív
- [ ] Nincs `CREATE OR REPLACE` ami "lenyelte" a `SECURITY DEFINER`-t

```sql
-- Audit query: trigger function-ök SECURITY DEFINER ellenőrzése
SELECT p.proname, t.tgrelid::regclass, t.tgname, p.prosecdef
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT t.tgisinternal
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

### 5.3 — Frontend ↔ Backend Auth Mismatch

**Checklist:**
- [ ] Every frontend role gate has a corresponding RLS policy
- [ ] Admin-only UI buttons are hidden AND backed by RLS
- [ ] Company member checks use the same logic frontend & backend
- [ ] Sign-out properly clears all cached data (React Query, Context, localStorage)

### 5.4 — Session Handling

```bash
grep_search Query="onAuthStateChange" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
grep_search Query="localStorage" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🔴 No `onAuthStateChange` listener — tab switching causes stale auth
- 🟡 Multiple `onAuthStateChange` subscriptions without cleanup
- 🟡 `useSessionGuard` idle timeout nem szinkronizált tabek között

---

## Layer 6: UI Consistency

**Related skills:** `frontend-design`, `vercel-composition-patterns`

### 6.1 — Component Library Usage

```bash
grep_search Query="from.*@/components/ui/" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"] IsRegex=true
grep_search Query="style={{" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
```

**Red flags:**
- 🟡 Raw `<button>` instead of `<Button>` from UI library
- 🟡 Inline `style={{}}` instead of className/CSS
- 🟡 Same visual pattern implemented differently across pages
- 🟠 Custom component duplicates an existing shadcn/ui component

### 6.2 — Loading & Empty States

```bash
grep_search Query="isLoading" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
grep_search Query="Skeleton" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
```

**Red flags:**
- 🔴 Page shows undefined/null data while loading (no skeleton/spinner)
- 🟡 Inconsistent loading patterns (some use Skeleton, some use Spinner)
- 🟡 No empty state for lists ("Nincs adat" missing)

---

## Layer 7: Supabase Integration

**Visibill ADR:** [A-016: PostgreSQL Query Strategy](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-016-postgresql-query-strategy.md) (77 RPC function katalógus)

### 7.0 — Graphify: Supabase interakciók

```bash
graphify query "supabase from rpc select insert update delete"
```

### 7.1 — Query Pattern Consistency

```bash
grep_search Query=".single()" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
grep_search Query=".select('*')" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🔴 `.single()` on query that might return 0 rows — throws error instead of null
- 🟡 `.select('*')` fetches unnecessary data — use specific columns
- 🟡 `.select()` without column specification (implicit `*`)

### 7.2 — RPC Function Audit

```bash
grep_search Query=".rpc(" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Checklist (cross-reference A-016):**
- [ ] Minden frontend `.rpc()` hívás létező function-re mutat
- [ ] Az RPC paraméterek típusa egyezik a function definícióval
- [ ] Nincs deprecated RPC hívás (A-016-ban "deprecated" jelzéssel)
- [ ] SECURITY DEFINER function-ök `anon` role-tól REVOKE-olva

### 7.3 — Realtime Subscription Cleanup

```bash
grep_search Query=".channel(" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
grep_search Query="removeChannel" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🔴 `.subscribe()` without `.unsubscribe()` in useEffect cleanup — memory leak
- 🟡 Subscribing to entire table without filter (performance waste)
- 🟡 Multiple subscriptions for same data in different components

### 7.4 — RLS Policy ↔ Frontend Mismatch Detection

**Process:**
1. List all tables the frontend queries
2. For each table, check if RLS is enabled (MCP `execute_sql`)
3. Verify frontend assumptions match RLS policy behavior
4. Check if frontend handles RLS denial gracefully (empty result vs error)

```bash
grep_search Query=".from('" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

---

## Layer 8: Dead Code & Unused Imports

### 8.0 — Graphify: Orphan keresés

```bash
# Graphify explain segítségével a low-degree node-ok potenciális dead code
graphify query "orphan unused dead"

# Ellenőrizd az 1-connection node-okat — potenciális orphan
```

### 8.1 — Unused Files

```bash
# PowerShell: pages fájlok, amik nincsenek importálva
Get-ChildItem d:\ThinkAI\Visibill\eaisybill-prod\src\pages\*.tsx | ForEach-Object {
  $base = $_.BaseName
  $count = (grep_search Query="$base" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx","*.ts"]).Count
  if ($count -le 1) { "ORPHAN: $_" }
}
```

### 8.2 — Console Statements

```bash
grep_search Query="console.log" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
grep_search Query="console.error" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🟢 `console.log` in components — should be removed for production
- 🟡 `console.error` without user-facing feedback
- 🔴 `console.log` printing sensitive data (tokens, passwords, user data)

---

## Layer 9: Environment & Configuration

### 9.1 — Environment Variables

```bash
grep_search Query="import.meta.env" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🔴 Hardcoded API URL or Supabase URL in source code
- 🔴 API key/secret in source code (should be in env or Vault)
- 🟡 Env variable used but not in `.env.example`

### 9.2 — Hardcoded Values

```bash
grep_search Query="https://.*supabase" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"] IsRegex=true
grep_search Query="http://localhost" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

---

## Layer 10: Localization & Hardcoded Strings

### 10.1 — Language Consistency

```bash
grep_search Query="Loading" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx"]
grep_search Query="Error" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src\pages" Includes=["*.tsx"]
```

**Red flags:**
- 🟡 Mix of Hungarian and English user-facing strings
- 🟡 Error messages from Supabase shown raw (English) to Hungarian users
- 🟡 Date formatting inconsistent (US vs EU format)
- 🟢 Button labels not consistent ("Mentés" vs "Ment" vs "Save")

### 10.2 — Date & Number Formatting

```bash
grep_search Query="toLocaleDateString" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
grep_search Query="toLocaleString" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]
```

**Red flags:**
- 🟡 `toLocaleDateString()` without locale parameter (uses browser default)
- 🟡 Currency formatting inconsistent (some show "Ft", some show "HUF", some show nothing)
- 🟡 `toFixed(2)` used for display instead of `Intl.NumberFormat`

---

## Layer 11: DB Triggers & Migrations (ÚJ)

> **Ez a layer a `visibill-db-audit` és `visibill-db-checklist` skillek kiegészítése.** A codebase audit kontextusban a trigger chain integritásra és a migráció-kód konzisztenciára fókuszál.

**Visibill ADR-ek:**
- [A-020: Auth Trigger Chain Incident](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-020-auth-trigger-chain-incident.md)
- [A-003: Multi-tenancy RLS](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-003-multi-tenancy-rls.md)
- [A-016: PostgreSQL Query Strategy](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-016-postgresql-query-strategy.md)

### 11.1 — Trigger Function Audit

Használd a Supabase MCP `execute_sql` tool-t:

```sql
-- Összes trigger function SECURITY DEFINER státusza
SELECT p.proname, p.prosecdef as is_security_definer,
       t.tgrelid::regclass as trigger_table, t.tgname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT t.tgisinternal
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY p.proname;

-- Trigger function-ök search_path ellenőrzése
SELECT p.proname, p.proconfig
FROM pg_proc p
WHERE p.prosecdef = true
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND p.prorettype = (SELECT oid FROM pg_type WHERE typname = 'trigger');
```

**Red flags:**
- 🔴 Trigger function `SECURITY DEFINER` nélkül ami más táblába ír
- 🔴 `search_path` nem tartalmazza `extensions`-t ha extension function-t hív
- 🔴 `CREATE OR REPLACE` migration ami "lenyelte" a korábbi attribútumokat

### 11.2 — Migráció-kód konzisztencia

```bash
# Migrációs fájlok naming convention ellenőrzése
Get-ChildItem d:\ThinkAI\Visibill\eaisybill-prod\supabase\migrations\*.sql | Select-Object Name
```

**Elvárt naming convention:** `YYYYMMDD_<leíró_snake_case>.sql`  
Részletek: [visibill-db-checklist](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-checklist/SKILL.md)

### 11.3 — Éles DB ↔ Migráció szinkron

```sql
-- Éles function definíció
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '<function_name>';
```

**Red flags:**
- 🔴 Éles DB-ben más function definíció van mint az utolsó migrációs fájlban
- 🟡 Migráció fájl létezik a repo-ban de nincs lefuttatva élesben

---

## Layer 12: Edge Functions (ÚJ)

**Visibill ADR:** [A-005: Edge Functions](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-005-edge-functions.md) (46 function katalógus)

### 12.1 — Deployolt ↔ Hivatkozott EF szinkron

```bash
# Frontend-ből hivatkozott Edge Function-ök
grep_search Query="functions/v1/" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\src" Includes=["*.tsx", "*.ts"]

# Trigger-ből hivatkozott Edge Function-ök
grep_search Query="functions/v1/" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\supabase\migrations" Includes=["*.sql"]
```

Használd az MCP `list_edge_functions` tool-t az élesben deployolt EF-ek listázásához, és hasonlítsd össze.

**Red flags:**
- 🔴 Hivatkozott EF nincs deployolva (pl. `send-welcome-email` incidens — A-020)
- 🟡 Deployolt EF nincs hivatkozva sehonnan (dead EF)
- 🟡 EF kód a repo-ban de nincs deployolva

### 12.2 — EF Auth Middleware

```bash
grep_search Query="getUser" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\supabase\functions" Includes=["*.ts"]
grep_search Query="Authorization" SearchPath="d:\ThinkAI\Visibill\eaisybill-prod\supabase\functions" Includes=["*.ts"]
```

**Red flags:**
- 🔴 Edge Function auth check nélkül (public endpoint, hacsak nem webhook)
- 🟡 Inconsistent auth pattern across EF-ek
- 🟡 CORS headers hiányoznak vagy inkonzisztensek

---

## Audit Execution Process

### Step 0: Graphify gráf frissítése (5 min)

```bash
graphify update .
```

### Step 1: Automated Scan (30 min)
Futtasd a `grep_search` és `graphify query` mintákat minden layer-re. Gyűjtsd össze a raw eredményeket.

### Step 2: Triage (15 min)
Classify each finding by severity. Merge duplicates. Group by layer.

### Step 3: Deep Dive (variable)
For each 🔴 Critical finding:
- Apply `systematic-debugging` skill to trace root cause
- Apply `verification-before-completion` to confirm the fix

For each 🟡 High finding:
- Apply `vercel-react-best-practices` or `vercel-composition-patterns` for correct solution
- Check if the pattern repeats elsewhere (systemic issue)

### Step 4: Report (artifact)
Mentsd az audit eredményét **artifact fájlként** — ne a chat-be írd ki. Használd az alábbi template-et.

---

## Audit Output Template

```markdown
# Kódbázis Audit Jelentés — Visibill
## Dátum: YYYY-MM-DD
## Auditor: [agent/ember]

### Összefoglaló
| Súlyosság | Darab |
|-----------|-------|
| 🔴 Kritikus | X |
| 🟡 Magas | X |
| 🟠 Közepes | X |
| 🟢 Alacsony | X |

### 🔴 Kritikus Hibák
| # | Layer | Fájl(ok) | Probléma | Hatás | Javítás |
|---|-------|----------|----------|-------|---------|

### 🟡 Magas Hibák
| # | Layer | Fájl(ok) | Probléma | Hatás | Javítás |
|---|-------|----------|----------|-------|---------|

### 🟠 Közepes Hibák
| # | Layer | Fájl(ok) | Probléma | Hatás | Javítás |
|---|-------|----------|----------|-------|---------|

### 🟢 Alacsony Hibák
| # | Layer | Fájl(ok) | Probléma | Hatás | Javítás |
|---|-------|----------|----------|-------|---------|

### Metrikák
| Metrika | Jelenlegi | Cél |
|---------|-----------|-----|
| `any` darabszám | X | < 10 |
| console.log darabszám | X | 0 (prod) |
| Orphan oldalak | X | 0 |
| Típus nélküli Supabase query-k | X | 0 |
| Hiányzó Error Boundary | X | 0 |
| Hardcoded URL/key | X | 0 |
| SECURITY DEFINER nélküli trigger | X | 0 |
| Nem deployolt Edge Function hivatkozás | X | 0 |
| 50KB+ fájlok | X | < 5 |

### Javasolt Prioritás
1. Fix all 🔴 Kritikus azonnal
2. Fix 🟡 Magas az aktuális sprintben
3. 🟠 Közepes beütemezése backlog-ba
4. 🟢 Alacsony nyomon követése jövőbeli cleanup-hoz
```

## Quick Reference

| Layer | Eszköz | Mit keres | Kapcsolódó Skill |
|-------|--------|-----------|------------------|
| Routing | `grep_search` + graphify | Orphan pages, scoped routing, guards | `vercel-react-best-practices` |
| Types | `grep_search any` + TS compiler | Type coverage, consistency | — |
| Data Flow | `grep_search useState/useQuery` + graphify | State location, duplication, fájlméret | `vercel-composition-patterns` |
| Errors | `grep_search try/catch/error` | Coverage, user feedback | `systematic-debugging` |
| Auth | `grep_search useAuth/role` + graphify + MCP SQL | Guard coverage, RLS match, trigger chain | `visibill-db-audit` |
| UI | `grep_search style={{` + visual | Consistency, responsive | `frontend-design` |
| Supabase | `grep_search .from/.rpc` + MCP SQL | Query patterns, RPC match, subscriptions | `visibill-db-checklist` |
| Dead Code | `grep_search export` + graphify community | Unused files, exports, orphans | — |
| Config | `grep_search env/hardcoded` | Secrets, magic numbers | — |
| i18n | `grep_search` string patterns | Language mix, date format | — |
| DB Triggers | MCP `execute_sql` | SECURITY DEFINER, search_path, migration sync | `visibill-db-audit` |
| Edge Functions | MCP `list_edge_functions` + `grep_search` | Deploy sync, auth middleware, CORS | — |
