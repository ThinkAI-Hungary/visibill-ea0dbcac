# A-019: Management Dashboard Architektúra

**Status:** Decided  
**Date:** 2025-12 (last updated 2026-07-08)

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

Egyetlen Edge Function, 15 action:

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
| `worker-status` | — | containers[] (heartbeat health), queues[] (PGMQ metrics), pipelines[] (24h teljesítmény + 7d sparkline), recent_jobs[] (utolsó 20), summary KPI-k |
| `llm-costs` | `period` (24h/7d/30d/90d) | Cross-project LLM költségaggregáció: kpi{total_cost, total_jobs, avg_cost_per_job, total_tokens}, by_pipeline[], by_project[], top_companies[] (top 3), daily_trend[], by_model[] |

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
| `llm_koltsegek` | LLM token/költség részletezés (szerver-oldali lapozás). `worker_id` oszlop per-konténer bontáshoz |
| `app_error_logs` | Centralizált hibalogok (frontend, worker, webhook, mailgun) |
| `worker_heartbeats` | Worker konténer heartbeat (60s UPSERT, container_name UNIQUE). Health threshold: 120s |
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

A 4 upload tábla (`invoice_uploads`, `transaction_uploads`, `bank_statement_uploads`, `report_uploads`) sokféle `processing_status` értéket tartalmaz. A management dashboard ezeket **4 kategóriába** normalizálja:

| Kategória | DB státuszok / Feltétel | Badge szín |
|-----------|-------------|------------|
| **Feldolgozva** (success) | `done`, `completed`, `processed` | 🟢 zöld |
| **Átirányítva** (redirected) | `redirected` (sikeresen fallback-redirectelt szülő sorok) | 🔵 kék/indigo |
| **Hiba** (error) | `error`, `failed`, `ignored`, `dismissed`, `webhook_failed` | 🔴 piros |
| **Folyamatban** (pending) | **minden más** (pl. `webhook_sent`, `processing`, `pending`, `null`) | 🟡 sárga |

#### Fallback átirányítás és virtuális státusz
Ha egy fájl feldolgozása során fallback-átirányítás történik (pl. számlából tranzakció lesz), és a létrejött gyermek sor sikeresen befejeződik:
- A backend (`management-stats` Edge Function) a szülő sor státuszát virtuálisan `redirected` értékre írja át, és elrejti a hibaüzenetét.
- A szülő sor így nem fog megjelenni a "Hibás feldolgozások" listában és nem számítódik bele a hibaszámokba.
- Ha a gyermek feldolgozás is hibára fut, a szülő sor marad "Hiba" státuszban.

#### Exklúziós logika

> **`pendingCount = total - successCount - errorCount`**

A pending számolás **nem explicit listával** történik, hanem exklúzióval. Ez biztosítja, hogy bármilyen jövőbeli új státusz (pl. `ocr_processing`, `ai_classifying`) automatikusan a "Folyamatban" kategóriába essen anélkül, hogy az EF kódot frissíteni kellene.

#### Error message elsőbbség

> **Ha egy fájlnak van `error_message` mezője, és nem sikeresen átirányított (`redirected`) vagy nem sikeres visszajelzés ("Job completed") → automatikusan "Hiba" kategóriába kerül**, függetlenül a `processing_status` értékétől.

```typescript
// EF (management-stats/index.ts)
const isError = (r) => {
  if (r.processing_status === "redirected") return false;
  return ERROR_STATUSES.has(r.processing_status) || (!!r.error_message && !isCompletedMessage(r.error_message));
};
const isSuccess = (r) => isCompletedMessage(r.error_message) && (SUCCESS_STATUSES.has(r.processing_status) || r.processing_status === "redirected");

// FE (ManagementDashboard.tsx)
function normalizeStatus(status, errorMessage?) {
  if (status === 'redirected') return 'redirected';
  if (errorMessage && !isCompletedMessage(errorMessage)) return 'error'; // non-success error_message wins
  if (!status) return 'pending';
  switch (status) { /* ... */ }
}
```
```

### Filter UX: Command Combobox Pattern (2026-07-07)

A **Cég** és **Felhasználó** szűrők mindkét panelen (Files, Errors) a `Command` + `Popover` combobox patternt használják:

- **Keresővel** ellátott dropdown (nem natív `<select>`)
- **Scrollbar** nagy listáknál (`max-h-[280px]` vagy `CommandList` auto-scroll)
- Az adatok a globális `allUsers` prop-ból származnak (nem a táblázat aktuális soraiból)
- A `Source` és `Category` filterek egyszerűbb `Popover` + scroll wrapperrel (`max-h-[280px] overflow-y-auto`)

```typescript
// Company/User combobox pattern (Files + Errors panel):
<Popover open={companySearchOpen} onOpenChange={setCompanySearchOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" ...>
  </PopoverTrigger>
  <PopoverContent className="w-[250px] p-0">
    <Command>
      <CommandInput placeholder="Cég keresése..." />
      <CommandList>
        <CommandEmpty>Nincs találat.</CommandEmpty>
        <CommandGroup>
          <CommandItem ...>Minden cég</CommandItem>
          {companyOptions.map(...)}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

### Mailgun User Label (2026-07-07)

Ha egy fájl vagy hiba a Mailgun webhook-ból származik, a User oszlopban a felhasználó neve helyett egy vizuális 📧 **Mailgun** label jelenik meg (amber szín).

**Backend (`management-stats` EF):** Mindkét panelre a backend állítja a `user_name = 'Mailgun'` értéket:

| Panel | Feltétel (backend) | Logika |
|-------|-------------------|--------|
| **Fájlok** | `metadata.source === 'email_alias'` VAGY `!user_id` | `buildFiles()` sor 1935-1937 |
| **Hibák** | `component === 'process-mailgun-webhook'` | `buildErrors()` sor 1212-1214 |

```typescript
// buildErrors — management-stats/index.ts
user_name: (isAppLog && row.component === 'process-mailgun-webhook')
  ? 'Mailgun'
  : (row.user_id ? (profileByUserId.get(row.user_id) || null) : null),
```

> **Megjegyzés:** A webhook `logError()`-ba `user_id: alias.user_id` kerül (az email alias tulajdonosa), ezért a backend-nek explicit felül kell írnia `'Mailgun'`-ra — különben a profile lookup az alias-tulajdonos nevét adná vissza.

**Frontend fallback:** A Hibák panelen a Mailgun check **elsőbbséget kap** a `user_name` felett:

```tsx
// ManagementDashboard.tsx — Hibák panel User oszlop
{r.error_message?.includes('process-mailgun-webhook') ? (
  <span>📧 Mailgun</span>     // ← ELSŐ: Mailgun check
) : r.user_name ? (
  <button>...</button>        // ← MÁSOD: normál user
) : <span>—</span>}           // ← HARMAD: nincs user
```

### Debounce + Loading Pattern (2026-07-07)

Keresés/szűrés közben a `useEffect` debounce-olja a tényleges query paramétert:
- **`isLoading`**: Skeleton renderelés (csak első betöltéskor)
- **`isFetching && !isLoading`**: Opacity overlay (`opacity-60 transition-opacity`) — stale adat látható, háttérben frissül

Részletek: [07-loading-patterns.md](../../design/07-loading-patterns.md)

### Error Taxonomy — 3 fő kategória (2026-07-07)

A Management Dashboard **Hibák paneljén** a hibaforrások és típusok **3 egységes kategóriába** vannak csoportosítva, az eredeti több tucat nyers `error_type` érték helyett:

| Kategória | Szín | Source-ok |
|-----------|------|----------|
| **Application** | 🩵 Teal | `app_error_logs:frontend`, `app_error_logs:worker` |
| **Mailgun** | 🟡 Amber | `app_error_logs:mailgun` (minden mailgun/webhook hibát lefed) |
| **Worker** | 🔵 Kék | `invoice_uploads`, `transaction_uploads`, `report_uploads`, `bank_statement_uploads`, `gl_upload_notifications`, `nav_sync_logs` |

#### Kategória meghatározás — két lépés

1. **Component override:** Ha a log `component === 'process-mailgun-webhook'` → kat. = `Mailgun`, source = `app_error_logs:mailgun` (függetlenül az `error_type`-tól)
2. **`APP_LOG_CATEGORY_MAP`:** Minden egyéb `error_type`-ot egy lookup-mappa (`Application` / `Worker`) átalakít

```typescript
// management-stats/index.ts
const APP_LOG_CATEGORY_MAP: Record<string, 'Application' | 'Worker'> = {
  // Frontend
  navigation_error: 'Application',
  auth_error: 'Application',
  ui_error: 'Application',
  warning: 'Application',
  // Worker
  transaction_error: 'Worker',
  invoice_processing_error: 'Worker',
  // ... stb.
};
```

#### Forrás label egységesítés

Minden upload tábla (`invoice_uploads`, `transaction_uploads`, stb.) a Forrás oszlopban **"Feltöltés"** felirattal jelenik meg (közös label a különböző fájltípusok helyett). Az alábbi típus (`Application` vs `Worker`) mutatja, hogy frontend kézi feltöltés vagy worker pipeline hibáról van-e szó.

#### `uploads` csoport-szűrő

A frontend `forrás` szűrőben a “Feltöltés” opció `value: 'uploads'` küldödik a backendnek, ahol az EF az összes upload forrást egyszerre szűri:

```typescript
const UPLOAD_SOURCES = new Set([
  "invoice_uploads", "transaction_uploads", "report_uploads",
  "gl_upload_notifications", "nav_sync_logs", "bank_statement_uploads",
]);

if (filterSource === 'uploads') {
  allErrors = allErrors.filter(e => UPLOAD_SOURCES.has(e.source));
}
```

### Severity Diszciplína (2026-07-08)

A Hibák panel és az Overview "Összes hiba" KPI **csak `severity='error'`** bejegyzéseket mutat az `app_error_logs` táblából. A `management-stats` EF `buildErrors` és `buildOverview` query-i `.eq("severity", "error")` szűrőt alkalmaznak.

**Miért:** Korábban minden `app_error_logs` bejegyzés megjelent a panelen (warning + realtime channel zaj + validation warningok), ami elárasztotta a valódi hibákat. A `severity` oszlop default értéke `'error'`, így ha egy warning szintű log `severity` nélkül lett hívva, `severity='error'`-ként tárolódott → zajként jelent meg.

**Szabályok:**
- **Frontend:** Minden `action: 'warn'` / `action: 'warning'` hívásnál **kötelező** `severity: 'warning'`-ot megadni a `reportError`-nek. (10 call site javítva.)
- **Realtime:** A `LiveNotificationProvider` channel státusz változásai (TIMED_OUT/CLOSED/SUBSCRIBED/CHANNEL_ERROR) **csak konzolra** kerülnek (`console.warn`), nem DB-be — operációs zaj, a kliens auto-reconnect-el.
- **Történelmi adat:** 41 régi realtime channel log visszaamenőleg `severity='warning'`-ra lett reklasszifikálva.

Részletek: [error-logging-system.md — Severity diszciplína](../error-logging-system.md#severity-diszciplína)

### Hibák Panel Dátum Kezelés & Szűrés Szinkron (2026-07-11)

A többszörösen újraindított/újraküldött feldolgozásoknál (amelyeknél a `created_at` az eredeti feltöltési idő, de a legfrissebb hiba az `updated_at` időpontban lépett fel) a dashboardon a rendezettség és a dátumszűrés az alábbiak szerint lett szinkronizálva:

1. **`error_timestamp` mező**: Az Edge Function `buildErrors` metódusa a lekérdezéseknél lekéri az `updated_at` (vagy `nav_sync_logs` esetén `completed_at`, `gl_upload_notifications` esetén `processed_at`) mezőt is. Ezt egy új `error_timestamp` tulajdonságban tároljuk el.
2. **Kijelzés vs. Rendezés**: 
   - A listában a kijelzett dátum (`created_at`) az eredeti futás/feltöltés dátuma marad (a felhasználó kérésének megfelelően: "a fájl eredeti dátummal van megjelenítve").
   - A szűrések (`dateFrom`/`dateTo`) és az időrendi rendezés (sortBy: `created_at`) az `error_timestamp` mezőt használják. Ezzel a legfrissebb hiba (újraindított sor) mindig a lista legtetejére kerül, nem duplikálódik, és a helyes relatív időablakba esik.
3. **Relatív 24h szűrés szinkron**: A "Utolsó 24h" kártya kattintásakor a frontend relatív ISO formátumú időt küld (`new Date(Date.now() - 24 * 3600 * 1000).toISOString()`) a korábbi sima `today` dátumsztring helyett. Ez biztosítja, hogy a KPI kártya (amely az `error_timestamp` alapján számolódik) és a lista találatai megegyezzenek.

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
- Command combobox filterek → kereshető, scrollozható, globális adatforrás
- Mailgun user label → webhook-eredetú hibák/fájlok azonnal felismerhetők
- Debounce + opacity transition → nincs skeleton flash háttér-refetch-nél
- Error taxonomy (3 kategória) → Application/Mailgun/Worker egységes besorolás, összecsúszó kategóriák megszűntek
- Severity diszciplína → a Hibák panel csak `severity='error'` logokat mutat; warning/realtime zaj kiszűrve; frontend call site-ok kötelezően `severity:'warning'`-ot adnak meg warningoknál
- Feltöltés forrás-label egységesítés → uploads group filter, típus badge mutatja a részletet

**Negatív:**
- ~~`auth.admin.listUsers({ perPage: 1000 })` → 1000+ felhasználónál csonkolódik~~ — **Javítva:** `listAllAuthUsers()` helper paginál az összes oldalon
- Minden action egyetlen fetch hívásban fut → ha bármelyik query lassú, az egész válasz lassú
- Overview minden company és member adatát egyszerre tölti le → nagy tenant számmal skálázódási kockázat
- Nincs cache-invalidation — `refetchInterval` alapú polling, nem Realtime
- A `management`/`thinkai` role check a `profiles` tábla `role` mezőjére épít, nem Supabase-natív custom claims-re

## Kapcsolódó Dokumentáció

- [Error Logging System](../error-logging-system.md) — Részletes error logging architektúra és dashboard
- [09-Error Handling & Feedback](../../design/09-error-handling-feedback.md) — Frontend error kezelés design
- [07-Loading Patterns](../../design/07-loading-patterns.md) — Debounce + skeleton/opacity pattern

---

## Worker Monitor Panel

**Utoljára frissítve:** 2026-07-08

### Architektúra

A Worker Monitor a management dashboard "Worker" fülén található. Két al-tab-ot tartalmaz:

| Tab | Leírás | Adatforrás |
|-----|--------|------------|
| **Áttekintés** | Konténer health, PGMQ queue-k, pipeline teljesítmény, utolsó jobok | `worker-status` action (30s polling) |
| **LLM Költség** | Cross-project költségaggregáció, pie chartek, top cégek, trend, modell tábla | `llm-costs` action (60s polling) |

### KPI Metrika Kártyák (Áttekintés tab)

Az Áttekintés tab tetején 5 KPI kártya látható:

| KPI | Adatforrás | Kattintható | Viselkedés |
|-----|-----------|-------------|------------|
| **Konténerek** | `worker_heartbeats` (healthy/total) | ❌ | — |
| **Queue várakozó** | `pgmq.metrics_all()` összesített queue_length | ✅ | Globális queue panel (pipeline+recent jobs eltűnik) |
| **Feldolgozva (period)** | `invoice_uploads` + `transaction_uploads` completed count | ❌ | — |
| **Feldolgozás alatt** | `invoice_uploads` + `transaction_uploads` where `processing_status='processing'` | ✅ | Globális processing panel (pipeline+recent jobs eltűnik) |
| **Worker hibák (period)** | `invoice_uploads` + `transaction_uploads` where `processing_status='error'` | ❌ | — |

**Alapértelmezett időszak:** 24 óra (`workerPeriod` state default: `'24h'`)

> **Fontos:** A "Worker hibák" KPI az upload táblák `processing_status='error'` sorait számolja, **NEM** az `app_error_logs` tábla frontend hibáit.

### Globális KPI Panelek

Két KPI kártya kattintható és **globális nézetet** nyit (mindhárom projekt adatai):

#### Feldolgozás alatt panel (`showProcessing` state)

- **Trigger:** "Feldolgozás alatt" KPI kattintás
- **Adatforrás:** `active_processing` tömb a `management-stats` EF-ből
- **Query:** `invoice_uploads` + `transaction_uploads` where `processing_status='processing'` (mindhárom projekt)
- **Megjelenítés:** Projekt-csoportosított tábla (Pipeline | Fájl | Cég | Típus | Eltelt idő)
- **Eltelt idő szín:** zöld (<30s), sárga (<120s), piros (>120s)
- **Üres állapot:** CheckCircle2 ikon + "Jelenleg nincs aktív feldolgozás"
- **Rejtett elemek:** Pipeline teljesítmény tábla + Utolsó feldolgozások
- **Oszlop kompatibilitás:** Csak univerzális oszlopok (`id, file_name, company_id, processing_status, created_at, updated_at, document_category`). A `source` és `detected_bank` oszlopok kihagyva (VSWEB-en nem léteznek).

#### Queue várakozó panel (`showAllQueues` state)

- **Trigger:** "Queue várakozó" KPI kattintás
- **Adatforrás:** `queues` tömb (mindhárom projekt PGMQ adatai)
- **Szűrés:** `queue_length > 0` és nem dismissed
- **Megjelenítés:** Queue-csoportosított tábla (# | Fájl | Cég | Várakozás | Forrás | Típus)
- **Várakozás szín:** zöld (<2min), sárga (<5min), piros (>5min)
- **Per-queue dismiss:** Minden queue szekció fejlécében X gomb → eltávolítja a panelből
- **Sidebar szinkron:** `showAllQueues` módban a sidebar queue chevronjei szinkronban vannak:
  - Chevron felfelé (rotate-180) = queue megjelenik a panelben
  - Sidebar kattintás = toggle dismiss (chevron lefelé → queue eltűnik a panelből)
- **Auto-close:** Ha az utolsó queue-t is bezárja → `showAllQueues = false`, teljes panel eltűnik
- **Dismissed reset:** KPI újra kattintás → `dismissedQueues` state resetelődik
- **Rejtett elemek:** Pipeline teljesítmény tábla + Utolsó feldolgozások

### Queue Sidebar — `dismissedQueues` State

A sidebar queue lista viselkedése a `showAllQueues` állapottól függ:

| Mód | Sidebar kattintás hatása | Chevron állapot |
|-----|-------------------------|----------------|
| **Normál** (showAllQueues=false) | `selectedQueue` toggle → inline queue detail panel | Felfelé ha selected |
| **Globális** (showAllQueues=true) | `dismissedQueues` toggle → queue eltűnik/visszajön a panelből | Felfelé ha nem dismissed |

A badge (`queue_length`) fix szélességű (`min-w-[24px]`) és a chevron mindig helyet foglal (`invisible` ha nincs elem).

### Cross-Project Monitoring

A `overview`, `worker-status` és `llm-costs` action-ök **3 Supabase projektet** kérdeznek le párhuzamosan:

| Projekt | Env vars | Cél |
|---------|----------|-----|
| **PROD** | (default admin client) | Fő production projekt |
| **VSWEB** | `VSWEB_SUPABASE_URL`, `VSWEB_SERVICE_ROLE_KEY` | VS Web projekt |
| **THINKERMAN** | `THINKERMAN_SUPABASE_URL`, `THINKERMAN_SERVICE_ROLE_KEY` | Thinkerman projekt |

### LLM Cost Tab — Komponensek

```
LLMCostPanel
  ├── Időszak választó (24h / 7d / 30d / 90d)
  ├── 4 KPI kártya (költség, jobok, átlag/job, tokenek)
  ├── 2 CSS Pie Chart (pipeline bontás + projekt bontás)
  ├── Top 3 legdrágább cég (rangsor + progress bar)
  ├── Napi költség trend (bar chart, hover tooltip)
  └── Modell használat tábla (modell × pipeline × jobok × token × költség × arány)
```

### Per-Model Cost Splitting (Worker)

A `LLMCostTracker.save()` (worker/llm_tracker.py) **modellekre bontva** menti a költségeket:

- Ha egy pipeline feldolgozás során **egyetlen modellt** használtunk → 1 sor az `llm_koltsegek` táblába
- Ha **több modellt** használtunk (pl. `deepseek/deepseek-chat` klasszifikáció + `gpt-4o-mini` Vision OCR) → **1 sor modellenként**

Ez biztosítja, hogy a dashboard a Vision OCR költségeket is pontosan, külön modellként mutatja.

### Project-Scoped Filtering

A **Pipeline** szekció és a **Queue** lista a kiválasztott konténer projektje szerint szűrt (normál módban):

- Konténer kiválasztása → `activeProject` meghatározása (heartbeat `project` mező)
- Pipeline-ok: `${project}:${pipeline}` prefix alapján szűrve
- Queue-k: projekt mező alapján szűrve, **mindig alfabetikus sorrendben**
- PGMQ queue-k: `public.pgmq_metrics_all()` wrapper RPC-n keresztül érhetők el (mindhárom projektben létrehozva)

> **Megjegyzés:** A globális KPI panelek (showProcessing / showAllQueues) felülírják a projekt szűrést — ilyenkor minden projekt adata megjelenik.

### Aszinkron URL Állapot Szinkronizáció & Pagináció

A dashboard és a WorkerPanel állapota URL-query paramétereken keresztül szinkronizált, megelőzve a React lokális state-ek alaphelyzetbe állását (pl. külső adathívások vagy navigáció esetén):

* **Query Paraméterek:**
  * `wrk_show_errors` (`true` / `null`): A Worker hibapanel megjelenítése.
  * `wrk_show_processing` (`true` / `null`): A globális feldolgozás alatti panel megjelenítése.
  * `wrk_show_queues` (`true` / `null`): A globális queue várakozó panel megjelenítése.
  * `wrk_err_page` (szám): A Worker hibatábla aktív oldalszáma.
* **Időszak váltás szűrő:** A `wrk_err_page` értéke csak a monitoring időszak (`workerPeriod`) megváltozásakor áll vissza az első oldalra, megakadályozva a lapozási állapot elvesztését sima frissítések során.

### Worker Hibás Feldolgozások Kereső & Layout Stabilizáció

A "Worker hibák" panelen (`wrk_show_errors=true`) a felhasználó keresést is végezhet a hibás feldolgozások között (szűrés fájlnévre, cégre, pipeline-ra, vagy konkrét hibaüzenetre):
* **Kliens-oldali szűrés**: A `workerErrorSearch` state alapján a `filteredErrorJobs` hook reaktívan szűri a letöltött hibás jobokat. Keresés megadásakor a lapozás automatikusan visszaáll az 1. oldalra (`wrk_err_page=1`).
* **Layout Shift elleni védelem (Table & Footer height stabilization)**: A kereső sáv bevitele és szűrés közbeni sor-változás nem tolja el a felületet:
  - A táblázat soraiból hiányzó helyek üres helyőrző sorokkal (`placeholder-${index}`) vannak kitöltve, így a táblázat magassága mindig pontosan 10 sornyi marad, akár 0 találat esetén is.
  - A paginációs footer wrapper fix minimális magassággal (`min-h-[53px]`) rendelkezik, így a táblázat alatti sáv sem ugrál akkor sem, ha a keresés miatt a lapozó gombok eltűnnek.

### Virtuális Fallback Átirányítás Státusz (REDIRECTED)

Amikor egy fájl feldolgozása elbukik egy pipeline-ban (pl. a `transaction` pipeline-ban a K&H bankkivonat koordináta-alapú parsolása), de a rendszer sikeresen átirányítja és feldolgozza egy fallback gyermek pipeline-ban (pl. `invoice`), a szülő upload rekord státusza a dashboardon virtuálisan `REDIRECTED` (REDIRECT badge) lesz a korábbi zavaró `ERROR` helyett.


## Email-fájl Sibling Cleanup (2026-07-13)

> **Cél:** 1 Mailgun-fájlból legfeljebb **1 hibasor** legyen a Hibák/Fájlok panelen, függetlenül attól, hányszor futott át a pipeline-okon vagy hányszor kézbesítette újra a Mailgun.

### Probléma

A worker fallback lánc (`fallback_from_invoice/transaction/report` + 3 inline redirect a `process_*_job`-ban) email-forrású (`metadata.source='email_alias'`) fájloknál több pipeline-t is próbál. **Egy cikluson belül** ez rendben van: az intermediate sikertelen sorok törlődnek, és 1 végső hibasor marad. De **ciklusok között** (Mailgun újrakézbesítés, manual retry) minden ciklus **új** eredeti sort + új végső hibasort hoz létre, anélkül hogy tudna a korábbi testvér-sorokról. Pl. `SKM_C250i26071012000.pdf` → **8 db** `transaction_uploads` hibasor 15 perc alatt.

Különösen erős a probléma, amikor a feladó nem küld `Message-Id` headert (pl. Canon szkenner) — ilyenkor a webhook idempotency check-je is skippelődik (ld. [A-011 — Null Message-Id Fallback Dedup](./A-011-email-processing.md#null-message-id-fallback-dedup-2026-07-13)).

### Megoldás — két réteg

**1. Webhook keményítés (A-011):** null-Message-Id esetén cross-tábla dedup `(company_id, file_name, email_alias)` alapján 24h ablakban — megelőzi a felesleges újrafeldolgozást/LLM költséget.

**2. Worker sibling cleanup (fő garancia):** mielőtt a fallback **bármelyik** végső hibasort kiírná, törli a testvér-sorokat.

#### `cleanup_email_file_siblings()` helper (`worker/db.py`)

```python
async def cleanup_email_file_siblings(company_id, file_name, keep_ids):
    """Delete sibling email_alias upload rows for the same (company_id, file_name)
    across all upload tables, except those in keep_ids. Best-effort, never raises."""
    for tbl in ("invoice_uploads", "transaction_uploads", "report_uploads"):
        client.table(tbl).delete() \
            .eq("company_id", company_id) \
            .eq("file_name", file_name) \
            .eq("metadata->>source", "email_alias") \
            .not_in("id", keep_ids).execute()
```

#### Behívási helyek (7 call site a `worker.py`-ban, 6 kódlocation)

| Függvény | Mit csinál |
|---|---|
| `fallback_from_invoice` | invoice→report/transaction fallback végső hiba |
| `fallback_from_transaction` | transaction→report/invoice fallback végső hiba |
| `fallback_from_report` | report→invoice/transaction fallback végső hiba |
| `process_single_job` (inline) | korai invoice→report redirect hiba |
| `process_transaction_job` (inline) | korai transaction→report redirect hiba |
| `process_report_job` (inline, 2 ág) | korai report→transaction és report→invoice redirect hiba |

Minden helyen **miután** a végső hibasor (`new_id`) létrejött és az `error_message` ki van írva: `await cleanup_email_file_siblings(company_id, file_name, keep_ids=[new_id])`.

#### Garanciák

- **≤1 hibasor email-fájlonként** bármely stabil időpillanatban, bármennyi redelivery/retry esetén.
- **Csak `metadata.source='email_alias'`** sorokat érinti — manuális feltöltések sosem érintettek.
- **Best-effort:** a helper hibája nem tör meg fallback folyamatot (csak logol).

> **Megjegyzés:** a management-stats EF (`buildErrors`/`buildFiles`) **nem** módosult — nincs szükség megjelenítés-oldali dedupra, mert a sibling cleanup után nem keletkezik duplikátum. A histórikus duplikátumok manuálisan törölhetők (pl. a `delete-all-errors` actionnel vagy SQL-lel).



