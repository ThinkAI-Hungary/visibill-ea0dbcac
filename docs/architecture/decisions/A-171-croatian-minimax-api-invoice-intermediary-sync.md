# A-171: Horvát Minimax REST API Számla-közvetítő Integráció és Szinkronizáció

* **Dátum:** 2026-09-28
* **Státusz:** Elfogadva (Accepted)
* **Környezet:** Eaisybill / Horvát Lokalizáció (`country_code = 'HR'`)
* **Kapcsolódó döntések:** [A-109](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md), [A-140](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md), [A-156](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-156-croatian-vat-return-obrazac-pdv-and-tax-codes.md), [A-170](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-170-croatian-eporezna-vat-xml-export-pdv-s-and-zp.md)

---

## 1. Kontextus és Problémafelvetés

Magyarországon a számlaadatok primer forrása a Nemzeti Adó- és Vámhivatal (NAV Online Számla 3.0 API), ahonnan gép-gép kapcsolaton keresztül letölthető az összes kimenő és belföldi bejövő számla.
Horvátországban a jogi és technikai környezet eltérő: nem az adóhatóság üzemeltet közvetlen lakossági/vállalati számlalehívó API-t a cégek számára, hanem a számlaközvetítői hálózat (pl. FINA, Minimax, moj-eRacun). A könyvelők és cégek a számlaközvetítői REST API-n keresztül kezelik az e-számlákat (Izlazni računi / Ulazni računi).

A feladat az volt, hogy a horvát cégek (`country_code = 'HR'`) esetében a magyar NAV szinkronizáció helyére zökkenőmentesen a horvát **Minimax REST API** közvetítői szolgáltatás lépjen be ([https://moj.minimax.hr/HR/API](https://moj.minimax.hr/HR/API)), biztosítva:
1. Biztonságos hitelesítést (OAuth 2.0 password grant: `client_id`, `client_secret`, felhasználónév és alkalmazás jelszó).
2. Kétirányú számlaszinkronizációt (Kimenő / Bejövő számlák és tételsorok).
3. Automatikus horvát ÁFA-kód hozzárendelést (`trg_auto_assign_croatian_vat_code` adatbázis trigger).
4. Fejlesztői és könyvelői tesztmódot (amíg nincs éles Minimax fejlesztői fiók, élethű szimulált horvát számlákkal).

---

## 2. Architektúrális Döntések

### 2.1. Adatbázis Séma és Hitelesítő Adatok Tárolása
Létrehoztuk a `company_minimax_credentials` és `minimax_sync_logs` táblákat szigorú RLS házirendekkel (`company_members` alapú hozzáférés):
* `company_minimax_credentials`:
  * `company_id` (UNIQUE), `user_id`, `minimax_username`, `minimax_password`, `organisation_id`, `organisation_name`.
  * `is_test_environment` (boolean), `auto_sync_enabled` (boolean), `sync_frequency`.
  * `validation_status` (`pending`, `valid`, `invalid`), `last_validated_at`, `last_synced_at`, `last_sync_result` (JSONB).
* RPC függvények:
  * `save_minimax_credentials`: Mentés és frissítés jogosultság-ellenőrzéssel.
  * `get_minimax_credentials`: Biztonságos lekérdezés maszkolt jelszóval (`has_password: true`).
  * `disconnect_minimax_credentials`: Kapcsolat biztonságos bontása.

### 2.2. Supabase Edge Function (`minimax-sync`)
A szinkronizációs motort egy Deno runtime-ban futó Edge Function valósítja meg:
* **OAuth 2.0 Auth Protocol:** Token kérés a `https://moj.minimax.hr/HR/AUT/oauth20/token` végponton `grant_type=password` segítségével.
* **Actions:**
  * `test_connection` / `get_orgs`: Ellenőrzi a kapcsolatot és lekéri a felhasználóhoz tartozó Minimax szervezeteket (`/currentuser/orgs`).
  * `sync`: Lekéri a kimenő (`/orgs/{orgId}/issuedinvoices`) és bejövő (`/orgs/{orgId}/receivedinvoices`) számlákat, és upserteli a `public.invoices` és `public.invoice_items` táblákba.
* **Szimulált tesztmód (`testMode`):** Ha a rendszerben nincs még beállítva éles Minimax client secret vagy `testMode === true`, valósághű horvát számlákat (Zágrábi vevő, Eszéki szállító, 25%-os EUR tételek, OIB azonosítók) generál és szúr be az adatbázisba.
* **Adatbázis Integritás & CHECK Constraints:**
  * `statusz`: `'feldolgozott'` (kisbetűs, a Postgres check constraintnek megfelelően).
  * `invoice_type`: `'sima_szla'` (a Visibill standard számlatípusa).
  * `intermediary_service`: `true` (jelzi, hogy közvetítői szolgáltatásból érkezett).
* **Többoldalas Lapozás (Paging & Safeguard - Opció A):**
  * A Minimax REST API 100-as alapértelmezett lapozási korlátját az aszinkron `fetchAllPages` ciklus kezeli (`PageSize=100`, `Page=1..20`).
  * Automatikus lapozás történik mindaddig, amíg van újabb oldal (`items.length < pageSize`).
  * Beépített védelmi plafon (safeguard limit: max. 20 oldal / 2 000 számla futásonként), megelőzve az esetleges végtelen ciklusokat és az Edge Function timeoutokat.

### 2.3. Frontend Jurisdictio és Komponensek
* `useCompanyJurisdiction`: Kibővítve a `hasMinimaxIntegration: isCroatia`, `intermediaryName: 'Minimax'`, `syncLabel: 'Minimax szinkronizálás'` mezőkkel.
* `MinimaxSettingsCard`: Csatlakozási űrlap, szervezet-választó, kapcsolat-tesztelő, szimulált tesztmód kapcsoló és szinkronizálási napló nézet.
* `MinimaxSyncDialog`: Dátum-presetek (30, 60, 90 nap, teljes év), egyéni naptár és számlairány választó (`BOTH`, `OUTBOUND`, `INBOUND`).
* `NavSyncButton`: Horvát cégeknél dinamikusan a Minimax szinkronizációs gombbá alakul át és a `MinimaxSyncDialog`-ot jeleníti meg.
* `useInvoiceData` & `useInvoiceMutations`: A `credentialsExist` és a `handleSync` zökkenőmentesen a Minimax hitelesítő adatokat és a `minimax-sync` Edge Functiont használja horvát cégeknél.

---

## 3. Bizonyítékok és Eredmények (Evidence)

* **Adatbázis Migráció:** A táblák és a 3 RPC élesben létezik a Supabase adatbázisban.
* **Edge Function Telepítés:** `minimax-sync` státusz: `ACTIVE`, ID: `6768a255-8e2a-4b0b-a692-f740b98896d1`.
* **Éles Szinkronizációs Teszt:**
  * `2026-MM-OUT-001` (Kimenő, 3 125,00 EUR) $\rightarrow$ az automatikus trigger sikeresen hozzárendelte a **`HR_IZL_25`** ÁFA kódot.
  * `2026-MM-IN-002` (Bejövő, 562,50 EUR) $\rightarrow$ az automatikus trigger sikeresen hozzárendelte a **`HR_UL_25_ODB`** levonható ÁFA kódot.
* **Multi-tenancy RLS védelem:** A nem hozzárendelt felhasználók kéréseit a rendszer 403-as hibával biztonságosan blokkolja.
* **Build és Típusellenőrzés:** `npx tsc --noEmit` és `npm run build` 0 hibával lefutott.
