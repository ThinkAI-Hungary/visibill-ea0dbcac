# Visibill — Architecture Overview

> **Verzió:** 1.4 | **Dátum:** 2026-06-22  
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
│  │  Edge Functions (48 Deno function)      │ │
│  │   • NAV sync, email, trigger-ek         │ │
│  │   • MNB árfolyam letöltés (SOAP API)    │ │
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

### XML főkönyvi import

```
XML feltöltés (frontend)
  │
  ▼
Supabase Storage (`gl_uploads` bucket)
  │
  ▼
Edge Function (process-gl-upload)
  │
  ├── XML parsing (RLB/Novitax/Kulcs-Soft/KÖKÉNY)
  ├── Számlatükör importálás (gl_accounts)
  └── Tétel import (gl_entries)
  │
  ▼
Eredménykimutatás + Mérleg + Beszámoló oldalak
```

### MNB árfolyam szinkronizálás

```
Dashboard betöltés (auto-trigger, ha üres a daily_exchange_rates tábla)
  │
  ▼
Edge Function (fetch-mnb-rates)
  │
  ├── MNB SOAP API hívás (http://www.mnb.hu/arfolyamok.asmx)
  ├── XML válasz parsing (13 deviza, napi szinten)
  └── Upsert: daily_exchange_rates (onConflict: rate_date, currency, source)
  │
  ▼
RPC: get_fx_differences (számla teljesítés vs. befolyás árfolyam összehasonlítás)
  │
  ▼
Dashboard: FxDifferencesSection (KPI kártyák + bar chart + tételszintű tábla)
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
| **Modul jogosultságok** | `eaisybill_module_permissions` DB tábla | Per-user, per-company modul ki-/bekapcsolás, kliens-specifikus feature-ök (pl. Szállítmányozás) |

---

## Kapcsolódó Dokumentáció

| Dokumentum | Tartalom |
|-----------|----------|
| [decisions/index.md](./decisions/index.md) | 20 architekturális döntés (ADR-ek) |
| [frontend-tech-stack.md](./frontend-tech-stack.md) | Frontend tech stack, build, provider hierarchy |
| [frontend-state-management.md](./frontend-state-management.md) | React Context, React Query, Realtime invalidáció |
| [frontend-auth-onboarding.md](./frontend-auth-onboarding.md) | Auth flow, session management, onboarding |
| [frontend-performance.md](./frontend-performance.md) | Code splitting, prefetch, memoizáció |
| [error-logging-system.md](./error-logging-system.md) | Centralizált error logging & dashboard rendszer |
| [shipment-matching.md](./shipment-matching.md) | HRT Spedition fuvar-számla párosítás + Module Permission System |
| [../business/decisions/034-worker-pipeline.md](../business/decisions/034-worker-pipeline.md) | Worker pipeline üzleti scope |
| [../business/decisions/006-tech-stack.md](../business/decisions/006-tech-stack.md) | Üzleti tech stack döntés |
