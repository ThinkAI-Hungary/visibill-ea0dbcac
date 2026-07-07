# A-005: Edge Functions (Deno) a Serverless Logikához

**Status:** Decided  
**Date:** 2025-09  
**Utoljára frissítve:** 2026-07-07

## Context

A rendszernek serverless logikára van szüksége: NAV API hívások, email küldés, webhook feldolgozás, PGMQ triggerelés. Ezek nem felelnek meg sem a frontend-nek (kliens oldali), sem a Python worker-nek (nehézsúlyú).

## Decision

**Supabase Edge Functions** (Deno runtime) — 49 deployed function + `_shared/` közös kód.

**Közös kód:** `_shared/` mappa — CORS headers, Supabase client, utility-k.

---

### Teljes Edge Function Katalógus

#### 🏛️ NAV Integráció (7 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `nav` | ❌ | NAV API proxy — általános NAV hívások |
| `nav-auto-sync` | ❌ | Automatikus NAV szinkronizáció (cron-ból hívva) |
| `nav-sync` | ✅ | Manuális NAV számla szinkronizáció (user-initiated) |
| `nav-token` | ✅ | NAV API token generálás/exchange |
| `nav-query-outbound-invoices` | ✅ | Kimenő számlák lekérdezése NAV-tól |
| `query-nav-invoices` | ✅ | Bejövő NAV számlák lekérdezése (decrypt credentials → NAV API) |
| `nav-tax-profile-sync` | ❌ | Adószám profil szinkronizáció NAV-ból |

#### 📧 Email Küldés (8 db)

| Function | JWT | Leírás |
|----------|-----|---------|
| `send-email` | ❌ | **Supabase Auth Hook** — Resend API-n keresztül küld emailt auth eventekre (recovery, email_change, magiclink). Signup típust **skipeli** (v147 óta) — a welcome email kezeli. |
| `send-welcome-email` | ❌ | Regisztrációs üdvözlő email — a `handle_new_user` Postgres trigger hívja pg_net-en keresztül (nem a frontend). Custom `email_verify_token` alapú megerősítő linket tartalmaz. |
| `send-dunning-email` | ❌ | Fizetési felszólítás küldése |
| `send-invoice-notification` | ✅ | Számla feldolgozás értesítés |
| `send-notification-email` | ❌ | Általános értesítő email |
| `send-weekly-summary` | ❌ | Heti összefoglaló email (cron) |
| `send-monthly-summary` | ❌ | Havi összefoglaló email (cron) |
| `send-accounty-email` | ❌ | eaisyBooks modul — hiányzó dokumentum értesítés |

#### 📥 Email Fogadás (3 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `process-mailgun-webhook` | ❌ | Bejövő email feldolgozás (Mailgun webhook → attachment → Storage → DB) |
| `create-email-alias` | ✅ | Email alias létrehozása (cegnev@inbox.visibill.hu) |
| `delete-email-alias` | ✅ | Email alias törlése |

#### ⚡ Trigger / Queue (6 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `trigger-invoice-processing` | ✅ | Számla feldolgozás indítása → PGMQ enqueue |
| `trigger-transaction-processing` | ✅ | Tranzakció feldolgozás indítása → PGMQ enqueue |
| `trigger-bank-statement-processing` | ✅ | Bankkivonat feldolgozás indítása → PGMQ enqueue |
| `trigger-salary-processing` | ❌ | Béradat feldolgozás indítása → PGMQ enqueue |
| `trigger-nav-categorization` | ✅ | NAV számla GL kategorizálás indítása → PGMQ enqueue |
| `generate-pdf-export` | ✅ | PDF export v13 — Auth + invoice query + job INSERT + PGMQ enqueue. Feldolgozás a Python Workerben (`pdf_export_processor.py`). |

#### 🔐 Auth & User Management (4 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `invite-user` | ❌ | Felhasználó meghívás (email + role assignment) |
| `join-company` | ✅ | Meghívás elfogadása — céghez csatlakozás |
| `validate-employee-token` | ❌ | Alkalmazotti token validáció (munkaóra app) |
| `verify-email` | ❌ | Custom token alapú email megerősítés (v22+): `profiles.email_verified = true` ÉS `auth.users.email_confirmed_at = NOW()` (admin API). Így a Supabase "Confirm email" setting BE lehet kapcsolva. |

#### 🔑 NAV Credentials (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `save-credentials` | ❌ | NAV API credentials titkosított mentése (AES-256-GCM → `save_nav_credentials` RPC) |
| `delete-nav-credentials` | ✅ | NAV API credentials törlése |

#### 📱 Accounty Modul (9 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `accounty-seed` | ❌ | Accounty adatok inicializálása céghez |
| `accounty-detect-missing` | ❌ | Hiányzó dokumentumok detektálása (cron). Talált hiányokról email értesítést küld a hozzárendelt könyvelőknek ÉS az ügyfél kapcsolattartónak (`send-accounty-notification`, dual-mode). |
| `accounty-detect-bank` | ❌ | Hiányzó bankkivonatok detektálása (cron) |
| `accounty-generate-deadlines` | ❌ | Kötelezettségek határidő generálás (cron) |
| `accounty-ai-phone` | ❌ | AI-alapú telefonos asszisztens (hívás fogadás) |
| `accounty-ai-chat` | ❌ | AI chat asszisztens az eaisyBooks modulhoz |
| `send-accounty-notification` | ❌ | eaisyBooks email értesítés — dual-mode: (A) könyvelő: `accounty_email_preferences` opt-in check, (B) ügyfél: `recipient_type='client_contact'` + kék template (`wrapClientHtml`). Resend API (`info@mail.visibill.hu`). Log: `outgoing_emails`. (A-030) |
| `validate-partner-code` | ❌ | Meghívó kód (share_token) read-only validáció — cég adatok visszaadása |
| `join-company-as-accountant` | ❌ | Meghívó kód → `accounty_assignments` INSERT (könyvelő hozzárendelés) |

#### 🔗 Nylas Email Integráció (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `nylas-auth` | ✅ | Nylas OAuth flow indítása |
| `nylas-callback` | ❌ | Nylas OAuth callback kezelése |

#### 💳 Fizetés / Subscription — ⛔ Teljes mértékben eltávolítva (A-015)

| Function | JWT | Leírás | Státusz |
|----------|-----|--------|---------|
| `check-subscription` | — | Előfizetés ellenőrzése | ⛔ **Eltávolítva** — nem létezik a `supabase/functions/` könyvtárban |
| `check-subscription-status` | — | Előfizetési státusz lekérdezés | ⛔ **Eltávolítva** — nem létezik a `supabase/functions/` könyvtárban |
| `create-checkout` | ✅ | Stripe checkout session | ⛔ Legacy (A-015) |
| `customer-portal` | ✅ | Stripe customer portal | ⛔ Legacy (A-015) |

#### 🛠️ Management & Egyéb (6 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `management-stats` | ❌ | Management dashboard — 14 action (overview, company/user detail, permissions, files+bulk status update, errors CRUD+retry, superadmin 27 modul). Service_role auth. |
| `impersonate-company` | ✅ | Support Admin impersonation flow (start/stop). Kezeli az ideiglenes `accounty_assignments` sorok beillesztését és törlését az ügyfelekhez. (Lásd: A-026) |
| `create-management-user` | — | ⛔ **Eltávolítva** — nincs meg a `supabase/functions/` könyvtárban |
| `export-user-data` | ✅ | GDPR adatexport — felhasználó összes adata ZIP-ben |
| `get-invoice-image-url` | ❌ | Számla kép signed URL generálása (Storage) |
| `check-missing-invoices` | ❌ | Hiányzó számlák ellenőrzése (cron) |
| `check-payment-deadlines` | ❌ | Fizetési határidők ellenőrzése (cron) |
| `sandbox-storage-cleanup` | ❌ | SANDBOX cég mock számlaképek törlése Storage-ból + DB melleklet_url NULL-ra. Admin-only (`x-admin-secret` header). Dry-run mód támogatott. |

#### 🔌 External API (1 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `openclaw-api` | ❌ | Read-only REST API külső integrációkhoz (OpenClaw). Saját API key auth (SHA-256 hash, `api_keys` tábla). 4 action: `help`, `list-tables`, `schema`, `query`. 120+ tábla olvasható, 6 szenzitív tábla blokkolva. Rate limiting (100 req/perc/kulcs). |

#### 🗓️ Egyéb / Cron (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `fetch-mnb-rates` | ❌ | MNB SOAP API → `daily_exchange_rates` tábla upsert (cron + dashboard auto-trigger) |
| `fetch-legal-updates` | ❌ | Jogi frissítések letöltése (cron) |

#### 🚚 Szállitmányozás / HRTSPED (1 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `shipment-retroactive-match` | ❌ | DR-031: Retroaktív shipment↔invoice párosítás invoice-first életciklushöz. A `ShipmentImportPage` hívja Excel import után (1 POST/import). Tábla: `shipment_matches`, `invoices`, `transport_documents`, `shipments`. 90 napos ablak. Service_role auth. |

---

### JWT Összefoglaló

| JWT beállítás | Darabszám | Mikor |
|---|---|---|
| `verify_jwt: true` | 17 | Frontend-ből közvetlenül hívott function-ök |
| `verify_jwt: false` | 33 | Webhook-ok, cron jobok, más EF-ek által hívottak, service_role auth, API key auth |

**Megjegyzés:** `verify_jwt: false` nem jelent védtelenséget — ezek a function-ök saját auth-ot implementálnak:
- Webhook-ok: HMAC signature verification (Mailgun)
- Cron jobok: Supabase Cron scheduler hívja (internal)
- Service role: `SUPABASE_SERVICE_ROLE_KEY` env var-ral autentikál
- Nylas callback: OAuth state validation
- API key auth: `openclaw-api` — SHA-256 hash lookup az `api_keys` táblából, saját rate limiting

---

## Consequences

**Pozitív:**
- Gyors cold start (Deno, ~50ms)
- Nincs szerver karbantartás — Supabase kezeli
- Natív Supabase integráció (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` env vars)
- A functions verziókezelve vannak a repo-ban (`supabase/functions/`)

**Negatív:**
- Deno runtime — npm csomagok korlátozott támogatása (`esm.sh` wrapper szükséges)
- 60s timeout (hosszú NAV API hívások közel a limithez)
- Nincs lokális hibakeresés (Supabase CLI `serve` korlátozottan működik)
- 49 function karbantartása nehézkes — a legacy Stripe EF-ek konszolidálhatók

## Kapcsolódó
- [A-011: Mailgun Email Processing](./A-011-email-processing.md)
- [A-012: NAV Integration](./A-012-nav-integration.md)
- [A-010: Credential Encryption](./A-010-credential-encryption.md)
- [A-015: Stripe Removal](./A-015-stripe-removal.md) (legacy EF-ek)
- [A-019: Management Dashboard](./A-019-management-dashboard.md)
- [A-021: Email Auth Flow Redesign](./A-021-email-auth-flow-redesign.md) (send-email hook, verify-email, signup single email)
- [A-030: Accounty Email Notification Architecture](./A-030-accounty-email-notifications.md)
