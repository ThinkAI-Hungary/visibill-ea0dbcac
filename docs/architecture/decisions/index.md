# Visibill — Architecture Decision Records (ADR)

> **Utoljára frissítve:** 2026-08-29  
> **Összesen:** 55 döntés | ✅ Decided: 53 | ⛔ Superseded: 2

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
| A-005 | Edge Functions (Deno) — 50 function teljes katalógus | ✅ Decided | [A-005](./A-005-edge-functions.md) |
| A-023 | Upload Dedup Védelem (DB Trigger + Frontend Mutex) | ✅ Decided | [A-023](./A-023-upload-dedup-protection.md) |

## 🤖 AI & Feldolgozás

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-006 | Python Worker architektúra (Docker, asyncio) | ✅ Decided | [A-006](./A-006-python-worker.md) |
| A-007 | LLM stratégia (LiteLLM, multi-provider) | ✅ Decided | [A-007](./A-007-llm-strategy.md) |
| A-008 | OCR pipeline (Vision + MarkItDown) | ✅ Decided | [A-008](./A-008-ocr-pipeline.md) |
| A-024 | Partner Upsert Strategy (prefix match, foreign partners, both upgrade) | ✅ Decided | [A-024](./A-024-partner-upsert-strategy.md) |
| A-025 | Cross-company Invoice Routing (multi-company adószám-alapú átirányítás) | ✅ Decided | [A-025](./A-025-cross-company-routing.md) |
| A-028 | PDF Export Workflow & Lifecycle (PGMQ, Realtime, 24h cleanup) | ✅ Decided | [A-028](./A-028-pdf-export-lifecycle.md) |
| A-035 | Háromirányú Szekvenciális Pipeline Átirányítás (Invoice ↔ Transaction ↔ Report) és Hibakezelés | ✅ Decided | [A-035](./A-035-three-way-fallback-redirection.md) |
| A-039 | Transaction Matcher Performance Optimization (O(1) in-memory hash indexing) | ✅ Decided | [A-039](./A-039-transaction-matcher-performance-optimization.md) |
| A-047 | Robust PDF Export Pipeline, Paired Image Resolution & eaisybill Brand Kontírozó Lap | ✅ Decided | [A-047](./A-047-pdf-export-enhancements-and-posting-slips.md) |

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

## 🗄️ Adatbázis & Pénzügy

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-016 | PostgreSQL query stratégia — 81 RPC function teljes katalógus | ✅ Decided | [A-016](./A-016-postgresql-query-strategy.md) |
| A-022 | Kategóriák és projektek dual-table szinkronizációja | ✅ Decided | [A-022](./A-022-categories-projects-sync.md) |
| A-036 | Pénztárbizonylat (Cash Voucher) Processing | ✅ Decided | [A-036](./A-036-penztarbizonylat-processing.md) |
| A-037 | Jegyzetek Rendszer Architektúra (Notes System Architecture) | ✅ Decided | [A-037](./A-037-notes-architecture.md) |
| A-051 | ÁFA Bevallás Kalkuláció Robusztusság (Auto-Seed & Date Fallback) | ✅ Decided | [A-051](./A-051-vat-return-auto-seed-and-date-fallback.md) |
| A-053 | Tárgyi Eszközök Projektekhez Rendelése (Fixed Assets Project Assignment) | ✅ Decided | [A-053](./A-053-fixed-assets-project-assignment.md) |
| A-055 | Server-Side Invoice Query, KPI Aggregation & GIN Trigram Optimization | ✅ Decided | [A-055](./A-055-server-side-invoice-query-kpi-optimization.md) |
| A-056 | pg_cron Storage Cleanup Guard & Edge Function Schema Alignment | ✅ Decided | [A-056](./A-056-pgcron-storage-cleanup-and-edge-function-guards.md) |

## 🖥️ Frontend

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-013 | Scoped URL routing + invoice filter query params | ✅ Decided | [A-013](./A-013-scoped-routing.md) |
| A-014 | React Query cache stratégia | ✅ Decided | [A-014](./A-014-react-query-cache.md) |
| A-027 | Partner Ranking & Treemap — NAV-only + külföldi partner + dátumszűrő logika | ✅ Decided | [A-027](./A-027-partner-ranking-treemap.md) |
| A-029 | Aszinkron URL és Lokális Dialógus Állapot Szinkronizáció | ✅ Decided | [A-029](./A-029-syncing-url-dialog-state.md) |
| A-040 | Multi-Tab Auth Flow Isolation (sessionStorage és auth-token storage) | ✅ Decided | [A-040](./A-040-multi-tab-auth-flow-isolation.md) |
| A-044 | Shared FilePreviewModal Utility — Egységes fájl előnézet | ✅ Decided | [A-044](./A-044-shared-file-preview-modal.md) |
| A-054 | Szigorított NAV ↔ Beküldött Számla Összerendelés (Strict Invoice Pairing) | ✅ Decided | [A-054](./A-054-strict-nav-submitted-pairing.md) |

## 💳 Fizetés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-015 | Stripe integráció eltávolítása | ⛔ Superseded | [A-015](./A-015-stripe-removal.md) |

## 🎟️ Ügyfélszolgálat

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-018 | Hibajegy rendszer architektúra (event sourcing, Realtime) | ✅ Decided | [A-018](./A-018-ticket-system.md) |

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


