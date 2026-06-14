# Edge Functions Katalógus

**42 Deno-alapú Edge Function** a `supabase/functions/` könyvtárban.  
**Létrehozva:** 2026-06-13

---

## Deno-specifikus kötöttségek

Minden Edge Function Deno runtime-ban fut. A lock-in pontok:

```typescript
// 1. Deno-specifikus imports (nem Node.js kompatibilis)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 2. Deno.serve() API (nem Express/Fastify)
Deno.serve(async (req) => { ... });

// 3. Deno.env (nem process.env)
const url = Deno.env.get('SUPABASE_URL');

// 4. URL-based imports (nem npm)
import { sha3_512 } from "https://esm.sh/@noble/hashes@1.3.0/sha3";
```

**Ami viszont könnyen migrálható:**
- ✅ A tényleges üzleti logika standard TypeScript
- ✅ `fetch()` API — Web Standard, Node.js 18+-ban is elérhető
- ✅ `crypto.subtle` — Web Crypto API, Node.js-ben is van
- ✅ `Request`/`Response` objektumok — Web Standard

---

## 🟠 NAV Integráció (7 db) — Üzletileg kritikus

| Funkció | Komplexitás | Migrációs nehézség | Leírás |
|---|:---:|:---:|---|
| `nav-token` | 🔴 473 sor | Közepes | NAV credential validáció + token exchange (SHA-512, SHA3-512) |
| `nav-sync` | 🔴 Magas | Közepes | NAV számla szinkronizáció |
| `nav-auto-sync` | 🟡 Közepes | Könnyű | Automatikus NAV szinkron (pg_cron trigger) |
| `nav-query-outbound-invoices` | 🔴 Magas | Közepes | Kimenő számlák lekérdezése NAV-tól |
| `nav-tax-profile-sync` | 🟡 Közepes | Könnyű | NAV adóprofil szinkron |
| `query-nav-invoices` | 🟡 Közepes | Könnyű | NAV számla lekérdezés |
| `save-credentials` | 🟡 Közepes | Könnyű | NAV credential mentés (titkosított vault-ban) |

**NAV-specifikus megjegyzések:**
- A `nav-token` használ `@noble/hashes` SHA3-512-t a NAV API aláíráshoz — ez npm-ben is elérhető
- A NAV XML API kommunikáció standard `fetch()` + XML string building — nem Deno-specifikus
- A credential titkosítás a Supabase Vault-ot használja — ezt migrálni kell

---

## 📧 Email küldés (8 db)

| Funkció | Migrációs nehézség | Leírás |
|---|:---:|---|
| `send-email` | Könnyű | Általános email küldés (Mailgun API) |
| `send-welcome-email` | Könnyű | Üdvözlő email + verify link generálás |
| `send-notification-email` | Könnyű | Értesítő emailek |
| `send-dunning-email` | Könnyű | Fizetési felszólító email |
| `send-accounty-email` | Könnyű | Accounty értesítések |
| `send-invoice-notification` | Könnyű | Számla értesítés |
| `send-monthly-summary` | Könnyű | Havi összesítő riport email |
| `send-weekly-summary` | Könnyű | Heti összesítő riport email |

**Megjegyzés:** Mind a Mailgun HTTP API-t használja `fetch()`-el. Teljes mértékben portolható Node.js-re változtatás nélkül.

---

## 🔄 PGMQ Trigger-ek (5 db) — Worker indítók

| Funkció | Migrációs nehézség | Leírás |
|---|:---:|---|
| `trigger-invoice-processing` | Könnyű | PGMQ queue-ba küld invoice job-ot |
| `trigger-transaction-processing` | Könnyű | PGMQ queue-ba küld transaction job-ot |
| `trigger-nav-categorization` | Könnyű | PGMQ queue-ba küld GL classification job-ot |
| `trigger-bank-statement-processing` | Könnyű | Bankszámlakivonat feldolgozás indítás |
| `trigger-salary-processing` | Könnyű | Bérjegyzék feldolgozás indítás |

**Megjegyzés:** Ezek a legegyszerűbb funkciók — lényegében PGMQ `pgmq.send()` hívások Supabase client-en keresztül. Bármelyik backend-ből meghívhatók, ha van DB hozzáférés.

---

## 👤 User Management (6 db)

| Funkció | Auth API? | Migrációs nehézség | Leírás |
|---|:---:|:---:|---|
| `invite-user` | 🔴 Admin API | Nehéz | `auth.admin.createUser()` + `listUsers()` |
| `join-company` | ⚠️ `getUser` | Közepes | Céghez csatlakozás |
| `validate-employee-token` | ⚠️ `getUser` | Közepes | Alkalmazotti token validáció |
| `verify-email` | 🔴 GoTrue flow | Nehéz | Email cím megerősítés — saját flow |
| `export-user-data` | ⚠️ `getUser` | Könnyű | GDPR adatexport |
| `delete-nav-credentials` | ⚠️ `getUser` | Könnyű | NAV credential törlés |

---

## 🤖 Accounty AI (5 db)

| Funkció | Migrációs nehézség | Leírás |
|---|:---:|---|
| `accounty-ai-phone` | Közepes | AI telefon asszisztens (LLM hívás) |
| `accounty-detect-bank` | Közepes | Bank detektálás |
| `accounty-detect-missing` | Közepes | Hiányzó számla detektálás |
| `accounty-generate-deadlines` | Közepes | Határidő generálás |
| `accounty-seed` | Könnyű | Accounty seed/demo adatok |

---

## 📦 Egyéb (11 db)

| Funkció | Migrációs nehézség | Leírás |
|---|:---:|---|
| `create-email-alias` | Könnyű | Mailgun email alias létrehozás |
| `delete-email-alias` | Könnyű | Mailgun email alias törlés |
| `get-invoice-image-url` | Könnyű | Storage signed URL generálás |
| `management-stats` | Könnyű | Admin dashboard statisztikák (SQL aggregáció) |
| `check-missing-invoices` | Könnyű | Ütemezett hiányzó számla ellenőrzés |
| `check-payment-deadlines` | Könnyű | Ütemezett fizetési határidő ellenőrzés |
| `nylas-auth` | Közepes | Nylas OAuth2 integráció |
| `nylas-callback` | Közepes | Nylas OAuth callback |
| `process-mailgun-webhook` | Közepes | Bejövő email feldolgozás (webhook) |
| `nav` | Könnyű | NAV API wrapper/router |
| `_shared/emails/` | — | Megosztott email template-ek |

---

## 📊 Migrációs nehézség összesítés

| Nehézség | Darab | Funkciók |
|---|:---:|---|
| **Könnyű** | 23 | Email küldők, PGMQ triggerek, egyszerű CRUD |
| **Közepes** | 14 | NAV integráció, Accounty AI, Nylas |
| **Nehéz** | 5 | `invite-user`, `verify-email`, `nav-token`, `nav-sync`, `nav-query-outbound-invoices` |

---

## Frontend hívási pontok

Az alábbi frontend fájlok hívnak Edge Function-öket `supabase.functions.invoke()` segítségével:

| Frontend fájl | Meghívott funkciók |
|---|---|
| `NavCredentialsForm.tsx` | `nav-token` (3×), `save-credentials`, `nav-query-outbound-invoices` (2×), `delete-nav-credentials`, `trigger-nav-categorization` |
| `EmptyStateDashboard.tsx` | `nav-token`, `save-credentials`, `nav-query-outbound-invoices` (2×), `join-company` |
| `Auth.tsx` | `verify-email` (raw fetch), `send-welcome-email` (raw fetch) |
| `InviteUserDialog.tsx` | `invite-user` |
| `useInvoiceMutations.ts` | `nav-query-outbound-invoices` (2×), `trigger-nav-categorization` |
| `DunningDialog.tsx` | `send-dunning-email` |
| `CompanySelector.tsx` | `join-company` |
| `NylasEmailConnect.tsx` | `nylas-auth` (3×) |
| `InvoiceImagePreview.tsx` | `get-invoice-image-url` |
| `Settings.tsx` | `export-user-data` |
| `EmployeeRegister.tsx` | `validate-employee-token` |
| `ManagementDashboard.tsx` | `management-stats` (raw fetch) |
| `seedAccounty.ts` | `accounty-seed` |
| `PayrollCyclePage.tsx` | `send-notification-email` |
| `ClientPortalPage.tsx` | `send-notification-email` |
| `ApprovalQueuePage.tsx` | `send-accounty-email` |
