# P-003: Empty State Dashboard

**Status:** Decided  
**Category:** Onboarding & Első Élmény

**Question:** Mit lát a felhasználó ha nincs még cége?

**Decision:** Inline cég létrehozás flow, minimális friction.

**Current Implementation:**
- EmptyStateDashboard komponens ha companies.length === 0
- Inline cég létrehozás flow
- Befejezés után ProductTour indul automatikusan

**Rationale:** Az egyszerűség kulcs — a felhasználó azonnal céghez jut. A P-002-ben döntött onboarding checklist kiegészíti az értékbemutatást, nincs szükség külön landing-re vagy demo cégre.
