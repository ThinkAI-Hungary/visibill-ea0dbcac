# Visibill — Architecture Decision Records (ADR)

> **Utoljára frissítve:** 2026-06-11  
> **Összesen:** 20 döntés | ✅ Decided: 19 | ⛔ Superseded: 1

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
| A-005 | Edge Functions (Deno) — 46 function teljes katalógus | ✅ Decided | [A-005](./A-005-edge-functions.md) |

## 🤖 AI & Feldolgozás

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-006 | Python Worker architektúra (Docker, asyncio) | ✅ Decided | [A-006](./A-006-python-worker.md) |
| A-007 | LLM stratégia (LiteLLM, multi-provider) | ✅ Decided | [A-007](./A-007-llm-strategy.md) |
| A-008 | OCR pipeline (Vision + MarkItDown) | ✅ Decided | [A-008](./A-008-ocr-pipeline.md) |

## 🔐 Biztonság & Auth

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-009 | Supabase Auth + RBAC (owner/admin/member/employee) | ✅ Decided | [A-009](./A-009-auth-rbac.md) |
| A-010 | Credential titkosítás (AES-256-GCM, per-user) | ✅ Decided | [A-010](./A-010-credential-encryption.md) |
| A-017 | Biztonsági architektúra (5 réteg, audit trail) | ✅ Decided | [A-017](./A-017-security-architecture.md) |
| A-020 | Auth Trigger Chain — Signup Incident és Tanulságok | ✅ Decided | [A-020](./A-020-auth-trigger-chain-incident.md) |

## 📧 Email & Integráció

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-011 | Mailgun email processing pipeline | ✅ Decided | [A-011](./A-011-email-processing.md) |
| A-012 | NAV Online Számla API v3 integráció | ✅ Decided | [A-012](./A-012-nav-integration.md) |

## 🗄️ Adatbázis

| # | Döntés | Státusz | Fájl |
|---|--------|---------|------|
| A-016 | PostgreSQL query stratégia — 77 RPC function teljes katalógus | ✅ Decided | [A-016](./A-016-postgresql-query-strategy.md) |

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
| A-019 | Management Dashboard architektúra (Edge Function + service_role) | ✅ Decided | [A-019](./A-019-management-dashboard.md) |

---

## 📄 Frontend Referencia Dokumentumok

A `docs/architecture/` mappában az ADR-ek mellett részletes frontend referencia dokumentumok is találhatók (korábban `docs/design/`-ban voltak):

| Dokumentum | Tartalom |
|-----------|----------|
| [frontend-tech-stack.md](../frontend-tech-stack.md) | React, Vite, TypeScript, provider hierarchy, projekt struktúra |
| [frontend-state-management.md](../frontend-state-management.md) | React Context-ek, React Query, Realtime invalidáció, localStorage |
| [frontend-auth-onboarding.md](../frontend-auth-onboarding.md) | Auth flow, session management, RBAC, onboarding wizard |
| [frontend-performance.md](../frontend-performance.md) | Code splitting, prefetch, memoizáció, query cache tuning |
