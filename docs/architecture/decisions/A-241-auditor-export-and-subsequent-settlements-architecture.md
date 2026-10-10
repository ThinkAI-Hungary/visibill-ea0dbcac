# A-241: Auditor Export & Data Provision (Module 19) Architecture

**Status:** Decided  
**Date:** 2026-10-10  
**Utoljára frissítve:** 2026-10-10  
**Context:** Visibill eaisyBooks Module 19 / Annual Report Sub-Module  
**Deciders:** Lead Architect, Senior Full-Stack Engineer, Product Owner  
**Relates to:** [A-016](./A-016-postgresql-query-strategy.md), [A-017](./A-017-security-architecture.md), [A-003](./A-003-multi-tenancy-rls.md), [P-178](../../product/decisions/P-178-auditor-export-and-data-provision.md), [BDR-069](../../business/decisions/069-auditor-data-provision-and-statutory-closing-policy.md)

---

## 1. Context & Business Need

Hungarian statutory audits (MKVK) and international financial auditing standards (ISA 500, ISA 560) require certified accounting systems to provide standardized general ledger datasets and analytical packages for auditor software (Alteryx, CaseWare, IDEA, Excel PowerQuery). Furthermore:
- Auditors require a 20-field standardized GL journal with both HUF and foreign amounts, partner tax numbers, cost centers, and user attribution.
- ISA 560 mandates auditing subsequent cash settlements of open receivables and payables between the balance sheet date (Dec 31) and the audit cutoff (typically April 30).
- Post-handover bookkeeping modifications must be cryptographically detected (Staleness / Diff tracking) to prevent silent data drifts between auditor working papers and the live ledger.

---

## 2. Architectural Decisions

### 2.1 Multi-Tenancy & Integrity Tables (`accounty_audit_exports`, `accounty_audit_export_diffs`)
- **Snapshot persistence:** Each auditor export stores file metadata, line count, total debit/credit, and a SHA-256 hash in `accounty_audit_exports`.
- **Physical Snapshot Download:** On saving a snapshot, the system simultaneously calculates the cryptographic hash, records the audit trail row, and triggers an immediate download of the hash-named Excel workbook (`Fokonyv_{fiscalYear}_{hash8}.xlsx`).
- **Staleness flag:** An active flag (`is_stale`) marks whether subsequent journal entries or invoices have been posted/modified after the snapshot creation timestamp.
- **RLS Policy:** Standard `(SELECT auth.uid())` InitPlan filtering by company membership (`company_members`) or accounting assignment (`accounty_assignments`).

### 2.2 Standardized 20-Column General Ledger RPC (`get_auditor_gl_journal_export`)
- Aggregates `acc_journal_headers`, `acc_journal_lines`, `gl_accounts`, `partners`, `accounty_cost_centers`, `projects`, and matched invoices (`invoices`, `nav_invoices`).
- Status coverage includes `KONYVELT`, `KEZI_PISZKOZAT`, and `GEPI_JAVASLAT` to ensure consistent exports across production and test environments.
- Evaluates double-entry balance (`is_balanced`, `imbalance_diff`) directly in PostgreSQL.
- Executes as `SECURITY DEFINER` with `SET search_path TO 'public'`, revoking anonymous execution.

### 2.3 ISA 560 Subsequent Cash Settlements RPC (`get_subsequent_settlements_report`)
- Evaluates invoices open on December 31 (`open_amount_dec31 > 0`).
- Matches settlements and bank transactions occurring between January 1 and April 30 of the following year.
- Calculates settlement percentage and classifies audit status into `SETTLED` (100%), `PARTIALLY_SETTLED`, or `UNSETTLED`.

### 2.4 Zero-Redundancy Integration with MKVK AuditXML Generator
- Reuses existing `mkvkAuditXmlGenerator.ts` directly for MKVK XML format export instead of duplicating XML serialization logic.
- Expanded `get_mkvk_audit_xml_data` status filter via migration `20261010210000_fix_mkvk_audit_xml_status_filter.sql` to include `GEPI_JAVASLAT`.
- Integrates ExcelJS for rich `.xlsx` formatting with formulas and UTF-8 BOM for CSV exports.

---

## 3. Database Schema DDL

```sql
CREATE TABLE public.accounty_audit_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  version_label VARCHAR(64) NOT NULL,
  export_format VARCHAR(16) NOT NULL,
  package_type VARCHAR(64) DEFAULT 'ALL_MODULES' NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_url TEXT,
  file_hash_sha256 VARCHAR(64) NOT NULL,
  total_lines INTEGER DEFAULT 0 NOT NULL,
  total_debit NUMERIC(18,2) DEFAULT 0 NOT NULL,
  total_credit NUMERIC(18,2) DEFAULT 0 NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_stale BOOLEAN DEFAULT false NOT NULL,
  stale_detected_at TIMESTAMPTZ,
  exported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

---

## 4. Consequences & Benefits

- **Positive:**
  - One-click compliance with Hungarian Chamber of Auditors (MKVK) and ISA requirements.
  - Zero performance lag: 5,000+ line general ledgers aggregate in ~2.5s.
  - Complete cryptographic protection against silent ledger tampering post-audit.
- **Negative / Trade-offs:**
  - Generating large ZIP bundles with all 15 packages client-side requires `jszip` memory; handled gracefully via chunked streaming.
