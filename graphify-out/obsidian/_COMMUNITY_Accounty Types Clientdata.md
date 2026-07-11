---
type: community
cohesion: 0.12
members: 17
---

# Accounty Types Clientdata

**Cohesion:** 0.12 - loosely connected
**Members:** 17 nodes

## Members
- [[Accounty Module]] - concept - PROJECT_DOCUMENTATION.md
- [[Bank Statement Integration]] - concept - PROJECT_DOCUMENTATION.md
- [[Currency Conversion]] - concept - PROJECT_DOCUMENTATION.md
- [[Dashboard Analysis Report]] - document - dashboard_analysis_report.html
- [[Dashboard Analytics]] - concept - PROJECT_DOCUMENTATION.md
- [[Invoice Management System]] - concept - PROJECT_DOCUMENTATION.md
- [[NAV (Hungarian Tax Authority) Integration]] - concept - PROJECT_DOCUMENTATION.md
- [[NAV Authentication (SHA-512SHA3-512)]] - concept - PROJECT_DOCUMENTATION.md
- [[NAV XML Processing]] - concept - PROJECT_DOCUMENTATION.md
- [[Payroll Pipeline]] - concept - PROJECT_DOCUMENTATION.md
- [[Project Tracking]] - concept - PROJECT_DOCUMENTATION.md
- [[Salary Management]] - concept - PROJECT_DOCUMENTATION.md
- [[Transaction Matching]] - concept - PROJECT_DOCUMENTATION.md
- [[VAT Reporting]] - concept - PROJECT_DOCUMENTATION.md
- [[bank_transactions Table]] - concept - PROJECT_DOCUMENTATION.md
- [[invoices Table]] - concept - PROJECT_DOCUMENTATION.md
- [[nav_invoices Table]] - concept - PROJECT_DOCUMENTATION.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Accounty_Types_Clientdata
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_Hooks Useaccountydata Accountycommunicationprefs]]
- 1 edge to [[_COMMUNITY_Hooks Useaccountydata Invoicereportrow]]

## Top bridge nodes
- [[Invoice Management System]] - degree 10, connects to 2 communities