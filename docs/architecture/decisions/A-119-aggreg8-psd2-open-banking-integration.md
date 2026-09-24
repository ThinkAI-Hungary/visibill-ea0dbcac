# A-119: Aggreg8 PSD2 Open Banking AISP Integráció, Hosted SyncUI és Valós Idejű Tranzakció Szinkronizáció

**Status:** Decided  
**Date:** 2026-09-17  
**Utoljára frissítve:** 2026-09-24  

## Context

A Visibill / eaisybill-prod rendszerben a banki tranzakciók és számla-kiegyenlítések importja korábban kizárólag manuális bankkivonatok (CSV, XLS) feltöltésével történt (`transaction_uploads` $\rightarrow$ Python Worker / regex parser). Ez a könyvelők és vállalkozók számára jelentős manuális terhet jelentett, napi szintű beavatkozást igényelt, és késleltette a számlapárosítási folyamatokat.

A cél egy automatikus, jogszabályilag védett és felügyelt banki kapcsolat kialakítása volt az európai PSD2 (Payment Services Directive 2) Account Information Service Provider (AISP) keretrendszerén keresztül.

## Decision

Az **Aggreg8 (AISP API v5.3.1)** felhőalapú banki aggregátorát integráltuk hivatalos partnerként, az alábbi rétegeken:

### 1. Hosted SyncUI és Zéró Felelősség (Zero Liability) Modell
- A felhasználó az Aggreg8 biztonságos, dedikált felugró ablakában (`SyncUI`, mérete: `500x750 px`) választja ki a bankját, majd átirányításra kerül a bank hivatalos azonosító felületére (OTP, Erste, George, MBH, Raiffeisen, K&H, CIB, UniCredit, Revolut, Wise).
- A Visibill **soha nem látja és nem tárolja a felhasználó netbankos belépési adatait vagy jelszavait**.
- A felugró ablakban egyedi partner-branding jelenik meg a Visibill / Eaisybill logóval (185x55 px).

### 2. Kettős Edge Function Architektúra, Megosztott Motor és Proxy Relay
- **Megosztott Szinkronizációs Motor (`supabase/functions/_shared/aggreg8-sync.ts`):**
  - Központosítja az autentikációt, a partner token sanitization-t, az automatikus token frissítést és a lapozásos tranzakcióletöltést az `aggreg8-api` és `aggreg8-callback` között.
- **Környezetkezelés és Dedikált Reverse Proxy Relay:**
  - Sandbox: `https://a8-ais-api.sandbox.aggreg8test.hu` és `https://a8-sync-ui.sandbox.aggreg8test.hu`.
  - Prod: `https://ais-api.aggreg8.hu` és `https://sync-ui.aggreg8.hu`.
  - **Statikus IP Whitelist Garancia (`64.226.83.137`):** Mivel a felhős Supabase Edge Function kimenő IP címe dinamikus, az éles Aggreg8 tűzfal IP-engedélyezési követelményét egy dedikált DigitalOcean Droplet reverse proxy-val (`https://a8.visibill.hu` $\rightarrow$ `64.226.83.137`) fedjük le.
  - **Proxy Védelem (`A8_PROXY_SECRET`):** A proxy Dockerben futó Caddy v2 webszerver, amely szigorúan ellenőrzi az `X-A8-Proxy-Secret` fejlécet. Titkos kulcs nélkül (403 Forbidden) elutasít minden külső forgalmat.
- **Bearer Token Sanitization & 401 Auto-Retry:**
  - Az Aggreg8 token formátuma (`Bearer eyJ...`) miatt a motor elvégzi a prefix-tisztítást, megelőzve a duplikált `Bearer Bearer ...` 401 hibákat.
  - A `fetchAggreg8WithRetry` wrapper HTTP 401 esetén automatikusan invalidálja az `aggreg8_settings` cache-t, új partner tokent igényel, és egyszer megismétli a hívást.
- **`aggreg8-api` (`verify_jwt: true`):**
  - Védve van a Visibill kettős védelmi reteszével (`checkAutomationShield` és Supabase JWT autentikáció).
  - Szerepkörei:
    - Partner token lekérése és gyorsítótárazása (`aggreg8_settings` táblában 175 percre).
    - Aggreg8 felhasználó azonosító feloldása / regisztrációja (`ensureAggreg8User`).
    - SyncUI session indítása (`user-flow/init`): `ADD_BANK`, `ON_DEMAND`, `EXTEND_CONSENT`, `DELETE_INFO_SHARING_CONSENT`.
    - **Munkamenet-követés (Multi-Company Isolation):** Az indításkor kapott `userFlowId`-t azonnal naplózza az `aggreg8_webhook_logs` táblába `FLOW_INITIATED` típusú bejegyzésként a pontos `company_id` és `user_id` metaadatokkal.
    - Támogatott bankok listázása (`GET /banks`).
  - Hiba esetén strukturált HTTP 503 / 400 választ ad `A8_API_KEY_MISSING` vagy `OPERATION_FAILED` hibakóddal.
- **`aggreg8-callback` (`verify_jwt: false`):**
  - Nyilvános webhook végpont az Aggreg8 szerverek felé (`/functions/v1/aggreg8-callback`).
  - Események: `INFO_SHARING_CONSENT_CREATED`, `INFO_SHARING_CONSENT_EXTENDED`, `INFO_SHARING_CONSENT_DELETED`, `ACCOUNT_SYNCED`, `DATA_TRANSFER_SCHEDULED`, `TRANSACTIONS_CREATED`, `TRANSACTIONS_UPDATED`.
  - **Determinisztikus Cégfeloldás (Session Mapping):** `INFO_SHARING_CONSENT_CREATED` eseménynél a `payload.userFlowInfo.userFlowId` kulcs alapján pontosan visszakeresi a cég- és felhasználó-azonosítót a `FLOW_INITIATED` naplóból.
  - **Számlaszűrés (`consentedAccounts`):** Csak az adott folyamatban kifejezetten engedélyezett számlákat köti a céghez.
  - **Történeti Paginációs Plafon (10 000+ tranzakció) és PGMQ Chunking:** Kezdeti szinkronizációkor az Edge Function 50 oldalig (10 000 tétel) fut le a 60 másodperces időkorlát védelmében. Ha még maradt adat (`page < totalPages`), `hasMore: true` jelzést ad, és egy folytatási feladatot küld a `transaction_jobs` PGMQ sorba (`source: 'aggreg8_continuation'`), amit a háttér worker korlátlan idő alatt szinkronizál végig.
  - Upsert a `bank_transactions` és `transactions` táblákba külső duplikáció elleni védelemmel (`external_id` és `unique_transaction_entry`).

### 3. Adatbázis Séma és Nullability Migráció
- **Táblák:**
  - `aggreg8_consents`: Hozzájárulás állapota, 180 napos lejárat (`valid_until`), hozzáférési token, bank azonosító.
  - `aggreg8_accounts`: Bankszámlaszám (IBAN), egyenleg, deviza, utolsó szinkronizáció ideje (`last_synced_at`), valamint szinkronizált tételek száma (`last_synced_count`).
  - `aggreg8_settings`: Gyorsítótárazott partner customer token és környezet (`sandbox` / `prod`).
- **DDL migrációk:**
  - `ALTER TABLE public.bank_transactions ALTER COLUMN bank_statement_id DROP NOT NULL;` (Open Banking direkt tranzakciók tárolása).
  - `ALTER TABLE public.aggreg8_accounts ADD COLUMN IF NOT EXISTS last_synced_count INTEGER NOT NULL DEFAULT 0;` (`20260924143000_add_last_synced_count_to_aggreg8_accounts.sql`).

### 4. Aszinkron Háttér-feldolgozás (Python Worker & PGMQ)
- Az `aggreg8-callback` a sikeresen szinkronizált tranzakciók azonosítóival (`a8_transaction_ids`) felad egy feladatot a `transaction_jobs` PGMQ sorba (`source: 'aggreg8'`).
- A Python Worker (`d:\ThinkAI\Visibill\worker`) a `worker.py` routeren keresztül meghívja a dedikált `aggreg8_processor.py` modult:
  - **Adatnormalizálás:** A `bank_transactions` sorokat `RawTransaction` objektumokká konvertálja (előjel: terhelés negatív, jóváírás pozitív; `upload_id=None`).
  - **AI Kategorizálás:** `categorize_transactions()` futtatása intelligens kategóriabesorolással.
  - **Two-Pass Számlapárosítás:** NAV kimenő (`nav_outbound`), bejövő számlák (`nav_inbound`) és kifizetések (`payment_transfers`) determinisztikus heurisztikus (`heuristic_match`) és AI (`match_transaction`) párosítása.
  - **GL Szabályok:** `apply_transaction_rules` és `apply_default_heuristics` alkalmazása a cég számlatükrére.
  - **Batch Perzisztencia:** Mentés a `public.transactions` táblába `a8_transaction_id` idempotens egyedi parciális indexszel és relációk rögzítése a `transaction_invoice_matches` táblában.

### 5. Versenyhelyzet és UX Retesz (Race Condition Protection)
- Amikor a felhasználó bezárja a SyncUI ablakot, a banki webhook 1-2 másodperces késéssel érkezhet meg.
- Ennek áthidalására:
  - **Supabase Realtime feliratkozás** az `aggreg8_consents` és `aggreg8_accounts` táblákra (azonnali UI frissülés amint a webhook beír).
  - Lépcsőzetes késleltetett lekérdezés: popup zárásakor azonnali refetch, majd +2.5 mp és +6.0 mp múlva megerősítő invalidáció.
  - Frontend animált „Szinkronizálás folyamatban...” visszajelzés a felhasználónak.

### 6. Felületi Elhelyezés és Kétirányú Navigáció (UI/UX Architecture)
- **Master-Detail Split View az Integrációk (`/integrations`) menüpontban:** A korábbi egymásra halmozott, függőlegesen nyúló űrlapok helyett egy professzionális, kétoszlopos Master-Detail architektúrát vezettünk be:
  - **Bal oldalsáv (Master):** 3 logikai csoportba sorolva (Pénzintézet & Hatóság, Számlázás & Dokumentum, Fejlesztők & Rendszer) listázza a modulokat élő állapotjelzőkkel (`2 bank`, `Aktív`, `Agent API`, `Alias aktív`, `Archívum`, `API hozzáférés`).
  - **Jobb munkaterület (Detail Canvas):** Egyszerre kizárólag a kiválasztott integráció teljes, kényelmes felülete látható (zéró túlcsordulás és görgetési káosz).
  - **URL Query Deep-linking (`?tab=banking`):** A kiválasztott tabot a böngésző URL állapota vezérli, így a `Beállítások -> Bankszámlák` felületről átkattintva közvetlenül a banki kapcsolatok nyílnak meg.
  - **Mobil reszponzivitás:** Kis képernyőn elegáns, vízszintesen görgethető gombfolyammá alakul át a bal oldalsáv.
- **Állapotjelző & Átirányító Kártya a Beállítások $\rightarrow$ Bankszámlák lapon:** A `BankAccountsTab` megtartja a cég manuális kimenő bankszámláinak nyilvántartását, tetején egy státuszkártyával, amely mutatja az aktív banki kapcsolatok számát, és a `navigate('/integrations?tab=banking')` hívással közvetlenül a megfelelő nézetbe vezeti a felhasználót.

## Consequences

**Pozitív:**
- Teljesen automatizált, napi és igény szerinti bankszámla-szinkronizáció.
- Zero Liability: nincs biztonsági kockázat a banki jelszavakkal kapcsolatban.
- 180 napos PSD2 engedélyezési ciklus, egyértelmű lejárati figyelmeztetéssel.
- Azonnali számla-tranzakció párosítás manuális kivonatfeltöltés nélkül.

**Negatív / Kötöttségek:**
- Függőség az Aggreg8 rendelkezésre állásától és az `A8_AIS_API_KEY` titkos környezeti változótól.
- 180 naponta a PSD2 törvény miatt a felhasználónak meg kell újítania a felhatalmazást.

## Kapcsolódó
- [026-banking-integration.md (BRD)](../../business/decisions/026-banking-integration.md)
- [P-087: Aggreg8 Bankcsatlakozás és SyncUI UX](../../product/decisions/P-087-aggreg8-bank-connections-and-sync-ui-ux.md)
- [A-005: Edge Functions Katalógus](./A-005-edge-functions.md)
- [06-transactions-bank.md Adatbázis séma](../database/06-transactions-bank.md)
- [useAggreg8.ts Hook](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAggreg8.ts)
