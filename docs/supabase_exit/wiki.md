# Technikai Fogalomtár — Supabase Exit Strategy

Az alábbi fogalmak mind előfordulnak az eaisybill Supabase exit dokumentációjában. Mindegyiknél leírjuk: mi ez, mire jó, és hol használjuk jelenleg.

---

## Supabase

**Mi ez?**  
Nyílt forráskódú Backend-as-a-Service (BaaS) platform. Gyakorlatilag egy „Firebase alternatíva", de PostgreSQL adatbázisra épül, nem NoSQL-re. A Supabase cég managed cloud szolgáltatásként kínálja, de self-hosted-ként is futtatható.

**Mire jó?**  
Egy helyen biztosít adatbázist, authentikációt, fájltárolást, serverless funkciókat, valós idejű szinkronizációt és REST API-t — anélkül, hogy saját backend szervert kellene építenünk.

**Hol használjuk?**  
Az eaisybill teljes backend infrastruktúrája Supabase Cloud-on fut. A frontend React alkalmazás a `@supabase/supabase-js` kliens SDK-n keresztül kommunikál vele. A konfigurációt a `src/integrations/supabase/client.ts` tartalmazza.

---

## GoTrue

**Mi ez?**  
A Supabase által használt authentikációs szerver. Eredetileg a Netlify fejlesztette, a Supabase fork-olta és tovább fejlesztette. Ez kezeli a felhasználók regisztrációját, bejelentkezését, jelszókezelését és session-jeit.

**Mire jó?**  
JWT (JSON Web Token) alapú hitelesítést biztosít. Támogatja az email/jelszó, OAuth (Google, GitHub, stb.), magic link és phone auth módszereket. A kibocsátott JWT tokeneket a PostgREST és a Realtime is felhasználja a jogosultság-ellenőrzéshez.

**Hol használjuk?**  
- `src/contexts/AuthContext.tsx` — a központi auth provider, ami a `supabase.auth.*` API-kon keresztül kommunikál a GoTrue-val
- `src/pages/Auth.tsx` — login, signup, forgot password UI
- `src/pages/AuthCallback.tsx` — Google OAuth callback
- `src/hooks/useSessionGuard.ts` — session lejárat és idle kezelés
- Edge Functions-ben: `auth.getUser(token)` a JWT validáláshoz

---

## JWT (JSON Web Token)

**Mi ez?**  
Egy nyílt szabvány (RFC 7519) kompakt, önleíró tokenekhez. Három részből áll: header, payload (claims) és signature. A payload tartalmazza a felhasználó adatait (ID, email, role, stb.).

**Mire jó?**  
Állapotmentes (stateless) hitelesítés: a szerver nem tart nyilván session-öket, hanem a token maga hordozza a jogosultsági információt. Minden API kéréshez az `Authorization: Bearer <token>` headerben küldjük.

**Hol használjuk?**  
- A GoTrue kibocsátja, a frontend a `localStorage`-ban tárolja (`sb-vxxgvdlqvvchtlmqnrqf-auth-token` kulcs alatt)
- A PostgREST a JWT `sub` claimjéből határozza meg az `auth.uid()` értékét az RLS policy-khoz
- Az Edge Functions a `req.headers.get('Authorization')` headerből olvassák ki és `auth.getUser(token)`-nel validálják
- A `useSessionGuard` hook 4 órás abszolút és 28 perces idle lejáratot érvényesít

---

## Edge Functions

**Mi ez?**  
Serverless (szerver nélküli) függvények, amelyek a Supabase infrastruktúrán futnak. Deno runtime-ot használnak (nem Node.js-t). Minden függvény egy HTTP kérést kap és egy HTTP választ ad vissza.

**Mire jó?**  
Olyan backend logikát futtatunk bennük, ami nem fér bele a PostgREST-be vagy az RLS-be: külső API-hívások (NAV, Mailgun, Nylas), email küldés, credential titkosítás, PGMQ queue-ba írás, admin user management.

**Hol használjuk?**  
42 db Edge Function a `supabase/functions/` mappában. A frontend a `supabase.functions.invoke('function-name', { body: {...} })` hívással éri el őket. Részletes katalógus: `02-edge-functions-catalog.md`.

---

## Deno

**Mi ez?**  
JavaScript/TypeScript runtime (mint a Node.js), amit Ryan Dahl készített (a Node.js eredeti alkotója). URL-alapú import-okat használ npm csomagok helyett, és Web Standard API-kra épül (fetch, Request, Response, crypto.subtle).

**Mire jó?**  
A Supabase Edge Functions ezen a runtime-on futnak. Előnyei: beépített TypeScript támogatás, biztonságos sandbox, Web Standard kompatibilitás. Hátránya: nem kompatibilis a Node.js npm ökoszisztémával.

**Hol használjuk?**  
Minden Edge Function Deno-specifikus kódot tartalmaz:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";  // Deno import
Deno.serve(async (req) => { ... });  // Deno API
const url = Deno.env.get('SUPABASE_URL');  // Deno env (nem process.env)
```

---

## PostgREST

**Mi ez?**  
Önálló webszerver, ami egy PostgreSQL adatbázist automatikusan REST API-vá alakít. A Supabase ezt használja a `supabase.from('table').select()` stílusú lekérdezésekhez.

**Mire jó?**  
Nem kell kézzel REST endpoint-okat írni — a PostgREST automatikusan generálja a CRUD műveleteket az adatbázis tábláiból. Támogatja a szűrést, rendezést, lapozást, joinokat és az RLS-t is.

**Hol használjuk?**  
- 20+ frontend fájlban `supabase.from('invoices').select('*').eq('company_id', id)` formában
- Hook-okban: `useDashboardData`, `useInvoiceData`, `useKintlevoData`, `useSalaryData`, `useTickets`, stb.
- A PostgREST a Supabase URL-en a `/rest/v1/` útvonalon érhető el

---

## RLS (Row Level Security)

**Mi ez?**  
PostgreSQL beépített biztonsági funkció, ami sor szintű hozzáférés-szabályozást tesz lehetővé. Minden tábla rendelkezhet policy-kkel, amelyek meghatározzák, hogy egy adott felhasználó mely sorokat láthatja/módosíthatja.

**Mire jó?**  
A frontend közvetlenül kérdezhet az adatbázisból, mert az RLS automatikusan kiszűri azokat a sorokat, amelyekhez az aktuális felhasználónak nincs joga. Ez kiváltja a hagyományos backend middleware-t.

**Hol használjuk?**  
172 SQL migrációs fájlban, 365+ helyen. Tipikus minta:
```sql
CREATE POLICY "Users see own invoices" ON invoices
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = (SELECT auth.uid())
    )
  );
```
Az `auth.uid()` a GoTrue JWT-ből olvassa ki a felhasználó ID-ját — ez a fő Supabase lock-in pont az RLS-ben.

---

## `auth.uid()`

**Mi ez?**  
Supabase/GoTrue-specifikus SQL függvény, ami visszaadja az aktuálisan authentikált felhasználó UUID-jét. A PostgREST a beérkező JWT token `sub` claimjéből állítja be ezt az értéket.

**Mire jó?**  
Az RLS policy-k erre hivatkoznak, hogy meghatározzák, ki mihez fér hozzá. Például: „egy felhasználó csak a saját cégéhez tartozó számlákat lássa".

**Hol használjuk?**  
365+ SQL sorban az RLS policy-kban. Az initplan-optimalizált változat `(SELECT auth.uid())` formában szerepel, ami megakadályozza, hogy a PostgreSQL minden sornál újra kiértékelje.

---

## `auth.users`

**Mi ez?**  
A Supabase GoTrue által kezelt tábla az `auth` sémában, ami az összes regisztrált felhasználót tartalmazza (id, email, encrypted_password, user_metadata, stb.). Ez nem a `public` sémában van, hanem a protected `auth` sémában.

**Mire jó?**  
A felhasználói adatok master táblája. Más táblák foreign key-jel hivatkoznak rá (`REFERENCES auth.users(id)`), ami biztosítja az adatintegritást.

**Hol használjuk?**  
~10 tábla tartalmaz FK hivatkozást:
- `accounty_assignments.accountant_user_id`
- `accounty_todos.completed_by`
- `accounty_missing_items.ignored_by`, `resolved_by`
- `accounty_notes.created_by`
- `accounty_audit_log.user_id`
- `accounty_messages.sender_user_id`
- `vat_returns.user_id`

---

## Supabase Storage

**Mi ez?**  
S3-kompatibilis fájltárolási szolgáltatás, amit a Supabase biztosít. A fájlok „bucket"-ekben (vödrökben) vannak szervezve, és RLS policy-kkal védettek.

**Mire jó?**  
Fájlok feltöltése (számlák PDF-jei, bankszámlakivonatok, riportok, bérjegyzékek, profilképek), letöltése és törlése. A `getPublicUrl()` metódus publikus URL-t generál, míg a `createSignedUrl()` időkorlátos hozzáférést ad.

**Hol használjuk?**  
9 bucket, 22+ API hívás 8 frontend fájlban:
- `ManualUpload.tsx` — számla/bank/tranzakció/riport feltöltés (12 hívás)
- `AssetDetailPanel.tsx` — eszköz dokumentumok
- `InvoiceFilesDialog.tsx`, `ReportFilesDialog.tsx` — fájl törlés
- `SalaryFilesTable.tsx` — bérjegyzék törlés
- `upload-ticket-image.ts` — ticket csatolmány feltöltés
- `get-invoice-image-url` Edge Function — signed URL generálás

---

## Supabase Realtime

**Mi ez?**  
WebSocket-alapú szolgáltatás, ami valós időben értesíti a klienst az adatbázis változásairól. A PostgreSQL WAL (Write-Ahead Log) streamet figyeli és a `supabase_realtime` publication-höz rendelt táblákon reagál.

**Mire jó?**  
A felhasználó azonnal látja, ha egy számla feldolgozása befejeződött, új tranzakció érkezett, vagy egy kolléga módosított valamit — anélkül, hogy az oldalt frissítenie kellene. Toast értesítéseket jelenít meg és automatikusan frissíti a React Query cache-t.

**Hol használjuk?**  
3 csatorna, 15 figyelt tábla:
- `LiveNotificationProvider.tsx` (497 sor) — a fő realtime hub, 15 táblát figyel, debounced cache invalidációval és tab visibility reconnect logikával
- `GeneralLedgerPage.tsx` — AI classification status figyelés
- `useTickets.ts` — ticket comment badge frissítés

---

## WAL (Write-Ahead Log)

**Mi ez?**  
PostgreSQL belső mechanizmus: minden adatmódosítás (INSERT, UPDATE, DELETE) előbb egy log fájlba kerül, és csak utána íródik a tényleges táblába. Ez biztosítja az adatvesztés-mentességet crash esetén.

**Mire jó?**  
A Supabase Realtime erre épül: a WAL stream-ből olvassa ki a változásokat és továbbítja a klienseknek WebSocket-en keresztül. A `supabase_realtime` publication határozza meg, mely táblák változásait streameli.

**Hol használjuk?**  
SQL migrációkban táblákat adunk a publication-höz:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE nav_invoices;
-- ... összesen 8 tábla
```

---

## PGMQ (Postgres Message Queue)

**Mi ez?**  
PostgreSQL extension, ami message queue funkcionalitást ad az adatbázisnak — hasonlóan az AWS SQS-hez vagy a RabbitMQ-hoz, de közvetlenül a PostgreSQL-ben fut.

**Mire jó?**  
Aszinkron feladatkezelés: a frontend vagy egy Edge Function berak egy üzenetet a queue-ba, és a Python worker feldolgozza. Ez elválasztja a „feladat beérkezését" a „feladat végrehajtásától".

**Hol használjuk?**  
- 5 trigger Edge Function (trigger-invoice-processing, trigger-transaction-processing, trigger-nav-categorization, trigger-bank-statement-processing, trigger-salary-processing) küld üzeneteket a queue-ba
- A Python worker (`d:\ThinkAI\Visibill\worker`) folyamatosan figyeli a queue-t és dolgozza fel a feladatokat
- A GL classification is PGMQ-n keresztül indul (`gl_upload_notifications` tábla insert → DB trigger → PGMQ)

---

## pg_cron

**Mi ez?**  
PostgreSQL extension, ami cron-szerű időzített feladatfuttatást biztosít közvetlenül az adatbázisban. A standard Unix cron szintaxist használja.

**Mire jó?**  
Ütemezett feladatok automatikus indítása: NAV szinkronizáció, hiányzó számla detektálás, határidő generálás — mind fix időközönként futnak anélkül, hogy külső schedulert kellene üzemeltetni.

**Hol használjuk?**  
4 ütemezett job:
```sql
cron.schedule('nav-auto-sync-all', '0 */6 * * *', ...);           -- 6 óránként
cron.schedule('accounty-auto-sync', '0 */4 * * *', ...);          -- 4 óránként
cron.schedule('accounty-detect-missing', '0 6 * * *', ...);       -- reggel 6-kor
cron.schedule('accounty-generate-deadlines', '0 7 1 * *', ...);   -- hó 1. reggel 7
```

---

## RPC (Remote Procedure Call)

**Mi ez?**  
A Supabase lehetőséget ad PostgreSQL `FUNCTION`-ök meghívására a frontendből a `supabase.rpc('function_name', { params })` szintaxissal. A háttérben a PostgREST `/rpc/function_name` endpointját hívja.

**Mire jó?**  
Komplex lekérdezések és üzleti logika, amit nem lehet egyszerű CRUD-dal megoldani: aggregációk, riport generálás, batch műveletek. A PL/pgSQL függvények `SECURITY DEFINER` módban RLS-t is megkerülhetik.

**Hol használjuk?**  
18 különböző RPC, 10 frontend fájlban, 21+ hívás:
- Dashboard: `get_invoice_aggregates`, `get_nav_invoice_aggregates`, `get_petty_cash_balance`
- Főkönyv: `get_gl_balances`, `get_gl_categorized_items`, `override_gl_classifications_batch`
- P&L: `get_pnl_report`, `save_pnl_mappings`
- Mérleg: `get_bs_report`, `save_bs_mappings`
- ÁFA: `calculate_vat_return`, `seed_default_vat_codes`
- Éves zárlat: `freeze_annual_data`, `validate_annual_report`

---

## Supavisor (korábban PgBouncer)

**Mi ez?**  
A Supabase saját fejlesztésű connection pooler-je (Elixir-ben írva), ami a PgBouncer-t váltotta le. Kezeli a PostgreSQL kapcsolatok újrafelhasználását, hogy ne merüljön ki a korlátozott számú adatbázis-kapcsolat.

**Mire jó?**  
A PostgreSQL-nek korlátozott számú egyidejű kapcsolata van (a Micro plan-nál 60). A Supavisor „pool"-olja ezeket: sok kliens kérését kevés valós DB kapcsolaton keresztül szolgálja ki. A 6543-as porton érhető el (szemben az 5432-es direkt porttal).

**Hol használjuk?**  
Közvetetten — a Supabase infrastruktúra automatikusan alkalmazza. A Python worker a `supabase-py` SDK-n keresztül csatlakozik, ami a Supavisor-on megy át. A PostgREST és a Realtime szintén Supavisor-on keresztül érik el a DB-t.

---

## Service Role Key

**Mi ez?**  
Egy speciális Supabase API kulcs, ami megkerüli az RLS-t és teljes admin hozzáférést ad az adatbázishoz. A „service_role" JWT claim-mel rendelkezik, ami a PostgREST-nek jelzi, hogy ne alkalmazza az RLS policy-kat.

**Mire jó?**  
Backend-oldali műveletek, ahol a RLS nem releváns: Edge Functions-ben worker szintű DB hozzáférés, user management (admin.createUser), automatikus adatfeldolgozás.

**Hol használjuk?**  
- Szinte minden Edge Function-ben: `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
- A Python worker-ben a DB kapcsolathoz
- A pg_cron job-ok HTTP hívásaiban az Edge Functions meghívásához
- **Soha nem a frontendben** — ott az anon key van

---

## Anon Key (Publishable Key)

**Mi ez?**  
A Supabase publikusan megosztható API kulcsa. Korlátozott jogosultsággal rendelkezik: csak olyan adatokhoz fér hozzá, amiket az RLS policy-k engedélyeznek az adott felhasználónak.

**Mire jó?**  
A frontend ezzel a kulccsal inicializálja a Supabase klienst. Biztonságos a böngészőben tárolni, mert önmagában nem ad admin hozzáférést — az RLS védi az adatokat.

**Hol használjuk?**  
- `src/integrations/supabase/client.ts` — `SUPABASE_PUBLISHABLE_KEY` konstansként
- `src/pages/Auth.tsx` — hardcoded fallback az email verification-höz (ez egy ismert tech debt)

---

## OAuth2 / PKCE

**Mi ez?**  
**OAuth2** egy nyílt szabvány a delegált hitelesítéshez (pl. „Bejelentkezés Google-lel"). A **PKCE** (Proof Key for Code Exchange) az OAuth2 egy biztonsági kiterjesztése, ami védi a public client-eket (SPA, mobil app) a code interception támadások ellen.

**Mire jó?**  
A felhasználó a Google fiókjával tud bejelentkezni anélkül, hogy jelszót adna meg az eaisybill-nek. A PKCE biztosítja, hogy az authorization code-ot csak az eredeti kérő (a mi alkalmazásunk) használhassa fel.

**Hol használjuk?**  
- `src/pages/Auth.tsx` — `supabase.auth.signInWithOAuth({ provider: 'google' })`
- `src/pages/AuthCallback.tsx` — `supabase.auth.exchangeCodeForSession(code)` — ez a PKCE code exchange lépése

---

## Refresh Token

**Mi ez?**  
Egy hosszú élettartamú token, amit az access token lejárta után lehet használni új access token kérésére — anélkül, hogy a felhasználónak újra be kellene jelentkeznie.

**Mire jó?**  
Az access token rövid élettartamú (tipikusan 1 óra a Supabase-nél). A refresh token-nel csendben, a háttérben lehet újat kérni. A GoTrue automatikusan rotálja (cseréli) a refresh tokent minden használatnál, ami biztonsági feature.

**Hol használjuk?**  
- `AuthContext.tsx` — `supabase.auth.getSession()` automatikusan refresheli, ha szükséges
- `useSessionGuard.ts` — `supabase.auth.refreshSession()` a „Maradok aktív" gombra kattintáskor
- Az `autoRefreshToken: true` beállítás a kliensben automatikus háttér-refresh-et biztosít

---

## onAuthStateChange

**Mi ez?**  
GoTrue-specifikus event listener, ami értesít az auth állapot változásairól. Az események: `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `PASSWORD_RECOVERY`, `USER_UPDATED`.

**Mire jó?**  
A React alkalmazás ennek segítségével reagál az auth változásokra: ha a user bejelentkezik, kijelentkezik, vagy a token megújul, az `AuthContext` frissíti a state-et és a UI automatikusan frissül.

**Hol használjuk?**  
- `src/contexts/AuthContext.tsx` — a fő subscriber, ami az `user` és `session` state-et kezeli
- `src/pages/ResetPassword.tsx` — a `PASSWORD_RECOVERY` event figyelése

---

## Magic Link

**Mi ez?**  
Egy egyszer használatos, e-mailben küldött URL, amire kattintva a felhasználó automatikusan bejelentkezik vagy elvégez egy műveletet (pl. jelszó visszaállítás, email megerősítés) anélkül, hogy jelszót kellene megadnia.

**Mire jó?**  
Jelszó-visszaállítás és email-cím megerősítés. A Supabase GoTrue generálja a linkeket és kezeli a token validációt.

**Hol használjuk?**  
- `Auth.tsx` — `supabase.auth.resetPasswordForEmail(email, { redirectTo })` — jelszó-visszaállító link küldése
- `verify-email` Edge Function — saját email verification flow

---

## Bucket

**Mi ez?**  
A Supabase Storage-ban egy logikai konténer a fájlok számára — az AWS S3 bucket koncepciója. Lehet publikus (bárki eléri) vagy privát (csak RLS-en átmenő felhasználók).

**Mire jó?**  
A fájlok szervezése és a hozzáférés szabályozása. Minden bucket-nek külön RLS policy-jai lehetnek.

**Hol használjuk?**  
9 bucket: `invoice-uploads`, `bank-statements`, `transactions`, `report-uploads`, `salaries`, `asset-documents`, `ticket-attachments`, `avatars`, `szla_image`

---

## Signed URL

**Mi ez?**  
Egy időkorlátos, titkosított aláírással ellátott URL, ami átmeneti hozzáférést ad egy privát fájlhoz. A lejárat után az URL érvénytelenné válik.

**Mire jó?**  
Privát számlakép-ek megjelenítése a böngészőben anélkül, hogy a bucket publikus legyen. A signed URL-ben benne van a lejárati idő és a kriptográfiai aláírás.

**Hol használjuk?**  
- `get-invoice-image-url` Edge Function — a számlakép (szla_image bucket) megjelenítéséhez signed URL-t generál
- A frontend az `InvoiceImagePreview.tsx` komponensben használja

---

## Hono

**Mi ez?**  
Ultrakönnyű, Web Standard-kompatibilis TypeScript web framework. Futhat Node.js-en, Deno-n, Cloudflare Workers-ön, Bun-on — bármilyen JavaScript runtime-on.

**Mire jó?**  
A migrációs tervben az Edge Functions Node.js-re portolásának célkeretrendszere. A `Deno.serve()` → `app.post('/api/...')` csere a legkisebb kódváltoztatással jár, mert a Hono is Web Standard Request/Response objektumokat használ.

**Hol használjuk?**  
Még nem — a `03-migration-plan.md`-ben javasolt jövőbeli technológia.

---

## Drizzle / Prisma / Kysely

**Mi ez?**  
TypeScript ORM-ek (Object-Relational Mapper-ek), amelyek type-safe adatbázis-lekérdezéseket tesznek lehetővé. Drizzle a legkönnyebb, Prisma a legismertebb, Kysely a leginkább SQL-szerű.

**Mire jó?**  
A `supabase.from('table').select()` PostgREST query builder helyettesítése, ha elhagyjuk a Supabase-t. Mindegyik közvetlenül PostgreSQL-hez csatlakozik és SQL-t generál.

**Hol használjuk?**  
Még nem — a `03-migration-plan.md`-ben javasolt lehetséges alternatívák a PostgREST kiváltására.

---

## Keycloak / Auth0

**Mi ez?**  
**Keycloak**: nyílt forráskódú, self-hosted Identity and Access Management (IAM) megoldás a Red Hat-tól. **Auth0**: managed (fizetős) auth szolgáltatás az Okta-tól.

**Mire jó?**  
A GoTrue kiváltása, ha elhagyjuk a Supabase Auth-ot. Mindkettő támogatja az OAuth2, OIDC, SAML, SSO és felhasználókezelési funkciókat.

**Hol használjuk?**  
Még nem — a `03-migration-plan.md`-ben javasolt jövőbeli alternatívák. A döntési kérdés: self-hosted (Keycloak, ingyenes) vs. managed (Auth0, fizetős de egyszerűbb).

---

## TanStack Query (React Query)

**Mi ez?**  
React library az aszinkron adatlekérdezések kezeléséhez. Automatikusan cache-eli az API válaszokat, kezeli a loading/error állapotokat, és támogatja a stale-while-revalidate mintát.

**Mire jó?**  
A Supabase-ből érkező adatok cache-elése és frissítése. A Realtime események `queryClient.invalidateQueries()` hívással jelzik, hogy a cache elavult — erre a TanStack Query automatikusan újra lekérdezi az adatot.

**Hol használjuk?**  
Az összes `useQuery` és `useMutation` hookunkban (useDashboardData, useInvoiceData, useTickets, stb.). A `LiveNotificationProvider.tsx` 497 soros kódja lényegében egy Supabase Realtime → TanStack Query cache invalidáció bridge.

---

## CORS (Cross-Origin Resource Sharing)

**Mi ez?**  
Böngésző biztonsági mechanizmus, ami szabályozza, hogy egy weboldal milyen más domain-ekre küldhet HTTP kéréseket. A szerver `Access-Control-Allow-Origin` headerrel engedélyezi a hozzáférést.

**Mire jó?**  
Az `app.visibill.hu` frontendnek engedélyezni kell, hogy a `vxxgvdlqvvchtlmqnrqf.supabase.co` URL-re hívásokat tegyen. Migrációnál az új backend URL-eket is CORS-engedélyezni kell.

**Hol használjuk?**  
Minden Edge Function tartalmaz egy `corsHeaders` objektumot:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

---

## Mailgun

**Mi ez?**  
Email küldő SaaS szolgáltatás, ami HTTP API-n keresztül küldi el a leveleket. Nem Supabase-specifikus — bármelyik backendből hívható.

**Mire jó?**  
Tranzakciós email-ek küldése: üdvözlő email, fizetési felszólítás, heti/havi összefoglaló, számla értesítés, email megerősítés.

**Hol használjuk?**  
8 Edge Function: `send-email`, `send-welcome-email`, `send-notification-email`, `send-dunning-email`, `send-accounty-email`, `send-invoice-notification`, `send-monthly-summary`, `send-weekly-summary`. Plusz: `create-email-alias` és `delete-email-alias` az email alias kezeléshez.

---

## NAV Online Számla API

**Mi ez?**  
A magyar Nemzeti Adó- és Vámhivatal (NAV) online számla-adatszolgáltatási rendszerének programozói felülete (API). XML-alapú, v3 verziójú, SHA-512 és SHA3-512 kriptográfiai aláírásokat használ.

**Mire jó?**  
Számlák automatikus letöltése a NAV-tól: a felhasználó NAV credential-jaival az eaisybill lekérdezi a kimenő és bejövő számlákat, validálja a hitelesítő adatokat, és szinkronizálja az adatbázisba.

**Hol használjuk?**  
7 Edge Function: `nav-token` (473 sor — credential validáció + token exchange), `nav-sync`, `nav-auto-sync`, `nav-query-outbound-invoices`, `nav-tax-profile-sync`, `query-nav-invoices`, `save-credentials`.

---

## SECURITY DEFINER

**Mi ez?**  
PostgreSQL funkció attribútum, ami azt jelenti, hogy a függvény a **létrehozó** jogosultságaival fut, nem a **hívó** felhasználóéval. Hasonló a Unix SUID bit-hez.

**Mire jó?**  
RLS-védett adatokhoz való hozzáférés olyankor, amikor a hívó jogosultsága nem elegendő — például egy trigger függvény, ami service-szinten módosít adatokat, vagy egy RPC, ami admin műveletet végez.

**Hol használjuk?**  
Több RPC és trigger függvényben a migrációkban. Biztonsági audit szempontból fontos, hogy a SECURITY DEFINER függvényekhez ne legyen `anon` role hozzáférés (ezt a `20260608_revoke_anon_security_definer.sql` migráció kezeli).

---

## Vendor Lock-in

**Mi ez?**  
Az a helyzet, amikor egy technológia vagy szolgáltató olyan mértékben beépül a rendszerbe, hogy a váltás költséges, kockázatos vagy időigényes lesz. A lock-in lehet technológiai (specifikus API-k), adatszintű (adatformátumok) vagy szerződéses.

**Mire jó?**  
A fogalom felismerése és mérése segít tudatos döntéseket hozni: melyik lock-in-t fogadjuk el (mert megéri), és melyiket kerüljük el (mert drága lenne a váltás).

**Hol használjuk?**  
Ennek az egész dokumentáció-csomagnak ez a témája. Az eaisybill-nél a fő lock-in pontok: GoTrue Auth (🔴), Deno Edge Functions (🔴), Storage (🟡), Realtime (🟡), PostgREST (🟡). A PostgreSQL + RLS + PGMQ + pg_cron viszont lock-in-mentes (🟢).
