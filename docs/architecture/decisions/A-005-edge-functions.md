# A-005: Edge Functions (Deno) a Serverless Logikához

**Status:** Decided  
**Date:** 2025-09  
**Utoljára frissítve:** 2026-06-08

## Context

A rendszernek serverless logikára van szüksége: NAV API hívások, email küldés, webhook feldolgozás, PGMQ triggerelés. Ezek nem felelnek meg sem a frontend-nek (kliens oldali), sem a Python worker-nek (nehézsúlyú).

## Decision

**Supabase Edge Functions** (Deno runtime) — 46 deployed function + `_shared/` közös kód.

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
|----------|-----|--------|
| `send-email` | ❌ | Általános email küldés (Mailgun API) — más EF-ek hívják |
| `send-welcome-email` | ✅ | Regisztráció utáni üdvözlő email |
| `send-dunning-email` | ❌ | Fizetési felszólítás küldése |
| `send-invoice-notification` | ✅ | Számla feldolgozás értesítés |
| `send-notification-email` | ❌ | Általános értesítő email |
| `send-weekly-summary` | ❌ | Heti összefoglaló email (cron) |
| `send-monthly-summary` | ❌ | Havi összefoglaló email (cron) |
| `send-accounty-email` | ❌ | Accounty modul — hiányzó dokumentum értesítés |

#### 📥 Email Fogadás (3 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `process-mailgun-webhook` | ❌ | Bejövő email feldolgozás (Mailgun webhook → attachment → Storage → DB) |
| `create-email-alias` | ✅ | Email alias létrehozása (cegnev@inbox.visibill.hu) |
| `delete-email-alias` | ✅ | Email alias törlése |

#### ⚡ Trigger / Queue (5 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `trigger-invoice-processing` | ✅ | Számla feldolgozás indítása → PGMQ enqueue |
| `trigger-transaction-processing` | ✅ | Tranzakció feldolgozás indítása → PGMQ enqueue |
| `trigger-bank-statement-processing` | ✅ | Bankkivonat feldolgozás indítása → PGMQ enqueue |
| `trigger-salary-processing` | ❌ | Béradat feldolgozás indítása → PGMQ enqueue |
| `trigger-nav-categorization` | ✅ | NAV számla GL kategorizálás indítása → PGMQ enqueue |

#### 🔐 Auth & User Management (4 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `invite-user` | ❌ | Felhasználó meghívás (email + role assignment) |
| `join-company` | ✅ | Meghívás elfogadása — céghez csatlakozás |
| `validate-employee-token` | ❌ | Alkalmazotti token validáció (munkaóra app) |
| `verify-email` | ❌ | Email cím megerősítés link feldolgozása |

#### 🔑 NAV Credentials (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `save-credentials` | ❌ | NAV API credentials titkosított mentése (AES-256-GCM → `save_nav_credentials` RPC) |
| `delete-nav-credentials` | ✅ | NAV API credentials törlése |

#### 📊 Accounty Modul (5 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `accounty-seed` | ❌ | Accounty adatok inicializálása céghez |
| `accounty-detect-missing` | ❌ | Hiányzó dokumentumok detektálása (cron) |
| `accounty-detect-bank` | ❌ | Hiányzó bankkivonatok detektálása (cron) |
| `accounty-generate-deadlines` | ❌ | Kötelezettségek határidő generálás (cron) |
| `accounty-ai-phone` | ❌ | AI-alapú telefonos asszisztens (hívás fogadás) |

#### 🔗 Nylas Email Integráció (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `nylas-auth` | ✅ | Nylas OAuth flow indítása |
| `nylas-callback` | ❌ | Nylas OAuth callback kezelése |

#### 💳 Fizetés / Subscription (4 db) — ⛔ részben superseded (Stripe eltávolítva)

| Function | JWT | Leírás | Státusz |
|----------|-----|--------|---------|
| `check-subscription` | ❌ | Előfizetés ellenőrzése | ⛔ Legacy |
| `check-subscription-status` | ❌ | Előfizetési státusz lekérdezés | ⛔ Legacy |
| `create-checkout` | ✅ | Stripe checkout session | ⛔ Legacy (A-015) |
| `customer-portal` | ✅ | Stripe customer portal | ⛔ Legacy (A-015) |

#### 🛠️ Management & Egyéb (6 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `management-stats` | ❌ | Management dashboard statisztikák (service_role) |
| `create-management-user` | ❌ | Management admin user létrehozása |
| `export-user-data` | ✅ | GDPR adatexport — felhasználó összes adata ZIP-ben |
| `get-invoice-image-url` | ❌ | Számla kép signed URL generálása (Storage) |
| `check-missing-invoices` | ❌ | Hiányzó számlák ellenőrzése (cron) |
| `check-payment-deadlines` | ❌ | Fizetési határidők ellenőrzése (cron) |

---

### JWT Összefoglaló

| JWT beállítás | Darabszám | Mikor |
|---|---|---|
| `verify_jwt: true` | 17 | Frontend-ből közvetlenül hívott function-ök |
| `verify_jwt: false` | 29 | Webhook-ok, cron jobok, más EF-ek által hívottak, service_role auth |

**Megjegyzés:** `verify_jwt: false` nem jelent védtelenséget — ezek a function-ök saját auth-ot implementálnak:
- Webhook-ok: HMAC signature verification (Mailgun)
- Cron jobok: Supabase Cron scheduler hívja (internal)
- Service role: `SUPABASE_SERVICE_ROLE_KEY` env var-ral autentikál
- Nylas callback: OAuth state validation

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
- 46 function karbantartása nehézkes — 4 db legacy (Stripe) konszolidálható

## Kapcsolódó
- [A-011: Mailgun Email Processing](./A-011-email-processing.md)
- [A-012: NAV Integration](./A-012-nav-integration.md)
- [A-010: Credential Encryption](./A-010-credential-encryption.md)
- [A-015: Stripe Removal](./A-015-stripe-removal.md) (legacy EF-ek)
- [A-019: Management Dashboard](./A-019-management-dashboard.md)
