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
- Hibák (401, 403, 400, 429) és sikeres hívások (200) egyaránt ellenőrizhetők és visszakövethetők.

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
