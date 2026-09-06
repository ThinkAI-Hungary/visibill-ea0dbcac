# A-005: Edge Functions (Deno) a Serverless Logikához

**Status:** Decided  
**Date:** 2025-09  
**Utoljára frissítve:** 2026-08-31

## Context

A rendszernek serverless logikára van szüksége: NAV API hívások, email küldés, webhook feldolgozás, háttér kalkulációk, PGMQ triggerelés és push értesítések. Ezek nem felelnek meg sem a frontend-nek (kliens oldali), sem a Python worker-nek (nehézsúlyú aszinkron worker).

## Decision

**Supabase Edge Functions** (Deno runtime) — **58 deployed function** + `_shared/` közös kód.

**Közös kód:** `_shared/` mappa:
- `_shared/nav/` — Központi NAV Online Számla v3 protokoll motor (`NavClient`), titkosítás (SHA-512, SHA3-512), XML borítéképítők/parszolók, és adatbázis szinkronizáció (`NavIngestionService`).
- `_shared/client-guard.ts` — Szkript-automatizáció elleni védelmi pajzs (`checkAutomationShield`) és kibővített `corsHeaders` (lásd: [A-101](./A-101-direct-script-automation-restriction.md)).
- `_shared/cors.ts`, `_shared/supabase.ts` — CORS headers, Supabase client és segédfüggvények.

---

### Teljes Edge Function Katalógus (58 db)

#### 🏛️ NAV Integráció (7 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `nav` | ❌ | NAV API proxy — általános NAV hívások |
| `nav-auto-sync` | ❌ | Automatikus NAV szinkronizáció és webhook triggerelés (`NavIngestionService`) |
| `nav-sync` | ✅ | Manuális NAV számla szinkronizáció (`NavIngestionService`) |
| `nav-token` | ✅ | NAV API hitelesítő adatok validálása és token exchange (`NavClient`) |
| `nav-query-outbound-invoices` | ✅ | Kimenő számlák és tételsorok lekérdezése (`NavIngestionService`) |
| `query-nav-invoices` | ✅ | NAV számlák keresése és szűrése (`NavIngestionService`) |
| `nav-tax-profile-sync` | ❌ | Adószám profil szinkronizáció NAV-ból |

#### 📧 Email Küldés & Riportok (10 db)

| Function | JWT | Leírás |
|----------|-----|---------|
| `send-email` | ❌ | **Supabase Auth Hook** — Resend API-n keresztül küld emailt auth eventekre (recovery, email_change, magiclink). Signup típust skipeli — a welcome email kezeli. |
| `send-welcome-email` | ❌ | Regisztrációs üdvözlő email — a `handle_new_user` Postgres trigger hívja pg_net-en keresztül. Custom `email_verify_token` alapú megerősítő linket tartalmaz. |
| `send-dunning-email` | ❌ | Fizetési felszólítás küldése |
| `send-invoice-notification` | ✅ | Számla feldolgozás értesítés |
| `send-notification-email` | ❌ | Általános értesítő email |
| `send-weekly-summary` | ❌ | Heti összefoglaló email (cron) |
| `send-monthly-summary` | ❌ | Havi összefoglaló email (cron) |
| `send-accounty-email` | ❌ | eaisyBooks modul — hiányzó dokumentum értesítés |
| `send-accounty-weekly-report` | ❌ | eaisyBooks heti összefoglaló riport küldése könyvelőknek |
| `send-accounty-monthly-report` | ❌ | eaisyBooks havi összefoglaló riport küldése könyvelőknek |

#### 📥 Email Fogadás & Saját Levelező (5 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `process-mailgun-webhook` | ❌ | Bejövő email feldolgozás (Mailgun webhook → attachment → Storage → DB) |
| `create-email-alias` | ✅ | Email alias létrehozása (cegnev@inbox.visibill.hu) |
| `delete-email-alias` | ✅ | Email alias törlése |
| `test-email-connection` | ✅ | IMAP/SMTP kapcsolat tesztelése és hitelesítése Vault feloldással |
| `delete-email-settings` | ✅ | Saját levelező beállítások és Vault titkok biztonságos törlése / leválasztása |

#### ⚡ Queue & Export Generálás (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `trigger-nav-categorization` | ✅ | NAV számla GL kategorizálás indítása → PGMQ enqueue |
| `generate-pdf-export` | ✅ | PDF export v13 — Auth + invoice query + job INSERT + PGMQ enqueue. Feldolgozás a Python Workerben (`pdf_export_processor.py`). |

#### 🔐 Auth & User Management (4 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `invite-user` | ❌ | Felhasználó meghívás (email + role assignment) |
| `join-company` | ✅ | Meghívás elfogadása — céghez csatlakozás |
| `validate-employee-token` | ❌ | Alkalmazotti token validáció (munkaóra app) |
| `verify-email` | ❌ | Custom token alapú email megerősítés: `profiles.email_verified = true` ÉS `auth.users.email_confirmed_at = NOW()` (admin API). |

#### 🔑 NAV Credentials (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `save-credentials` | ❌ | NAV API credentials titkosított mentése (AES-256-GCM → `save_nav_credentials` RPC) |
| `delete-nav-credentials` | ✅ | NAV API credentials törlése |

#### 📱 eaisyBooks / Accounty Modul (15 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `accounty-seed` | ❌ | Accounty adatok inicializálása céghez |
| `accounty-detect-missing` | ❌ | Hiányzó dokumentumok detektálása (cron). Talált hiányokról email értesítést küld (`send-accounty-notification`). |
| `accounty-detect-bank` | ❌ | Hiányzó bankkivonatok detektálása (cron) |
| `accounty-generate-deadlines` | ❌ | Kötelezettségek határidő generálás (cron) |
| `accounty-check-deadlines` | ❌ | Közeledő és lejárt adóügyi határidők ellenőrzése és riasztások küldése |
| `accounty-generate-xml` | ❌ | NAV 08/SZJA/ÁFA bevallás XML állományok generálása |
| `accounty-ai-phone` | ❌ | AI-alapú telefonos asszisztens (hívás fogadás) |
| `accounty-ai-chat` | ❌ | AI chat asszisztens az eaisyBooks modulhoz |
| `accounty-ai-categorize` | ❌ | eaisyBooks számlák és tételek intelligens AI kategorizálása |
| `accounty-ai-depreciation` | ❌ | Tárgyi eszközök automatikus értékcsökkenés AI számítása |
| `send-accounty-notification` | ❌ | eaisyBooks email értesítés — dual-mode: könyvelő és ügyfél kapcsolattartó. |
| `send-web-push` | ❌ | eaisyBooks Web Push értesítés kiküldése VAPID kulcsokkal. |
| `send-accounty-digest` | ❌ | Napi/heti Digest email kiküldése a könyvelőknek (óránkénti cron). |
| `validate-partner-code` | ❌ | Meghívó kód (share_token) read-only validáció — cég adatok visszaadása |
| `join-company-as-accountant` | ❌ | Meghívó kód → `accounty_assignments` INSERT (könyvelő hozzárendelés) |

#### 🔗 Nylas Email Integráció (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `nylas-auth` | ✅ | Nylas OAuth flow indítása |
| `nylas-callback` | ❌ | Nylas OAuth callback kezelése |

#### 🛠️ Management & Üzemeltetés (7 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `management-stats` | ❌ | Management dashboard — 14 action (áttekintés, cég/user adatok, jogosultságok, hibakezelés, worker állapot). Moduláris domén handler architektúra (`handlers/`, `middleware/`, `utils/`, lásd [A-077](./A-077-management-stats-edge-function-and-telemetry-decomposition.md)). |
| `impersonate-company` | ✅ | Support Admin impersonation flow (start/stop) az ideiglenes hozzáféréshez. |
| `export-user-data` | ✅ | GDPR adatexport — felhasználó összes adata ZIP-ben |
| `get-invoice-image-url` | ❌ | Számla kép signed URL generálása (Storage) |
| `check-missing-invoices` | ❌ | Hiányzó számlák ellenőrzése (cron) |
| `check-payment-deadlines` | ❌ | Fizetési határidők ellenőrzése (cron) |
| `sandbox-storage-cleanup` | ❌ | SANDBOX cég mock számlaképek törlése Storage-ból. |

#### 🔌 External API (1 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `openclaw-api` | ❌ | Read-only REST API külső integrációkhoz (OpenClaw). Saját API key auth (SHA-256 hash, `api_keys` tábla). |

#### 🗓️ MNB & Jogi Frissítések (2 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `fetch-mnb-rates` | ❌ | MNB SOAP API → `daily_exchange_rates` tábla upsert (cron + dashboard auto-trigger) |
| `fetch-legal-updates` | ❌ | Jogi frissítések letöltése (cron) |

#### 🚚 Szállítmányozás / HRTSPED (1 db)

| Function | JWT | Leírás |
|----------|-----|--------|
| `shipment-retroactive-match` | ❌ | Retroaktív shipment↔invoice párosítás Excel import után. |

---

### JWT Összefoglaló

| JWT beállítás | Darabszám | Mikor |
|---|---|---|
| `verify_jwt: true` | 13 | Frontend-ből közvetlenül, bejelentkezett felhasználói JWT-vel hívott function-ök |
| `verify_jwt: false` | 45 | Webhook-ok, cron jobok, belső hívások, service_role auth, API key auth, magic link tokenek |

---

## Consequences

**Pozitív:**
- Gyors cold start (Deno, ~50ms)
- Teljes szervermentes üzemeltetés a Supabase platformon.
- Verziókezelt forráskód a `supabase/functions/` könyvtárban.

**Negatív:**
- 60s végrehajtási időkorlát (a nehéz számítások a Python workerbe kerültek).

## Kapcsolódó
- [A-011: Mailgun Email Processing](./A-011-email-processing.md)
- [A-012: NAV Integration](./A-012-nav-integration.md)
- [A-010: Credential Encryption](./A-010-credential-encryption.md)
- [A-019: Management Dashboard](./A-019-management-dashboard.md)
- [A-030: Accounty Email Notification Architecture](./A-030-accounty-email-notifications.md)
- [A-034: Accounty Digest Emails](./A-034-accounty-digest-emails.md)
- [A-052: Multi-Profile Email Accounts](./A-052-multi-profile-email-accounts-vault-integration.md)
- [A-101: Közvetlen Szkript-Automatizációk Letiltása és Kettős Védelmi Retesz](./A-101-direct-script-automation-restriction.md)
