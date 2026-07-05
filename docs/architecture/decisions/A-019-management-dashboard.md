# A-019: Management Dashboard Architektúra

**Status:** Decided  
**Date:** 2025-12 (last updated 2026-07-05)

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

### Hozzáférés-védelem (5 réteg)

1. **`useAppReady()`:** Profile query-ból felismeri a `management`/`thinkai` role-t → `redirectTarget = 'management'`
2. **`ProtectedLayout`:** A `/` és scoped route-okból azonnal `<Navigate to="/management">` — sidebar nem renderel
3. **`ProtectedRoute`:** A `/accounty` és bármely más route-ból is redirect — `isPending` alatt `null`-t renderel (zero-flash guard)
4. **Edge Function JWT:** `admin.auth.getUser(token)` — érvényes JWT token szükséges
5. **Role check:** `profiles.role` = `'management'` vagy `'thinkai'` — csak ezekkel a role-okkal rendelkező user kaphat adatot

```typescript
// Edge Function: management-stats/index.ts
const { data: requesterProfile } = await admin
  .from("profiles")
  .select("user_id, role")
  .eq("user_id", userId)
  .maybeSingle();

if (requesterProfile?.role !== "management" && requesterProfile?.role !== "thinkai") {
  return json({ error: "Unauthorized", ...emptyForAction(action) });
}
```

### API Design: Action-based Query Params

Egyetlen Edge Function, 13 action:

| Action | Params | Visszatérés |
|---|---|---|
| `overview` | — | usersCount, companiesCount, companies[], users[], llmOverview |
| `company-detail` | `companyId`, `page`, `pageSize`, `sortBy`, `sortDir`, `search`, `dateFrom`, `dateTo` | invoiceCount, members[], lastActivity, llmCosts{details[]} |
| `user-detail` | `userId` | companyCount, companies[] |
| `user-permissions` | `userId` | Felhasználó modul jogosultságai (eaisybill + accounty modulok, read/write) |
| `update-permissions` | POST body: `{ userId, permissions[] }` | Jogosultságok frissítése |
| `errors` | `page`, `pageSize`, `sortCol`, `sortDir`, `search`, `filterSource`, `filterCategory`, `filterCompanyId`, `filterUserId` | totalErrors, last24hErrors, mostAffectedCompany, mostAffectedUser, topErrorCategory, errors[], totalRows |
| `delete-errors` | POST body: `{ ids }` | Hibák törlése (app_error_logs: DELETE, upload táblák: dismissed) |
| `delete-all-errors` | POST (no body) | Összes hiba törlése: app_error_logs DELETE + upload táblák error→dismissed |
| `retry-errors` | POST body: `{ ids, targetQueue?, targetCategory? }` | Hibák újraküldése PGMQ queue-ba (pipeline override) |
| `files` | `page`, `pageSize`, `sortBy`, `sortDir`, `search`, `companyId`, `status`, `source_table`, `dateFrom`, `dateTo` | KPI: total/processing/error/done, topCompany. Fájlok lapozott listája 4 upload táblából (invoice/transaction/bank_statement/report_uploads) |
| `update-file-status` | POST body: `{ files: [{id, source_table}], targetStatus }` | Bulk fájl státusz módosítás. `done` → automatikus mapping: `processed` (invoice_uploads) / `completed` (többi). Max 200 fájl/batch. Nem triggerel PGMQ worker-t (kozmetikai változás). |
| `superadmin-module-data` | `companyId`, `module`, `page`, `pageSize`, `dateFrom`, `dateTo`, `search` | Cégenként 27 modul bármelyikének lapozott adatai (rows[], totalCount) |

### Adatforrások

Az Edge Function `service_role` klienssel az alábbi táblákat olvassa:

| Tábla | Cél |
|---|---|
| `companies` | Cég lista (id, name, tax_number) |
| `company_members` | Cég-user kapcsolat (role, created_at) |
| `profiles` | Felhasználó info (name, role) — kiszűri a `management` role-t |
| `invoices` | Számlák (overview összesítés + superadmin modul) |
| `nav_invoices` | NAV számlák (overview + superadmin) |
| `transactions` | Tranzakciók (overview + superadmin) |
| `salary` | Bérszámfejtés (overview + superadmin) |
| `petty_cash_entries` | Házipénztár (superadmin) |
| `categories` | Kategóriák (superadmin) |
| `projects` | Projektek (superadmin) |
| `partners` | Partnertörzs (superadmin) |
| `fixed_assets` | Tárgyi eszközök (superadmin) |
| `shipments` | Fuvarok (superadmin) |
| `annual_reports` | Éves beszámolók (superadmin) |
| `accounty_assignments` | eaisyBooks hozzárendelések (overview `hasEaisyBooks` flag + superadmin) |
| `accounty_tax_profiles` | Adó profilok (superadmin) |
| `accounty_missing_items` | Hiányzó dokumentumok (superadmin) |
| `accounty_deadlines` | Határidők (superadmin) |
| `accounty_employees` | Alkalmazottak (superadmin) |
| `accounty_payroll_cycles` | Bérszámfejtési ciklusok (superadmin) |
| `accounty_filings` | Bevallások (superadmin) |
| `accounty_tao_yearly` | TAO adatok (superadmin) |
| `accounty_audit_log` | Audit napló (superadmin) |
| `accounty_documents` | Dokumentumok (superadmin) |
| `accounty_templates` | Sablonok — **globális**, nincs company_id szűrés (superadmin) |
| `accounty_job_codes` | Jogviszony kódok — **globális** (superadmin) |
| `accounty_legal_updates` | Jogszabályfigyelő — **globális** (superadmin) |
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

### Fájl Státusz Normalizáció (Files Panel)

A 4 upload tábla (`invoice_uploads`, `transaction_uploads`, `bank_statement_uploads`, `report_uploads`) sokféle `processing_status` értéket tartalmaz. A management dashboard ezeket **3 kategóriába** normalizálja:

| Kategória | DB státuszok | Badge szín |
|-----------|-------------|------------|
| **Feldolgozva** (success) | `done`, `completed`, `processed` | 🟢 zöld |
| **Hiba** (error) | `error`, `failed`, `ignored`, `dismissed`, `webhook_failed` | 🔴 piros |
| **Folyamatban** (pending) | **minden más** (pl. `webhook_sent`, `processing`, `pending`, `null`) | 🟡 sárga |

#### Exklúziós logika

> **`pendingCount = total - successCount - errorCount`**

A pending számolás **nem explicit listával** történik, hanem exklúzióval. Ez biztosítja, hogy bármilyen jövőbeli új státusz (pl. `ocr_processing`, `ai_classifying`) automatikusan a "Folyamatban" kategóriába essen anélkül, hogy az EF kódot frissíteni kellene.

#### Error message elsőbbség

> **Ha egy fájlnak van `error_message` mezője → automatikusan "Hiba" kategóriába kerül**, függetlenül a `processing_status` értékétől.

Ez azért szükséges, mert bizonyos webhook hibáknál a `processing_status` `webhook_sent` marad, de az `error_message` már tartalmazza a hiba leírását (pl. `"Webhook failed: 404 Not Found"`).

```typescript
// EF (management-stats/index.ts)
const isError = (r) => ERROR_STATUSES.has(r.processing_status) || !!r.error_message;
const isSuccess = (r) => !r.error_message && SUCCESS_STATUSES.has(r.processing_status);

// FE (ManagementDashboard.tsx)
function normalizeStatus(status, errorMessage?) {
  if (errorMessage) return 'error';     // error_message wins
  if (!status) return 'pending';
  switch (status) { /* ... */ }
}
```

## Consequences

**Pozitív:**
- Egyetlen Edge Function, 13 action → egyszerű deployment
- Service_role az Edge Function-ben → biztonságos cross-tenant hozzáférés
- Server-side pagination → LLM tábla és superadmin modulok akárhány rekordra skálázódnak
- `keepPreviousData` → lapozás közben nincs villogás
- Graceful error handling → nem crashel, üres adatot mutat
- Zero-flash management routing → 5 rétegű guard biztosítja, hogy a management user soha nem lát sidebar/navbar villanást
- Superadmin 27 modul → teljes platform adatáttekintés cégszinten
- User-mode kontextus megőrzés → cégváltáskor a user filter nem veszik el

**Negatív:**
- ~~`auth.admin.listUsers({ perPage: 1000 })` → 1000+ felhasználónál csonkolódik~~ — **Javítva:** `listAllAuthUsers()` helper paginál az összes oldalon
- Minden action egyetlen fetch hívásban fut → ha bármelyik query lassú, az egész válasz lassú
- Overview minden company és member adatát egyszerre tölti le → nagy tenant számmal skálázódási kockázat
- Nincs cache-invalidation — `refetchInterval` alapú polling, nem Realtime
- A `management`/`thinkai` role check a `profiles` tábla `role` mezőjére épít, nem Supabase-natív custom claims-re

## Kapcsolódó Dokumentáció

- [Error Logging System](../error-logging-system.md) — Részletes error logging architektúra és dashboard
- [09-Error Handling & Feedback](../../design/09-error-handling-feedback.md) — Frontend error kezelés design
