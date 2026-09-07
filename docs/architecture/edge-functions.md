# Supabase Edge Functions Katalógus

> **Utoljára frissítve:** 2026-09-07  
> **Összesen:** 59 Deno Edge Function + `_shared/` közös modulok | **Runtime:** Deno (TypeScript) | **Platform:** Supabase Cloud

Ez a dokumentáció az eaisybill-prod rendszer összes Supabase Edge Function-jének hivatalos, autoritatív katalógusa. Részletezi az egyes funkciók célját, jogosultsági modelljét (`verify_jwt`), meghívási kontextusát (Frontend, pg_cron, Webhook, Postgres Trigger) és környezeti változóit.
A funkciók forráskódja a [`supabase/functions/`](../../supabase/functions/) könyvtárban található. A technikai architektúra döntést az [A-005: Edge Functions a Serverless Logikához](./decisions/A-005-edge-functions.md), az adatbázis sémát a [database-schema.md](./database-schema.md), az eljárásokat pedig az [rpc-catalog.md](./rpc-catalog.md) írja le.

---

## Közös Modulok (`supabase/functions/_shared/`)

Az Edge Function-ök modularitását és védelmét a központi `_shared/` könyvtár biztosítja:
- **`_shared/nav/`** — Központi NAV Online Számla v3 protokoll motor (`NavClient`), hitelesítés és kriptográfia (SHA-512, SHA3-512), XML borítéképítők és a `NavIngestionService` adatbázis szinkronizáló réteg.
- **`_shared/client-guard.ts`** — Közvetlen szkript-automatizáció elleni kettős védelmi pajzs (`checkAutomationShield`) és egységesített CORS engedélyezés (lásd: [A-101](./decisions/A-101-direct-script-automation-restriction.md)).
- **`_shared/cors.ts`** — Standard böngészős CORS fejlécek (`Access-Control-Allow-Origin`, preflight OPTIONS válaszok).
- **`_shared/supabase.ts`** — Supabase admin és anon kliensek egységes inicializálása.
- **`_shared/email.ts`** — Email küldési segédfüggvények (Resend és Mailgun HTTP API kliensek).

---

## Tartalomjegyzék

1. [🏛️ NAV Integráció (7 db)](#1-nav-integráció)
2. [📧 Email Küldés & Riportok (10 db)](#2-email-küldés--riportok)
3. [📥 Email Fogadás & Saját Levelező (5 db)](#3-email-fogadás--saját-levelező)
4. [⚡ Queue & Export Generálás (2 db)](#4-queue--export-generálás)
5. [🔐 Auth & Felhasználókezelés (4 db)](#5-auth--felhasználókezelés)
6. [🔑 NAV Hitelesítő Adatok (2 db)](#6-nav-hitelesítő-adatok)
7. [📱 eaisyBooks / Accounty Modul (15 db)](#7-eaisybooks--accounty-modul)
8. [🔗 Nylas Email Integráció (2 db)](#8-nylas-email-integráció)
9. [🛠️ Management, Üzemeltetés & AI Segédek (8 db)](#9-management,-üzemeltetés--ai-segédek)
10. [🔌 Külső Integrációk & API (1 db)](#10-külső-integrációk--api)
11. [🗓️ MNB & Jogi Frissítések (2 db)](#11-mnb--jogi-frissítések)
12. [🚚 Szállítmányozás / HRTSPED (1 db)](#12-szállítmányozás--hrtsped)

---

## 1. 🏛️ NAV Integráció (7 db)

> NAV Online Számla v3 protokoll motor, hitelesítés, számla és adószám szinkronizáció.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`nav`](../../supabase/functions/nav/index.ts) | ❌ Nyilvános / Belső | Belső / PostgREST proxy | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Általános NAV API proxy és lekérdező végpont. |
| [`nav-auto-sync`](../../supabase/functions/nav-auto-sync/index.ts) | ❌ Nyilvános / Belső | pg_cron (időzített feladat) / Webhook | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Automatikus NAV számlaletöltés és státuszszinkron az összes aktív cégre a `NavIngestionService` segítségével. |
| [`nav-sync`](../../supabase/functions/nav-sync/index.ts) | ✅ Kötelező | Frontend (NavInvoicesTable / InvoicesHeader) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Manuálisan indított NAV számla szinkronizáció megadott cégre és időszakra. |
| [`nav-token`](../../supabase/functions/nav-token/index.ts) | ✅ Kötelező | Frontend (NavSettings.tsx) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | NAV technikai felhasználó és aláírókulcsok (SHA-512, SHA3-512) validációja és token-csere. |
| [`nav-query-outbound-invoices`](../../supabase/functions/nav-query-outbound-invoices/index.ts) | ✅ Kötelező | Frontend (InvoicesPage) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Kimenő számlák lekérdezése a NAV-ból és mentése a `nav_invoices` táblába `direction='outbound'` jelölővel. |
| [`query-nav-invoices`](../../supabase/functions/query-nav-invoices/index.ts) | ✅ Kötelező | Frontend (NavSearchModal) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Egyedi számlakeresés és részletek lekérdezése NAV bizonylatszám vagy tranzakcióazonosító alapján. |
| [`nav-tax-profile-sync`](../../supabase/functions/nav-tax-profile-sync/index.ts) | ❌ Nyilvános / Belső | pg_cron / Company onboarding | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Cég adózási státuszának, ÁFA csoportazonosítójának és telephelyeinek frissítése a NAV nyilvántartásból. |

---

## 2. 📧 Email Küldés & Riportok (10 db)

> Tranzakciós emailek, rendszerértesítések, heti/havi riportok és fizetési felszólítások kiküldése (Resend / Mailgun API).

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`send-email`](../../supabase/functions/send-email/index.ts) | ❌ Nyilvános / Belső | Supabase Auth Hook | `RESEND_API_KEY, SUPABASE_URL` | Supabase Auth hook email küldő (jelszóvisszaállítás, email módosítás, magic link). A sima signup-ot skipeli a welcome-email javára. |
| [`send-welcome-email`](../../supabase/functions/send-welcome-email/index.ts) | ❌ Nyilvános / Belső | PostgreSQL Trigger (handle_new_user via pg_net) | `RESEND_API_KEY, SUPABASE_URL, APP_URL` | Regisztrációs üdvözlő email küldése egyedi email-megerősítő tokennel és linkkel (A-021). |
| [`send-dunning-email`](../../supabase/functions/send-dunning-email/index.ts) | ❌ Nyilvános / Belső | Frontend / DunningWizard / pg_cron | `MAILGUN_API_KEY / RESEND_API_KEY, SUPABASE_URL` | Fizetési felszólító levél kiküldése lejárt vevői számlákhoz egyedi sablonnal és tartozásösszesítővel. |
| [`send-invoice-notification`](../../supabase/functions/send-invoice-notification/index.ts) | ✅ Kötelező | Frontend / Worker | `RESEND_API_KEY, SUPABASE_URL` | Számla sikeres feldolgozásáról vagy jóváhagyásáról szóló azonnali értesítés küldése a kijelölt felhasználóknak. |
| [`send-notification-email`](../../supabase/functions/send-notification-email/index.ts) | ❌ Nyilvános / Belső | Belső rendszermag / Hibakezelő | `RESEND_API_KEY, SUPABASE_URL` | Általános rendszerértesítések, audit riasztások és státuszváltások közvetítése emailben. |
| [`send-weekly-summary`](../../supabase/functions/send-weekly-summary/index.ts) | ❌ Nyilvános / Belső | pg_cron (hétfő reggel) | `RESEND_API_KEY, SUPABASE_URL` | Heti pénzügyi és számlaösszesítő riport küldése a cégvezetőknek (KPI-k, kintlévőségek, beérkezett számlák). |
| [`send-monthly-summary`](../../supabase/functions/send-monthly-summary/index.ts) | ❌ Nyilvános / Belső | pg_cron (hó elején) | `RESEND_API_KEY, SUPABASE_URL` | Havi záró összesítő kimutatás küldése pénzforgalmi adatokkal és könyvelési felkészültséggel. |
| [`send-accounty-email`](../../supabase/functions/send-accounty-email/index.ts) | ❌ Nyilvános / Belső | Accounty hiánydetektáló / Frontend | `RESEND_API_KEY, SUPABASE_URL` | eaisyBooks modul — figyelmeztetés hiányzó bizonylatokról és bankszámlakivonatokról. |
| [`send-accounty-weekly-report`](../../supabase/functions/send-accounty-weekly-report/index.ts) | ❌ Nyilvános / Belső | pg_cron (péntek délután) | `RESEND_API_KEY, SUPABASE_URL` | eaisyBooks heti könyvelői portfólió összefoglaló a könyvelőirodák kollégái számára. |
| [`send-accounty-monthly-report`](../../supabase/functions/send-accounty-monthly-report/index.ts) | ❌ Nyilvános / Belső | pg_cron (hó végén) | `RESEND_API_KEY, SUPABASE_URL` | eaisyBooks havi zárási riport a könyvelési és adóbevallási feladatok állásáról. |

---

## 3. 📥 Email Fogadás & Saját Levelező (5 db)

> Bejövő számlák fogadása Mailgun webhookon keresztül, valamint cégek saját IMAP/SMTP levelezőfiók konfigurációja és tesztelése.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`process-mailgun-webhook`](../../supabase/functions/process-mailgun-webhook/index.ts) | ❌ Nyilvános / Belső | Mailgun HTTP Webhook | `MAILGUN_SIGNING_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Beérkező számlalevelek feldolgozása: aláírás-ellenőrzés, PDF/kép csatolmány kicsomagolása és mentése Supabase Storage-ba, majd DB és PGMQ enqueue (A-011, A-041). |
| [`create-email-alias`](../../supabase/functions/create-email-alias/index.ts) | ✅ Kötelező | Frontend (EmailSettingsTab) | `MAILGUN_API_KEY, SUPABASE_URL` | Egyedi bejövő email cím (cegnev@inbox.visibill.hu) lefoglalása és route regisztrációja Mailgunban. |
| [`delete-email-alias`](../../supabase/functions/delete-email-alias/index.ts) | ✅ Kötelező | Frontend (EmailSettingsTab) | `MAILGUN_API_KEY, SUPABASE_URL` | Céghez tartozó email alias felszabadítása és Mailgun route törlése. |
| [`test-email-connection`](../../supabase/functions/test-email-connection/index.ts) | ✅ Kötelező | Frontend (EmailAccountModal) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Egyedi céges IMAP/SMTP szerver kapcsolat, tanúsítvány és hitelesítés valós idejű tesztelése a Vaultban tárolt adatokkal (A-038). |
| [`delete-email-settings`](../../supabase/functions/delete-email-settings/index.ts) | ✅ Kötelező | Frontend (EmailSettingsTab) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Saját levelező beállítások és a hozzá kapcsolódó Vault titkok biztonságos végleges törlése. |

---

## 4. ⚡ Queue & Export Generálás (2 db)

> Főkönyvi feldolgozás PGMQ sorba állítása és aszinkron nagy méretű PDF export generálás.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`trigger-nav-categorization`](../../supabase/functions/trigger-nav-categorization/index.ts) | ✅ Kötelező | Frontend (InvoicesPage) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | NAV számlák automatikus AI főkönyvi számlaszám hozzárendelésének kezdeményezése PGMQ enqueue segítségével. |
| [`generate-pdf-export`](../../supabase/functions/generate-pdf-export/index.ts) | ✅ Kötelező | Frontend (PdfExportDialog) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Több száz/ezer számlát tartalmazó PDF csomag és kontírozó lap generálási feladat inicializálása a `pdf_export_jobs` táblában és worker értesítés (A-028, A-047). |

---

## 5. 🔐 Auth & Felhasználókezelés (4 db)

> Meghívásos onboarding, céghez csatlakozás, token validáció és kétlépcsős email megerősítés.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`invite-user`](../../supabase/functions/invite-user/index.ts) | ❌ Nyilvános / Belső | Frontend (InviteUserDialog) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY` | Új munkatárs meghívása céghez: fiók regisztráció vagy feloldás az Admin API-val, jogosultság hozzárendelés és meghívó levél küldése. |
| [`join-company`](../../supabase/functions/join-company/index.ts) | ✅ Kötelező | Frontend (JoinCompanyPage) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Meghívó token elfogadása: a bejelentkezett felhasználó hozzárendelése a céghez `company_members` rekorddal. |
| [`validate-employee-token`](../../supabase/functions/validate-employee-token/index.ts) | ❌ Nyilvános / Belső | Külső alkalmazotti munkaidő app | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Alkalmazotti bejelentkezési és jelenléti token validálása bejelentkezés nélkül. |
| [`verify-email`](../../supabase/functions/verify-email/index.ts) | ❌ Nyilvános / Belső | Frontend (VerifyEmailPage) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Egyedi email-megerősítő token validálása: `profiles.email_verified = true` és `auth.users.email_confirmed_at = NOW()` szinkron beállítása (A-021). |

---

## 6. 🔑 NAV Hitelesítő Adatok (2 db)

> NAV technikai felhasználói adatok mentése és törlése Supabase Vault védelemmel.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`save-credentials`](../../supabase/functions/save-credentials/index.ts) | ❌ Nyilvános / Belső | Frontend (NavSettings.tsx) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | NAV technikai felhasználó jelszavának, aláíró- és cserekulcsainak AES-256 titkosítása és mentése a `save_nav_credentials` RPC-n keresztül (A-010). |
| [`delete-nav-credentials`](../../supabase/functions/delete-nav-credentials/index.ts) | ✅ Kötelező | Frontend (NavSettings.tsx) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | NAV hitelesítő adatok és titkosított kulcsok törlése az adatbázisból és a Vaultból. |

---

## 7. 📱 eaisyBooks / Accounty Modul (15 db)

> Könyvelőirodai ERP funkciók: automatikus hiánydetektálás, határidők, XML bevallásgenerálás, Web Push és AI asszisztens.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`accounty-seed`](../../supabase/functions/accounty-seed/index.ts) | ❌ Nyilvános / Belső | Company Onboarding / Beállítások | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | eaisyBooks cégkörnyezet kezdeti konfigurációja (alapértelmezett határidők, adózási profil, naplók inicializálása). |
| [`accounty-detect-missing`](../../supabase/functions/accounty-detect-missing/index.ts) | ❌ Nyilvános / Belső | pg_cron (napi futás) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Hiányzó bizonylatok, szállítói számlák és kiadások automatikus heurisztikus detektálása a `nav_invoices` és banki forgalom alapján. |
| [`accounty-detect-bank`](../../supabase/functions/accounty-detect-bank/index.ts) | ❌ Nyilvános / Belső | pg_cron (napi futás) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Hiányzó havi bankszámlakivonatok felismerése dátumrések és tranzakciós bizonylatok hiánya alapján. |
| [`accounty-generate-deadlines`](../../supabase/functions/accounty-generate-deadlines/index.ts) | ❌ Nyilvános / Belső | pg_cron (havi futás) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Törvényi és egyedi könyvelési határidők generálása a cégek adózási profilja (ÁFA, járulék, KATA/KIVA) alapján. |
| [`accounty-check-deadlines`](../../supabase/functions/accounty-check-deadlines/index.ts) | ❌ Nyilvános / Belső | pg_cron (reggeli futás) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Közeledő és lejárt adóügyi határidők figyelése, automatikus riasztások küldése a felelős könyvelőknek. |
| [`accounty-generate-xml`](../../supabase/functions/accounty-generate-xml/index.ts) | ❌ Nyilvános / Belső | Frontend (FilingsTab) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Hivatalos ÁNYK és ONYA kompatibilis XML állományok (08 bérbevallás, ÁFA bevallás) szabványos generálása (A-080). |
| [`accounty-ai-phone`](../../supabase/functions/accounty-ai-phone/index.ts) | ❌ Nyilvános / Belső | Twilio / Webhook | `OPENAI_API_KEY, SUPABASE_URL` | AI telefonos asszisztens hanghívások fogadására és ügyféligények automatikus jegyzetelésére. |
| [`accounty-ai-chat`](../../supabase/functions/accounty-ai-chat/index.ts) | ❌ Nyilvános / Belső | Frontend (AccountyAiChatModal) | `OPENAI_API_KEY / ANTHROPIC_API_KEY, SUPABASE_URL` | eaisyBooks intelligens AI könyvelői csevegő asszisztens (ügyféladatok, adószabályok kontextuális megválaszolása). |
| [`accounty-ai-categorize`](../../supabase/functions/accounty-ai-categorize/index.ts) | ❌ Nyilvános / Belső | eaisyBooks Dokumentumtár | `OPENAI_API_KEY, SUPABASE_URL` | Feltöltött egyéb ügyféldokumentumok (szerződések, határozatok, igazolások) automatikus AI osztályozása. |
| [`accounty-ai-depreciation`](../../supabase/functions/accounty-ai-depreciation/index.ts) | ❌ Nyilvános / Belső | Tárgyi Eszköz Modul | `OPENAI_API_KEY, SUPABASE_URL` | Tárgyi eszközök leírási kulcsának és maradványértékének javaslata a számviteli törvény és TAO alapján. |
| [`send-accounty-notification`](../../supabase/functions/send-accounty-notification/index.ts) | ❌ Nyilvános / Belső | eaisyBooks Rendszermag | `RESEND_API_KEY, SUPABASE_URL` | Dual-mode email értesítő: könyvelői és ügyfél kapcsolattartói értesítések küldése hiányokról és jóváhagyásokról (A-030). |
| [`send-web-push`](../../supabase/functions/send-web-push/index.ts) | ❌ Nyilvános / Belső | eaisyBooks Push Motor | `VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, SUPABASE_URL` | Böngészős Web Push értesítések küldése könyvelőknek és ügyfeleknek sürgős feladatok esetén (A-032). |
| [`send-accounty-digest`](../../supabase/functions/send-accounty-digest/index.ts) | ❌ Nyilvános / Belső | pg_cron (óránkénti vizsgálat) | `RESEND_API_KEY, SUPABASE_URL` | Napi/heti összesítő értesítő email (Digest) kiküldése könyvelőknek, elkerülve az értesítés-dömpinget (A-034). |
| [`validate-partner-code`](../../supabase/functions/validate-partner-code/index.ts) | ❌ Nyilvános / Belső | Frontend (JoinCompanyAsAccountantPage) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Könyvelői meghívó kód (share_token) ellenőrzése és cégadatok megjelenítése regisztráció előtt. |
| [`join-company-as-accountant`](../../supabase/functions/join-company-as-accountant/index.ts) | ❌ Nyilvános / Belső | Frontend (JoinCompanyAsAccountantPage) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Könyvelő-ügyfél összerendelés létrehozása az `accounty_assignments` táblában és hozzáférés biztosítása. |

---

## 8. 🔗 Nylas Email Integráció (2 db)

> Nylas OAuth flow indítása és visszahívások kezelése automatikus levelezés-integrációhoz.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`nylas-auth`](../../supabase/functions/nylas-auth/index.ts) | ✅ Kötelező | Frontend (EmailSettingsTab) | `NYLAS_CLIENT_ID, NYLAS_API_KEY, SUPABASE_URL` | Nylas OAuth hitelesítési folyamat indítása egyedi céges email fiók bekötéséhez. |
| [`nylas-callback`](../../supabase/functions/nylas-callback/index.ts) | ❌ Nyilvános / Belső | Nylas OAuth Szerver (HTTP redirect) | `NYLAS_CLIENT_ID, NYLAS_API_KEY, SUPABASE_URL` | OAuth hozzáférési token fogadása, validálása és mentése a `nylas_tokens` táblába. |

---

## 9. 🛠️ Management, Üzemeltetés & AI Segédek (8 db)

> Rendszerüzemeltetés, support admin megszemélyesítés, GDPR export, takarítás és céges AI leírásgenerálás.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`management-stats`](../../supabase/functions/management-stats/index.ts) | ❌ Nyilvános / Belső | Frontend (Management Dashboard) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Központi adminisztrációs API — 14 moduláris action (cégek, userek, jogosultságok, hibák, worker állapot, PGMQ retry, A-077). |
| [`impersonate-company`](../../supabase/functions/impersonate-company/index.ts) | ✅ Kötelező | Frontend (Management / Support Admin) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Ideiglenes support admin megszemélyesítés indítása és leállítása auditált időkorláttal (A-026). |
| [`export-user-data`](../../supabase/functions/export-user-data/index.ts) | ✅ Kötelező | Frontend (Settings / Privacy) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | GDPR adathordozhatósági export generálása a felhasználó összes számlájával, tranzakciójával és naplóbejegyzésével ZIP formátumban. |
| [`get-invoice-image-url`](../../supabase/functions/get-invoice-image-url/index.ts) | ❌ Nyilvános / Belső | Frontend (InvoiceImageViewer) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Időkorlátos, biztonságos Signed URL generálása a védett Supabase Storage számlaképekhez. |
| [`check-missing-invoices`](../../supabase/functions/check-missing-invoices/index.ts) | ❌ Nyilvános / Belső | pg_cron (időzített ellenőrzés) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Banki kifizetésekhez tartozó hiányzó számlák ellenőrzése és riasztások sorba állítása. |
| [`check-payment-deadlines`](../../supabase/functions/check-payment-deadlines/index.ts) | ❌ Nyilvános / Belső | pg_cron (időzített ellenőrzés) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Közeledő számlafizetési határidők ellenőrzése és figyelmeztető feladatok ütemezése. |
| [`sandbox-storage-cleanup`](../../supabase/functions/sandbox-storage-cleanup/index.ts) | ❌ Nyilvános / Belső | pg_cron / Management karbantartás | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | SANDBOX tesztcégek ideiglenes mock számlaképeinek és fájljainak automatikus törlése a Storage-ból. |
| [`generate-company-description`](../../supabase/functions/generate-company-description/index.ts) | ✅ Kötelező | Frontend (CompanySettings / Onboarding) | `DEEPSEEK_API_KEY / OPENAI_API_KEY, SUPABASE_URL` | Cég tevékenységének és gazdasági profiljának intelligens AI leírásgenerálása TEÁOR kód és cégnév alapján. |

---

## 10. 🔌 Külső Integrációk & API (1 db)

> Harmadik felek és külső rendszerek biztonságos integrációs végpontja.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`openclaw-api`](../../supabase/functions/openclaw-api/index.ts) | ❌ Nyilvános / Belső | Külső integrációs kliensek (OpenClaw) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Szigorúan korlátozott, olvasási jogú REST API végpont SHA-256 hash-elt API kulcs hitelesítéssel (`api_keys` tábla). |

---

## 11. 🗓️ MNB & Jogi Frissítések (2 db)

> Külső hatósági adatok és árfolyamok automatikus letöltése.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`fetch-mnb-rates`](../../supabase/functions/fetch-mnb-rates/index.ts) | ❌ Nyilvános / Belső | pg_cron / Dashboard auto-trigger | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Magyar Nemzeti Bank hivatalos deviza középárfolyamainak lekérdezése az MNB SOAP webszolgáltatásból és mentése a `daily_exchange_rates` táblába. |
| [`fetch-legal-updates`](../../supabase/functions/fetch-legal-updates/index.ts) | ❌ Nyilvános / Belső | pg_cron (heti frissítés) | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Számviteli és adójogi jogszabályváltozások automatikus letöltése és integrálása az `accounty_legal_updates` hírfolyamba. |

---

## 12. 🚚 Szállítmányozás / HRTSPED (1 db)

> Logisztikai és fuvarozási modul integrációk.

| Edge Function | JWT Auth | Meghívó Réteg | Szükséges Környezeti Változók | Leírás és Üzleti Szerepkör |
|---|:---:|---|---|---|
| [`shipment-retroactive-match`](../../supabase/functions/shipment-retroactive-match/index.ts) | ❌ Nyilvános / Belső | Frontend (ShipmentsPage) / Import zárás | `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY` | Fuvarpozíciók és számlák tömeges, retroaktív párosítása Excel/CSV import után. |

---

## Jogosultsági és JWT Összefoglaló

| Típus | Darabszám | Szabályzat |
|---|:---:|---|
| `verify_jwt: true` | 14 | Közvetlenül a bejelentkezett felhasználó böngészőjéből, érvényes Bearer JWT token kíséretében hívható végpontok. |
| `verify_jwt: false` | 45 | Időzített feladatok (`pg_cron`), külső webhookok (Mailgun, Nylas, Twilio), admin műveletek (`service_role`), API kulcsos hívások, vagy bejelentkezés előtti publikus végpontok (pl. jelszó-visszaállítás, email ellenőrzés). |

---

> ℹ️ *A katalógus a `supabase/functions/` könyvtár tényleges forráskódjának és konfigurációinak elemzése alapján készült. Új Edge Function bevezetése előtt kövesse az [A-005](./decisions/A-005-edge-functions.md) és [A-101](./decisions/A-101-direct-script-automation-restriction.md) irányelveit.*