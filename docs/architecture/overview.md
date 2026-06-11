# Visibill — Architecture Overview

> **Verzió:** 1.1 | **Dátum:** 2026-06-11  
> **Kapcsolódó:** [Business Overview](../business/overview.md) · [PRD](../product/prd.md) · [Design System](../design/00-overview.md)

---

## Rendszer Áttekintés

A Visibill egy három rétegű rendszer:

```
┌──────────────────────────────────────────────────────────┐
│                     FELHASZNÁLÓ                           │
│                    (böngésző / PWA)                       │
└──────────────┬───────────────────────────────┘
               │ HTTPS
┌──────────────▼───────────────────────────────┐
│           FRONTEND (Vite + React)             │
│  • React 18 + TypeScript                      │
│  • shadcn/ui + TailwindCSS                    │
│  • React Query (server-state cache)           │
│  • React Router (scoped URLs)                 │
│  Hosting: Vercel / Supabase Static            │
└──────────────┬───────────────────────────────┘
               │ supabase-js SDK
┌──────────────▼───────────────────────────────┐
│          SUPABASE PLATFORM                    │
│  ┌─────────────────────────────────────────┐ │
│  │  PostgreSQL (DB + RLS + PGMQ queues)    │ │
│  ├─────────────────────────────────────────┤ │
│  │  Auth (JWT + RBAC)                      │ │
│  ├─────────────────────────────────────────┤ │
│  │  Storage (számla képek, PDF-ek)         │ │
│  ├─────────────────────────────────────────┤ │
│  │  Edge Functions (46 Deno function)      │ │
│  │   • NAV sync, email, trigger-ek         │ │
│  │   • CORS, auth validation               │ │
│  └─────────────────────────────────────────┘ │
│  Hosting: Supabase Cloud                      │
└──────────────┬───────────────────────────────┘
               │ PGMQ (queue polling)
┌──────────────▼───────────────────────────────┐
│          PYTHON WORKER                        │
│  • asyncio + supabase-py                      │
│  • LiteLLM (OpenAI/Anthropic/stb.)           │
│  • MarkItDown + Vision OCR                    │
│  • 6 pipeline (invoice, tx, salary...)        │
│  Hosting: DigitalOcean Droplet (Docker)       │
└──────────────────────────────────────────────┘
```

---

## Adatfolyam

```
Számla beérkezés                    Tranzakció beérkezés
  │                                   │
  ├── Email (Mailgun webhook)         ├── CSV upload (frontend)
  ├── NAV sync (edge function)        └── Futár riport CSV
  └── Kézi feltöltés (frontend)
  │                                   │
  ▼                                   ▼
Supabase Storage + DB INSERT          DB INSERT
  │                                   │
  ▼                                   ▼
Edge Function → PGMQ enqueue         Edge Function → PGMQ enqueue
  │                                   │
  ▼                                   ▼
Python Worker poll                   Python Worker poll
  │                                   │
  ├── OCR (Vision/MarkItDown)         ├── CSV parsing
  ├── LLM klasszifikáció              ├── AI matching (számlákhoz)
  ├── Adatkinyerés                    └── GL kategorizálás
  └── GL kategorizálás
  │                                   │
  ▼                                   ▼
DB UPDATE (feldolgozott adatok)      DB UPDATE (párosított tételek)
  │
  ▼
Frontend (React Query invalidation → friss adat)
```

---

## Kulcsfontosságú Architekturális Döntések

| Terület | Döntés | Miért |
|---------|--------|-------|
| **Backend** | Supabase BaaS | Gyors fejlesztés, beépített auth + RLS + realtime |
| **Multi-tenancy** | RLS (Row Level Security) | Adatszeparáció DB szinten, nem app szinten |
| **Queue** | PGMQ | Nincs extra infrastruktúra (Redis/RabbitMQ) — Postgres-ben fut |
| **Worker** | Python + asyncio | AI/ML ökoszisztéma Pythonban a legerősebb |
| **LLM** | LiteLLM multi-provider | Provider-független, költség-optimalizálás |
| **Frontend routing** | `/:companyId/:dateRange/*` | Bookmarkolható, megosztható URL-ek, SEO-barát |
| **Auth** | Supabase Auth + custom RBAC | JWT token, RLS policy-k, 4 szerep |
| **Email** | Mailgun webhook → Edge Function | Megbízható, skálázható, spam szűréssel |

---

## Kapcsolódó Dokumentáció

| Dokumentum | Tartalom |
|-----------|----------|
| [decisions/index.md](./decisions/index.md) | 20 architekturális döntés (ADR-ek) |
| [frontend-tech-stack.md](./frontend-tech-stack.md) | Frontend tech stack, build, provider hierarchy |
| [frontend-state-management.md](./frontend-state-management.md) | React Context, React Query, Realtime invalidáció |
| [frontend-auth-onboarding.md](./frontend-auth-onboarding.md) | Auth flow, session management, onboarding |
| [frontend-performance.md](./frontend-performance.md) | Code splitting, prefetch, memoizáció |
| [../business/decisions/034-worker-pipeline.md](../business/decisions/034-worker-pipeline.md) | Worker pipeline üzleti scope |
| [../business/decisions/006-tech-stack.md](../business/decisions/006-tech-stack.md) | Üzleti tech stack döntés |
