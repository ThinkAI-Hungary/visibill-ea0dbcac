# A-052: Multi-Profile IMAP/SMTP Levelező Fiókok és Vault Integráció

**Status:** Decided  
**Date:** 2026-08-27  
**Utoljára frissítve:** 2026-08-27  
**Supersedes:** [A-038: IMAP/SMTP Hitelesítő Adatok és Vault Integráció](./A-038-imap-smtp-credentials-vault-integration.md)

## Context
A korábbi implementáció ([A-038](./A-038-imap-smtp-credentials-vault-integration.md)) egyetlen globális IMAP/SMTP beállítási párt engedélyezett cégenként a `company_email_settings` táblában.
A modern vállalkozások azonban gyakran több különböző e-mail címet használnak (pl. `szamlak@ceg.hu` számlák fogadására, `penzugy@ceg.hu` könyvelésre, `info@ceg.hu` kimenő felszólítókhoz).

Szükségessé vált egy olyan skálázható, többprofilos architektúra, amely:
1. **Multi-profile tárolás:** Egy céghez tetszőleges számú egyedi e-mail fiókot (profilt) enged felvenni, külön-külön konfigurálható IMAP és SMTP adatokkal.
2. **Különválasztott funkció- és alapértelmezési kapcsolók:** Globális aktív állapot (`is_active`), modul-specifikus kapcsolók (`is_imap_enabled`, `is_smtp_enabled`), valamint független alapértelmezett kimenő (`is_default_smtp`) és bejövő (`is_default_imap`) jelölők.
3. **Szigorú Vault titkosítás és takarítás:** A jelszavak sosem kerülhetnek plaintext formában az adatbázis táblába. A `pg_vault` titkok automatikusan törlődnek jelszócsere vagy fióktörlés esetén, megelőzve az árván maradt secret-eket.
4. **Párhuzamos multi-IMAP feldolgozás:** A Python worker az összes aktív IMAP fiókot egyidejűleg és párhuzamosan tudja pollolni.
5. **Kimenő SMTP és Resend fallback:** A kimenő e-mailek (pl. fizetési felszólítások) az alapértelmezett SMTP fiókon keresztül mennek, hiba esetén automatikus Resend kézbesítéssel és státuszfrissítéssel.

---

## Decision

### 1. Új Adatbázis Tábla: `public.company_email_accounts`
A régi egyrekordos `company_email_settings` tábla helyett létrehoztuk a több rekordot támogató `company_email_accounts` táblát:

```sql
CREATE TABLE public.company_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Levelező fiók',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default_smtp BOOLEAN NOT NULL DEFAULT false,
  is_default_imap BOOLEAN NOT NULL DEFAULT false,
  
  -- IMAP bejövő beállítások
  is_imap_enabled BOOLEAN NOT NULL DEFAULT true,
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_username TEXT,
  imap_password_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
  imap_encryption TEXT NOT NULL DEFAULT 'SSL/TLS',
  imap_status TEXT NOT NULL DEFAULT 'pending',
  imap_last_synced_at TIMESTAMPTZ,
  imap_last_validated_at TIMESTAMPTZ,
  imap_validation_error TEXT,
  
  -- SMTP kimenő beállítások
  is_smtp_enabled BOOLEAN NOT NULL DEFAULT true,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 465,
  smtp_username TEXT,
  smtp_password_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
  smtp_encryption TEXT NOT NULL DEFAULT 'SSL/TLS',
  smtp_status TEXT NOT NULL DEFAULT 'pending',
  smtp_last_validated_at TIMESTAMPTZ,
  smtp_validation_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. Row Level Security (RLS) és Indexek
* **Indexek:**
  * `idx_company_email_accounts_company_id` on `(company_id)`
  * `idx_company_email_accounts_active_imap` on `(is_active, is_imap_enabled)`
  * `idx_company_email_accounts_default_smtp` on `(company_id, is_default_smtp)`
* **RLS Szabályok:**
  * `SELECT`: A cég tagjai (`company_members`) és tulajdonosa lekérdezhetik a fiókokat.
  * `ALL` (Insert/Update/Delete): Csak a cég tulajdonosa és adminisztrátora kezelheti.

### 3. Atomikus SECURITY DEFINER RPC Függvények
Minden Vault-ot és beállításokat érintő művelet dedikált `SECURITY DEFINER` tárolt eljáráson keresztül fut:
1. `save_company_email_account(...)`: Fiók mentése vagy frissítése. Automatikus Vault secret létrehozás és régi titkok törlése. Az alapértelmezett jelölők (`is_default_smtp`, `is_default_imap`) átkapcsolásakor atomikusan kikapcsolja a többi fiók default jelölését.
2. `delete_company_email_account(p_account_id)`: Fiók törlése és a hozzá tartozó Vault jelszótitkok maradéktalan törlése.
3. `set_default_company_email_account(p_account_id, p_type)`: Alapértelmezett fiók gyors átállítása vagy lekapcsolása (`smtp`, `imap`, `both`, `none_smtp`, `none_imap`, `none_both`).
4. `get_company_email_accounts(p_company_id)`: Fiókok listázása a frontend és adminisztráció számára, a Vault-ból feloldott jelszavakkal.
5. `get_single_email_account(p_account_id)`: Egyetlen fiók dekriptált lekérdezése teszteléshez és szerkesztéshez.
6. `get_default_company_smtp(p_company_id)`: Az aktív alapértelmezett kimenő SMTP fiók feloldása a `send-dunning-email` Edge Function számára.
7. `get_active_imap_accounts()`: Az összes aktív és engedélyezett IMAP fiók listázása a Python worker párhuzamos feldolgozójának.

### 4. Edge Functions & Worker Integráció
* **`test-email-connection` (Deno):** Támogatja az `accountId` alapú közvetlen jelszófeloldást (`get_single_email_account`) és a tesztelés eredményének mentését az adott fiók rekordjába.
* **`send-dunning-email` (Deno):** A `get_default_company_smtp` RPC-vel feloldja az alapértelmezett kimenő fiókot, hiba esetén automatikusan Resend-re vált és `smtp_status = 'error'` állapotot állít be.
* **Python Worker (IMAP):** A `get_active_imap_accounts` segítségével az összes aktív fiókot aszinkron feladatként pollolja, a letöltött számláknál eltárolva az `email_account_id` és `email_account_name` metaadatokat.

---

## Consequences

### Pozitív
* **Korlátlan skálázhatóság:** A cégek tetszőleges számú postafiókot köthetnek be és kezelhetnek egyetlen felületen.
* **Maximális biztonság:** A jelszavak sosem kerülnek kódolatlanul tárolásra, Vault kulcsok szivárgása és árván maradása kizárt.
* **Párhuzamos adatcsatornák:** Egyszerre több postafiókból érkezhetnek számlák és fuvarlevelek anélkül, hogy egymást blokkolnák.
* **Hibaelkülönítés:** Ha egy postafiók jelszava lejár vagy hibára fut, csak az adott fiók vált `error` státuszra, a többi postafiók szinkronizációja zavartalanul folytatódik.

### Negatív
* **Komplexebb UI:** A korábbi egyszerű form helyett profillista, modal dialógus és kártya alapú állapotkezelés szükséges.

---

## Kapcsolódó
* [P-051: Multi-Profile Email Accounts Management UX](../product/decisions/P-051-multi-profile-email-accounts-management-ux.md)
* [A-005: Edge Functions](./A-005-edge-functions.md)
* [A-006: Python Worker](./A-006-python-worker.md)
* [A-010: Credential Encryption](./A-010-credential-encryption.md)
