# Visibill — Architecture Decision Records (ADR)

> **Utoljára frissítve:** 2026-08-09  
> **Összesen:** 47 döntés | ✅ Decided: 46 | ⛔ Superseded: 1

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
| A-035 | Háromirányú Szekvenciális Pipeline Átirányítás (Invoice ↔ Transaction ↔ Report) és Hibakezelés. Kiterjesztés: kompenzációs levél PDF detekció (content gate + AI classifier → courier_reports). Lásd: Worker ADR-047. | ✅ Decided | [A-035](./A-035-three-way-fallback-redirection.md) |
| A-039 | Transaction Matcher Performance Optimization (O(1) in-memory hash indexing) | ✅ Decided | [A-039](./A-039-transaction-matcher-performance-optimization.md) |
| A-047 | Robust PDF Export Pipeline, Paired Image Resolution & eaisybill Brand Kontírozó Lap | ✅ Decided | [A-047](./A-047-pdf-export-enhancements-and-posting-slips.md) |

## đź”  BiztonsĂˇg & Auth

| # | DĂ¶ntĂ©s | StĂˇtusz | FĂˇjl |
|---|--------|---------|------|
| A-009 | Supabase Auth + RBAC (7 role: owner/admin/member/assistant/viewer/employee/management+thinkai) | âś… Decided | [A-009](./A-009-auth-rbac.md) |
| A-010 | Credential titkosĂ­tĂˇs (AES-256-GCM, per-user) | âś… Decided | [A-010](./A-010-credential-encryption.md) |
| A-017 | BiztonsĂˇgi architektĂşra (5 rĂ©teg, audit trail) | âś… Decided | [A-017](./A-017-security-architecture.md) |
| A-020 | Auth Trigger Chain â€” Signup Incident Ă©s TanulsĂˇgok | âś… Decided | [A-020](./A-020-auth-trigger-chain-incident.md) |
| A-021 | Email Auth Flow Redesign â€” Email change, signup single email, hash interception, sessionStorage security | âś… Decided | [A-021](./A-021-email-auth-flow-redesign.md) |

## đź“§ Email & IntegrĂˇciĂł

| # | DĂ¶ntĂ©s | StĂˇtusz | FĂˇjl |
|---|--------|---------|------|
| A-011 | Mailgun email processing pipeline | ✅ Decided | [A-011](./A-011-email-processing.md) |
| A-012 | NAV Online Számla API v3 integráció | ✅ Decided | [A-012](./A-012-nav-integration.md) |
| A-030 | Accounty Email Notification Architecture (preference-gated, dual-sender, event-driven) | ✅ Decided | [A-030](./A-030-accounty-email-notifications.md) |
| A-031 | Mailgun Webhook Robustness (silent missing alias, legacy skip) | ✅ Decided | [A-031](./A-031-mailgun-webhook-robustness.md) |
| A-032 | Accounty Push Notification Preferences (Service Worker, VAPID, EF) | ✅ Decided | [A-032](./A-032-accounty-push-notifications.md) |
| A-034 | Accounty Digest Emails (dedikált oszlopok JSONB helyett, óránkénti Cron) | ✅ Decided | [A-034](./A-034-accounty-digest-emails.md) |
| A-038 | IMAP/SMTP Hitelesítő Adatok és Vault Integráció | ✅ Decided | [A-038](./A-038-imap-smtp-credentials-vault-integration.md) |
| A-041 | Mailgun Webhook Concurrent Dedup — Háromrétegű Idempotency (L1: upload check, L2: llm_koltsegek, L3: DB UNIQUE index) | ✅ Decided | [A-041](./A-041-mailgun-concurrent-dedup.md) |

## đź—„ď¸Ź AdatbĂˇzis

| # | DĂ¶ntĂ©s | StĂˇtusz | FĂˇjl |
|---|--------|---------|------|
| A-016 | PostgreSQL query stratégia — 81 RPC function teljes katalógus | ✅ Decided | [A-016](./A-016-postgresql-query-strategy.md) |
| A-022 | Kategóriák és projektek dual-table szinkronizációja | ✅ Decided | [A-022](./A-022-categories-projects-sync.md) |
| A-036 | Pénztárbizonylat (Cash Voucher) Processing | ✅ Decided | [A-036](./A-036-penztarbizonylat-processing.md) |
| A-037 | Jegyzetek Rendszer Architektúra (Notes System Architecture) | ✅ Decided | [A-037](./A-037-notes-architecture.md) |

## 🖥️ Frontend

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-013 | Scoped URL routing + invoice filter query params | ✅ Decided | [A-013](./A-013-scoped-routing.md) |
| A-014 | React Query cache stratégia | ✅ Decided | [A-014](./A-014-react-query-cache.md) |
| A-029 | Aszinkron URL és Lokális Dialógus Állapot Szinkronizáció (ref lock + delay) | ✅ Decided | [A-029](./A-029-syncing-url-dialog-state.md) |
| A-040 | Multi-Tab Auth Flow Isolation (sessionStorage és auth-token storage detektálás) | ✅ Decided | [A-040](./A-040-multi-tab-auth-flow-isolation.md) |
| A-044 | Shared FilePreviewModal Utility — Egységes fájl előnézet (portal, típusdetektálás, anti-blob-URL) | ✅ Decided | [A-044](./A-044-shared-file-preview-modal.md) |

## đź’ł FizetĂ©s

| # | DĂ¶ntĂ©s | StĂˇtusz | FĂˇjl |
|---|--------|---------|------|
| A-015 | Stripe integrĂˇciĂł eltĂˇvolĂ­tĂˇsa | â›” Superseded | [A-015](./A-015-stripe-removal.md) |

## đźŽ« ĂśgyfĂ©lszolgĂˇlat

| # | DĂ¶ntĂ©s | StĂˇtusz | FĂˇjl |
|---|--------|---------|------|
| A-018 | Hibajegy rendszer architektĂşra (event sourcing, Realtime) | âś… Decided | [A-018](./A-018-ticket-system.md) |

## đź› ď¸Ź Platform ĂśzemeltetĂ©s

| # | DĂ¶ntĂ©s | StĂˇtusz | FĂˇjl |
|---|--------|---------|------|
| A-019 | Management Dashboard architektúra (11 action, 27 superadmin modul, 5 rétegű guard, Edge Function + service_role) | ✅ Decided | [A-019](./A-019-management-dashboard.md) |
| A-033 | Service Role kizárása a cég szintű Audit naplóból | ✅ Decided | [A-033](./A-033-exclude-service-role-from-audit.md) |
| A-042 | Sztornó Számla Kézi Lezárás — 2 lépéses láncolat logika, reversible settle/unsettle toggle | ✅ Decided | [A-042](./A-042-storno-settle-architecture.md) |
| A-043 | ZIP / RAR / 7z Archívum Csatolmány Kicsomagolás és Body-MIME Parsing — mindkét email pipeline (IMAP + Mailgun), fflate Deno-ban, py7zr/rarfile Python Worker-ben, body-mime RFC822 fallback | ✅ Decided | [A-043](./A-043-zip-archive-email-attachment-expansion.md) |
| A-045 | Audit Trigger Email-Alias Bypass — service_role guard kivétele Mailgun EF INSERT-ekre + trigger kiterjesztés transaction_uploads és report_uploads táblákra | ✅ Decided | [A-045](./A-045-audit-trigger-email-alias-service-role-bypass.md) |
| A-046 | LLM Költség Aggregáció Szerver-Oldali SECURITY DEFINER VOLATILE RPC-kkel — PostgREST max_rows (1000 sor) és 25006-os read-only tranzakciós hibák kiküszöbölése | ✅ Decided | [A-046](./A-046-llm-cost-aggregation-server-side-rpc.md) |

---

## đź“„ Frontend Referencia Dokumentumok

A `docs/architecture/` mappĂˇban az ADR-ek mellett rĂ©szletes frontend referencia dokumentumok is talĂˇlhatĂłk (korĂˇbban `docs/design/`-ban voltak):

| Dokumentum | Tartalom |
|-----------|----------|
| [frontend-tech-stack.md](../frontend-tech-stack.md) | React, Vite, TypeScript, provider hierarchy, projekt struktĂşra |
| [frontend-state-management.md](../frontend-state-management.md) | React Context-ek, React Query, Realtime invalidĂˇciĂł, localStorage |
| [frontend-auth-onboarding.md](../frontend-auth-onboarding.md) | Auth flow, session management, RBAC, onboarding wizard |
| [frontend-performance.md](../frontend-performance.md) | Code splitting, prefetch, memoizĂˇciĂł, query cache tuning |
| [error-logging-system.md](../error-logging-system.md) | CentralizĂˇlt error logging & dashboard (app_error_logs tĂˇbla, management-stats EF, Management Dashboard Error panel) |

## đź—„ď¸Ź AdatbĂˇzis SĂ©ma DokumentĂˇciĂł

A teljes adatbĂˇzis sĂ©ma referencia a `docs/architecture/` mappĂˇban:

| Dokumentum | Tartalom |
|-----------|----------|
| [database-schema.md](../database-schema.md) | **ĂttekintĂ©s** â€” ~155 tĂˇbla listĂˇja csoportonkĂ©nt, sor szĂˇmok, leĂ­rĂˇsok |
| [database/01-auth-users.md](../database/01-auth-users.md) | đź” Auth & FelhasznĂˇlĂłk (profiles, subscriptions, credentials) |
| [database/02-companies.md](../database/02-companies.md) | đźŹ˘ CĂ©gek & TagsĂˇg |
| [database/03-permissions.md](../database/03-permissions.md) | đź”‘ JogosultsĂˇgok (eaisybill + eaisyBooks modul permissions) |
| [database/04-invoices.md](../database/04-invoices.md) | đź“„ SzĂˇmlĂˇk (invoices, uploads, backup tĂˇblĂˇk) |
| [database/05-nav.md](../database/05-nav.md) | đźŹ›ď¸Ź NAV Online SzĂˇmla integrĂˇciĂł |
| [database/06-transactions-bank.md](../database/06-transactions-bank.md) | đź’ł TranzakciĂłk & Bank |
| [database/07-general-ledger.md](../database/07-general-ledger.md) | đź“Š FĹ‘kĂ¶nyv (GL accounts, journal entries, audit) |
| [database/08-salary-hr.md](../database/08-salary-hr.md) | đź’° BĂ©r & MunkaidĹ‘ |
| [database/09-petty-cash.md](../database/09-petty-cash.md) | đźŹ¦ HĂˇzipĂ©nztĂˇr |
| [database/10-assets.md](../database/10-assets.md) | đź“¦ TĂˇrgyi EszkĂ¶zĂ¶k |
| [database/11-shipping.md](../database/11-shipping.md) | đźšš SzĂˇllĂ­tmĂˇnyozĂˇs (shipments, CMR, transport docs) |
| [database/12-annual-reports.md](../database/12-annual-reports.md) | đź“‹ Ă‰ves BeszĂˇmolĂł & ĂFA bevallĂˇsok |
| [database/13-eaisybooks-core.md](../database/13-eaisybooks-core.md) | đź“ eaisyBooks â€” Alap (assignments, deadlines, missing items) |
| [database/14-eaisybooks-payroll.md](../database/14-eaisybooks-payroll.md) | đź“ eaisyBooks â€” BĂ©rszĂˇmfejtĂ©s |
| [database/15-eaisybooks-tax-legal.md](../database/15-eaisybooks-tax-legal.md) | đź“ eaisyBooks â€” AdĂł & Jogi |
| [database/16-eaisybooks-org.md](../database/16-eaisybooks-org.md) | đź“ eaisyBooks â€” Szervezet |
| [database/17-eaisybooks-ev.md](../database/17-eaisybooks-ev.md) | đź“ eaisyBooks â€” EV âš ď¸Ź Planned/Empty |
| [database/18-eaisybooks-ai.md](../database/18-eaisybooks-ai.md) | đź“ eaisyBooks â€” AI Chat |
| [database/19-platform-ops.md](../database/19-platform-ops.md) | đź› ď¸Ź Platform & ĂśzemeltetĂ©s (error logs, audit, LLM costs) |
| [database/20-tickets.md](../database/20-tickets.md) | đźŽ« Hibajegy Rendszer |
| [database/21-master-data.md](../database/21-master-data.md) | đźŹ·ď¸Ź TĂ¶rzsadatok (categories, projects, partners) |
| A-026 | Support Admin Ideiglenes Hozzáférés (Impersonation & RLS Bypass) | ✅ Decided | [A-026](./A-026-support-impersonation-access.md) |
| A-027 | Partner Ranking & Treemap — NAV-only + külföldi partner + dátumszűrő logika | ✅ Decided | [A-027](./A-027-partner-ranking-treemap.md) |

