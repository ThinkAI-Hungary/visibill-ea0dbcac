# A-117: Hivatalos Ügyfél REST API (Customer API), Többcéges API Kulcs Kezelés és Auditált M2M Átjáró

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** Architecture / API / Security / Multi-Tenancy / Settings  
**Érintett komponensek:** `supabase/functions/customer-api/index.ts`, `ApiKeysCard.tsx`, `SecuritySection.tsx`, `api_keys`, `api_request_logs`  
**Kapcsolódó döntések:** [A-101: Közvetlen Szkript-Automatizációk Letiltása](./A-101-direct-script-automation-restriction.md), [A-093: Atomi Cégbeállítások Upsert](./A-093-atomic-company-settings-upsert-and-partial-update-isolation.md), [BRD 030: API Hozzáférés](../../business/decisions/030-api-access.md), [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)

---

## Context

A platform korábbi biztonsági incidensének tanulságaként ([A-101](./A-101-direct-script-automation-restriction.md)) letiltásra került a böngészős felhasználói JWT tokenekkel történő közvetlen szkript-alapú PostgREST és Edge Function hívás (`checkAutomationShield` és `public.check_request`). 

Ügyfeleink (elsőként Mauroni Marco, aki 7 hazai gazdasági társaság és egyesület tulajdonosa) részéről felmerült a jogos igény, hogy programozottan, gép-gép (M2M) kapcsolaton keresztül kívánják elérni és naprakészen tartani a cégeik alapadatait (név, székhely, leírás, TEÁOR, adószám, ÁFA rendszer) és konfigurációs beállításait (munkaidő, adminisztrációs határidők, főkönyvi dátum alap).

A korábbi `openclaw-api` Edge Function egy belső, 120+ táblát lefedő read-only motor az AI ügynök számára, amely nem alkalmas külső ügyfél felé történő megnyitásra és nem rendelkezett írási/módosítási képességgel vagy szigorú mezőszintű üzleti validációval.

---

## Decision

### 1. Dedikált `customer-api` Supabase Edge Function
Létrehoztunk egy új, független, kifejezetten az ügyfelek M2M integrációira szabott Edge Function-t:
- **Végpont URL:** `https://<project-ref>.supabase.co/functions/v1/customer-api`
- **Hitelesítés:** `Authorization: Bearer vb_<40-hex-characters>` (SHA-256 hash lookup az adatbázisban, a nyers kulcs soha nem tárolódik).
- **Gateway Konfiguráció:** `verify_jwt: false` (mivel a Supabase Kong gateway nem tud külső API kulcsot validálni; az autentikációt a funkció az `authenticate_customer_api_key` RPC-n keresztül atomian végzi).
- **Kliens Védelem:** Nem alkalmazza a böngészős Origin/Referer szűrést, így cURL, Python, Node.js és ERP rendszerek zökkenőmentesen kommunikálhatnak vele.

### 2. Többcéges Hibrid API Kulcs Modell (`user_id` kapcsolat)
Az `api_keys` táblát kibővítettük a `user_id uuid REFERENCES auth.users(id)` mezővel és indexekkel.
- **Dinamikus hatáskör feloldás:** Ha a kulcshoz `user_id` tartozik, az `authenticate_customer_api_key` PostgreSQL függvény automatikusan feloldja az összes olyan céget (`accessible_company_ids`), ahol a felhasználó a `company_members` táblában `owner` vagy `admin` ranggal rendelkezik.
- **Eredmény:** Mauroni Marco egyetlen API kulccsal képes mind a 7 cégét kezelni, miközben idegen cég adatát szigorúan 403 Forbidden hibával elutasítja a rendszer.
- **Scope-ok:** Támogatott a `'read'` (csak olvasás) és a `'read_write'` (olvasás és módosítás) hatáskör.
- **Kulcs Visszavonás Jogosultság (`revoke_api_key` RPC):** A függvény támogatja a közvetlen kulcstulajdonos általi visszavonást (`user_id = auth.uid() OR created_by = auth.uid()`), így az ügyfelek hiba nélkül képesek deaktiválni a saját többcéges kulcsaikat is.

### 3. Támogatott Műveletek és Szigorú Mező-Whitelist
Az API kizárólag ellenőrzött, whitelistelt mezőket enged módosítani:
- `GET ?action=companies`: Elérhető cégek listája.
- `GET ?action=company&company_id=<uuid>`: Cég részletes adatai + beállításai + telephelyei + bankszámlái.
- `PATCH ?action=update_company&company_id=<uuid>`:
  - Engedélyezett mezők: `name`, `address`, `description`, `primary_teaor`, `tax_number` (magyar és EU adószám formátum-ellenőrzéssel: `/^(HU)?\d{8}-?[1-5]-?\d{2}$/i`), `vat_regime`, `vat_regime_effective_from`.
  - Tiltott / védett mezők: `id`, `owner_id`, `created_at`, `share_token`, `szamlazz_agent_key`.
- `PATCH ?action=update_settings&company_id=<uuid>`:
  - Engedélyezett mezők: `work_start_time`, `work_end_time`, `admin_deadline`, `monthly_working_hours`, `gl_date_basis`.
  - **Atomi PostgREST Upsert ([A-093](./A-093-atomic-company-settings-upsert-and-partial-update-isolation.md)):** `onConflict: 'company_id'` mentéssel, védve a párhuzamos hívások versenyhelyzeteitől.

### 4. Átfogó API Audit Napló (`api_request_logs`)
Létrehoztunk egy dedikált `public.api_request_logs` táblát indexekkel és RLS védelemmel:
- Minden beérkező API hívást naplóz: `api_key_id`, `user_id`, `company_id`, `endpoint`, `method`, `status_code`, `ip_address`, `user_agent`, `duration_ms`, `error_message`.
- **Részletes belső hibainfó (`_errorMessage`):** Az `error_message` mezőbe nem a generikus `Status 500` szöveg kerül, hanem a válaszhoz csatolt konkrét hibakód és hibaüzenet (`code: message (details)`), így a hívási naplókból közvetlenül és azonnal kiderül a hiba valódi gyökéroka.
- Hibák (401, 403, 400, 429, 500) és sikeres hívások (200) egyaránt ellenőrizhetők és visszakövethetők.

### 5. Webes Kulcskezelő Felület (`ApiKeysCard.tsx`)
A `Beállítások` (`Settings.tsx`) felületen, a `Biztonság` szekcióban elhelyezésre került a modern API kulcs kezelő kártya:
- Kulcsok listája (név, prefix, scope, hatáskör, létrehozás, utolsó használat, aktív/visszavont státusz).
- Új kulcs generálása Dialógus (kulcsnév, scope, cég hatáskör).
- Kriptográfiai biztonság: a generált nyers kulcs kizárólag a modálban jelenik meg egyetlen alkalommal, másolás gombbal és biztonsági figyelmeztetéssel.
- Visszavonási megerősítő modál (`AlertDialog`).
- **Önálló Fejlesztői Portál (`/api-docs`):** A fejlécben elhelyezett „API Dokumentáció” gomb új böngészőlapon nyitja meg a dedikált, keret- és oldalsávmentes fejlesztői portál felületet ([ApiDocsPage.tsx](../../../src/pages/ApiDocsPage.tsx)), amely tartalmazza mind a 17 végpont specifikációját, a cURL/JS/Python kódmintákat és az Élő Végpont Tesztelőt.

---

## Addendum (2026-09-18) — Customer REST API v2 Bővítés (Pénzügyi Domainek & Path-Based Routing)

A Mauroni Group (7 entitás) és külső ERP integrációk igényei alapján az API v2 architektúrája az alábbi elvekkel bővült:
1. **Path-Based REST Útvonalak (`/v1/...`):** A korábbi query paraméteres `?action=` mellett bevezetésre került a valódi RESTful útvonalkezelés (`GET /v1/invoices`, `POST /v1/invoices`, `GET /v1/partners`, `GET /v1/transactions`, `GET /v1/ledger`, `GET /v1/reports/*`).
2. **Normalizált Számla Adatmodell:** Egyetlen egységes JSON sémába szervezi a kimenő és bejövő (NAV) számlákat (`direction: 'inbound' | 'outbound'`), szűrési és lapozási lehetőségekkel.
3. **Kettős Főkönyv & Riport Struktúra:**
   - `/v1/ledger`: Sorszintű, kontírozott könyvelési tételek az ERP-be történő importáláshoz.
   - `/v1/reports/*`: Időszakilag aggregált ÁFA és Eredménykimutatás.
4. **Hibrid Feltöltés:** Közvetlen multipart kisebb számlákhoz, pre-signed Storage URL nagy méretű PDF kötegekhez (védve a Deno 150 MB-os memóriakorlátját).
5. **UI Elhelyezés:** Az API kulcskezelő felület a `Beállítások > Integrációk` oldalra is beágyazásra kerül a külső rendszerek (NAV, bankok, Számlázz.hu) mellé.
6. **Webhook Ütemezés:** A PGMQ-alapú aszinkron webhook alrendszer külön 2. fázisban valósul meg a core REST API élesítése után.

---

## Addendum (2026-09-22) — Customer REST API v2.1 (OpenAPI 3.0.3, Idempotencia, P0 Adatintegritás és Teljes Életciklus)

A Mauroni Marco által végzett éles integrációs audit és visszajelzések alapján a Customer REST API 2.1-es alverzióra bővült:

1. **Hivatalos OpenAPI 3.0.3 Szabvány:**
   - Publikus, hitelesítés nélkül elérhető gépi specifikáció a `GET /v1/openapi.json` és `GET /openapi.json` útvonalakon, valamint a statikus [docs/api/openapi.json](../../api/openapi.json) fájlban.
   - Swagger UI, Postman, Insomnia és kódgenerátorok (OpenAPI Generator, Orval, kiota) által azonnal importálható formátumban.
2. **P0 Adatintegritási Javítások:**
   - **Szigorú Párosítási Validáció:** A `POST /v1/transactions/:id/match` megszüntette a hamis 200 sikerjelentést: nem létező vagy idegen céghez tartozó tranzakció vagy számla esetén szigorú `404 Not Found` választ ad (`TRANSACTION_NOT_FOUND`, `INVOICE_NOT_FOUND`).
   - **Szigorú URL Paraméter Validáció:** Bármely ismeretlen vagy elgépelt query paraméter azonnali `400 Bad Request` (`INVALID_QUERY_PARAMETER`) hibát eredményez az összes végponton, kizárva a csendes szűrési félreértéseket.
   - **`unmatched_only` és `is_matched=false` Ekvivalencia:** A lekérdezések támogatják az `unmatched_only=true` aliast, a paraméter-ütközések (`unmatched_only=true&is_matched=true`) pedig 400 hibával elutasításra kerülnek.
3. **P1 Életciklus és Hiányzó Képességek:**
   - **Tranzakció Párosítás Visszavonása (Unmatch):** `POST /v1/transactions/:id/unmatch` és `DELETE /v1/transactions/:id/match` atomian bontja a kapcsolatot, visszaállítja a számla kifizetetlen státuszát és törli a `transaction_invoice_matches` rekordot.
   - **Tranzakció Törlés:** Egyedi `DELETE /v1/transactions/:id` és kötegelt `POST /v1/transactions/bulk-delete` (max. 500 ID/kérés) automatikus kapcsolat-bontással.
   - **Számla Törlésvédelmi Integritás:** `DELETE /v1/invoices/:id` NAV által szinkronizált számlák esetén szigorú `409 Conflict` (`NAV_INVOICE_CANNOT_BE_DELETED`) védelmet alkalmaz; csak manuális számlák törölhetők azonnal, vagy explicit `force=true` paraméter szükséges.
   - **Csatolt Számlakép Letöltés:** `GET /v1/invoices/:id/image` (és `/download`) 1 órás időkorlátos, előre aláírt Supabase Storage URL-t ad vissza, illetve opcionális `redirect=true` esetén közvetlen 302 átirányítást biztosít.
   - **Kategóriák és Főkönyv Lekérdezés:** `GET /v1/categories` biztosítja a cég- és rendszerszintű kategóriák, ikonok, színek és hozzájuk tartozó `gl_accounts` főkönyvi számok gépi felolvasását.
   - **NAV Kapcsolat és Szinkronizáció Státusz:** `GET /v1/nav/status` maszkolt technikai felhasználóval, automatikus szinkronizáció beállításokkal és az utolsó 5 szinkronizációs napló tétellel (`nav_sync_logs`).
   - **Manuális NAV Szinkronizáció Indítása:** `POST /v1/nav/sync` lehetővé teszi tetszőleges dátumtartomány (`date_from`, `date_to`) és irány (`inbound`, `outbound`, `both`) szerinti azonnali számlaletöltést a `NavIngestionService` motoron keresztül, tételszintű sorok mentésével és automatikus tranzakció-újrapárosítási feladat (`rematch`) triggerelésével.
   - **Idempotencia Védelem (`Idempotency-Key`):** A POST/PATCH/DELETE hívások fejléce támogatja az `Idempotency-Key` értéket. Az atomi `api_idempotency_keys` tábla 24 órán át garantálja az azonos kérés újrafuttatás nélküli azonnali visszaadását `Idempotency-Replayed: true` HTTP fejléccel.
4. **P2 Kulcs Introspekció és Dokumentáció:**
   - `GET /v1/auth/me` visszaadja a használt API kulcs metaadatait, jogosultsági körét és az összes elérhető cég listáját.
   - `GET /v1/reports/vat` az éves szűrés mellett támogatja az explicit havi időszakot (`period=YYYY-MM`).
   - Az interaktív [ApiDocsExplorer.tsx](../../../src/components/settings/ApiDocsExplorer.tsx) kibővült az összes új végponttal, a DELETE metódussal, dinamikus számlálókkal és a közvetlen OpenAPI 3 JSON letöltési hivatkozással.

---

## Addendum (2026-09-22) — Customer REST API v2.2 (Hibajegyek / Support Tickets Modul Integráció)

Az ügyfélszolgálati folyamatok automatizálása és a platformon belüli integrált ticket-kezelés érdekében az API a 2.2-es verzióra bővült a `feedback`, `ticket_comments` és `ticket_events` táblák teljes körű kiszolgálásával:

1. **Dedikált Hibajegy Útvonalak (`/v1/tickets`):**
   - `GET /v1/tickets`: Lapozott jegylista státusz (`new`, `open`, `in_progress`, `resolved`), prioritás (`low`, `medium`, `high`, `urgent`) és típus (`bug`, `feedback`, `question`) szerinti szűréssel, valamint hozzákapcsolt nyilvános hozzászólás-számlálóval.
   - `POST /v1/tickets`: Új hibajegy feladása kötelező mezővalidációval (`message`, `type`, `priority`). Létrehozáskor a meglévő PostgreSQL triggerek (`trg_generate_ticket_number`, `trg_ticket_created_event`) automatikusan generálják az emberileg olvasható jegyszámot (pl. `EB-0157`) és a kezdeti naplóeseményt.
   - `GET /v1/tickets/:id`: Részletes jegyadatok lekérése **duális azonosítással** (UUID és `EB-xxxx` formátumú jegyszám alapján egyaránt működik).
   - `POST /v1/tickets/:id/comments`: Ügyfél válasz vagy újabb észrevétel beküldése, amely atomian beállítja a `needs_staff_response = true` flaget és frissíti az `updated_at` időbélyeget.
   - `POST /v1/tickets/:id/confirm-resolution`: Megoldás megerősítése az ügyfél részéről; a jegyet `resolved` státuszba állítja, törli a `waiting_for_user_confirmation` jelzőt, és `resolution_confirmed` típusú audit eseményt rögzít a `ticket_events` táblában.
   - **Újranyitás Tiltása (Reopen Restriction):** Ügyfélszolgálati folyamatbiztonsági döntés alapján a lezárt hibajegyek gépi újranyitása (`reopen`) az ügyfél REST API-n keresztül nem engedélyezett, megakadályozva az automatizált végtelen ciklusokat és a koordinálatlan újraaktiválásokat.

2. **Szigorú Belső Adatszivárgás-védelem (Internal Comment Isolation):**
   - Az ügyfélszolgálati munkatársak által rögzített belső megjegyzések (`is_internal = true`) lekérdezéskor szigorúan kiszűrésre kerülnek (`or("is_internal.is.null,is_internal.eq.false")`).
   - A Customer REST API kliens semmilyen körülmények között nem láthatja vagy módosíthatja a belső feljegyzéseket.

3. **OpenAPI 3.0.3 v2.2.0 és Fejlesztői Portál Frissítés:**
   - A gépi OpenAPI specifikáció ([openapi-spec.ts](../../../supabase/functions/customer-api/openapi-spec.ts) és [openapi.json](../../api/openapi.json)) frissítésre került v2.2.0-ra, tartalmazva a teljes hibajegy sémát és az engedélyezett 5 végpontot.
   - Az interaktív fejlesztői felületen ([ApiDocsExplorer.tsx](../../../src/components/settings/ApiDocsExplorer.tsx)) megjelent a „Hibajegyek (5)” kategória szűrő gomb és a cURL/JSON tesztelő kártyák.

### v2.2.1 Kiegészítés (Morfi Review Döntések nyomán — 2026-09-22)
1. **M2M API Kulcsok Felhasználói Kontextusa (Opció A):**
   - Ha egy gépi API kulcs tisztán céges hatókörű (`api_keys.user_id IS NULL`), a hibajegy és hozzászólás létrehozásakor a rendszer automatikusan feloldja a cég tulajdonosának (`company_members WHERE role = 'owner'`) vagy adminisztrátorának azonosítóját (`resolveEffectiveUserId`), megelőzve az adatbázis `NOT NULL` kényszerhibáját.
2. **NAV Manuális Szinkron 60s Perzisztens Cooldown (Opció A):**
   - A `POST /v1/nav/sync` végponton a `nav_sync_logs` tábla alapján vizsgáljuk az utolsó szinkron kezdetét. Ha 60 másodpercen belül indult már szinkron a cégre, az API azonnali `429 Too Many Requests` választ ad `NAV_SYNC_COOLDOWN` hibakóddal és `retry_after_seconds` mezővel.
3. **Lezárt Hibajegyek Kommentelési Védelme (Opció B):**
   - Lezárt hibajegyhez (`resolved` vagy `closed` státusz) a `POST /v1/tickets/:id/comments` végponton keresztül nem küldhető további hozzászólás. A rendszer szigorú `400 Bad Request` választ ad `TICKET_CLOSED` hibakóddal, előírva, hogy az ügyfél új jegyet nyisson a korábbi jegyszámra hivatkozva.

---

## Consequences

- **Pozitív:**
  - Mauroni Marco és a jövőbeli ügyfelek hivatalos, biztonságos, auditált REST API-t kaptak.
  - Zéró törés a webappban: a korábbi A-101-es védelmi pajzsok érintetlenül fennmaradtak, a webapp JWT tokenjei továbbra sem scriptelhetők.
  - Multi-tenancy RLS garanciák: semmilyen módon nem férhet hozzá egy ügyfél idegen cég adataihoz.
  - Minden API tevékenység másodperc- és mezőszinten auditált.
  - 100%-os típusbiztonság és sikeres build (`npm run build`).

- **Negatív / Kötöttségek:**
  - A felhasználónak a kulcs generálásakor azonnal el kell mentenie a nyers kulcsot, mert a szerver adatbázisa csak az SHA-256 hash-t tárolja. Kulcsvesztés esetén új kulcs generálása szükséges.

## Kapcsolódó
- [P-086: Programozói Hozzáférés & API Kulcsok Kezelése (ApiKeysCard) UX](../../product/decisions/P-086-customer-api-keys-management-ux.md)
- [P-025: Settings Oldal Struktúra](../../product/decisions/P-025-settings-structure.md)
- [A-101: Közvetlen Szkript-Automatizációk Letiltása](./A-101-direct-script-automation-restriction.md)
- [A-093: Atomi Cégbeállítások Upsert](./A-093-atomic-company-settings-upsert-and-partial-update-isolation.md)
- [A-005: Edge Functions a Serverless Logikához](./A-005-edge-functions.md)
- [BRD 030: API Hozzáférés](../../business/decisions/030-api-access.md)
- [02-companies Adatbázis Séma](../database/02-companies.md)
- [19-platform-ops Adatbázis Séma (`api_keys`)](../database/19-platform-ops.md)
