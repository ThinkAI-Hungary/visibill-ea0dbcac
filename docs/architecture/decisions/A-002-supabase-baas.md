# A-002: Supabase mint Backend-as-a-Service

**Status:** Decided  
**Date:** 2025-09

## Context

Szükségünk van auth-ra, adatbázisra, file storage-re, serverless function-ökre, és realtime subscription-ökre. Lehetőségek: saját backend, Firebase, Supabase, Appwrite.

## Decision

**Supabase** a teljes backend platform:
- **PostgreSQL** — relációs DB, RLS, PGMQ extension
- **Auth** — JWT, email/password, session management
- **Storage** — számla PDF/képek, bérjegyzékek
- **Edge Functions** — Deno runtime, 42 function (NAV sync, email, trigger-ek)
- **Realtime** — DB change subscription-ök

**Client:** `@supabase/supabase-js` v2.57 — a frontend közvetlenül a Supabase-t hívja, nincs köztes API layer.

## Consequences

**Pozitív:**
- Nincs saját backend kód — RLS policy-k biztosítják a biztonsági szabályokat DB szinten
- Edge Functions könnyű serverless logikához (NAV token csere, email küldés)
- Beépített auth → nincs JWT implementáció
- 165 migration → verziókezelt séma

**Negatív:**
- Vendor lock-in (Supabase specifikus API-k, RLS szintaxis)
- Edge Functions korlátozottak (Deno, nem Node.js)
- Komplex RLS policy-k nehezen debugolhatók
- Nincs ORM — nyers SQL + supabase-js query builder
