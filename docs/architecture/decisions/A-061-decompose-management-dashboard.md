# A-061: Decomposing the Monolithic Super-Admin & Management Dashboard

## Status
Accepted (Implemented & Verified)

## Context
The Super-Admin and Management Dashboard in `src/pages/ManagementDashboard.tsx` had grown into a massive 8,239-line monolith containing 10+ distinct domain features intertwined in a single file:
- API types, interfaces, and Edge Function invocation handlers
- UI primitives (stat cards, list rows, badges, skeletons, date inputs)
- Company & User detail sub-views with activity summaries and LLM cost breakdowns
- Permission & role matrix tables (`ModuleMatrix`, `PermissionsPanel`)
- Error control panel with pagination, bulk resolution, and deletion modals
- File management panel with preview, bulk status changes, and soft-delete modals
- LLM financial cost monitoring panel with interactive sparklines, donut charts, and model breakdown
- Worker & queue monitoring panel with real-time heartbeat status, container CPU/RAM metrics, and retry pipeline modals
- Superadmin module explorer with multi-tenant company/user switching and support session impersonation
- Root Bento Grid overview orchestrator

This monolithic structure presented critical maintenance hazards:
1. High risk of merge collisions during multi-feature development.
2. Slower IDE performance and cognitive overload when maintaining individual panels.
3. Tight coupling between URL state parameters and component render lifecycles.

## Decision
We decomposed the monolithic `src/pages/ManagementDashboard.tsx` (8,239 lines) into a domain-driven, modular architecture under `src/features/management/`, reducing the entry facade in `src/pages/ManagementDashboard.tsx` to 1 line (re-export).

### Directory & Component Structure
```
src/features/management/
├── api/
│   ├── types.ts                     # Domain models, enums, DTO interfaces
│   └── managementApi.ts             # Typed fetch/post API clients
├── components/
│   ├── common/
│   │   ├── RoleBadge.tsx            # Badge component for user roles
│   │   ├── ManagementSkeleton.tsx   # Loading skeletons
│   │   ├── ManagementStatCard.tsx   # Bento & KPI stat cards
│   │   ├── ManagementListRow.tsx    # List item rows
│   │   ├── ManagementSectionHeader.tsx # Section title & actions
│   │   └── DatePickerInput.tsx      # Native date picker input
│   ├── company/
│   │   ├── CompanyLlmCostTable.tsx  # Company LLM cost breakdown table
│   │   └── CompanyDetailView.tsx    # Company detail view
│   ├── user/
│   │   ├── UserDetailView.tsx       # User detail view with assigned companies
│   │   └── UsersControlPanel.tsx    # User list, search, and cost summary
│   ├── permissions/
│   │   ├── PermissionConstants.ts   # Platform roles & module constants
│   │   ├── ModuleMatrix.tsx         # Matrix permission table
│   │   └── PermissionsPanel.tsx     # Full permissions management panel
│   ├── errors/
│   │   └── ErrorControlPanel.tsx    # Error monitoring, bulk actions, and modals
│   ├── files/
│   │   └── FilesPanel.tsx           # File storage explorer, status changes, delete
│   ├── llm/
│   │   └── LLMCostPanel.tsx         # Financial LLM analytics & model costs
│   ├── worker/
│   │   └── WorkerPanel.tsx          # Container metrics, queues, pipelines, retry
│   ├── superadmin/
│   │   ├── SuperadminConstants.ts   # Module definitions, column labels, status keys
│   │   └── SuperadminPanel.tsx      # Multi-tenant viewer & support impersonation
│   ├── overview/
│   │   └── ManagementOverview.tsx   # High-density Bento Grid overview
│   └── ControlCenter.tsx            # Orchestrating tab container for subpanels
└── ManagementDashboard.tsx          # Root feature orchestrator & view router
```

## Consequences

### Positive
- **Maintainability:** Each domain module is isolated into its own file with clean single-responsibility boundaries.
- **Zero Regression:** All existing URL search parameters (`err_*`, `file_*`, `usr_*`, `wrk_*`, `sa_*`, `view`, `id`) and state interactions were 100% preserved.
- **Strict Backward Compatibility:** `src/pages/ManagementDashboard.tsx` re-exports the orchestrator so lazy route imports in `src/routes/authRoutes.tsx` remain unchanged.
- **Test Integrity:** 100% test pass rate across all 60 test suites (935 passed, 0 failed).

### Negative / Trade-offs
- More files in the file tree, which is managed cleanly through logical folder structuring under `src/features/management/`.
