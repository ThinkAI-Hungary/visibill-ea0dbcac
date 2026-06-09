# A-010: Credential Titkosítás (AES-256-GCM)

**Status:** Decided  
**Date:** 2025-10

## Context

A NAV API hívásokhoz szükséges technikai felhasználó adatokat (login, jelszó, aláírókulcs, cserekulcs) biztonságosan kell tárolni.

## Decision

**AES-256-GCM titkosítás**, felhasználónkénti kulccsal:

- A NAV credentials titkosítva vannak a DB-ben (`nav_credentials` tábla)
- A titkosítási kulcs a `ENCRYPTION_KEY` env variable-ból származik
- A feloldás csak az Edge Function-ben történik (`save-credentials`, `nav-token`)
- A frontend soha nem látja a nyers credentials-t

**Flow:**
1. Felhasználó megadja a NAV adatokat → frontend → Edge Function
2. Edge Function titkosít (AES-256-GCM) → DB-be ment
3. NAV sync → Edge Function lekéri → feloldja → NAV API hívás → eredmény DB-be

## Consequences

**Pozitív:**
- A DB kompromittálása nem jelent credential szivárgást
- Per-record IV (initialization vector) — nincs ismétlődő titkosított szöveg
- A Supabase RLS továbbra is érvényes — felhasználó csak a sajátját éri el

**Negatív:**
- Az `ENCRYPTION_KEY` elvesztése → minden credential elvész (nincs key rotation)
- Az Edge Function-ben van a feloldás — a service_role key kompromittálása = credential hozzáférés
