---
name: visibill-codebase-audit
description: Use when auditing the Visibill codebase for bugs, inconsistent rendering, broken routes, type safety issues, dead code, and architectural problems. Covers React frontend, Supabase integration, auth flows, data consistency, and UI/UX coherence across the full-stack.
license: MIT
metadata:
  author: Visibill Team
  version: "1.0.0"
  date: May 2026
  abstract: Comprehensive codebase quality audit framework for the Visibill platform. Covers 10 audit layers from routing and type safety through data flow, error handling, auth, UI consistency, dead code, and Supabase-specific integration patterns. Includes automated grep/search patterns for each layer and references related skills for deep-dive analysis.
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

## Prerequisites — Load Related Skills First

Before starting the audit, read these skills for methodology context:

1. **`react-best-practices`** — Component patterns, hook rules, state management
2. **`systematic-debugging`** — Root cause methodology for any bugs found
3. **`verification-before-completion`** — Verify each fix before marking done
4. **`webapp-testing`** — What should be tested, testing strategy
5. **`frontend-design`** — UI/UX consistency baseline
6. **`composition-patterns`** — Component composition, prop drilling detection

**Rule:** Read each skill's SKILL.md before starting the relevant audit layer. Don't skip — each skill has nuances that affect how you evaluate findings.

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
└──────────────────────────────────────────────┘
```

**Iron Rule:** Don't fix while auditing. Document everything first, then prioritize, then fix. Mixing audit and fix leads to missed issues and half-done repairs.

## Severity Classification

| Severity | Definition | Examples |
|----------|-----------|----------|
| 🔴 **Critical** | App crashes, data loss, security hole | Unprotected route, uncaught promise, data overwrite |
| 🟡 **High** | Feature broken or misleading | Wrong data displayed, stale cache, broken navigation |
| 🟠 **Medium** | UX degradation, maintenance burden | Inconsistent styling, prop drilling, any types |
| 🟢 **Low** | Code quality, future risk | Dead code, missing types on internal utils, style nits |

---

## Layer 1: Routing & Navigation

**Related skill:** `react-best-practices` (routing patterns)

### 1.1 — Route Definition Audit

Find the main route configuration and verify completeness:

```bash
# Find route definitions
grep -rn "path:" src/ --include="*.tsx" --include="*.ts" | grep -i "route\|router"
grep -rn "<Route" src/ --include="*.tsx"
grep -rn "createBrowserRouter\|createRoutesFromElements" src/ --include="*.tsx"
```

**Checklist:**
- [ ] Every page in `src/pages/` has a corresponding route
- [ ] No orphaned pages (files in pages/ with no route)
- [ ] No duplicate route paths
- [ ] 404/catch-all route exists
- [ ] Nested routes have proper `<Outlet />` parents

### 1.2 — Lazy Loading & Suspense

```bash
# Find lazy-loaded routes
grep -rn "React.lazy\|lazy(" src/ --include="*.tsx"

# Find Suspense boundaries
grep -rn "<Suspense" src/ --include="*.tsx"

# Find direct page imports (should be lazy)
grep -rn "^import.*from.*pages/" src/App.tsx src/main.tsx
```

**Red flags:**
- 🟡 Pages imported directly (not lazy) in main router — increases initial bundle
- 🔴 Lazy import without `<Suspense>` wrapper — crashes on slow networks
- 🟡 No fallback UI in `<Suspense fallback={...}>` — blank screen flash

### 1.3 — Navigation Consistency

```bash
# Find all navigation calls
grep -rn "navigate(\|useNavigate\|<Link\|<NavLink\|window.location\|href=" src/ --include="*.tsx"

# Find hardcoded paths (should use constants)
grep -rn "navigate('/\|to='/\|href='/\|to=\"/" src/ --include="*.tsx" | grep -v "node_modules"
```

**Red flags:**
- 🟡 Hardcoded route strings instead of route constants
- 🔴 `window.location.href` used instead of React Router (full page reload)
- 🟡 Mix of `<Link>`, `navigate()`, and `window.location` without pattern

### 1.4 — Protected Route Coverage

```bash
# Find auth guard components
grep -rn "ProtectedRoute\|RequireAuth\|AuthGuard\|PrivateRoute" src/ --include="*.tsx"

# Find routes WITHOUT protection
grep -rn "<Route" src/ --include="*.tsx" | grep -v "Protected\|Auth\|Guard\|Private\|login\|register\|public"
```

**Red flags:**
- 🔴 Page accessible without authentication that should require it
- 🔴 Admin page without role check
- 🟡 Inconsistent guard component usage

---

## Layer 2: Type Safety

### 2.1 — `any` Usage Audit

```bash
# Count total `any` usage
grep -rn ": any\|as any\|<any>\|any\[\]\|any =" src/ --include="*.ts" --include="*.tsx" | wc -l

# Find the worst offenders
grep -rn ": any\|as any" src/ --include="*.ts" --include="*.tsx" | \
  sed 's/:.*//' | sort | uniq -c | sort -rn | head -20
```

**Severity by location:**
- 🔴 `any` in API response types — data shape unknown, silent bugs
- 🔴 `any` in props — component contract broken
- 🟡 `any` in internal utils — maintenance risk
- 🟢 `any` in test files — acceptable

### 2.2 — Supabase Query Types

```bash
# Find untyped supabase queries
grep -rn "\.from(" src/ --include="*.ts" --include="*.tsx" | grep -v "Database\|Tables\|<"

# Find missing generic in createClient
grep -rn "createClient(" src/ --include="*.ts" --include="*.tsx"
```

**Red flags:**
- 🟡 `supabase.from('table').select('*')` without type parameter
- 🟡 `createClient(url, key)` without `Database` generic
- 🔴 Manual type casting on Supabase responses (`as MyType` without validation)

### 2.3 — Interface Consistency

```bash
# Find all interface/type definitions
grep -rn "^interface \|^type \|^export interface \|^export type " src/ --include="*.ts" --include="*.tsx" | \
  sed 's/:.*//' | sort

# Find duplicate type names
grep -rn "^export interface \|^export type " src/ --include="*.ts" --include="*.tsx" | \
  grep -oP "(?:interface|type)\s+\w+" | sort | uniq -d
```

**Red flags:**
- 🟡 Same entity typed differently in different files
- 🟡 Interface defined inline instead of shared
- 🔴 Frontend type doesn't match Supabase schema (field missing/extra)

### 2.4 — Null/Undefined Handling

```bash
# Find non-null assertions (risky)
grep -rn "!\." src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules\|test\|spec\|!=\|!=="

# Find optional chaining that might hide bugs
grep -rn "\?\.\[" src/ --include="*.tsx" | head -20
```

**Red flags:**
- 🔴 `object!.property` — crashes at runtime if null
- 🟡 Excessive `?.` chaining — might be masking a data flow bug

---

## Layer 3: Data Flow & State Management

**Related skills:** `react-best-practices`, `composition-patterns`

### 3.1 — State Location Audit

```bash
# Find all useState calls with count per file
grep -rn "useState" src/ --include="*.tsx" | sed 's/:.*//' | sort | uniq -c | sort -rn | head -20

# Find all useContext calls
grep -rn "useContext" src/ --include="*.tsx" | sed 's/:.*//' | sort | uniq -c | sort -rn

# Find all React Query/TanStack usage
grep -rn "useQuery\|useMutation\|useInfiniteQuery" src/ --include="*.tsx" | sed 's/:.*//' | sort | uniq -c | sort -rn
```

**Red flags:**
- 🟡 Component with > 8 `useState` calls — needs refactoring (useReducer or split)
- 🟡 Same data fetched from Supabase in multiple components independently
- 🔴 Global state (Context) storing data that should be in React Query cache
- 🟡 Props drilled through > 3 levels

### 3.2 — Data Fetching Consistency

```bash
# Find direct supabase calls in components (should be in hooks/queries)
grep -rn "supabase\.from\|supabase\.rpc" src/pages/ src/components/ --include="*.tsx" | head -20

# Find useEffect with fetch patterns
grep -rn "useEffect.*{" src/ --include="*.tsx" -A3 | grep "supabase\|fetch\|axios"
```

**Red flags:**
- 🟡 Supabase calls directly in component body (not in custom hook or React Query)
- 🔴 `useEffect` + `setState` for data fetching instead of React Query
- 🟡 Same query repeated in multiple components without shared queryKey
- 🔴 Missing loading/error states for async operations

### 3.3 — Race Condition Detection

```bash
# Find useEffect without cleanup
grep -rn "useEffect" src/ --include="*.tsx" -A10 | grep -B5 "supabase\|fetch" | grep -v "return\|cleanup\|abort\|unsubscribe"

# Find async useEffect patterns
grep -rn "useEffect.*async\|useEffect.*=>" src/ --include="*.tsx" -A3 | grep "await"
```

**Red flags:**
- 🔴 Async operation in useEffect without abort controller/cleanup
- 🔴 State update after component unmount (memory leak)
- 🟡 Multiple rapid re-fetches without debounce

### 3.4 — Stale Data & Cache Issues

```bash
# Find manual cache invalidation
grep -rn "invalidateQueries\|refetchQueries\|setQueryData" src/ --include="*.tsx" --include="*.ts"

# Find staleTime configurations
grep -rn "staleTime\|cacheTime\|gcTime" src/ --include="*.tsx" --include="*.ts"
```

**Red flags:**
- 🟡 Mutation without `onSuccess: invalidateQueries` — stale list after create/update
- 🔴 `setQueryData` used to optimistically update but no rollback on error
- 🟡 No `staleTime` set globally — every focus re-fetches everything

---

## Layer 4: Error Handling

**Related skill:** `systematic-debugging`

### 4.1 — Try-Catch Coverage

```bash
# Find async functions without try-catch
grep -rn "async " src/ --include="*.tsx" --include="*.ts" -A10 | grep -B5 "await" | grep -v "try\|catch"

# Find Supabase calls without error check
grep -rn "supabase\.\(from\|rpc\)" src/ --include="*.tsx" --include="*.ts" -A3 | grep -v "error\|catch\|throw"
```

**Red flags:**
- 🔴 `await supabase.from(...).select()` without checking `.error`
- 🔴 Promise without `.catch()` or try-catch
- 🟡 Catching error but not showing user feedback (silent swallow)

### 4.2 — Error Boundaries

```bash
# Find Error Boundary components
grep -rn "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError" src/ --include="*.tsx"

# Find top-level error boundaries in layout
grep -rn "ErrorBoundary" src/App.tsx src/main.tsx src/layouts/ --include="*.tsx"
```

**Red flags:**
- 🔴 No Error Boundary at route level — entire app crashes on any render error
- 🟡 Error Boundary without recovery action (just shows "something went wrong")
- 🟡 No Error Boundary around heavy/complex components (charts, tables, PDF)

### 4.3 — User Feedback Consistency

```bash
# Find toast/notification usage
grep -rn "toast\|useToast\|sonner\|notification" src/ --include="*.tsx" | head -30

# Find console.error usage (should show user-facing message too)
grep -rn "console\.error\|console\.log" src/ --include="*.tsx" --include="*.ts" | wc -l
```

**Red flags:**
- 🟡 Error logged to console but no toast/alert shown to user
- 🟡 Inconsistent toast library usage (mixing toast systems)
- 🟡 Success/error messages in different languages (HU/EN mix)

---

## Layer 5: Auth & Authorization

### 5.1 — Auth State Management

```bash
# Find auth state usage
grep -rn "useAuth\|useUser\|useSession\|supabase\.auth" src/ --include="*.tsx" --include="*.ts" | head -30

# Find role checks
grep -rn "role\|isAdmin\|isCEO\|isOwner\|useAdmin" src/ --include="*.tsx" | head -20
```

**Red flags:**
- 🔴 Page renders content before auth check completes (flash of unauthorized content)
- 🔴 Role check only on frontend, not enforced by RLS on backend
- 🟡 Auth state duplicated between Context and Supabase client
- 🔴 JWT token expiry not handled (silent auth failure)

### 5.2 — Frontend ↔ Backend Auth Mismatch

**Checklist:**
- [ ] Every frontend role gate has a corresponding RLS policy
- [ ] Admin-only UI buttons are hidden AND backed by RLS
- [ ] Company member checks use the same logic frontend & backend
- [ ] Sign-out properly clears all cached data (React Query, Context, localStorage)

### 5.3 — Session Handling

```bash
# Find session refresh/listener
grep -rn "onAuthStateChange\|getSession\|refreshSession" src/ --include="*.tsx" --include="*.ts"

# Find localStorage auth artifacts
grep -rn "localStorage.*token\|localStorage.*auth\|localStorage.*session" src/ --include="*.tsx" --include="*.ts"
```

**Red flags:**
- 🔴 Token stored in localStorage without httpOnly cookie alternative
- 🔴 No `onAuthStateChange` listener — tab switching causes stale auth
- 🟡 Multiple `onAuthStateChange` subscriptions without cleanup

---

## Layer 6: UI Consistency

**Related skills:** `frontend-design`, `composition-patterns`

### 6.1 — Component Library Usage

```bash
# Find shadcn/ui imports
grep -rn "from.*@/components/ui/" src/ --include="*.tsx" | grep -oP "ui/\w+" | sort | uniq -c | sort -rn

# Find inline styles (should use design system)
grep -rn "style={{" src/ --include="*.tsx" | wc -l

# Find raw HTML elements that should be UI components
grep -rn "<button\b\|<input\b\|<select\b\|<table\b" src/ --include="*.tsx" | grep -v "components/ui" | head -20
```

**Red flags:**
- 🟡 Raw `<button>` instead of `<Button>` from UI library
- 🟡 Inline `style={{}}` instead of className/CSS
- 🟡 Same visual pattern implemented differently across pages
- 🟠 Custom component duplicates an existing shadcn/ui component

### 6.2 — Responsive Design

```bash
# Find responsive classes/media queries
grep -rn "@media\|sm:\|md:\|lg:\|xl:" src/ --include="*.tsx" --include="*.css" | head -20

# Find fixed widths that might break mobile
grep -rn "width:\s*[0-9]\+px\|min-width:\s*[0-9]\+px" src/ --include="*.css" --include="*.tsx"
```

**Red flags:**
- 🟡 No responsive breakpoints on main layout
- 🟡 Fixed pixel widths on containers (breaks mobile)
- 🟡 Tables without horizontal scroll wrapper on mobile

### 6.3 — Loading & Empty States

```bash
# Find loading state patterns
grep -rn "isLoading\|isPending\|isFetching\|Skeleton\|Spinner\|Loading" src/ --include="*.tsx" | \
  sed 's/:.*//' | sort | uniq -c | sort -rn

# Find pages WITHOUT loading states
# Compare pages list vs loading usage
```

**Red flags:**
- 🔴 Page shows undefined/null data while loading (no skeleton/spinner)
- 🟡 Inconsistent loading patterns (some use Skeleton, some use Spinner)
- 🟡 No empty state for lists ("Nincs adat" missing)

---

## Layer 7: Supabase Integration

### 7.1 — Query Pattern Consistency

```bash
# Find .single() vs .maybeSingle() usage
grep -rn "\.single()\|\.maybeSingle()" src/ --include="*.tsx" --include="*.ts"

# Find .select('*') — should specify columns
grep -rn "\.select(\s*['\"]\\*['\"])\|\.select()" src/ --include="*.tsx" --include="*.ts"
```

**Red flags:**
- 🔴 `.single()` on query that might return 0 rows — throws error instead of null
- 🟡 `.select('*')` fetches unnecessary data — use specific columns
- 🟡 `.select()` without column specification (implicit `*`)

### 7.2 — Realtime Subscription Cleanup

```bash
# Find realtime subscriptions
grep -rn "\.channel(\|\.on('postgres_changes'\|\.subscribe()" src/ --include="*.tsx" --include="*.ts"

# Check for unsubscribe in cleanup
grep -rn "removeChannel\|unsubscribe\|\.channel(" src/ --include="*.tsx" -A10 | grep -B5 "return.*=>"
```

**Red flags:**
- 🔴 `.subscribe()` without `.unsubscribe()` in useEffect cleanup — memory leak
- 🟡 Subscribing to entire table without filter (performance waste)
- 🟡 Multiple subscriptions for same data in different components

### 7.3 — RLS Policy ↔ Frontend Mismatch Detection

**Process:**
1. List all tables the frontend queries
2. For each table, check if RLS is enabled
3. Verify frontend assumptions match RLS policy behavior
4. Check if frontend handles RLS denial gracefully (empty result vs error)

```bash
# Find all tables referenced in frontend
grep -rn "\.from(['\"]" src/ --include="*.tsx" --include="*.ts" | grep -oP "from\(['\"](\w+)['\"]" | sort -u
```

---

## Layer 8: Dead Code & Unused Imports

### 8.1 — Unused Exports

```bash
# Find exported functions/components and check usage
grep -rn "^export " src/ --include="*.tsx" --include="*.ts" | \
  grep -oP "export (?:default |const |function |class )\s*(\w+)" | \
  while read -r name; do
    count=$(grep -rn "$name" src/ --include="*.tsx" --include="*.ts" | wc -l)
    if [ "$count" -le 1 ]; then echo "UNUSED: $name"; fi
  done
```

### 8.2 — Unused Files

```bash
# Find files not imported anywhere
for f in src/components/*.tsx src/pages/*.tsx; do
  base=$(basename "$f" .tsx)
  count=$(grep -rn "$base" src/ --include="*.tsx" --include="*.ts" | grep -v "$(basename $f)" | wc -l)
  if [ "$count" -eq 0 ]; then echo "ORPHAN: $f"; fi
done
```

### 8.3 — Console Statements

```bash
# Find all console.log/warn/error left in production code
grep -rn "console\.\(log\|warn\|error\|debug\|info\)" src/ --include="*.tsx" --include="*.ts" | \
  grep -v "// debug\|test\|spec\|__test__" | wc -l
```

**Red flags:**
- 🟢 `console.log` in components — should be removed for production
- 🟡 `console.error` without user-facing feedback
- 🔴 `console.log` printing sensitive data (tokens, passwords, user data)

---

## Layer 9: Environment & Configuration

### 9.1 — Environment Variables

```bash
# Find all env variable references
grep -rn "import\.meta\.env\|process\.env\|VITE_" src/ --include="*.tsx" --include="*.ts" | \
  grep -oP "(?:VITE_|NEXT_PUBLIC_)\w+" | sort -u

# Check .env.example exists and matches
cat .env.example 2>/dev/null | grep -oP "^\w+" | sort > /tmp/env_example
grep -rn "import\.meta\.env\." src/ --include="*.tsx" --include="*.ts" | \
  grep -oP "VITE_\w+" | sort -u > /tmp/env_used
diff /tmp/env_example /tmp/env_used
```

**Red flags:**
- 🔴 Hardcoded API URL or Supabase URL in source code
- 🔴 API key/secret in source code (should be in env or Vault)
- 🟡 Env variable used but not in `.env.example`
- 🟡 No `.env.example` file (onboarding friction)

### 9.2 — Hardcoded Values

```bash
# Find hardcoded URLs
grep -rn "https://.*supabase\|http://localhost" src/ --include="*.tsx" --include="*.ts" | \
  grep -v "node_modules\|\.env"

# Find hardcoded UUIDs (likely test data)
grep -rn "[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}" src/ --include="*.tsx" --include="*.ts"

# Find magic numbers
grep -rn "setTimeout.*[0-9]\{4,\}\|setInterval.*[0-9]\{4,\}" src/ --include="*.tsx" --include="*.ts"
```

---

## Layer 10: Localization & Hardcoded Strings

### 10.1 — Language Consistency

```bash
# Find Hungarian strings in JSX
grep -rn "\"[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]\+\s" src/ --include="*.tsx" | head -30

# Find English strings in JSX (if app is Hungarian)
grep -rn "'Loading\|'Error\|'Success\|'Delete\|'Save\|'Cancel" src/ --include="*.tsx" | head -20
```

**Red flags:**
- 🟡 Mix of Hungarian and English user-facing strings
- 🟡 Error messages from Supabase shown raw (English) to Hungarian users
- 🟡 Date formatting inconsistent (US vs EU format)
- 🟢 Button labels not consistent ("Mentés" vs "Ment" vs "Save")

### 10.2 — Date & Number Formatting

```bash
# Find date formatting
grep -rn "toLocaleDateString\|format(\|dayjs\|moment\|date-fns" src/ --include="*.tsx" --include="*.ts"

# Find number formatting
grep -rn "toLocaleString\|Intl\.NumberFormat\|toFixed" src/ --include="*.tsx" --include="*.ts"
```

**Red flags:**
- 🟡 `toLocaleDateString()` without locale parameter (uses browser default)
- 🟡 Currency formatting inconsistent (some show "Ft", some show "HUF", some show nothing)
- 🟡 `toFixed(2)` used for display instead of `Intl.NumberFormat`

---

## Audit Execution Process

### Step 1: Automated Scan (30 min)
Run all grep patterns from each layer. Collect raw findings.

### Step 2: Triage (15 min)
Classify each finding by severity using the table above.
Merge duplicates. Group by layer.

### Step 3: Deep Dive (variable)
For each 🔴 Critical finding:
- Apply `systematic-debugging` skill to trace root cause
- Apply `verification-before-completion` to confirm the fix

For each 🟡 High finding:
- Apply `react-best-practices` or `composition-patterns` for correct solution
- Check if the pattern repeats elsewhere (systemic issue)

### Step 4: Report
Use the template below.

---

## Audit Output Template

```markdown
# Codebase Audit Report — Visibill
## Date: YYYY-MM-DD
## Auditor: [name/agent]

### Summary
| Severity | Count |
|----------|-------|
| 🔴 Critical | X |
| 🟡 High | X |
| 🟠 Medium | X |
| 🟢 Low | X |

### 🔴 Critical Findings
| # | Layer | File(s) | Issue | Impact | Fix |
|---|-------|---------|-------|--------|-----|

### 🟡 High Findings
| # | Layer | File(s) | Issue | Impact | Fix |
|---|-------|---------|-------|--------|-----|

### 🟠 Medium Findings
| # | Layer | File(s) | Issue | Impact | Fix |
|---|-------|---------|-------|--------|-----|

### 🟢 Low Findings
| # | Layer | File(s) | Issue | Impact | Fix |
|---|-------|---------|-------|--------|-----|

### Metrics
| Metric | Current | Target |
|--------|---------|--------|
| `any` count | X | < 10 |
| console.log count | X | 0 (prod) |
| Orphaned pages | X | 0 |
| Untyped Supabase queries | X | 0 |
| Missing error boundaries | X | 0 |
| Hardcoded URLs/keys | X | 0 |

### Recommended Action Priority
1. Fix all 🔴 Critical immediately
2. Fix 🟡 High within current sprint
3. Schedule 🟠 Medium in backlog
4. Track 🟢 Low for future cleanup
```

## Quick Reference

| Layer | Primary Tool | What to Check | Related Skill |
|-------|-------------|---------------|---------------|
| Routing | `grep` route definitions | Orphan pages, missing guards | `react-best-practices` |
| Types | `grep any` + TS compiler | Type coverage, consistency | — |
| Data Flow | `grep useState/useQuery` | State location, duplication | `composition-patterns` |
| Errors | `grep try/catch/error` | Coverage, user feedback | `systematic-debugging` |
| Auth | `grep useAuth/role` | Guard coverage, RLS match | — |
| UI | `grep style={{` + visual | Consistency, responsive | `frontend-design` |
| Supabase | `grep .from/.rpc` | Query patterns, subscriptions | — |
| Dead Code | `grep export` + import check | Unused files, exports | — |
| Config | `grep env/hardcoded` | Secrets, magic numbers | — |
| i18n | `grep` string patterns | Language mix, date format | — |
