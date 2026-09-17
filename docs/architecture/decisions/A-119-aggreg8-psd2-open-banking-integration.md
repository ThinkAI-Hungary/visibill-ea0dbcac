# A-119: Aggreg8 PSD2 Open Banking AISP Integráció, Hosted SyncUI és Valós Idejű Tranzakció Szinkronizáció

**Status:** Decided  
**Date:** 2026-09-17  
**Utoljára frissítve:** 2026-09-17  

## Context

A Visibill / eaisybill-prod rendszerben a banki tranzakciók és számla-kiegyenlítések importja korábban kizárólag manuális bankkivonatok (CSV, XLS) feltöltésével történt (`transaction_uploads` $\rightarrow$ Python Worker / regex parser). Ez a könyvelők és vállalkozók számára jelentős manuális terhet jelentett, napi szintű beavatkozást igényelt, és késleltette a számlapárosítási folyamatokat.

A cél egy automatikus, jogszabályilag védett és felügyelt banki kapcsolat kialakítása volt az európai PSD2 (Payment Services Directive 2) Account Information Service Provider (AISP) keretrendszerén keresztül.

## Decision

Az **Aggreg8 (AISP API v5.3.1)** felhőalapú banki aggregátorát integráltuk hivatalos partnerként, az alábbi rétegeken:

### 1. Hosted SyncUI és Zéró Felelősség (Zero Liability) Modell
- A felhasználó az Aggreg8 biztonságos, dedikált felugró ablakában (`SyncUI`, mérete: `500x750 px`) választja ki a bankját, majd átirányításra kerül a bank hivatalos azonosító felületére (OTP, Erste, George, MBH, Raiffeisen, K&H, CIB, UniCredit, Revolut, Wise).
- A Visibill **soha nem látja és nem tárolja a felhasználó netbankos belépési adatait vagy jelszavait**.
- A felugró ablakban egyedi partner-branding jelenik meg a Visibill / Eaisybill logóval (185x55 px).

### 2. Kettős Edge Function Architektúra
- **`aggreg8-api` (`verify_jwt: true`):**
  - Védve van a Visibill kettős védelmi reteszével (`checkAutomationShield` és Supabase JWT autentikáció).
  - Szerepkörei:
    - Partner token lekérése és gyorsítótárazása (`aggreg8_settings` táblában 175 percre).
    - Aggreg8 felhasználó azonosító feloldása / regisztrációja (`ensureAggreg8User`).
    - SyncUI session indítása (`user-flow/init`): `ADD_BANK`, `ON_DEMAND`, `EXTEND_CONSENT`, `DELETE_INFO_SHARING_CONSENT`.
    - Támogatott bankok listázása (`GET /banks`).
  - Hiba esetén nem generikus 500-at dob, hanem strukturált HTTP 503 / 400 választ ad `A8_API_KEY_MISSING` vagy `OPERATION_FAILED` hibakóddal.
- **`aggreg8-callback` (`verify_jwt: false`):**
  - Nyilvános webhook végpont az Aggreg8 szerverek felé.
  - Események: `INFO_SHARING_CONSENT_CREATED`, `INFO_SHARING_CONSENT_EXTENDED`, `INFO_SHARING_CONSENT_DELETED`, `ACCOUNT_SYNCED`, `DATA_TRANSFER_SCHEDULED`.
  - Hozzájárulások perzisztálása az `aggreg8_consents` és `aggreg8_accounts` táblákba.
  - Automatikus tranzakcióletöltés: lapozás kezelése `while (page < totalPages && page < 50)` ciklussal kezdeti szinkronizációkor (>200 tétel esetén).
  - Upsert a `bank_transactions` és `transactions` táblákba külső duplikáció elleni védelemmel (`external_id` és `unique_transaction_entry`).

### 3. Adatbázis Séma és Nullability Migráció
- **Új táblák:**
  - `aggreg8_consents`: Hozzájárulás állapota, 180 napos lejárat (`valid_until`), hozzáférési token, bank azonosító.
  - `aggreg8_accounts`: Bankszámlaszám (IBAN), egyenleg, deviza, utolsó szinkronizáció.
  - `aggreg8_settings`: Gyorsítótárazott partner customer token és környezet (`sandbox` / `prod`).
- **DDL módosítás:**
  - `ALTER TABLE public.bank_transactions ALTER COLUMN bank_statement_id DROP NOT NULL;`
  - Korábban a tábla megkövetelte egy manuális kivonat feltöltési azonosítót (`bank_statement_id`). Az Open Banking tranzakciók közvetlen API-n keresztül érkeznek, ezért a mező opcionálissá tétele kötelező volt a megszakításmentes adatmentéshez.

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
