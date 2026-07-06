# Supabase Exit Strategy — Dokumentáció Index

Ez a mappa az eaisybill **teljes** Supabase vendor lock-in auditját és migrációs tervét tartalmazza.

**Cél:** Felkészülni arra az esetre, ha a jövőben el kell hagyni a Supabase platformot (árazás, skálázás, vagy üzleti okok miatt), minimalizálva a migrációs kockázatot és költséget.

**Állapot:** 🟡 Teljes audit kész — Fázis 0 (előkészítés) indítható  
**Utolsó frissítés:** 2026-06-13

---

## Dokumentumok

| # | Fájl | Tartalom |
|---|---|---|
| 01 | [vendor-lockin-audit](./01-vendor-lockin-audit.md) | Auth (GoTrue) lock-in — 36 hívási pont, 20+ fájl, Admin API, GoTrue-specifikus viselkedések |
| 02 | [edge-functions-catalog](./02-edge-functions-catalog.md) | Mind a 42 Deno Edge Function katalógusa migrációs nehézségi szintekkel |
| 03 | [migration-plan](./03-migration-plan.md) | 4 fázisú migrációs terv, Auth/EdgeFunction interface tervezetek, konverziós minták |
| 04 | [storage-realtime-postgrest-audit](./04-storage-realtime-postgrest-audit.md) | Storage (9 bucket, 22+ hívás), Realtime (3 csatorna, 15 tábla), PostgREST (20+ fájl, 21 RPC), RLS auth.uid() (365+ sor), pg_cron (4 job), hardcoded URL-ek |
| 05 | [extensions-queue-migration](./05-extensions-queue-migration.md) | Postgres kiterjesztések (pgmq, pg_cron) migrációs opciók, adatbázis sync downtime nélkül, és docker-compose alapú helyi tesztkörnyezet szimuláció |
| wiki | [wiki](./wiki.md) | Technikai fogalomtár — 25+ fogalom (GoTrue, JWT, RLS, PGMQ, PostgREST, Deno, stb.) magyarázattal |

---

## Teljes Lock-in Mátrix

| Komponens | Lock-in | Érintett | Migrációs terv |
|---|:---:|---|---|
| **PostgreSQL + RLS** | 🟢 Nulla | 172 migráció | `pg_dump` → bármelyik PG |
| **RLS `auth.uid()`** | 🟡 Közepes | 365+ SQL sor | `auth.uid()` → saját `current_user_id()` function |
| **`auth.users` FK** | 🟡 Közepes | ~10 tábla | Saját `users` tábla kell |
| **PGMQ** | 🟢 Alacsony | Worker | Standard PG extension |
| **pg_cron** | 🟢 Alacsony | 4 job | Standard PG extension |
| **Auth (GoTrue)** | 🔴 Magas | 20+ fájl, 36 hívás | `AuthService` interface + cserélhető implementáció |
| **Edge Functions (Deno)** | 🔴 Magas | 42 funkció | Handler kiszervezés + Node.js/Hono portolás |
| **Storage** | 🟡 Közepes | 9 bucket, 8 fájl, 22 hívás | S3-kompatibilis API csere (R2/Spaces) |
| **Realtime** | 🟡 Közepes | 3 csatorna, 15 tábla, 497 sor fő hub | Ably / Pusher / saját WebSocket |
| **PostgREST** | 🟡 Közepes | 20+ fájl | Drizzle / Prisma / Kysely ORM |
| **Hardcoded URL-ek** | 🟢 Alacsony | 5 fájl | ENV variable csere |

---

## Összesítő számok

| Metrika | Érték |
|---|---:|
| Frontend fájlok `supabase.auth.*` hívással | 20+ |
| Auth hívási pontok összesen | 36 |
| Edge Functions (Deno) | 42 |
| Storage bucket-ek | 9 |
| Storage hívási pontok | 22+ |
| Realtime csatornák | 3 |
| Realtime-on figyelt táblák | 15 |
| PostgREST query fájlok (`supabase.from()`) | 20+ |
| RPC funkciók (`supabase.rpc()`) | 18 |
| `auth.uid()` sorok SQL migrációkban | 365+ |
| `auth.users` FK hivatkozások | ~10 tábla |
| pg_cron job-ok | 4 |
| Hardcoded Supabase URL-ek | 5 fájl |
| SQL migrációk összesen | 172 |

---

## Időterv

```
MOST ──────── Fázis 0 ──────── Fázis 1 ──────── Fázis 2 ──── ... ──── Fázis 3
              Interfészek       Auth              Edge Fn +            Tényleges
              ~3-4 óra          absztrakció       Storage/RT           migráció
              0 kockázat        ~2-4 nap          ~1-2 hét             CSAK ha kell
```
