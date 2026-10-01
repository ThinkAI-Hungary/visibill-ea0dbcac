---
name: morfi-implementation-review
description: Comprehensive implementation and deep code review for cross-session handoffs, new features, and bugfixes with mandatory autonomous thoroughness (/goal mode). Combines the critical skepticism of receiving-code-review (anti-performative, zero blind agreement, YAGNI, technical pushback) with the structured Senior Reviewer protocol of requesting-code-review, Addy Osmani's 5-axis code quality framework, Surgical Auto-Fix for mechanical errors, the 8-Stage Downstream Data-Flow Pipeline Trace (Anti-Diff Myopia), Falsy Zero / Zero-as-Value guards, Mandatory Live DB Migration & Schema Verification, Mandatory pgTAP Database RPC & Regression Test Gate, and the 6-Axis Universal Software Reliability & Blind-Spot Matrix (with mandatory user inquiry before implementing new logic). Enhanced with project spec lookup, DB checklist guards, and modern engineering standards. Enforces that while internal review logic and guidelines are in English, the final review report delivered to the user must be in Hungarian. Use whenever the user types /morfi-implementation-review, /goal with a review task, provides a handoff document, asks to "ellenőrizd az előző session munkáját", "nézd át a handoff dokumentumot", "implementáció review handoff alapján", "code review a handoff alapján", "verifikáld az előző sessiont", or wants to deeply audit completed feature/fix work before proceeding.
---

# 🛡️ Morfi Implementation Review (Autonomous Goal Mode)

A comprehensive, evidence-based code and implementation review protocol designed for evaluating work from previous sessions, handoff documents, refactorings, or completed features.

This skill operates in **Autonomous Deep-Audit Mode (`/goal`)**: it runs exhaustively until every modified file, dependent service, database constraint, component lifecycle, dependency change, edge case, and downstream consumer has been physically inspected, stress-tested, and verified against specifications.

> [!IMPORTANT]
> **🌐 MANDATORY OUTPUT LANGUAGE CONSTRAINT**:
> While this skill definition and review guidelines are written entirely in English, the **final review report, findings, and interactive questions delivered to the user MUST ALWAYS BE WRITTEN IN HUNGARIAN (Magyar nyelven)**, strictly following the structured template in Phase 5.

---

## 🎯 Core Principles & Review Standards

1. **Clean Context / Zero Bias Review**:
   - For maximum independence and 100% clean context, open a fresh session (`+` New chat) and invoke `/goal /morfi-implementation-review <handoff_path>`.
   - When run in-session, the reviewer enforces absolute objective skepticism, treating every handoff claim and author assumption as an unproven hypothesis.
2. **Zero Superficial Passes & Anti-Hallucination**:
   - Never claim a file or feature was checked without actually reading the complete code using `view_file` or inspecting full context with `git diff`.
   - Forbidden: Saying *"Looks good"* and later reacting with *"Oh, you're right, I missed that!"*. If there is any doubt or unverified execution branch, investigate it immediately.
3. **Evidence Before Assertions**:
   - Never assert that something works without executing the automated test suites (`pytest`, `npm test`, pgTAP database test suites, `npm run build`, etc.) and inspecting the exact command outputs.
4. **Zero Performative Agreement (Anti-Sycophancy)**:
   - Never say *"Everything looks great!"* or blindly trust handoff notes. AI-generated and human-written code both contain blind spots.
5. **Technical Correctness Over Social Comfort**:
   - Clearly flag bugs, race conditions, edge-case gaps, and architectural drift with exact `file:line` references and solid technical rationale.
6. **Surgical Auto-Fix for Mechanical Nits (Fix-on-Sight Protocol)**:
   - If trivial, purely mechanical blockers are found during review (typos, missing imports, syntax errors, mismatched prop names failing a build), the reviewer **MAY fix them immediately** on sight.
   - **Strict Guardrail**: Fixing is ONLY permitted for non-business, mechanical bugs. Never alter business logic, database schemas, or API contracts autonomously. Every auto-fix must be re-verified by running tests and explicitly reported in the final review.
7. **6-Axis Universal Blind-Spot Discovery (Zero Silent Implementation)**:
   - The reviewer MUST stress-test the implementation against first-principles software reliability gaps across 6 universal dimensions (Concurrency, Boundaries, Failures, Lifecycle, Data Integrity, Security).
   - **CRITICAL RESTRICTION**: The reviewer **MUST NOT silently implement** newly discovered edge cases or business logic! All discovered blind spots must be clearly presented with their associated risks and concrete implementation options, **asking the user** for their explicit decision (Implement now vs. Defer to follow-up vs. Accept trade-off).
8. **Structural Remedies Over Vague Complaints ("Propose the Move")**:
   - Never stop at saying *"this is complex"* or *"this looks messy"*. Always propose the concrete structural pattern (e.g. replace conditional chain with typed dispatcher, split orchestration from business logic, decouple state provider).
9. **Lead with Leverage**:
   - Prioritize findings by impact: Correctness, Security, and Structural Blockers first; minor styling and cosmetic nits last. Never bury a critical architecture defect under ten minor nits.
10. **Clean Architecture & Modern Framework Standards**:
    - Enforce optimal rendering/runtime performance, clean composition without boolean prop proliferation, and explicit module boundaries.
11. **Scope, Dependency & File Sizing Discipline**:
    - Flag premature abstractions (YAGNI), enforce lockfile integrity, audit dependency updates, and prevent monolithic file bloat (Decompose-before-Add).
12. **Universal End-to-End Data Lifecycle & Downstream Consumer Tracing (Anti-Diff Myopia)**:
    - **Diff Myopia is strictly forbidden across all software projects**: Auditing only the modified lines in `git diff` is an amateur trap that blinds the reviewer to integration failures. Whenever a changeset introduces or modifies a data model, business rule, calculation engine, form input, or entity state, the reviewer MUST systematically trace the data's journey across all universal lifecycle stages:
      1. **Ingestion & Validation** (API, web form, CLI, webhook, file parser — are types, boundaries, and validation schemas enforced?)
      2. **Core Domain & Computation** (Business logic engines, transformers — are edge calculations and combinations accurate?)
      3. **Persistence & Schemas** (DB tables, columns, migrations, cache stores — is data stored losslessly?)
      4. **State Management & Query Subscriptions** (React Query, Redux, Zustand, event emitters — are cache keys invalidated?)
      5. **Intermediate Workflows & Multi-Step Views** (Wizards, edit forms, detail tabs — is data passed forward without dropping?)
      6. **Aggregates, Summaries & Dashboards** (KPI cards, overview grids, analytical totals — is the new item explicitly factored in?)
      7. **Document, Report & Artifact Generators** (PDFs, invoices, receipts, contracts, export files — does the output reflect the change?)
      8. **Downstream Integrations & External Systems** (Ledgers, event queues, webhooks, 3rd party APIs, regulatory exports).
13. **Universal "Zero-as-Value" & Falsy Fallback Audit**:
    - Across all software domains (finance, metrics, inventory, scoring, permissions, thresholds, counters), `0`, `false`, and `""` are valid, intentional business values (e.g. $0 tax, 0% discount, 0 items, 0 error count, 0 tolerance limit).
    - Reviewers MUST explicitly grep and audit for `val || fallback`, `if (val && val > 0)`, or `!val` conditions that mistakenly treat `0` or `false` as unassigned/falsy, accidentally triggering unintentional fallback recalculations, default values, or hiding legitimate zero states.
14. **Mandatory Implementation Plan DB Migration & Live Schema Verification**:
    - Whenever an implementation plan, task specification, handoff, or changeset introduces, plans, or relies on database schema modifications (new tables, altered columns, enum updates, foreign keys, triggers, RPC functions, or RLS policies):
    - **Plan Discrepancy & Omission Check**: The reviewer MUST cross-reference the original implementation plan or architectural design against the database changes: Was a database migration planned or required for the task? Did the implementer actually create and execute it, or was it silently skipped or forgotten?
    - **Checking the local `.sql` migration file is INSUFFICIENT**: A committed SQL file in `migrations/` does NOT guarantee the database is updated.
    - The reviewer MUST physically verify against the **live database environment** (via MCP tools like `execute_sql`, `list_tables`, `list_migrations`, or catalog queries against `information_schema.columns`, `pg_proc`, `pg_policies`):
      1. Has the planned migration actually been executed and recorded in the database's migration ledger?
      2. Do new tables/columns physically exist in the live database with expected data types, defaults, and nullability?
      3. Are new RPC functions deployed with correct parameters and search paths?
      4. Are new RLS policies active and verified in the live catalog?
    - **🔴 Critical Merge Blocker**: Never approve frontend, API, or worker code that queries database columns or tables that have not been physically applied and verified live in the target database!
15. **Infrastructure & Query Factory Integrity (Zero Partial Core Sync)**:
    - Shared core infrastructure, cache keys, query factories, and contract definitions (e.g. `src/lib/queryKeys.ts`, `src/lib/cache/*`, `src/lib/validationUtils.ts`, `src/integrations/supabase/types.ts`) must maintain absolute integrity.
    - When synchronizing or porting components between instances or modules, cherry-picking UI components while omitting newly introduced query keys or utility helpers from shared files is a critical failure pattern.
    - Reviewers MUST verify that any method, query key, or cache invalidator invoked by UI components physically exists in the referenced core modules.
16. **Scope Boundary, Excluded Feature & Dummy Stub Masking Guard (Anti-Residual Hygiene)**:
    - Whenever a task brief, prompt, or migration plan explicitly marks a feature, integration, or module as **excluded or out of scope** (e.g. *"fejlesztői napló nem kell"*, *"payments excluded"*):
      - **Explicit Residual Grep:** The reviewer MUST grep across all modified files (`git diff --name-only`) for domain keywords of the excluded feature (e.g. `changelog`, `skonto`).
      - **Zero Dummy Stub Tolerance:** Reviewers must reject creating artificial shim or dummy stub files (empty hooks, dummy constants, no-op functions) solely to satisfy broken imports in surviving components. If an imported symbol belongs to an excluded feature, the importing component must be inspected: is the import dead code? If dead code, remove it from the consumer! If actually needed, clarify the scope conflict with the user.
      - **Dead Local & Import Check (Bypassing `noUnusedLocals: false`):** Many projects disable `noUnusedLocals` in `tsconfig.json`. The reviewer MUST verify that newly modified or introduced imports and destructured variables (e.g. `const { hasUnread: hasUnreadChangelog } = ...`) are actually referenced in the rendering or business logic of the component.
17. **IDE Diagnostics & Editor Problems Gate (`@[current_problems]` Cross-Check)**:
    - Modern IDEs maintain an in-memory language server cache (TSServer daemon) for open editor buffers.
    - When files are created, renamed, or modified by background tools or subagents, TSServer can retain stale errors or fail to resolve newly created files until open buffers are touched or the server is reloaded.
    - Reviewers MUST inspect `@[current_problems]` and IDE problem diagnostics: if any problem is listed in `current_problems` for workspace files, the reviewer cannot declare the review clean without verifying and reconciling the diagnostic.
18. **Universal Scroll, Pagination & Async Invariant Audit (Anti-Loop & Anti-Duplicate-Key Matrix)**:
    - Infinite scroll, lazy loading, and paged data streams (e.g. `IntersectionObserver`, `onScroll`, cursor/offset pagination) are prime hotspots for infinite network loops and duplicate key crashes (`Encountered two children with the same key`).
    - **Synchronous In-Flight Mutex (`inFlightRef`)**: Never rely on asynchronous UI state (e.g. `isLoadingMore`, `isFetching`) to prevent duplicate requests. Fast scrolling or multiple observer callbacks fire concurrently before React re-renders. Reviewers MUST ensure an immediate, synchronous guard (e.g. `inFlightRef.current = true`) locks execution synchronously before any async call.
    - **Explicit Page/Cursor Tracking vs. Filtered Length**: Page indices (`page`, `offset`) must NEVER be calculated from filtered client-side array lengths (`Math.floor(list.length / PAGE_SIZE)`). If incoming items are filtered out on the client (e.g. 0-amount items, inactive rows), the list length falls behind the backend page size, permanently freezing page calculations in an infinite loop! Always maintain an independent, monotonic page or cursor counter ref/state.
    - **Deduplication on Append (`dedupeById`)**: In append operations (`setItems(prev => [...prev, ...newItems])`), reviewers MUST enforce idempotent deduplication by unique identifier (e.g. `id`). Network retries, concurrent bursts, or overlapping offsets must never introduce duplicate IDs into component state or DOM keys.
    - **Observer & Callback Dependency Decoupling**: Observer hooks (`IntersectionObserver`) must NOT re-arm/re-trigger infinitely when data arrives. Reviewers MUST ensure scroll callbacks are decoupled from rapidly mutating state (using refs for handlers or stable fetch functions) so that receiving new items does not tear down and re-register observers on the sentinel element.

---

## 🧠 Common Rationalizations vs. Reality

Reviewers must actively reject these common traps and rationalizations:

| Common Rationalization | Technical Reality |
|---|---|
| *"It works, that's good enough."* | Working code that is unreadable, fragile, or architecturally distorted creates compounding technical debt that slows every future task. |
| *"The author / previous session wrote it, so they knew what they were doing."* | Authors are blind to their own assumptions and edge cases. Every implementation requires fresh, objective verification. |
| *"We'll clean it up / write tests later."* | "Later" never comes. The review is the final quality gate before merge. Require cleanup now. |
| *"AI-generated code is confident and looks clean, so it's probably fine."* | AI code is plausibly written even when completely wrong. It requires *more* scrutiny, especially around invariants and race conditions. |
| *"The unit tests pass, so everything is solid."* | Tests are necessary but not sufficient. They frequently test implementation mocks rather than real behavior, and miss security, RLS, and concurrency issues. |
| *"This refactoring makes the code cleaner."* | Relocating complexity is not reducing complexity. If the reader still has to track the same number of concepts, it's not cleaner — look for structural cuts that eliminate branches. |
| *"It's only a 5-line addition to this file."* | A small diff pushed into an already massive (~1000+ line) file accelerates architectural decay. Decompose and modularize first, then add. |
| *"It's just a routine dependency version bump."* | A dependency bump is a third-party behavioral change. Semver is not a guarantee. Read the changelog and verify the lockfile. |
| *"I found a missing edge-case, I'll quickly write code for it."* | Omitted edge cases often represent business trade-offs or scope boundaries. Silently adding unrequested business logic introduces untested assumptions. Always present and ask! |
| *"The diff looks complete and the calculation engine works."* | **Universal Diff Myopia Trap:** Computing a value in a core engine or backend service is only half the feature. If downstream UI steps, aggregate summaries, printable documents/PDFs, or integration feeds don't consume or display it, the feature is broken for users. Always trace the full pipeline end-to-end. |
| *"The variable has a value or falls back to default."* | **The Falsy Zero Trap:** `val || fallback` or `if (val && val > 0)` treats `0` or `false` as non-existent. In any software system, 0 is often a completely legitimate business state that gets silently destroyed or overwritten by naive falsy checks. |
| *"The migration file is committed in `migrations/`, so the DB is updated."* | **Migration Illusion Trap:** A SQL file in Git is just text on disk. The live database knows nothing about it until it is executed (`supabase db push`, `apply_migration`, migration runner). Always inspect the live database catalog (`information_schema.columns`, `pg_tables`) to prove it is live and active. |
| *"The types.ts file was updated and tsc passes, so RPC calls are guaranteed to work."* | **The Compile-Time RPC Illusion Trap:** TypeScript only verifies calls against `src/integrations/supabase/types.ts`. If `types.ts` was copied or generated ahead of the target database, `tsc -b` passes 100% even when the live DB has an obsolete SQL function signature missing parameters. At runtime, PostgREST throws `PGRST202` (404 Schema Cache error). The reviewer MUST query `pg_proc` in the live DB to prove that function signatures accept all passed arguments. |
| *"Vite build passed, so the codebase is type-safe."* | **Vite SWC/esbuild Type-Stripping Trap:** Modern bundlers using `@vitejs/plugin-react-swc` or esbuild strip TypeScript types without performing semantic type-checking. A missing export, non-existent function call, or invalid prop type will pass `npm run build` without error. The reviewer MUST mandate strict typechecking (`tsc -b` or `tsc -p tsconfig.app.json --noEmit`). |
| *"All unit tests passed, so all UI views and tabs work."* | **Unmounted UI & Lazy-Tab Blind Spot:** Test suites can have 900+ passing tests while leaving critical tabs or sub-pages unmounted. When a component is not mounted in tests, runtime hook failures (e.g. `TypeError: queryKeys.emailAccounts is not a function`) remain completely invisible until clicked in a browser. The reviewer MUST require mounted smoke tests or browser dev server audit. |
| *"The build passed because the stub file satisfies the import."* | **The Dummy Stub & Scope Leak Trap:** An empty shim or dummy stub created to silence a compiler error often hides dead code or an excluded feature. If a feature was opted out by user requirements, residual imports and dummy stubs are technical debt and must be deleted from consumers, not patched over with dummy files. |
| *"The CLI compiler passed, so the editor has no problems."* | **The TSServer In-Memory Cache Trap:** Background commands run in fresh processes, but the IDE editor holds open file buffers in memory. If an error is reported in `@[current_problems]`, the reviewer must reconcile whether it's a real dead import or a cached diagnostic, and touch/clean open files accordingly. |
| *"I set `isLoading(true)` at the start of `loadMore`, so it won't fire twice."* | **The Async State Trap:** React `useState` updates asynchronously on the next render. Rapid scroll events or IntersectionObserver triggers execute in the same event loop tick before React re-renders, firing duplicate requests and corrupting state. Always use a synchronous ref (`inFlightRef.current = true`). |
| *"I just append the new items to the existing array: `setItems(prev => [...prev, ...newItems])`."* | **The Appending Duplication Trap:** Any network retry, offset jitter, or concurrent burst will append duplicate records into the array, resulting in React key collision warnings (`Encountered two children with the same key`) and DOM corruption. Always wrap incoming appends in a Set/Map-based `dedupeById`. |
| *"I calculate the next page from `list.length / PAGE_SIZE`."* | **The Filtered Length Trap:** If the client filters out any records (e.g. 0-value items, inactive status), `list.length` will be smaller than `page * PAGE_SIZE`. `Math.floor(length / PAGE_SIZE)` then rounds down and requests the same page forever, trapping the app in an infinite fetch loop. Always use an explicit monotonic page counter. |

---

## 🔄 The 5-Phase Review Pipeline

```
          [ /morfi-implementation-review <handoff_doc> ]
                                │
                                ▼
             PHASE 1: HANDOFF & INTENT INGESTION
          (RCA, goals, file list, git diff range,
          author claims, assumptions, open questions)
                                │
                                ▼
         PHASE 2: CONTEXT, SPECS & ARCHITECTURAL GUARDS
          (Spec-lookup, Implementation Plan DB Check & Live Schema,
          Frontend Composition & Performance, Dependency Discipline)
                                │
                                ▼
         PHASE 3: COMPREHENSIVE CODE AUDIT & BLIND-SPOT DISCOVERY
        (5-Axis code audit, 8-Stage Pipeline Trace, 6-Axis Universal
         Blind-Spot Matrix, formulate user options for logic gaps)
                                │
                                ▼
         PHASE 4: EVIDENCE-BASED VERIFICATION & AUTO-FIX
        (Run test suites, Live DB Schema & Migration Gate,
         immediate mechanical fixes [Surgical Auto-Fix], re-test)
                                │
                                ▼
         PHASE 5: HUNGARIAN STRUCTURED REPORT & USER DECISIONS
        (Delivered in Hungarian: Auto-fix log, Live DB status,
         Blind-Spot options, Presumptive Blockers, Final Verdict)
```

---

## 📋 Phase-by-Phase Execution Guide

### Phase 1: Ingest Handoff & Define Review Scope
1. Read the provided handoff document using `view_file` (or inspect `git log` / `git status` if no handoff file is provided).
2. Extract the key review scope:
   - **Objective / RCA**: What exact problem was solved or feature implemented?
   - **Target Files & Modules**: Every file created, modified, or deleted.
   - **Git Range**: `BASE_SHA` vs `HEAD_SHA` (or uncommitted working tree changes).
   - **Documented Claims**: What tests were claimed to pass, and what assumptions were made?
   - **Open Questions & Limitations**: Any unresolved items from the previous session.

*If any critical requirement or scope item is fundamentally ambiguous, stop and clarify before assuming.*

---

### Phase 2: Load Specs, Architecture & Specialized Guards

1. **Specification & Product Alignment**:
   - Check local architecture and product decision records (ADRs / PRDs / RFCs).
   - Verify if the changes conform to established domain rules and system architecture.

2. **Database & Data Layer Integrity Guard (Implementation Plan Migration & Live Schema Verification)**:
   - If the implementation plan, handoff, or changeset planned or touched any database tables, columns, migrations, RPCs, triggers, or constraints:
     - **Implementation Plan Discrepancy Check**: Cross-reference the original implementation plan against the actual repository and database. Did the plan specify a schema migration? Was it actually created, or was it skipped or forgotten?
     - **Live Database & Schema Verification**:
       - **NEVER trust local `.sql` files alone.** A migration script committed in Git is just text until executed.
       - Connect to / query the live target database (via database MCP tools like `execute_sql`, `list_migrations`, or catalog queries against `information_schema.columns`, `pg_proc`, `pg_policies`).
       - Verify:
         1. **Migration Execution Status**: Has the migration batch been applied in the system migration ledger (`supabase_migrations.schema_migrations`, `alembic_version`, `_prisma_migrations`, etc.)?
         2. **Physical Column/Table Existence**: Query `information_schema.columns` or `pg_tables` to physically confirm that all newly planned/referenced tables, columns, data types, nullability, and default values exist in the live engine.
         3. **Functions & RPCs**: Query `pg_proc` or `information_schema.routines` to ensure functions exist, signatures match, and search paths are safe.
         4. **Constraints & RLS**: Confirm foreign keys, unique constraints, check constraints, and RLS policies are active in the live catalog (`pg_constraint`, `pg_policies`).
       - If a migration was specified in the plan but NOT applied to the live database, immediately flag it as a **🔴 Critical Blocker**!
     - **Foreign Key Constraints**: Verify explicit `ON DELETE CASCADE` vs `RESTRICT` vs `SET NULL`.
     - **Idempotency**: Ensure migrations and triggers are safely re-runnable (`IF NOT EXISTS`, `CREATE OR REPLACE`).
     - **RLS & Index Performance**: Check RLS filter performance, avoid missing foreign key indexes, and prevent security definer leakage.

3. **Frontend & UI Layer Guards**:
   - If UI components, hooks, or pages were modified:
     - **Rendering Performance**: Flag unnecessary re-renders, missing memoization on hot closures, and layout thrashing.
     - **State & Data Fetching**: Check cache keys, stale time configuration, and optimistic updates.
     - **URL State Sync**: Ensure filtering/sorting states correctly sync with URL search params.
     - **Anti-Boolean Prop Explosion**: Ensure components don't accept 5+ boolean props to tweak internal behavior; enforce compound components or slot composition.

4. **Dependency & Supply Chain Discipline**:
   - **New Dependencies**: Does the existing stack or standard library already solve this? What is the bundle size impact? Is the package actively maintained? Does `npm audit` / security scans report vulnerabilities?
   - **Dependency Upgrades**: Did the author read the changelog? Are dependency upgrades isolated (1 package per change)? Is the lockfile committed and strictly reviewed (never hand-edited)?

---

### Phase 3: Exhaustive 5-Axis Code Audit

Inspect the actual changes using `git diff` or targeted file viewing. The reviewer MUST explicitly evaluate every modified file across these 5 core engineering pillars:

#### 1. Correctness & Behavioral Integrity
- Does the code do what it claims to do according to the spec?
- Are basic error paths robust (timeouts, rejected promises, network failures)?
- Are there obvious off-by-one errors, state synchronization lags, or race conditions?

#### 2. Readability & Simplicity
- Are names descriptive and consistent with project conventions (no vague `temp`, `data`, `res` without context)?
- Is control flow straightforward (avoiding nested ternaries and deeply indented callbacks)?
- **Could this be done with significantly less code?** (Adding 500 lines where 50 suffice is an architectural failure).
- **Dead Code Hygiene**: Identify and flag orphaned functions, unused imports, deprecated type definitions, leftover `// removed` comments, or no-op shims (`_unused`).

#### 3. Architecture & Structural Remedies
- Does the change fit the system design, or does it introduce unjustified patterns?
- **Does this refactoring reduce complexity or merely relocate it?** Count the concepts a reader must hold. Prefer refactorings that make branches disappear over those that centralize complexity into another layer.
- **Is feature-specific logic leaking into shared/general-purpose modules?** Keep domain logic in its owning package.
- **Propose Named Structural Remedies**:
  - *Replace conditional chains* with typed models or explicit dispatchers.
  - *Separate orchestration from business logic.*
  - *Reuse canonical helpers* instead of bespoke near-duplicates.
  - *Make type boundaries explicit* (`zod` parsing, explicit TypeScript discriminating unions) so downstream fallback branches disappear.
  - *Delete pass-through wrappers* that add indirection without value.

#### 4. Database Constraints & Concurrency Safety
- Are parent-child relationships guaranteed across worker processing and user actions?
- Are database operations idempotent and transactional where necessary?
- Are race conditions handled between background jobs and user actions?

#### 5. Frontend Lifecycle & UI Quality
- Are component hooks and effect dependencies accurate and free of infinite loops or memory leaks?
- Are modal dialogs, drawer focus states, and tab selections clean and accessible?
- **File Sizing Guard (Decompose-before-Add)**: If a change touches or grows an already-large file (~1000+ lines), demand decomposition into subcomponents or focused custom hooks first.

---

### Phase 3.1: 🔄 Universal Downstream Consumer & Data-Flow Pipeline Trace (Anti-Diff Myopia)

Reviewers MUST NOT suffer from "Diff Myopia" (only inspecting lines modified in `git diff`). In any software architecture (web, backend, microservice, mobile, data pipeline), whenever a business rule, calculation engine, form input, or data model is added or altered, the reviewer MUST systematically audit its full data journey:

| Universal Pipeline Stage | Critical Review Questions & Checks |
|---|---|
| **1. Ingestion & Boundary Validation** | Where does data enter (Form input, API payload, CLI argument, Webhook, File parser)? Are validation rules, types (Zod/Pydantic), sanitization, and boundary extremes enforced? |
| **2. Processing & Calculation Engine** | Does the domain logic or computation engine calculate the value correctly under all edge conditions, combinations, and exemptions? |
| **3. Persistence & Schemas** | Is the data properly stored in persistent storage (DB tables, columns, JSONB metadata, Redis)? Are migrations, constraints, and query cache invalidation keys wired up? |
| **4. Intermediate Workflows & UI Views** | Do intermediate screens, multi-step wizards, edit modals, or tabbed views pass the value forward without dropping, resetting, or overriding it? |
| **5. Aggregates, Summaries & Dashboards** | In final confirmation views, summary grids, and KPI dashboards, is there an explicit column/row for this item, or is it swallowed/masked by generic totals? |
| **6. Document, Report & Artifact Generators** | Is the data reflected on formal user-facing documents, generated PDFs, printable summaries, or downloadable files (e.g. invoices, receipts, payslips, contracts, CSV exports)? |
| **7. Downstream Integrations & Side Effects** | Do automated side effects (accounting journals, double-entry balances, event emitters, background tasks, webhooks) handle the new value accurately? |
| **8. External Exports & Public Interfaces** | Do external outputs (regulatory schemas, government XML/JSON, partner APIs, payment gateways) map and format the new fields per official contract? |

---

### Phase 3.5: 🔍 6-Axis Universal Software Reliability & Blind-Spot Matrix

The reviewer must step out of the author's mindset and actively interrogate the implementation against first-principles software failure modes across 6 universal dimensions.

> [!CAUTION]
> **ZERO SILENT IMPLEMENTATION RULE:**
> Do NOT implement solutions for discovered blind spots on your own!
> You must document the gap, explain the business/technical risk, formulate concrete options, and ask the user for direction.

#### 1. ⏱️ Concurrency, Race Conditions & Temporal Order
*Issues arising because operations do not occur in an isolated, linear sequence.*
- **Race conditions:** What happens if two asynchronous operations complete out of order?
- **Rapid repeat actions:** What happens on double-click or rapid duplicate triggers (missing debounce/throttle/button disabling)?
- **Idempotency & Duplicate Delivery:** If the same request, message, or webhook is delivered twice (at-least-once guarantee), does it corrupt state or produce duplicate records?
- **In-flight cancellation:** What happens if the user navigates away, closes a view, or aborts an action while a network or worker task is still pending (unmounted updates, memory leaks, zombie tasks)?
- **Infinite Scroll & Pagination Concurrency:** Are scroll/intersection triggers guarded by a synchronous mutex (`inFlightRef.current`), or does fast scrolling fire simultaneous queries that append duplicate records?
- **Observer Re-arm Loops:** Does receiving a new page of items cause the scroll observer to re-mount and re-trigger against an active sentinel in an infinite loop?

#### 2. 🧱 Boundary Conditions, Data Extremes & Nullability
*Issues occurring at the lower, upper, and empty limits of acceptable data.*
- **Boundaries & Extremes:** 0, 1, maximum allowable value, negative numbers, division by zero, float precision rounding errors (`0.1 + 0.2`).
- **The Falsy Zero / Zero-as-Value Trap:** Check for `val || fallback`, `if (val && val > 0)`, or `!val` where `0`, `false`, or `""` is a completely legitimate business state (e.g. 0 price/cost/tax, 0% rate, 0 items in cart, 0 retry attempts, false toggle). Falsy checks on numerical zeros or booleans silently trigger unintentional defaults, fallback recalculations, or hide valid data!
- **Nullability & Missing data:** `null`, `undefined`, empty strings, empty arrays/maps (`[]`, `{}`). Does the code crash with `TypeError: Cannot read properties of undefined`?
- **Payload extremes:** Excessively large inputs (e.g. 500-item arrays, 300+ character text strings, huge files) — does it break UI layouts, exceed database column limits, or cause out-of-memory errors?
- **Temporal & Timezone boundaries:** UTC vs Local time conversions, end-of-month / end-of-year rollovers, date boundary shifts.

#### 3. 💥 Failure Modes, Resilience & Rollback
*Issues occurring when external dependencies, networks, or sub-operations fail.*
- **Partial failures:** If a multi-step workflow fails halfway through, what state is left behind? Is there rollback, cleanup, or a stuck/corrupted intermediate status?
- **Timeouts & Network drops:** What happens if a network call hangs? Is there a timeout, or does the UI/worker hang indefinitely?
- **Error feedback & Recoverability:** Does the caller or user receive actionable, clear error feedback and a way to retry, or is it a generic silent failure?
- **Optimistic State Desync:** If an optimistic UI update was applied and the server returns an error, does the state roll back cleanly to prevent ghost data?

#### 4. 🔄 State Lifecycle, Transitions & Cache Invalidation
*Issues concerning entity state machines, cache synchronization, and navigation.*
- **Invalid state transitions:** Can an entity be modified when it is in an inactive, locked, or terminal state?
- **Stale cache & Invalidation:** After an insert/update/delete, are related caches, query results, or aggregates invalidated, or does the system show stale data?
- **Navigation & Pagination Reset:** Does changing filters, search terms, or context properly reset page indices and selection states (preventing empty page anomalies)?
- **Append-only List Deduplication:** When appending paginated items (`[...prev, ...newItems]`), are IDs deduplicated, or does network jitter/overlap trigger React key collisions?
- **Page Index Drift / Filtered Length:** Is the next page index computed from client-filtered array lengths rather than an explicit counter or backend cursor?
- **Unsaved Changes:** Can the user accidentally lose dirty form state or work-in-progress on navigation/backdrop click without a warning?

#### 5. 🔗 Data Integrity, Referential Consistency & Side Effects
*Issues concerning persistent data relationships and unexpected ripple effects.*
- **Downstream Consumer Gaps (Diff-Only Blindness):** If a calculation engine, data model, or form field was added or altered, did the reviewer inspect ALL downstream consumers outside the diff? (e.g. Later wizard steps, summary KPI cards, detail tables, PDF/document generators, GL journal postings, regulatory XML exports). Code changes in core engines are completely broken for users if downstream views ignore or misrepresent them.
- **Orphaned records:** When a parent record is updated, archived, or deleted, what happens to dependent child records, joins, or file blobs?
- **Transactional atomicity:** Are multi-record modifications executed in a single atomic transaction, or can a crash leave inconsistent data?
- **Unintended side effects:** Does a seemingly isolated change trigger unexpected cascades in event listeners, triggers, or shared state stores?

#### 6. 🛡️ Security, Authorization & Untrusted Inputs
*Issues concerning boundary crossing, permissions, and input sanitization.*
- **Server-side Authorization:** Are permissions strictly enforced at the API/database/worker level, rather than merely hiding UI controls?
- **Tenant & User Isolation:** Is data strictly scoped by user/tenant/organization identifiers across all queries and operations?
- **Input Sanitization & Injection:** Are untrusted inputs sanitized and validated at boundaries (SQL injection, XSS, prototype pollution, path traversal)?

---

### Phase 4: Verification & Surgical Auto-Fix Protocol (Evidence Gate)

A review is invalid without direct verification. The reviewer MUST execute the appropriate test suites and live database checks:

- **Backend / Python / Go / Node**: `python run_tests.py`, `pytest`, `npm test`, `go test`
- **Frontend / Web (Compilation, Deep Typecheck & Smoke Verification Gate)**:
  - **Step 1 - Deep Semantic Typecheck**: Modern bundlers using `@vitejs/plugin-react-swc` or esbuild strip types without checking them. Running `npm run build` alone is NOT a typecheck! Furthermore, if `tsconfig.json` uses Project References (`"files": []`), a bare `tsc --noEmit` checks nothing. The reviewer MUST run:
    ```bash
    npx tsc -b
    # or if project references require specific app target:
    npx tsc -p tsconfig.app.json --noEmit
    ```
  - **Step 1b - Scope Boundary & Excluded Feature Keyword Sweep**:
    - Cross-reference user scope constraints (e.g. "feature X excluded") against `git diff --name-only`.
    - Run ripgrep for excluded feature keywords on all touched files. Verify zero residual imports, unused hooks, or dummy shims remain.
  - **Step 1c - Active IDE Diagnostics Cross-Check (`@[current_problems]`)**:
    - Check `@[current_problems]` and open buffer diagnostics.
    - If any diagnostic exists in modified files, determine if it is a dead import or a TSServer in-memory desync. If dead code, surgically remove it; if a desync, re-save/touch the file so IDE diagnostics are 100% clean.
  - **Step 2 - Unit & Component Mount Smoke Tests**: `npm test -- --run`
    - For any modified UI components, tabs, or settings views that lack unit test coverage, ensure a mounting smoke test (`render(<Component />)`) executes so that hook initialization, queryKeys invocations, and store subscriptions actually run in the testing engine.
  - **Step 3 - Production Bundle**: `npm run build`
  - **Step 4 - Browser Dev Server Smoke Audit & Universal Console Inspection (Interactive Tab-Clicking)**:
    - Whenever UI/frontend routes, tabs, or menus are touched, verify on the active dev server (`http://localhost:8080`).
    - Use `browser_subagent` or Playwright to navigate to modified views, change tabs, and trigger primary actions.
    - Confirm:
      1. **Zero ErrorBoundary screens:** ("Valami hiba történt" or white screen) never appear.
      2. **Mandatory Console Inspection:** The reviewer MUST retrieve and inspect browser console logs (`console.error`, `console.warn`, unhandled promise rejections). Zero unhandled runtime exceptions (`TypeError`, `ReferenceError`) are permitted.
      3. **Zero 4xx/5xx Network & RPC Errors:** Detektálni kell az összes 4xx és 5xx hibát a hálózaton és a konzolon, különösen a PostgREST RPC hibákat (`PGRST202`, 404 Not Found, 400 Bad Request, schema cache eltérések).
      4. **Anti-Graceful-Failure (False Empty State) Guard:** Tilos sikeresnek minősíteni a tesztet, ha a KPI vagy fejléc találatokat jelez (pl. "221 számla", "40 tétel"), de alatta a táblázat üres állapotot mutat (*"Nincs megjeleníthető adat / számla"*). Az üres állapot mögött meghúzódó rejtett API hibát azonnal fel kell tárni!
      5. **DOM Row Assertion:** Táblázatoknál és listáknál kötelező igazolni a tényleges adatsorok (`<tr>`, kártya elemek) fizikai renderelődését.
      6. **Zero Duplicate Key Warnings:** The reviewer MUST inspect console logs for `Warning: Encountered two children with the same key`. Any key collision in list/table rendering indicates missing deduplication or key collision in append operations.
      7. **Anti-Infinite-Loop Scroll Audit:** When testing infinite scroll or paginated lists, verify that scrolling to the bottom loads exactly one page per trigger and ceases network activity when reaching the end of the dataset.
- **Database / Schema (Live Migration & Schema Verification Gate)**:
  - If any migration was part of the implementation plan or codebase changes:
    - **Step 1:** Run typecheck generation (`supabase gen types`, `prisma generate`, etc.) to confirm TypeScript/model alignment.
    - **Step 2:** Query the live database via MCP tool (`execute_sql` / `list_migrations` / catalog check) or migration CLI:
      ```sql
      -- Universal PostgreSQL schema verification check:
      SELECT table_name, column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = '<target_table>' 
        AND column_name IN ('<new_column_1>', '<new_column_2>');
      ```
    - **Step 3 - Live RPC Signature & Parameter Verification**:
      - For every modified or newly invoked `supabase.rpc('<rpc_name>', { ... })` call in frontend hooks/components:
      - Query `pg_proc` in the live database:
      ```sql
      -- PostgreSQL Live RPC signature and argument audit:
      SELECT 
          p.proname AS function_name,
          pg_get_function_arguments(p.oid) AS arguments,
          pg_get_function_result(p.oid) AS return_type
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN ('<rpc_name_1>', '<rpc_name_2>');
      ```
      - Cross-reference every parameter sent by the client against `arguments`. If a parameter sent by the frontend is missing from the live function signature (or lacks an appropriate default value in Postgres), declare an immediate **🔴 Critical Blocker**! (Prevents PostgREST `PGRST202` schema cache failures).
    - **Step 4 - Mandatory pgTAP Database RPC & Regression Test Gate**:
      - For every modified or newly introduced database migration, RPC function, trigger, or accounting/financial logic (`acc_*`, VAT/2665, general ledger, balance sheet, subledgers):
      - **Frontend/Vite tests alone are strictly insufficient**: Client-side mock tests cannot prove that PostgreSQL code won't crash on NULL values, violation of double-entry rules ($T \neq K$), or timeout (57014) on real data.
      - The reviewer MUST locate or execute the corresponding pgTAP test suites in `supabase/tests/database/*.test.sql` (either via `npx supabase test db` or executed directly in a rollback transaction `BEGIN ... ROLLBACK;` via database MCP `execute_sql`):
        1. **Null-Safety & Zero-State**: Test that queries against empty companies or null parameters return valid structure without crashing.
        2. **Financial Invariants**: Test that accounting constraints ($T = K$ balance balance enforcement, partner-linking on subledger accounts, non-skippable sorszám counters) strictly fail when violated (`throws_ok` / `throws_matching`).
        3. **Security / RLS Isolation**: Test that unauthenticated/anonymous access (`role = anon`) is strictly rejected with SQLSTATE `42501`.
      - **P1 Test Debt Flag**: If a modified Tier 1 or Tier 2 RPC (per [RPC Testing Blueprint](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/rpc-testing-blueprint.md)) lacks an automated pgTAP test file, flag it as a **🟡 Important / Missing Regression Suite** blocker!
    - **Step 5 - Schema & Test Evidence Recording**:
      - Record exact evidence: whether the planned migration has been executed, whether the live schema matches, whether all RPC signatures are verified, and whether all pgTAP database tests have passed. If any mismatch exists, declare a **🔴 Critical Blocker**!

#### 🛠️ Surgical Auto-Fix Protocol (Mechanical Fix-on-Sight)

When executing tests or reading code, if the reviewer encounters trivial mechanical blockers, the reviewer should fix them on the spot rather than failing the review over trivialities.

| Category | Green Zone (Permitted Auto-Fix) | Red Zone (FORBIDDEN Auto-Fix - Report Only!) |
|---|---|---|
| **Syntax & Typos** | Missing comma, closing bracket, typo in variable/type name | Rewriting expression logic or altering control flow |
| **Imports** | Missing import of an existing module or type | Introducing new external third-party packages |
| **Type & Lint** | Missing prop type in interface, unused import failing build | Using `any` cast to silence a real type mismatch |
| **Test Typos** | Obvious typo in test assertion name or mock parameter | Deleting failing assertions or weakening test assertions |
| **Scope** | Single localized change (1-5 lines) | Changes spanning multiple files or structural refactors |

**Auto-Fix Execution Loop:**
1. Apply surgical fix (1-5 lines max, zero business logic change).
2. Immediately re-run test and build commands.
3. Verify that the issue is resolved and no new regressions were introduced.
4. Log every fix in the report under `### 4. 🛠️ Autonóm módon javított triviális hibák`.

#### Test Intent & Quality Audit
Do not just check if tests pass. Verify:
- Do tests evaluate real **behavior** rather than implementation details/mocks?
- Would these tests actually fail if a bug or regression were introduced?
- Are edge cases (empty states, errors, boundary numbers) tested?

*Capture exact pass/fail counts, execution time, and command outputs.*

---

## 📏 Change & File Sizing Standards

Small, focused changes are easier to review, faster to merge, and safer in production:

```
~100 lines changed   → IDEAL. Reviewable in a single focused sitting.
~300 lines changed   → ACCEPTABLE if it's a single logical, cohesive change.
~1000 lines changed  → TOO LARGE. Must be split into stacked or sliced changes.
```

### File Size Guard (~1000 Total Lines)
A small diff can still push a file past a healthy boundary. When a change materially expands an already large file (~1000 total lines):
- **Decompose before Add:** Extract subcomponents, dedicated utility modules, or custom hooks *before* adding new behavior.
- **Separate Refactoring from Feature Work:** Never combine major structural refactorings and new feature logic in the same changeset.

### Splitting Strategies for Large Changesets
| Strategy | How | When to Use |
|---|---|---|
| **Stack** | Submit small foundational changes first, build next change on top | Sequential dependencies |
| **By File Group** | Separate changes for backend/worker vs frontend/UI | Cross-cutting features |
| **Horizontal** | Create shared models, types, and DB migrations first, then consumers | Layered architecture |
| **Vertical** | Break into smaller end-to-end slices of the user feature | Large multi-screen features |

---

## ⚖️ Disagreement Resolution Hierarchy

When evaluating code or resolving conflicting technical opinions, follow this strict hierarchy:

1. **Technical Facts & Empirical Data:** Benchmark numbers, test evidence, bundle size metrics, and reproduction scripts override subjective opinions.
2. **Project Conventions & Style Guides:** Explicitly documented repository standards and linters are the absolute authority on style matters.
3. **Software Engineering Principles:** Single Responsibility, YAGNI, Decoupling, and Composition principles override personal coding preferences.
4. **Codebase Consistency:** Acceptable if and only if it does not degrade overall system health or propagate anti-patterns.

*Never accept "I'll clean it up later." Require cleanup before approval unless it is an active production emergency.*

---

## 🚨 Issue Calibration & Presumptive Blockers

Categorize all findings using clear severity indicators:

### 🔴 Critical (Must Fix / Blocks Merge)
- Correctness bugs, unhandled exceptions in primary paths, data loss risks.
- Broken database foreign keys, missing authorization policies, unexecuted/missing live database migrations, security vulnerabilities.
- Regressions in existing pipelines or user workflows.

### ⛔ Presumptive Blockers (Architectural & Quality Veto)
*Surface and demand a cleaner design for any of the following:*
- A refactor that merely relocates complexity without reducing concept count.
- Adding code to an already massive (~1000+ line) file without prior decomposition.
- Feature-specific business logic leaking into shared/general utility modules.
- Re-implementing a bespoke helper when a canonical one already exists.
- Gratuitous `any`, unchecked type casts, or silent fallbacks (`|| ''`) that hide broken invariants.

### 🟡 Important (Should Fix / Required)
- Edge-case gaps (timeouts, unexpected nulls, unhandled API statuses).
- Missing error handling or uninformative user error feedback.
- Inefficient re-render loops or missing cache invalidations.
- Test coverage gaps around newly introduced logic.

### 🟢 Minor / Nit (Nice to Have)
- Code style, non-critical naming polish, minor comment clarification.
- Non-blocking micro-optimizations.

---

## 📄 Phase 5: Structured Review Report Template (Delivered in Hungarian)

> [!IMPORTANT]
> **MANDATORY HUNGARIAN REPORT REQUIREMENT**:
> The final review report presented to the user MUST be written in **Hungarian (Magyar nyelven)**, strictly using the template structure below:

```markdown
# 🛡️ Morfi Implementation Review: [Feladat / Handoff Címe]

## 1. 📌 Áttekintés & Célilleszkedés
- **Eredeti hiba / Cél (RCA):** [Rövid összefoglaló a feladatról]
- **Vizsgált fájlok & Git tartomány:** [Minden vizsgált fájl pontos listája]
- **Specifikációs megfelelőség (ADR/PRD/Spec):** [Megfelel / Eltérés indoklással]
- **Architektúra & Változtatás méret:** [~X sor módosult, Fájlméretek rendben / Dekompozíció szükséges]

---

## 2. 🔄 Univerzális Adatfolyam & Downstream Fogyasztói Ellenőrzés (Pipeline Trace Matrix)
*(Kötelező minden új vagy módosított üzleti szabály, űrlapmező, számítás vagy adatmodell esetén!)*
| Életciklus Állomás | Érintett komponens / Modul | Állapot | Észrevétel / Megjelenítés / Lefedettség |
|---|---|---|---|
| **1. Beviteli & Validációs réteg** | [pl. Form komponens, API Endpoint, CLI parser] | ✅ / ⚠️ | [Bemeneti validáció, típusbiztonság, szélsőértékek] |
| **2. Üzleti logika & Számítási motor** | [pl. Domain Service, Calculator Engine] | ✅ / ⚠️ | [Pontos üzleti kalkuláció, élek kezelése, mentességek] |
| **3. Perzisztencia & Adatbázis** | [pl. DB táblák, sémák, JSONB, Redis cache] | ✅ / ⚠️ | [Adattárolás veszteségmentes, migrációk rendben] |
| **4. Közbenső nézetek & Munkafolyamatok** | [pl. Wizard lépések, szerkesztő modálok] | ✅ / ⚠️ | [Adatátadás lépések között, perzisztens állapot] |
| **5. Összesítők, KPI-ok & Dashboardok** | [pl. Záró táblázat, összegző kártyák, KPI] | ✅ / ⚠️ | [Tételes oszlop/sor, beépülés az aggregációkba] |
| **6. Dokumentum-, Riport- & PDF-kimenetek** | [pl. Generált bizonylat, PDF, letölthető fájl] | ✅ / ⚠️ | [Hivatalos kimeneten való tételes feltüntetés] |
| **7. Rendszerintegrációk & Mellékhatások** | [pl. Könyvelési feladás, esemény queue, webhook] | ✅ / ⚠️ | [Mellékhatások, egyensúlyi ellenőrzés (T=K), audit] |
| **8. Külső hatósági / Partner exportok** | [pl. Szabványos XML, REST API, Banki csomag] | ✅ / ⚠️ | [Külső sémáknak és szerződéseknek való megfelelőség] |

---

## 3. 🗄️ Adatbázis Migráció & Éles Séma Ellenőrzés (Live DB Migration Audit)
*(Kötelező, ha az implementációs terv, handoff vagy changeset adatbázis módosítást érintett!)*

- **Implementációs terv szerinti migrációk:** [Volt-e migráció a tervben? pl. `20260908_add_xyz_columns.sql` / Nem volt DB érintettség]
- **Migrációs napló státusz (Migration Ledger):** [Lefutott és rögzítve az éles adatbázisban / HIÁNYZIK / N/A]
- **Fizikai séma vizsgálat (Live Schema Inspection via SQL/MCP):**
  - **Érintett táblák/oszlopok:** [pl. `employees.szocho_kedvezmeny_alap` létezik numeric(12,2) típussal az élő adatbázisban]
  - **Megszorítások & Indexek:** [pl. Foreign key constraints, unique indexek aktívak]
  - **RPC & RLS állapot:** [pl. Új RPC függvények telepítve, RLS házirendek aktívak]
- **Éles státusz verdikt:** [✅ ÉLES ÉS BIZONYÍTOTT / 🔴 BLOKKOLÓ: A migráció nem futott le élesben!]

---

## 4. 🛠️ Autonóm módon javított triviális hibák (Surgical Auto-Fixes)
*(Ha nem volt szükség azonnali javításra: "✅ Nem volt szükség mechanikus javításra.")*
1. **[file_path:line]**: [Mi volt a hiba pl. elírt import / típusnév], javítva erre: [javítás leírása]. Újratesztelve: ✅ SIKERES.

---

## 5. 🔬 Részletes Kódvizsgálat (Findings)

### 🔴 Critical & Presumptive Blockers (Must Fix)
*(Ha nincs: "✅ Nem található kritikus hiba vagy blokkoló szerkezeti probléma.")*
1. **[Hiba / Blokkoló címe]**
   - **Hely:** `[file_path:line]`
   - **Probléma:** [Pontos technikai leírás]
   - **Kockázat:** [Miért okoz hibát, adatvesztést vagy architekturális adósságot]
   - **Strukturális Gyógymód (The Move):** [Konkrét nevesített minta és megoldás]

### 🟡 Important (Should Fix / Required)
*(Ha nincs: "✅ Nem található fontos javítandó tétel.")*
1. **[Észrevétel címe]**
   - **Hely:** `[file_path:line]`
   - **Probléma:** [Edge-case, hiányzó hibakezelés, teljesítmény probléma vagy tesztrés]
   - **Javasolt javítás:** [Megoldás]

### 🧹 Dead Code & Dependency Hygiene
- **Azonosított árva kód / Elavult elemek:** [Listázva vagy "✅ Nincs holt kód."]
- **Függőség vizsgálat:** [Új csomagok / Frissítések / Lockfile állapot]

### 🟢 Minor / Nit (Optional)
1. **[Megjegyzés]** - `[file_path:line]`: [Stílus, komment, kisebb szépítés]

---

## 6. 🔍 Feltárt Vakfoltok & Tervezési Edge Case-ek (6-Axis Blind-Spot Analysis)
*(Figyelem: Ezek nincsenek automatikusan leimplementálva. Kérlek válaszd ki a kívánt kezelési módot!)*

1. **[Vakfolt / Edge Case Címe]**
   - **Dimenzió:** [1. Concurrency & Temporal | 2. Boundaries & Extremes | 3. Failure & Resilience | 4. State & Lifecycle | 5. Data Integrity & Atomicity | 6. Security & Inputs]
   - **Hely / Érintett modul:** `[file_path:line]`
   - **Vakfolt leírása:** [Mi az a szituáció, amire a kezdeti tervezés nem gondolt?]
   - **Üzleti / Technikai Kockázat:** [Mi történik élesben, ha ez bekövetkezik?]
   - **Javasolt Megoldási Opciók a Felhasználónak:**
     - **Opció A (Azonnali lefedés):** [Megoldás tömör leírása]
     - **Opció B (Külön feladatként felvenni / Backlog):** [Nem blokkolja a jelenlegi kört, későbbi iterációra ütemezve]
     - **Opció C (Tudatos kompromisszum / Out-of-scope):** [A kockázat elfogadható, nincs teendő]

---

## 7. 🧪 Verifikáció & Teszt Bizonyítékok
| Teszt Környezet | Futtatott Parancs / Ellenőrzés | Eredmény | Állapot |
|---|---|---|---|
| Backend / Worker Tesztek | `python run_tests.py` / `pytest` | [pl. 59 passed] | ✅ SIKERES |
| Frontend Tesztek | `npm test -- --run` | [pl. 896 passed] | ✅ SIKERES |
| Adatbázis RPC / pgTAP Tesztek | `supabase/tests/database/*.test.sql` via `execute_sql` | [pl. 33 passed (5/5 suite)] | ✅ SIKERES |
| Build Ellenőrzés | `npm run build` | [pl. 16.07s] | ✅ SIKERES |
| Éles DB Séma & Migráció | `execute_sql` / `information_schema` lekérdezés | [pl. Oszlopok fizikai létezése igazolva] | ✅ ÉLES ÉS IGAZOLT |

**Tesztminőség értékelése:** [A tesztek valódi viselkedést fednek le, nem csupán felületes mockokat.]

---

## 8. ⚖️ Végső Értékelés (Verdict)

**Ready to proceed / merge:** **[IGEN | NEM | JAVÍTÁSOKKAL | VAKFOLT DÖNTÉSRE VÁR]**

**Indoklás:** [Tömör vezetői összefoglaló a kód minőségéről, megbízhatóságáról és fenntarthatóságáról]

**Javasolt következő lépések & Kérdések a Felhasználóhoz:**
1. [Döntési kérdés a feltárt vakfoltokról]
2. [Konkrét teendők a merge-höz vagy javításhoz]

<!-- GOAL_COMPLETE -->
```

---

## 🚫 Forbidden Review Behaviors & Anti-Patterns

- ❌ **NEVER** claim *"Everything looks good"* without actually opening the affected files and reviewing line-by-line using `view_file` or `git diff`.
- ❌ **NEVER** skip running tests under the excuse that *"they already passed in the previous session"*.
- ❌ **NEVER** accept handoff document claims as established facts: verify every single assertion in the actual code.
- ❌ **NEVER** accept `npm run build` as proof of TypeScript correctness when using Vite SWC/esbuild: semantic typechecking (`tsc -b` / `tsc -p tsconfig.app.json --noEmit`) is strictly mandatory!
- ❌ **NEVER** sign off on UI changes or project sync without verifying that newly modified tabs or sub-views actually mount without runtime hook/query key exceptions (either via mounted smoke tests or interactive `browser_subagent` navigation)!
- ❌ **NEVER** approve or mark a review complete if a database migration was part of the task or implementation plan but has NOT been verified as executed and live in the actual target database engine!
- ❌ **NEVER** silently implement business logic or unrequested edge-case handling autonomously! Discovered blind spots must ONLY be presented with trade-offs and options for user decision.
- ❌ **NEVER** perform an auto-fix on business logic, database schemas, or API contracts! Auto-fixing is strictly limited to trivial mechanical syntax/import errors (1-5 lines).
- ❌ **NEVER** fail a review over a 1-line trivial mechanical typo (e.g. missing import) if it can be safely and surgically fixed and proven on the spot via the Surgical Auto-Fix protocol.
- ❌ **NEVER** raise vague complaints ("this code is ugly") — always propose a named **Structural Remedy** ("The Move").
- ❌ **NEVER** allow files bloated beyond ~1000 lines without prior decomposition (Decompose-before-Add).
- ❌ **NEVER** deliver the final review report in English when communicating with the user: the report MUST be in Hungarian per the Mandatory Output Language Constraint.
- ❌ **NEVER** allow dummy stubs or no-op shims to mask dead imports from excluded features: always remove the dead import and unused hook calls from the consumer instead of stubbing the module.
- ❌ **NEVER** ignore `@[current_problems]` or active editor diagnostics just because CLI `tsc` passed in a subshell: always verify and reconcile IDE diagnostics.
- ❌ **NEVER** approve infinite scroll or pagination code that calculates page indices from client-side filtered array lengths (`list.length / PAGE_SIZE`) or relies solely on React async state (`isLoading`) without a synchronous in-flight ref guard (`inFlightRef.current = true`).
- ❌ **NEVER** conclude a review superficially; only append the `<!-- GOAL_COMPLETE -->` tag once all verification points and checks have been 100% physically proven and executed.
