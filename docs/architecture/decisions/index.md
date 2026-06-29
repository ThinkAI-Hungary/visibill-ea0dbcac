# Visibill — Architecture Decision Records (ADR)

> **Utoljára frissítve:** 2026-06-29  
> **Összesen:** 23 döntés | ✅ Decided: 22 | ⛔ Superseded: 1

---

## Hogyan használd

Minden döntés egy külön `.md` fájl, amely leírja **miért** választottuk az adott technológiai/architekturális megoldást. Az ADR-ek az AI asszisztensnek is segítenek: nem kell kitalálnia a tervezési szándékot.

**ADR formátum:**
- `Status` — Decided / Open / Superseded
- `Context` — Miért volt szükség erre a döntésre?
- `Decision` — Mit választottunk?
- `Consequences` — Mik a következmények, trade-off-ok?

---

## 🏗️ Rendszer Architektúra

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

## 🔐 Biztonság & Auth

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-009 | Supabase Auth + RBAC (7 role: owner/admin/member/assistant/viewer/employee/management+thinkai) | ✅ Decided | [A-009](./A-009-auth-rbac.md) |
| A-010 | Credential titkosítás (AES-256-GCM, per-user) | ✅ Decided | [A-010](./A-010-credential-encryption.md) |
| A-017 | Biztonsági architektúra (5 réteg, audit trail) | ✅ Decided | [A-017](./A-017-security-architecture.md) |
| A-020 | Auth Trigger Chain — Signup Incident és Tanulságok | ✅ Decided | [A-020](./A-020-auth-trigger-chain-incident.md) |
| A-021 | Email Auth Flow Redesign — Email change, signup single email, hash interception, sessionStorage security | ✅ Decided | [A-021](./A-021-email-auth-flow-redesign.md) |

## 📧 Email & Integráció

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-011 | Mailgun email processing pipeline | ✅ Decided | [A-011](./A-011-email-processing.md) |
| A-012 | NAV Online Számla API v3 integráció | ✅ Decided | [A-012](./A-012-nav-integration.md) |

## 🗄️ Adatbázis

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-016 | PostgreSQL query stratégia — 79 RPC function teljes katalógus | ✅ Decided | [A-016](./A-016-postgresql-query-strategy.md) |
| A-022 | Kategóriák és projektek dual-table szinkronizációja | ✅ Decided | [A-022](./A-022-categories-projects-sync.md) |

## 🖥️ Frontend

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-013 | Scoped URL routing + invoice filter query params | ✅ Decided | [A-013](./A-013-scoped-routing.md) |
| A-014 | React Query cache stratégia | ✅ Decided | [A-014](./A-014-react-query-cache.md) |

## 💳 Fizetés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-015 | Stripe integráció eltávolítása | ⛔ Superseded | [A-015](./A-015-stripe-removal.md) |

## 🎫 Ügyfélszolgálat

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-018 | Hibajegy rendszer architektúra (event sourcing, Realtime) | ✅ Decided | [A-018](./A-018-ticket-system.md) |

## 🛠️ Platform Üzemeltetés

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-019 | Management Dashboard architektúra (11 action, 27 superadmin modul, 5 rétegű guard, Edge Function + service_role) | ✅ Decided | [A-019](./A-019-management-dashboard.md) |

---

## 📄 Frontend Referencia Dokumentumok

A `docs/architecture/` mappában az ADR-ek mellett részletes frontend referencia dokumentumok is találhatók (korábban `docs/design/`-ban voltak):

| Dokumentum | Tartalom |
|-----------|----------|
| [frontend-tech-stack.md](../frontend-tech-stack.md) | React, Vite, TypeScript, provider hierarchy, projekt struktúra |
| [frontend-state-management.md](../frontend-state-management.md) | React Context-ek, React Query, Realtime invalidáció, localStorage |
| [frontend-auth-onboarding.md](../frontend-auth-onboarding.md) | Auth flow, session management, RBAC, onboarding wizard |
| [frontend-performance.md](../frontend-performance.md) | Code splitting, prefetch, memoizáció, query cache tuning |
| [error-logging-system.md](../error-logging-system.md) | Centralizált error logging & dashboard (app_error_logs tábla, management-stats EF, Management Dashboard Error panel) |

## 🗄️ Adatbázis Séma Dokumentáció

A teljes adatbázis séma referencia a `docs/architecture/` mappában:

| Dokumentum | Tartalom |
|-----------|----------|
| [database-schema.md](../database-schema.md) | **Áttekintés** — ~155 tábla listája csoportonként, sor számok, leírások |
| [database/01-auth-users.md](../database/01-auth-users.md) | 🔐 Auth & Felhasználók (profiles, subscriptions, credentials) |
| [database/02-companies.md](../database/02-companies.md) | 🏢 Cégek & Tagság |
| [database/03-permissions.md](../database/03-permissions.md) | 🔑 Jogosultságok (eaisybill + eaisyBooks modul permissions) |
| [database/04-invoices.md](../database/04-invoices.md) | 📄 Számlák (invoices, uploads, backup táblák) |
| [database/05-nav.md](../database/05-nav.md) | 🏛️ NAV Online Számla integráció |
| [database/06-transactions-bank.md](../database/06-transactions-bank.md) | 💳 Tranzakciók & Bank |
| [database/07-general-ledger.md](../database/07-general-ledger.md) | 📊 Főkönyv (GL accounts, journal entries, audit) |
| [database/08-salary-hr.md](../database/08-salary-hr.md) | 💰 Bér & Munkaidő |
| [database/09-petty-cash.md](../database/09-petty-cash.md) | 🏦 Házipénztár |
| [database/10-assets.md](../database/10-assets.md) | 📦 Tárgyi Eszközök |
| [database/11-shipping.md](../database/11-shipping.md) | 🚚 Szállítmányozás (shipments, CMR, transport docs) |
| [database/12-annual-reports.md](../database/12-annual-reports.md) | 📋 Éves Beszámoló & ÁFA bevallások |
| [database/13-eaisybooks-core.md](../database/13-eaisybooks-core.md) | 📘 eaisyBooks — Alap (assignments, deadlines, missing items) |
| [database/14-eaisybooks-payroll.md](../database/14-eaisybooks-payroll.md) | 📘 eaisyBooks — Bérszámfejtés |
| [database/15-eaisybooks-tax-legal.md](../database/15-eaisybooks-tax-legal.md) | 📘 eaisyBooks — Adó & Jogi |
| [database/16-eaisybooks-org.md](../database/16-eaisybooks-org.md) | 📘 eaisyBooks — Szervezet |
| [database/17-eaisybooks-ev.md](../database/17-eaisybooks-ev.md) | 📘 eaisyBooks — EV ⚠️ Planned/Empty |
| [database/18-eaisybooks-ai.md](../database/18-eaisybooks-ai.md) | 📘 eaisyBooks — AI Chat |
| [database/19-platform-ops.md](../database/19-platform-ops.md) | 🛠️ Platform & Üzemeltetés (error logs, audit, LLM costs) |
| [database/20-tickets.md](../database/20-tickets.md) | 🎫 Hibajegy Rendszer |
| [database/21-master-data.md](../database/21-master-data.md) | 🏷️ Törzsadatok (categories, projects, partners) |
