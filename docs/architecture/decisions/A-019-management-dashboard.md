# A-019: Management Dashboard Architektúra

**Status:** Decided  
**Date:** 2025-12 (last updated 2026-06-14)

## Context

A management dashboard-nak cross-tenant adatokat kell lekérdeznie (összes cég, összes felhasználó, LLM költségek). Ez RLS-en keresztül nem lehetséges — szükség van `service_role` hozzáférésre, amelyet biztonságosan kell kezelni.

## Decision

### Architektúra: Edge Function + Service Role

A Management Dashboard **nem közvetlenül a Supabase client-en** keresztül kérdez le, hanem egy dedikált Edge Function-ön (`management-stats`) keresztül, amely `service_role` kulcsot használ.

```
ManagementDashboard.tsx
    ↓ fetch (Bearer JWT)
management-stats Edge Function
    ↓ JWT validate → profile.role === 'management' check
    ↓ service_role createClient
    ↓ DB queries (RLS bypass)
    ↓ JSON response
```

### Hozzáférés-védelem (3 réteg)

1. **Frontend:** `ProtectedPage` wrapper → auth guard, bejelentkezés nélkül nem érhető el
2. **Edge Function JWT:** `admin.auth.getUser(token)` — érvényes JWT token szükséges
3. **Role check:** `profiles.role === 'management'` — csak management role-lal rendelkező user kaphat adatot

```typescript
// Edge Function: management-stats/index.ts
const { data: requesterProfile } = await admin
  .from("profiles")
  .select("user_id, role")
  .eq("user_id", userId)
  .maybeSingle();

if (requesterProfile?.role !== "management") {
  return json({ error: "Unauthorized", ...emptyForAction(action) });
}
```

### API Design: Action-based Query Params

Egyetlen Edge Function, 6 action:

| Action | Params | Visszatérés |
|---|---|---|
| `overview` | — | usersCount, companiesCount, companies[], users[], llmOverview |
| `company-detail` | `companyId`, `page`, `pageSize`, `sortBy`, `sortDir`, `search`, `dateFrom`, `dateTo` | invoiceCount, members[], lastActivity, llmCosts{details[]} |
| `user-detail` | `userId` | companyCount, companies[] |
| `errors` | `page`, `pageSize`, `sortCol`, `sortDir`, `search`, `filterSource`, `filterCategory`, `filterCompanyId`, `filterUserId` | totalErrors, last24hErrors, mostAffectedCompany, mostAffectedUser, topErrorCategory, errors[], totalRows |
| `delete-errors` | POST body: `{ ids }` | Hibák törlése az `app_error_logs` táblából |
| `retry-errors` | POST body: `{ ids, targetQueue?, targetCategory? }` | Hibák újraküldése PGMQ queue-ba |

### Adatforrások

Az Edge Function `service_role` klienssel az alábbi táblákat olvassa:

| Tábla | Cél |
|---|---|
| `companies` | Cég lista (id, name, tax_number) |
| `company_members` | Cég-user kapcsolat (role, created_at) |
| `profiles` | Felhasználó info (name, role) — kiszűri a `management` role-t |
| `invoices` | Számlaszám cégenkénti összesítés |
| `nav_invoices` | NAV számlák összesítés |
| `transactions` | Tranzakciók összesítés |
| `salary` | Bérszámfejtés összesítés |
| `llm_koltsegek` | LLM token/költség részletezés (szerver-oldali lapozás) |
| `app_error_logs` | Centralizált hibalogok (frontend, worker, webhook, mailgun) |
| `audit_logs` | Utolsó aktivitás (company-detail) |
| `auth.users` (admin API) | Email címek (listUsers) |

### LLM Költség Lekérdezés (Server-Side)

A `company-detail` action a `llm_koltsegek` táblát **szerver-oldalon lapozza és szűri**:

```typescript
// Aggregált számok (lightweight query, nincs lapozás)
admin.from("llm_koltsegek")
  .select("estimated_cost_usd, total_tokens, llm_calls")
  .eq("company_id", companyId)

// Részletes táblázat (DB-level sort + pagination + count)
admin.from("llm_koltsegek")
  .select("...", { count: "exact" })
  .eq("company_id", companyId)
  .order(sortCol, { ascending: sortDir === "asc" })
  .range(page * pageSize, page * pageSize + pageSize - 1)
```

**Szűrők** (DB-szinten):
- `dateFrom` / `dateTo` → `gte` / `lte` created_at
- `search` → `or(model_name.ilike, file_name.ilike, user_id.in(matching_profile_ids))`

### Frontend Query Stratégia

```typescript
// Overview: 60s auto-refresh, 30s staleTime
useQuery({ queryKey: ['management-overview'], refetchInterval: 60_000 })

// Company detail: 30s auto-refresh, 15s staleTime
useQuery({ queryKey: ['management-company', companyId], refetchInterval: 30_000 })

// LLM cost table: keepPreviousData (lapozás közben nem villog)
useQuery({ queryKey: ['llm-costs', companyId, page, ...], placeholderData: keepPreviousData })
```

### Error Handling

Az Edge Function **mindig érvényes JSON-t ad vissza** — hiba esetén üres adatstruktúrát (nem 500-as hibát). Ez biztosítja, hogy a frontend soha nem crashel betöltés közben.

```typescript
} catch (error) {
  console.error("[MANAGEMENT-STATS] Unexpected error", error);
  return json(emptyForAction(action)); // Üres, de valid response
}
```

### Security: Service Role Használat

> **Miért service_role?** A management dashboard cross-tenant adatokat kérdez le (összes cég, összes user). Az RLS policy-k company_id-re szűrnek, ezért a `service_role` kulcs az egyetlen mód az aggregált adatok lekérdezésére.

**Kockázatcsökkentés:**
- A `service_role` kulcs **csak az Edge Function-ben** van (Deno env var)
- A frontend **soha nem kapja meg** a service_role kulcsot
- 3 rétegű auth (frontend guard + JWT validation + role check)

## Consequences

**Pozitív:**
- Egyetlen Edge Function, 3 action → egyszerű deployment
- Service_role az Edge Function-ben → biztonságos cross-tenant hozzáférés
- Server-side pagination → LLM tábla akárhány rekordra skálázódik
- `keepPreviousData` → lapozás közben nincs villogás
- Graceful error handling → nem crashel, üres adatot mutat

**Negatív:**
- ~~`auth.admin.listUsers({ perPage: 1000 })` → 1000+ felhasználónál csonkolódik~~ — **Javítva:** `listAllAuthUsers()` helper paginál az összes oldalon
- Minden action egyetlen fetch hívásban fut → ha bármelyik query lassú, az egész válasz lassú
- Overview minden company és member adatát egyszerre tölti le → nagy tenant számmal skálázódási kockázat
- Nincs cache-invalidation — `refetchInterval` alapú polling, nem Realtime
- A `management` role check a `profiles` tábla `role` mezőjére épít, nem Supabase-natív custom claims-re

## Kapcsolódó Dokumentáció

- [Error Logging System](../error-logging-system.md) — Részletes error logging architektúra és dashboard
- [09-Error Handling & Feedback](../../design/09-error-handling-feedback.md) — Frontend error kezelés design
