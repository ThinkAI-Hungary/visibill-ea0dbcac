# Visibill — Architecture Decision Records (ADR)

> **Utoljára frissítve:** 2026-09-24  
> **Összesen:** 159 döntés | ✅ Decided: 157 | ⛔ Superseded: 2

---

## Hogyan használd

Minden döntés egy külön `.md` fájl, amely leírja **miért** választottuk az adott technológiai/architekturális megoldást. Az ADR-ek az AI asszisztensnek is segítenek: nem kell kitalálnia a tervezési szándékot.

**ADR formátum:**
- `Status` — Decided / Open / Superseded
- `Context` — Miért volt szükség erre a döntésre?
- `Decision` — Mit választottunk?
- `Consequences` — Mik a következmények, trade-off-ok?

---

## 🏛️ Rendszer Architektúra

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-001 | Három rétegű architektúra (Frontend / Edge / Worker) | ✅ Decided | [A-001](./A-001-system-architecture.md) |
| A-002 | Supabase mint Backend-as-a-Service | ✅ Decided | [A-002](./A-002-supabase-baas.md) |
| A-003 | Multi-tenancy RLS alapon | ✅ Decided | [A-003](./A-003-multi-tenancy-rls.md) |

## 📡 Kommunikáció & Queue

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-004 | PGMQ mint aszinkron queue | ✅ Decided | [A-004](./A-004-pgmq-queue.md) |
| A-005 | Edge Functions (Deno) — 64 function teljes katalógus | ✅ Decided | [A-005](./A-005-edge-functions.md) |
| A-023 | Upload Dedup Védelem (DB Trigger + Frontend Mutex) | ✅ Decided | [A-023](./A-023-upload-dedup-protection.md) |
| A-074 | PDF Export Edge Function Invocation Resilience | ✅ Decided | [A-074](./A-074-pdf-export-edge-function-invocation-resilience.md) |
| A-130 | NAV Auto-Sync Hajnali Időablakos Terheléselosztás (Dawn Load Staggering) | ✅ Decided | [A-130](./A-130-nav-auto-sync-dawn-load-staggering.md) |
| A-132 | NAV Online Számla v3.0 queryTaxpayer Integráció és Think AI Kft. Kulcs Fallback | ✅ Decided | [A-132](./A-132-nav-query-taxpayer-auto-fill.md) |
| A-133 | NAV Online Számla v3.0 Hivatalos ÁFA Összesítő (<invoiceSummary>) és Áfakulcs-Megbontás Integráció | ✅ Decided | [A-133](./A-133-nav-official-invoice-summary-vat-breakdown.md) |

## 🤖 AI & Feldolgozás

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-006 | Python Worker architektúra (Docker, asyncio) | ✅ Decided | [A-006](./A-006-python-worker.md) |
| A-007 | LLM stratégia (LiteLLM, multi-provider) | ✅ Decided | [A-007](./A-007-llm-strategy.md) |
| A-008 | OCR pipeline (Vision + MarkItDown) | ✅ Decided | [A-008](./A-008-ocr-pipeline.md) |
| A-024 | Partner Upsert Strategy (prefix match, foreign partners, both upgrade) | ✅ Decided | [A-024](./A-024-partner-upsert-strategy.md) |
| A-025 | Cross-company Invoice Routing (multi-company adószám-alapú átirányítás & intra-group védelem) | ✅ Decided | [A-025](./A-025-cross-company-routing.md) |
| A-028 | PDF Export Workflow & Lifecycle (PGMQ, Realtime, 24h cleanup) | ✅ Decided | [A-028](./A-028-pdf-export-lifecycle.md) |
| A-035 | Háromirányú Szekvenciális Pipeline Átirányítás (Invoice ↔ Transaction ↔ Report) és Hibakezelés | ✅ Decided | [A-035](./A-035-three-way-fallback-redirection.md) |
| A-039 | Transaction Matcher Performance Optimization (O(1) in-memory hash indexing) | ✅ Decided | [A-039](./A-039-transaction-matcher-performance-optimization.md) |
| A-047 | Robust PDF Export Pipeline, Paired Image Resolution & eaisybill Brand Kontírozó Lap | ✅ Decided | [A-047](./A-047-pdf-export-enhancements-and-posting-slips.md) |
| A-059 | Tranzakció Párosítási Mag & Moduláris UI Architektúra (TransactionMatchingCore) | ✅ Decided | [A-059](./A-059-transaction-matching-core-and-modular-ui.md) |
| A-096 | Hivatalos NAV Tételsor Védőháló, Sorszám Szinkronizáció és 23505 Ütközésvédelem | ✅ Decided | [A-096](./A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md) |
| A-116 | K&H Bankkivonatok (.xls / .csv) Robusztus Feldolgozása, Tabulátor Detektálás és Tranzakció Pipeline Intercept Védelem | ✅ Decided | [A-116](./A-116-kh-bank-statement-parsing-and-pipeline-routing-safeguards.md) |
| A-118 | Skontó és Partner Fizetési Határidő Atomi Újraszámítás | ✅ Decided | [A-118](./A-118-atomic-partner-skonto-recalculation.md) |
| A-119 | Aggreg8 PSD2 Open Banking AISP Integráció, Hosted SyncUI és Valós Idejű Tranzakció Szinkronizáció | ✅ Decided | [A-119](./A-119-aggreg8-psd2-open-banking-integration.md) |
| A-120 | Csoportos ÁFA-alanyok Észlelése, Technikai Felhasználó Útmutatás és Szinkronizációs Védőháló | ✅ Decided | [A-120](./A-120-group-vat-entity-detection-and-technical-user-guidance.md) |
| A-128 | Szigorított Számlaszám Határ-illesztés (Boundary Matching), Részhalmaz Kiszűrés (Subsumption Filter) és Többszörös Párosítási Jóváhagyási Kapu | ✅ Decided | [A-128](./A-128-strict-invoice-number-boundary-matching-and-subsumption-guard.md) |
| A-129 | Partner-történeti Többségi Szabályú Számlakategorizálás & DB Triggerek | ✅ Decided | [A-129](./A-129-partner-history-majority-categorization.md) |
| A-145 | Tömeges PDF Szeletelés (Physical Chunk Slicing), NAV Determinisztikus Fallback és Többszörös Mellékletkezelés | ✅ Decided | [A-145](./A-145-bulk-invoice-slicing-and-multi-attachment-architecture.md) |
| A-146 | Magánszemély Vevőnevek Gazdagítása és ÁFA Analitikai Deduplikáció | ✅ Decided | [A-146](./A-146-private-customer-name-enrichment-and-vat-analytics.md) |
| A-147 | Kétirányú Számlaláncolat (Invoice Chaining), Dinamikus Kapcsolt Bizonylat Feloldás és Előnézeti Dokumentum-lapozás | ✅ Decided | [A-147](./A-147-bidirectional-invoice-chaining-and-preview-tabs.md) |

## 🔒 Biztonság & Auth

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-009 | Supabase Auth + RBAC (7 role: owner/admin/member/assistant/viewer/employee/management+thinkai) | ✅ Decided | [A-009](./A-009-auth-rbac.md) |
| A-010 | Credential titkosítás (AES-256-GCM, per-user) | ✅ Decided | [A-010](./A-010-credential-encryption.md) |
| A-017 | Biztonsági architektúra (5 réteg, audit trail) | ✅ Decided | [A-017](./A-017-security-architecture.md) |
| A-020 | Auth Trigger Chain — Signup Incident és Tanulságok | ✅ Decided | [A-020](./A-020-auth-trigger-chain-incident.md) |
| A-021 | Email Auth Flow Redesign — Email change, signup single email, hash interception | ✅ Decided | [A-021](./A-021-email-auth-flow-redesign.md) |
| A-026 | Support Admin Ideiglenes Hozzáférés (Impersonation & Full RLS Access) | ✅ Decided | [A-026](./A-026-support-impersonation-access.md) |
| A-049 | Felhasználó Törlési és Anonimizálási Stratégia (Soft Delete) | ✅ Decided | [A-049](./A-049-user-deletion-soft-delete-strategy.md) |
| A-072 | Robust Accounting Firm Assignment RLS & Direct Client Creation | ✅ Decided | [A-072](./A-072-accounting-assignments-insert-rls.md) |
| A-073 | eaisybill ↔ eaisyBooks Cégfelviteli Automatikus Szinkronizáció | ✅ Decided | [A-073](./A-073-eaisybill-eaisybooks-company-auto-sync.md) |
| A-101 | Közvetlen Szkript-Automatizációk Letiltása és Kettős Védelmi Retesz (PostgREST Pre-Request Hook & Edge Function Client Guard) | ✅ Decided | [A-101](./A-101-direct-script-automation-restriction.md) |

## 📧 Email & Integráció

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-011 | Mailgun email processing pipeline | ✅ Decided | [A-011](./A-011-email-processing.md) |
| A-012 | NAV Online Számla API v3 integráció | ✅ Decided | [A-012](./A-012-nav-integration.md) |
| A-030 | Accounty Email Notification Architecture (preference-gated, dual-sender, event-driven) | ✅ Decided | [A-030](./A-030-accounty-email-notifications.md) |
| A-031 | Mailgun Webhook Robustness (silent missing alias, legacy skip) | ✅ Decided | [A-031](./A-031-mailgun-webhook-robustness.md) |
| A-032 | Accounty Push Notification Preferences (Service Worker, VAPID, EF) | ✅ Decided | [A-032](./A-032-accounty-push-notifications.md) |
| A-034 | Accounty Digest Emails (dedikált oszlopok JSONB helyett, óránkénti Cron) | ✅ Decided | [A-034](./A-034-accounty-digest-emails.md) |
| A-038 | IMAP/SMTP Hitelesítő Adatok és Vault Integráció | ⛔ Superseded | [A-038](./A-038-imap-smtp-credentials-vault-integration.md) |
| A-041 | Mailgun Webhook Concurrent Dedup — Háromrétegű Idempotency | ✅ Decided | [A-041](./A-041-mailgun-concurrent-dedup.md) |
| A-052 | Multi-Profile IMAP/SMTP Levelező Fiókok és Vault Integráció | ✅ Decided | [A-052](./A-052-multi-profile-email-accounts-vault-integration.md) |
| A-113 | NAV Számlatételek ÁFA és Bruttó Összeg Automatikus Kalkulációja (Közműszámlák) | ✅ Decided | [A-113](./A-113-nav-invoice-items-vat-gross-auto-calculation.md) |
| A-119 | Aggreg8 PSD2 Open Banking AISP Integráció, Dedikált Proxy Relay és Valós Idejű Szinkronizáció | ✅ Decided | [A-119](./A-119-aggreg8-psd2-open-banking-integration.md) |
| A-130 | NAV Automatikus Szinkronizáció Hajnali Idő-ablakos Terheléselosztása (Load Staggering) | ✅ Decided | [A-130](./A-130-nav-auto-sync-dawn-load-staggering.md) |

## 🗄️ Adatbázis & Pénzügy

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-016 | PostgreSQL query stratégia — 133 RPC + 74 trigger function teljes katalógus | ✅ Decided | [A-016](./A-016-postgresql-query-strategy.md) |
| A-022 | Kategóriák és projektek dual-table szinkronizációja | ✅ Decided | [A-022](./A-022-categories-projects-sync.md) |
| A-036 | Pénztárbizonylat (Cash Voucher) Processing | ✅ Decided | [A-036](./A-036-penztarbizonylat-processing.md) |
| A-037 | Jegyzetek Rendszer Architektúra (Notes System Architecture) | ✅ Decided | [A-037](./A-037-notes-architecture.md) |
| A-051 | ÁFA Bevallás Kalkuláció Robusztusság (Auto-Seed & Date Fallback) | ✅ Decided | [A-051](./A-051-vat-return-auto-seed-and-date-fallback.md) |
| A-053 | Tárgyi Eszközök Projektekhez Rendelése (Fixed Assets Project Assignment) | ✅ Decided | [A-053](./A-053-fixed-assets-project-assignment.md) |
| A-055 | Server-Side Invoice Query, KPI Aggregation & GIN Trigram Optimization | ✅ Decided | [A-055](./A-055-server-side-invoice-query-kpi-optimization.md) |
| A-056 | pg_cron Storage Cleanup Guard & Edge Function Schema Alignment | ✅ Decided | [A-056](./A-056-pgcron-storage-cleanup-and-edge-function-guards.md) |
| A-057 | Könyvelési Napló Rendszer Architektúra, Robusztus Partner-felismerés és Zárt Tételek UX Védelme | ✅ Decided | [A-057](./A-057-accounting-journals-architecture.md) |
| A-058 | Banki Utalások és Csomagkészítés Architektúra (Bank Transfers) | ✅ Decided | [A-058](./A-058-bank-transfers-architecture.md) |
| A-068 | Szerver-oldali Fájl Lapozás és Összesítés (`get_management_files` RPC) | ✅ Decided | [A-068](./A-068-management-files-rpc-pagination.md) |
| A-071 | Missing EV & Org Database Tables Schema Restoration & Multi-Tenant Parity | ✅ Decided | [A-071](./A-071-ev-and-org-tables-restoration.md) |
| A-078 | Telefonszámla ÁFA Részleges Levonhatóság (70/30 Szabály) és Tételszintű Arányosítás | ✅ Decided | [A-078](./A-078-telecom-vat-deductibility-rules.md) |
| A-082 | Részben Fizetett Számlák Státusz, Szerveroldali Összeg-Aggregáció és Trigger Igazítás | ✅ Decided | [A-082](./A-082-partially-paid-invoices-status.md) |
| A-087 | Magnum Audit XML Főkönyvi Import, Tükörkód Feloldás, Számlatükör Auto-Szinkronizáció és RPC Robusztusság | ✅ Decided | [A-087](./A-087-magnum-audit-xml-gl-ingestion-and-sync.md) |
| A-091 | Bank Statement Boundary Governance & Defense-in-Depth Summary Artifact Filtering | ✅ Decided | [A-091](./A-091-bank-statement-boundary-and-summary-artifact-guard.md) |
| A-092 | Teljes Adatbázis Biztonsági és Teljesítménybeli Audit & Optimalizáció | ✅ Decided | [A-092](./A-092-database-security-and-performance-optimization.md) |
| A-093 | Atomi Cégbeállítások Upsert, Versenyhelyzet Megelőzés és Parciális Frissítések Izolációja | ✅ Decided | [A-093](./A-093-atomic-company-settings-upsert-and-partial-update-isolation.md) |
| A-094 | Bérszámfejtési Ciklus Végtelen Re-render Védelem és Kézi Jelenlét Perzisztencia | ✅ Decided | [A-094](./A-094-payroll-cycle-render-stability-and-attendance-persistence.md) |
| A-095 | Nemzetközi Kártyaelfogadó Terminál (Europay POS) Clearing Devizafelülírás Védelme | ✅ Decided | [A-095](./A-095-international-pos-clearing-currency-override-guard.md) |
| A-096 | Hivatalos NAV Tételsor Védőháló és Számla Szinkronizáció | ✅ Decided | [A-096](./A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md) |
| A-097 | Multi-Tenant nav_invoice_items Denormalizáció, GL Statement Timeout Felszámolása és RLS Optimalizálás | ✅ Decided | [A-097](./A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) |
| A-098 | Készpénzes és Manuális Kifizetésű Számlák Egységes Párosítási Státusza és KPI Integritása | ✅ Decided | [A-098](./A-098-cash-and-manual-payment-matching-status-consistency.md) |
| A-100 | Banki Tranzakció Egyediségi Megkötés Bővítése Összeggel és Csendes Duplikátum-kezelés | ✅ Decided | [A-100](./A-100-transaction-unique-constraint-amount-inclusion.md) |
| A-103 | Accounty RLS Teljesítményoptimalizálás és Postgres Hibanapló Stabilizálás | ✅ Decided | [A-103](./A-103-accounty-rls-performance-optimization-and-error-guarding.md) |
| A-110 | Bérszámfejtési Főkönyvi Számlatükör Pagináció, Cégprofilos Kontírozás Perzisztencia és Kattintási Outline Védelem | ✅ Decided | [A-110](./A-110-payroll-gl-preset-pagination-and-mapping-persistence.md) |
| A-111 | Közvetlen Bizonylat-visszanyitás (Unpost), Főkönyvi Sztornó Kioltás és Sorszámfolytonossági Védelem | ✅ Decided | [A-111](./A-111-accounting-journal-unpost-gl-storno-and-numbering-integrity.md) |
| A-118 | Atomi Partner Skontó Újraszámolás és Kliensoldali Ciklusok Felszámolása | ✅ Decided | [A-118](./A-118-atomic-partner-skonto-recalculation.md) |
| A-129 | Partner-történeti Többségi Szabályú Számlakategorizálás & DB Triggerek | ✅ Decided | [A-129](./A-129-partner-history-majority-categorization.md) |
| A-138 | Számlák Teljesítés Dátuma és Dátum Alap RPC Szűrés | ✅ Decided | [A-138](./A-138-invoices-delivery-date-and-date-basis-rpc-filters.md) |
| A-139 | Tranzakciós jutalék (fee_amount) és kötegelt számlaszám-feloldás | ✅ Decided | [A-139](./A-139-transaction-fee-amount-and-batch-invoice-resolution.md) |

## 🖥️ Frontend

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-013 | Scoped URL routing + invoice filter query params | ✅ Decided | [A-013](./A-013-scoped-routing.md) |
| A-014 | React Query cache stratégia (Modular Domain Registries & Dispatchers) | ✅ Decided | [A-014](./A-014-react-query-cache.md) |
| A-027 | Partner Ranking & Treemap — NAV-only + külföldi partner + dátumszűrő logika | ✅ Decided | [A-027](./A-027-partner-ranking-treemap.md) |
| A-029 | Aszinkron URL és Lokális Dialógus Állapot Szinkronizáció | ✅ Decided | [A-029](./A-029-syncing-url-dialog-state.md) |
| A-040 | Multi-Tab Auth Flow Isolation (sessionStorage és auth-token storage) | ✅ Decided | [A-040](./A-040-multi-tab-auth-flow-isolation.md) |
| A-044 | Shared FilePreviewModal Utility — Egységes fájl előnézet | ✅ Decided | [A-044](./A-044-shared-file-preview-modal.md) |
| A-054 | Szigorított NAV ↔ Beküldött Számla Összerendelés (Strict Invoice Pairing) | ✅ Decided | [A-054](./A-054-strict-nav-submitted-pairing.md) |
| A-059 | TransactionMatchingCore & Moduláris UI Architektúra | ✅ Decided | [A-059](./A-059-transaction-matching-core-and-modular-ui.md) |
| A-060 | Moduláris App Router & Platform Bootstrap Architektúra | ✅ Decided | [A-060](./A-060-modular-app-router-and-bootstrap-shell.md) |
| A-062 | Számla Feature Szelet Modularizáció és Dekompozíció (`src/features/invoices`) | ✅ Decided | [A-062](./A-062-invoices-feature-slice-modularization.md) |
| A-063 | Egységes DocumentEngine & Ports-and-Adapters Export Architektúra (`src/lib/documents`) | ✅ Decided | [A-063](./A-063-unified-document-engine-architecture.md) |
| A-064 | Multi-Channel Document Upload Engine és Feature Szelet Modularizáció (`src/features/upload`) | ✅ Decided | [A-064](./A-064-multi-channel-upload-engine-modularization.md) |
| A-065 | Invoice God Context Dekompozíció és Expanded Invoice Row Modularizáció | ✅ Decided | [A-065](./A-065-invoices-god-context-decomposition-and-expanded-row-modularization.md) |
| A-066 | Management Route Access Control és NotFound Guard | ✅ Decided | [A-066](./A-066-management-route-access-control-and-not-found-guard.md) |
| A-067 | Projects Oldal Lekérdezés Párhuzamosítás és Parciális Indexelés | ✅ Decided | [A-067](./A-067-projects-query-parallelization-and-partial-indexing.md) |
| A-070 | Multi-Channel Upload Storage Bucket Alignment & Synchronized History Mapping | ✅ Decided | [A-070](./A-070-multi-channel-upload-storage-bucket-alignment.md) |
| A-073 | Defensive Prop Normalization & Settings Component Resilience | ✅ Decided | [A-073](./A-073-defensive-prop-normalization-and-settings-resilience.md) |
| A-076 | Statutory Reporting & VAT Return Monolith Deepening, Pure Computation Engines & Feature Slices | ✅ Decided | [A-076](./A-076-statutory-reporting-and-vat-return-monolith-modularization.md) |
| A-079 | Accounty ErrorBoundary Route-Scoped Reset és Client-Scoped Prompt Szabályok | ✅ Decided | [A-079](./A-079-accounty-errorboundary-route-reset-and-prompt-rules-scoping.md) |
| A-080 | NAV ÁNYK 2665 ÁFA-Bevallás és 65M Összesítő Jelentés Szabványos XML Export | ✅ Decided | [A-080](./A-080-nav-anyk-vat-return-xml-standardization.md) |
| A-081 | NAV 08 (2608/2508/2408) XML Feldolgozás és Tömeges Bérszámfejtés Rekonstrukciós Motor | ✅ Decided | [A-081](./A-081-nav-08-payroll-reconstruction-and-bulk-import.md) |
| A-082 | Részben Fizetett Számlák Státusz és Maradék Összeg Kezelése | ✅ Decided | [A-082](./A-082-partially-paid-invoices-status.md) |
| A-083 | Rules of Hooks Invariáns Garantálása és Teszt-Telemetria Kiszivárgás Megelőzése | ✅ Decided | [A-083](./A-083-rules-of-hooks-invariance-and-test-telemetry-guard.md) |
| A-084 | NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu (Approval Gate) | ✅ Decided | [A-084](./A-084-nav-crosscheck-approval-gate.md) |
| A-085 | Főkönyvi Dátum Alap RPC Pushdown és Dinamikus Chunk Reload Recovery | ✅ Decided | [A-085](./A-085-gl-date-basis-rpc-and-chunk-error-recovery.md) |
| A-086 | Főkönyvi Könyvelési Státusz Szűrő (POSTED_ONLY) és Naplózási Irányelvek | ✅ Decided | [A-086](./A-086-gl-posting-status-filter-and-journal-governance.md) |
| A-087 | Főkönyvi Adatbázis-alapú Keresés, Számla-szintű Lapozás és Tooltip Architektúra | ✅ Decided | [A-087](./A-087-gl-database-search-and-account-pagination.md) |
| A-090 | Biztonságos Számlatükör Sablon Törlés, Függőség-Ellenőrzés és Tételek Átkötése (Remapping) | ✅ Decided | [A-090](./A-090-safe-chart-of-accounts-preset-deletion-and-remapping.md) |
| A-094 | Bérszámfejtési Ciklus Végtelen Re-render Védelem, Stabil Függőségi Kulcsok és Kézi Jelenlét Perzisztencia | ✅ Decided | [A-094](./A-094-payroll-cycle-render-stability-and-attendance-persistence.md) |
| A-099 | Számlakép Törlés Kettős Döntési Modell (Dual Choice), Lebegő Műveletsáv Kijelölés-kezelés és Lapozási Határeset Auto-Recovery | ✅ Decided | [A-099](./A-099-invoice-and-upload-deletion-governance.md) |
| A-102 | eaisyBooks Kettős Működési Mód (Dual-Mode Router), Kliens Kontextus és Hibrid Szerepkör Architektúra | ✅ Decided | [A-102](./A-102-eaisybooks-dual-mode-modular-architecture.md) |
| A-103 | eaisyBooks RLS Teljesítmény Optimalizáció és Hiba-Elhárítás | ✅ Decided | [A-103](./A-103-accounty-rls-performance-optimization-and-error-guarding.md) |
| A-104 | eaisyBooks AI Chat Streaming, Dual-Provider API Routing és Edge Architektúra | ✅ Decided | [A-104](./A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md) |
| A-105 | eaisyBill Tudástár Adatmodell, Full-Text Search és AI Retrieval Előkészítés | ✅ Decided | [A-105](./A-105-knowledge-base-schema-and-fts.md) |
| A-106 | Saját Jogú Nyugdíjas Járulékmentesség, Megbízási Munkaidő Rugalmasság és Vendéglátóipari Felszolgálási Díj Adózás | ✅ Decided | [A-106](./A-106-pensioner-tax-exemption-and-service-charge-taxation.md) |
| A-107 | ÁFA Levonhatóság Szinkronizálása a Könyvelési Naplóval és Főkönyvvel, Valós Idejű Trigger és Zárt Tételek Védelme | ✅ Decided | [A-107](./A-107-vat-deductibility-journal-and-gl-sync.md) |
| A-108 | Bérszámfejtési Munkába Járás Költségtérítés (39/2010 Korm. rend.) és Dolgozó-Központú Munkalap (Employee Worksheet View) | ✅ Decided | [A-108](./A-108-payroll-commute-reimbursement-and-employee-worksheet.md) |
| A-109 | Eaisybill Horvát Lokalizáció, /hr/ Scoped Route Architektúra és Helyi Tároló Mentes Nyelvkezelés | ✅ Decided | [A-109](./A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md) |
| A-110 | Bérszámfejtési Számlatükör Sablon Lapozás és Leképezés Perzisztencia | ✅ Decided | [A-110](./A-110-payroll-gl-preset-pagination-and-mapping-persistence.md) |
| A-111 | Közvetlen Bizonylat-visszanyitás (Unpost), Főkönyvi Sztornó Kioltás és Sorszámfolytonossági Védelem | ✅ Decided | [A-111](./A-111-accounting-journal-unpost-gl-storno-and-numbering-integrity.md) |
| A-112 | Futárszolgálati Kompenzációs Értesítők Kétirányú Automatikus Számlarendezése és Futárriport UI Párosítás | ✅ Decided | [A-112](./A-112-courier-compensation-inbound-invoice-auto-settlement.md) |
| A-114 | eaisyBooks Kettős Működési Módú Navigációs Héj Összevonása (Collapse Dual-Mode Navigation Shell) és Seam Hardening | ✅ Decided | [A-114](./A-114-collapse-dual-mode-navigation-shell.md) |
| A-115 | eaisyBooks ↔ eaisyBill Szimmetrikus Hideg/Meleg (Cold/Warm) Hibrid Életciklus Átmenet és Szinkron Útvonal Feloldás | ✅ Decided | [A-115](./A-115-eaisybooks-eaisybill-cold-warm-hybrid-transition-and-route-resolution.md) |
| A-121 | Évek Közötti Áthúzódó Teljesítésű Számlák Főkönyvi és ÁFA Védőhálója (Cross-Year Delivery Guard) | ✅ Decided | [A-121](./A-121-cross-year-delivery-vat-and-general-ledger-guard.md) |
| A-122 | Nem Könyvelt Státusz Kétirányú Szinkronizációja és Optimista UI Állapotkezelés | ✅ Decided | [A-122](./A-122-exclude-from-accounting-sync-and-optimistic-ui.md) |
| A-123 | Vevő Adószám Inkonzisztencia Detektálás és Könyvelői Jóváhagyási Figyelmeztetés | ✅ Decided | [A-123](./A-123-buyer-tax-mismatch-detection-and-approval-guard.md) |
| A-124 | Többoldalas Számlák Folytatás-Felismerése és Téves Multi-Invoice Split Megelőzés | ✅ Decided | [A-124](./A-124-multi-page-invoice-continuation-guard-and-split-suppression.md) |
| A-125 | Atomi Házipénztári Számlakiegyenlítés, Számlaszinkron Trigger Védelem és Auth Életciklus Védelmek | ✅ Decided | [A-125](./A-125-atomic-petty-cash-invoice-settlement-and-auth-resilience.md) |
| A-127 | Számlatáblázat Tab-Váltási Render-Skálázás (Lazy Combobox / DOM Pruning) és CSS Grid Accordion Re-Render Retesz | ✅ Decided | [A-127](./A-127-invoice-table-tab-switch-scaling-and-accordion-re-render-latch.md) |
| A-131 | NAV 2665 ÁFA Bevallás Sormegfeleltetés, Gyűjtőkódok Tisztítása, 6/B Acélipari Nyilatkozat és Egész Kilogrammos Kerekítés | ✅ Decided | [A-131](./A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md) |
| A-134 | Nem Levonható ÁFA Életciklus, Reaktív ÁFA-Bontás (1. + 2. + 3. Opció) és Parciális B-Tree Indexek | ✅ Decided | [A-134](./A-134-non-deductible-vat-lifecycle-and-partial-indexes.md) |
| A-135 | Kettős Áfa Kódrendszer (NAV 2665 vs Konvencionális Könyvelői Kódok) és F.AFA Fordított Adózási Felismerés | ✅ Decided | [A-135](./A-135-dual-vat-code-system-and-reverse-charge-recognition.md) |
| A-136 | Számlatételek Áfakód Szerkeszthetősége és Gépi Tanulási (Machine Learning) Memória | ✅ Decided | [A-136](./A-136-invoice-vat-code-overrides-and-machine-learning.md) |
| A-137 | Rugalmas Főkönyvi Kivonat és Nyitó Import Normalizáció (Microfox Fejlécek és XML SpreadsheetML) | ✅ Decided | [A-137](./A-137-general-ledger-and-opening-import-normalization.md) |
| A-138 | Számlák Teljesítési Dátum és Dátum Alapú Szerveroldali RPC Szűrése | ✅ Decided | [A-138](./A-138-invoices-delivery-date-and-date-basis-rpc-filters.md) |
| A-139 | Tranzakciós jutalék (fee_amount) és kötegelt számlaszám-feloldás | ✅ Decided | [A-139](./A-139-transaction-fee-amount-and-batch-invoice-resolution.md) |
| A-140 | Multi-Jurisdiction Cégkezelés (country_code), Horvát Rendszerszintű Számlatükör Hierarchia (számla_hr) és Dinamikus Főkönyvi Devizanem-Kezelés | ✅ Decided | [A-140](./A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md) |
| A-141 | Globális Fejléc Dátumválasztó Mellé Helyezett Nyelvválasztó (Inline DatePicker Companion Pattern) és Oldalsáv Tehermentesítés | ✅ Decided | [A-141](./A-141-global-header-inline-datepicker-language-switcher.md) |
| A-142 | Kettős Könyvvitel Szerinti Kötelező Kontírszám Szabályok és Vevői Kontírválasztó (311–317 + ÁFA 467/466) | ✅ Decided | [A-142](./A-142-customer-and-vat-gl-rules-enforcement.md) |
| A-143 | Devizás Főkönyvi Számlakezelés (gl_accounts), Bankszámla Deviza Védelem, Devizás Számlakarton és Többdevizás Partner Analitika | ✅ Decided | [A-143](./A-143-multicurrency-chart-of-accounts-and-general-ledger.md) |
| A-144 | Determinisztikus Számlatétel Szabály Motor (invoice_item_rules) és 1-Kattintásos Mentés Dialógus | ✅ Decided | [A-144](./A-144-deterministic-invoice-item-rules-engine.md) |

## 💳 Fizetés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-015 | Stripe integráció eltávolítása | ⛔ Superseded | [A-015](./A-015-stripe-removal.md) |

## 🎟️ Ügyfélszolgálat

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-018 | Hibajegy rendszer architektúra (event sourcing, Realtime) | ✅ Decided | [A-018](./A-018-ticket-system.md) |
| A-089 | Management Dashboard Hibajegy Létrehozás Felhasználó Nevében (Impersonated Ticket Creation) | ✅ Decided | [A-089](./A-089-management-ticket-creation-on-behalf-of-user.md) |

## 🛠️ Platform Üzemeltetés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-019 | Management Dashboard architektúra (11 action, 27 superadmin modul) | ✅ Decided | [A-019](./A-019-management-dashboard.md) |
| A-033 | Service Role kizárása a cég szintű Audit naplóból | ✅ Decided | [A-033](./A-033-exclude-service-role-from-audit.md) |
| A-042 | Sztornó Számla Kézi Lezárás — 2 lépéses láncolat logika | ✅ Decided | [A-042](./A-042-storno-settle-architecture.md) |
| A-043 | ZIP / RAR / 7z Archívum Csatolmány Kicsomagolás és Body-MIME Parsing | ✅ Decided | [A-043](./A-043-zip-archive-email-attachment-expansion.md) |
| A-045 | Audit Trigger Email-Alias Bypass — service_role guard | ✅ Decided | [A-045](./A-045-audit-trigger-email-alias-service-role-bypass.md) |
| A-046 | LLM Költség Aggregáció Szerver-Oldali SECURITY DEFINER VOLATILE RPC-kkel | ✅ Decided | [A-046](./A-046-llm-cost-aggregation-server-side-rpc.md) |
| A-048 | Számla Irány Felülbírálás (Invoice Direction Override) | ✅ Decided | [A-048](./A-048-invoice-direction-programmatic-override.md) |
| A-050 | Server-Side Aggregation & N+1 Query Optimization | ✅ Decided | [A-050](./A-050-server-side-aggregation-and-n-plus-1-optimization.md) |
| A-061 | Decomposing the Monolithic Super-Admin & Management Dashboard | ✅ Decided | [A-061](./A-061-decompose-management-dashboard.md) |
| A-069 | Centralized Frontend Error Ingestion, Stack Trace & Context Deserialization | ✅ Decided | [A-069](./A-069-frontend-error-reporting-and-context-inspection.md) |
| A-075 | Management Overview Null-Safety in SQL JSON Aggregations | ✅ Decided | [A-075](./A-075-management-overview-null-safety-in-rpc-aggregations.md) |
| A-077 | Management Stats Edge Function & Telemetry Decomposition | ✅ Decided | [A-077](./A-077-management-stats-edge-function-and-telemetry-decomposition.md) |
| A-088 | Management Dashboard Adatkonzisztencia, Dedublikáció és Worker Fallback Ciklusvédelem | ✅ Decided | [A-088](./A-088-management-dashboard-dedup-and-worker-fallback-loop-prevention.md) |
| A-117 | Hivatalos Ügyfél REST API v2.2.2 (Customer API), OpenAPI 3, Hibajegyek és M2M Átjáró | ✅ Decided | [A-117](./A-117-customer-rest-api-and-multi-company-keys.md) |
| A-126 | Műveleti Napló E-mail Metaadatok Megőrzése és Retrospektív Számla-Összekapcsolás | ✅ Decided | [A-126](./A-126-audit-trail-email-ingestion-and-invoice-linking.md) |




