# A-038: IMAP/SMTP Hitelesítő Adatok és Vault Integráció

**Status:** Decided
**Date:** 2026-07-15
**Utoljára frissítve:** 2026-07-15

## Context
A felhasználók saját IMAP és SMTP szervereiket is csatlakoztathatják a Visibill rendszerhez, így a számlák letöltése a saját postaládájukból (IMAP), a kimenő levelek (például fizetési felszólítások) kiküldése pedig a saját címükről (SMTP) történhet.
Mivel a szerverekhez tartozó jelszavak rendkívül érzékeny adatok, azokat tilos sima szövegként (plaintext) tárolni az adatbázisban. Olyan biztonságos megoldásra van szükség, amely:
1. Megakadályozza, hogy a frontend közvetlenül hozzáférjen a nyers jelszavakhoz a mentés után.
2. Lehetővé teszi a biztonságos, szerver oldali feloldást mind a Deno Edge Function (SMTP küldés és tesztelés), mind a Python Worker (IMAP szinkronizáció) számára.
3. Biztosítja az RLS (Row Level Security) védelmet és a tranzakcionális integritást leválasztás (törlés) esetén.

## Decision
Az IMAP és SMTP hitelesítő adatok és jelszavak biztonságos tárolásához a **Supabase Vault** (pg_vault extension) sémát használjuk.

### 1. Adatbázis Séma és RLS
*   Létrehoztunk egy `public.company_email_settings` táblát, amely nem a nyers jelszavakat tárolja, hanem a Vault által visszaadott titok-azonosítókat (`imap_password_secret_id`, `smtp_password_secret_id` - `UUID` kulcsok).
*   A táblára bekapcsoltuk az RLS-t (`ROW LEVEL SECURITY`). A `SELECT` műveletet csak a cég tagjai hajthatják végre egy optimalizált subquery policy-vel:
    ```sql
    CREATE POLICY select_company_email_settings ON public.company_email_settings
    FOR SELECT TO authenticated
    USING (
      company_id IN (
        SELECT company_id FROM public.company_members 
        WHERE user_id = auth.uid()
      )
    );
    ```
*   Nem adtunk közvetlen írási (INSERT/UPDATE/DELETE) jogosultságot az `authenticated` szerepkörnek a táblán. A módosításokat kizárólag `SECURITY DEFINER` attribútumú RPC-k hajtják végre a Vault szinkronitás megőrzéséhez.

### 2. Biztonságos RPC Függvények (Security Definer)
*   `save_company_email_settings`: Létrehozza vagy frissíti a beállításokat. A jelszavakat a `vault.create_secret()` segítségével elmenti, és csak a titkok UUID kulcsait menti le a táblába. A korábbi jelszavak titkait a Vault-ból automatikusan kitörli a szivárgások megelőzésére.
*   `delete_company_email_settings`: Eltávolítja a cég levelezési beállításait, valamint az azokhoz kapcsolódó jelszavak titkait a Vault-ból.
*   `get_company_email_settings`: Egy dedikált, belső RPC függvény, amely a Vault `vault.decrypted_secrets` nézetével összekapcsolva visszaadja a titkosítatlan jelszavakat a hívónak. A jogosultságokat ellenőrzi (`auth.uid()`), de a worker hívások (`service_role`) számára megkerüli az ellenőrzést.

### 3. Szerver Oldali Feloldás és Fallback Kézbesítés
*   **Edge Function (SMTP):** A `send-dunning-email` Edge Function a `get_company_email_settings` RPC segítségével feloldja a jelszót, majd a `nodemailer` modullal TCP/TLS szinten kézbesíti a levelet a cég nevében. Ha az SMTP küldés elhasal (auth hiba, hálózati timeout), a rendszer automatikusan **Resend** fallback segítségével kézbesíti a levelet, és az integráció státuszát `error` állapotra frissíti az adatbázisban.
*   **Python Worker (IMAP):** A worker a `get_company_email_settings` RPC-t hívja meg `asyncio.to_thread` wrappinggel, és a beépített `imaplib` modullal szinkronizálja a beérkező `UNSEEN` e-maileket.

## Consequences

### Pozitív
*   **Maximális biztonság:** A nyers jelszavak soha nem kerülnek vissza a frontend kliensre (csak masked `***masked***` értékként jelennek meg a beviteli mezőben, ha már léteznek).
*   **Tranzakcionális integritás:** A Vault titkok és a beállítások törlése atomi tranzakcióként fut le a PostgreSQL szintjén.
*   **Kézbesítési garancia:** Az SMTP fallback mechanizmus biztosítja, hogy a kiküldendő felszólítások és értesítések akkor is célba érjenek (Resend-en keresztül), ha a felhasználó SMTP szervere átmenetileg elérhetetlen vagy hibás.

### Negatív
*   **Szerver oldali komplexitás:** A hitelesítő adatok megtekintéséhez és módosításához a `SECURITY DEFINER` RPC-kre és a Vault sémára vagyunk utalva, ami nehezíti a manuális SQL tesztelést.

## Kapcsolódó
*   [A-005: Edge Functions](./A-005-edge-functions.md)
*   [A-006: Python Worker](./A-006-python-worker.md)
*   [A-010: Credential Encryption](./A-010-credential-encryption.md)
*   [P-048: IMAP/SMTP Settings Tabs UX](../product/decisions/P-048-imap-smtp-settings-tabs-ux.md)
