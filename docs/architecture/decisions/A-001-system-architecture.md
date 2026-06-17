# A-001: Három Rétegű Architektúra

**Status:** Decided  
**Date:** 2025-09

## Context

A Visibill-nek aszinkron, AI-alapú dokumentumfeldolgozást kell végeznie (OCR, LLM), ami CPU/GPU intenzív. Ugyanakkor a frontend-nek gyorsnak és reaktívnak kell lennie.

## Decision

Három rétegű architektúra:

1. **Frontend** — React SPA (Vite), böngészőben fut
2. **Supabase Platform** — Auth, DB (PostgreSQL + RLS), Storage, Edge Functions (Deno)
3. **Python Worker** — Háttérfeldolgozás (Docker, DigitalOcean)

A rétegek lazán csatoltak — a kommunikáció PGMQ queue-kon és DB-n keresztül történik.

## Consequences

**Pozitív:**
- A frontend azonnal válaszol — nem vár az AI feldolgozásra
- A worker skálázható (több container)
- A Supabase platform csökkenti a boilerplate-et (auth, RLS, realtime)

**Negatív:**
- Két különböző runtime (Deno + Python) karbantartandó
- A frontend nem kap azonnali visszajelzést a feldolgozás végéről (polling/realtime szükséges)
- A worker deployment külön infrastruktúrát igényel (Docker + DigitalOcean)
