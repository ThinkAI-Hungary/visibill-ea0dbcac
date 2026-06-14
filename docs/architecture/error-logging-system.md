# Visibill — Error Logging & Dashboard Rendszer

> **Verzió:** 1.0 | **Dátum:** 2026-06-14  
> **Kapcsolódó:** [A-019 Management Dashboard](./decisions/A-019-management-dashboard.md) · [09-error-handling-feedback](../design/09-error-handling-feedback.md) · [management-stats EF](../../supabase/functions/management-stats/index.ts)

---

## Áttekintés

Centralizált hibalogolási rendszer, amely a rendszer minden rétegéből gyűjti és egy felületen jeleníti meg a hibákat:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HIBA FORRÁSOK                                   │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Frontend    │  │    Worker    │  │   Mailgun    │  │  Webhook  │ │
│  │ errorReporter │  │error_reporter│  │ EF logging   │  │ EF logging│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                  │                  │                │       │
│         ▼                  ▼                  ▼                ▼       │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    app_error_logs tábla                         │   │
│  │  (error_type, component, message, context, user_id, company_id)│   │
│  └────────────────────────────┬───────────────────────────────────┘   │
│                               │                                       │
│                               ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              management-stats Edge Function                    │   │
│  │  (service_role, aggregáció, szűrés, lapozás, context merge)   │   │
│  └────────────────────────────┬───────────────────────────────────┘   │
│                               │                                       │
│                               ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │            ManagementDashboard.tsx — Error Panel                │   │
│  │  (KPI kártyák, filterek, táblázat, bulk akciók, retry modal)  │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Adatbázis Tábla: `app_error_logs`

| Oszlop | Típus | Leírás |
|--------|-------|--------|
| `id` | `uuid` (PK) | Auto-generált azonosító |
| `created_at` | `timestamptz` | Hiba időpontja |
| `error_type` | `text` | Kategória kulcs (ld. lent) |
| `component` | `text` | Fájl/modul neve (pl. `AuthContext`, `InvoicePipeline`) |
| `action` | `text` | Művelet (`error`, `warning`, `info`) |
| `message` | `text` | Hibaüzenet szövege |
| `context` | `jsonb` | Opcionális kontextus adatok (pl. `{"email": "user@example.com"}`) |
| `user_id` | `uuid` | Felhasználó azonosító (FK → auth.users) |
| `company_id` | `uuid` | Cég azonosító (FK → companies) |

### Error Type Kategóriák

| error_type | Forrás | Leírás |
|------------|--------|--------|
| `auth_error` | Frontend | Bejelentkezési, session hibák |
| `db_query` | Frontend | Supabase query hibák |
| `api_error` | Frontend | Edge Function hívási hibák |
| `unhandled` | Frontend | Nem kezelt kivételek (ErrorBoundary) |
| `classification_error` | Worker | AI klasszifikációs hiba |
| `ocr_error` | Worker | OCR feldolgozási hiba |
| `extraction_error` | Worker | Adatkinyerési hiba |
| `duplicate_error` | Worker | Duplikátum detektálás |
| `empty_content` | Worker | Üres tartalom |
| `timeout_error` | Worker | Időtúllépés |
| `rate_limit_error` | Worker | API rate limit |
| `webhook` | Edge Function | Mailgun webhook feldolgozási hiba |
| `mailgun` | Edge Function | Email küldési/fogadási hiba |
| `email_alias` | Edge Function | Email alias létrehozás/törlés hiba |

### Szabályok

- **Rate limit**: max 10 log/perc/user (frontend oldali throttling)
- **Retention**: 90 napos megőrzés
- **Szenzitív szűrés**: jelszavak, tokenek automatikusan kiszűrve a `context`-ből

---

## 2. Hiba Források

### 2.1 Frontend — `errorReporter.ts`

**Fájl:** `src/lib/errorReporter.ts`

```typescript
interface ErrorReport {
  type: 'auth_error' | 'db_query' | 'api_error' | 'unhandled';
  component: string;      // pl. 'AuthContext', 'InvoicesPage'
  action: 'error' | 'warning' | 'info';
  message: string;
  error?: unknown;         // eredeti Error objektum
  context?: Record<string, unknown>;  // extra adatok (pl. email)
}

reportError(report: ErrorReport): void
```

**Használati példák:**
```typescript
// Auth hiba (email kontextussal)
reportError({
  type: 'auth_error',
  component: 'AuthContext/signIn',
  action: 'error',
  message: error.message,
  context: { email: userEmail },
});

// DB query hiba
reportError({
  type: 'db_query',
  component: 'useActivePreset',
  action: 'error',
  message: 'Error loading preset',
  error: e,
});
```

**Instrumentált komponensek:**
- `AuthContext.tsx` — signIn, signUp, signOut, session refresh
- `CompanyContext.tsx` — cég lista és váltás
- `useActivePreset.ts` — preset betöltés
- `upload-ticket-image.ts` — ticket kép feltöltés
- `ErrorBoundary.tsx` — unhandled runtime errors
- Minden `supabase.from()` hívás error ágai

### 2.2 Worker — `error_reporter.py`

**Fájl:** `worker/error_reporter.py`

A Python worker PGMQ-n vagy DB közvetlen insert-tel logol az `app_error_logs` táblába.

**Logolt pipeline hibák:**
- Invoice OCR/extraction
- Transaction matching
- GL classification
- Payroll processing
- Timeout és rate limit

### 2.3 Edge Functions — error-logger utility

**Fájl:** `supabase/functions/_shared/error-logger.ts`

Edge Function-ökben használt shared utility:

```typescript
import { logError } from '../_shared/error-logger.ts';

// Mailgun webhook hiba
await logError(admin, {
  error_type: 'webhook',
  component: 'process-mailgun-webhook',
  message: 'Failed to parse webhook payload',
  context: { event_type: 'stored' },
});
```

**Használó Edge Functions:**
- `process-mailgun-webhook` — email fogadási hibák
- `create-email-alias` — alias létrehozási hibák
- `delete-email-alias` — alias törlési hibák

---

## 3. Management Dashboard — Error Panel

### 3.1 Architektúra

```
ManagementDashboard.tsx (Error panel fül)
    ↓ useQuery(['management-errors', filters...])
    ↓ fetch → management-stats EF (action: 'errors')
    ↓ service_role query → app_error_logs + profiles + companies JOIN
    ↓ JSON response: { totalErrors, last24hErrors, mostAffectedCompany,
                        mostAffectedUser, topErrorCategory, errors[], totalRows }
```

### 3.2 KPI Kártyák

| KPI | Ikon | Leírás | Kattintás |
|-----|------|--------|-----------|
| **Összes hiba** | ⚠ AlertTriangle | Teljes hibalétszám | — |
| **24h** | 🕐 Clock | Utolsó 24 óra hibái | — |
| **Legtöbb hibás cég** | 🏢 Building2 | Legtöbb hibával rendelkező cég | Toggle: szűrés erre a cégre |
| **Legtöbb hibás user** | 👥 Users | Legtöbb hibával rendelkező user | Toggle: szűrés erre a userre |

A cég és user KPI kártyák **toggle** gombként működnek:
- Kattintásra szűr a megadott cégre/userre
- Újra kattintva törli a szűrőt
- Aktív szűrő esetén kiemelés: `bg-primary/10 border-primary/30`

### 3.3 Szűrők

A szűrők önálló sorban jelennek meg a KPI kártyák alatt:

| Szűrő | Típus | Leírás |
|-------|-------|--------|
| **Keresés** | Text input | Hibaüzenet szabad szöveges keresés |
| **Forrás** | Select | Frontend / Worker / Mailgun / Webhook |
| **Cég** | Select | Dinamikusan feltöltve az adatokból |
| **User** | Select | Dinamikusan feltöltve az adatokból |
| **Típus** | Select | Error type kategóriák |

### 3.4 Táblázat Oszlopok

| Oszlop | Tartalom |
|--------|----------|
| ☐ | Checkbox (bulk kijelölés) |
| ▼ | Expand/collapse ikon |
| Dátum | `MM.DD HH:MM` formátum |
| Cég | Cég neve (kattintásra szűr) |
| User | Felhasználó neve |
| Forrás | Badge: Frontend / Worker / Mailgun |
| Típus | Színes badge: Auth hiba, DB lekérdezés, OCR hiba stb. |
| Fájl | Komponens/modul neve |
| Hibaüzenet | Csonkolt üzenet (max 100 karakter) |
| Akciók | Törlés gomb (soronként) |

### 3.5 Expanded Nézet

Sor kattintásra kibontott részletek:

| Mező | Tartalom |
|------|----------|
| Forrás tábla | Technikai source (pl. `app_error_logs:frontend`) |
| Rekord ID | UUID |
| Felhasználó | Teljes név |
| Időpont | `YYYY.MM.DD HH:MM:SS` |
| Teljes hibaüzenet | `<pre>` blokkban, scrollable |
| Kontextus | Badge-ek a `context` JSON mezőiből (pl. `email: user@example.com`) |

### 3.6 Bulk Akciók

#### Törlés (Delete)
- **Trigger**: Kijelölés után megjelenő piros Trash gomb
- **Megerősítés**: Modal dialog (nem browser `confirm()`)
  - Cím: "Hibák törlése" + Trash2 ikon
  - Szöveg: "X hiba kerül törlésre (dismissed). Ez a művelet nem vonható vissza."
  - Gombok: Mégse (ghost) / Törlés (destructive)
- **Backend**: `management-stats` EF `delete-errors` action → `app_error_logs` DELETE

#### Újraküldés (Retry)
- **Trigger**: Kijelölés után megjelenő "Újra" gomb
- **Csak**: `invoice_uploads`, `transaction_uploads`, `gl_upload_notifications` forrásokra
- **Modal**: Pipeline választó (Eredeti / Számla / Bérjegyzék / Tranzakció / Főkönyv)
- **Backend**: `management-stats` EF `retry-errors` action → PGMQ re-enqueue

---

## 4. Edge Function: `management-stats` — Error Actions

### Action: `errors`

**Query params:**

| Param | Típus | Default | Leírás |
|-------|-------|---------|--------|
| `page` | number | `0` | Oldal szám |
| `pageSize` | number | `25` | Oldalméret |
| `sortCol` | string | `created_at` | Rendezési oszlop |
| `sortDir` | string | `desc` | Rendezési irány |
| `search` | string | `""` | Keresés az üzenetben |
| `filterSource` | string | `""` | Forrás szűrő |
| `filterCategory` | string | `""` | Típus szűrő |
| `filterCompanyId` | string | `""` | Cég szűrő |
| `filterUserId` | string | `""` | User szűrő |

**Response:**

```typescript
{
  totalErrors: number;         // Összes hiba (szűrés előtt)
  last24hErrors: number;       // 24h hibák (szűrés előtt)
  mostAffectedCompany: {       // Legtöbb hibás cég
    id: string;
    name: string;
    errorCount: number;
  } | null;
  mostAffectedUser: {          // Legtöbb hibás user
    id: string;
    name: string;
    errorCount: number;
  } | null;
  topErrorCategory: {          // Leggyakoribb hiba típus
    category: string;
    label: string;
    count: number;
  } | null;
  totalRows: number;           // Szűrt sorok száma (lapozáshoz)
  errors: ErrorRow[];          // Aktuális oldal sorai
}
```

**Sub-source Mapping:**

A `management-stats` az `app_error_logs.error_type` mezőből képez al-forrást:

| error_type | Sub-source label |
|------------|-----------------|
| `auth_error`, `db_query`, `api_error`, `unhandled` | `Frontend` |
| `classification_error`, `ocr_error`, `extraction_error`, `duplicate_error`, `empty_content`, `timeout_error`, `rate_limit_error` | `Worker` |
| `webhook` | `Webhook` |
| `mailgun` | `Mailgun` |
| `email_alias` | `Email Alias` |

### Action: `delete-errors`

**Body:**
```json
{ "ids": [{ "source": "app_error_logs:frontend", "id": "uuid" }] }
```

A source normalizálódik (`:frontend` levágva) → DELETE from `app_error_logs` WHERE id IN (...).

### Action: `retry-errors`

**Body:**
```json
{
  "ids": [{ "source": "invoice_uploads", "id": "uuid" }],
  "targetQueue": "invoice_jobs",     // opcionális: pipeline átirányítás
  "targetCategory": "invoice"        // opcionális: kategória override
}
```

A rekordokat újra berakja a PGMQ queue-ba feldolgozásra.

---

## 5. Frontend Key Split Pattern

A belső azonosító formátum: `{source}:{uuid}`

Mivel a source is tartalmazhat `:` karaktert (pl. `app_error_logs:frontend`), a key szétválasztásánál `lastIndexOf(':')` használandó:

```typescript
// HELYES
const lastColon = key.lastIndexOf(':');
const source = key.substring(0, lastColon);
const id = key.substring(lastColon + 1);

// HIBÁS — ne használd!
const [source, id] = key.split(':');  // Ha source-ban van ':', elrontja
```

---

## 6. Biztonság

| Réteg | Védelem |
|-------|---------|
| **Frontend** | `ProtectedPage` + `role === 'management'` guard |
| **Edge Function** | JWT validáció + `profiles.role === 'management'` check |
| **DB** | `service_role` használat (RLS bypass) — csak EF-ben |
| **Szenzitív adatok** | Jelszavak, tokenek kiszűrve a `context`-ből |
| **Rate limit** | 10 log/perc/user (frontend throttling) |
| **Retention** | 90 napos automatikus törlés |

---

## Kapcsolódó Fájlok

| Fájl | Szerep |
|------|--------|
| [`src/lib/errorReporter.ts`](../../src/lib/errorReporter.ts) | Frontend error reporting utility |
| [`src/pages/ManagementDashboard.tsx`](../../src/pages/ManagementDashboard.tsx) | Dashboard UI (Error panel fül) |
| [`supabase/functions/management-stats/index.ts`](../../supabase/functions/management-stats/index.ts) | Backend aggregáció és akciók |
| [`supabase/functions/_shared/error-logger.ts`](../../supabase/functions/_shared/error-logger.ts) | EF shared error logging utility |
| [`worker/error_reporter.py`](../../../worker/error_reporter.py) | Worker error reporting modul |
