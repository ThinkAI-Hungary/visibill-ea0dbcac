# A-090: Biztonságos Számlatükör Sablon Törlés, Függőség-Ellenőrzés és Tételek Átkötése (Remapping)

**Status:** Decided  
**Date:** 2026-09-04  
**Category:** Architecture / Database / General Ledger / Accounting Journals / Foreign Keys  

---

## 1. Context & Problem Statement

A Visibill rendszerben a felhasználók egyéni számlatükör sablonokat (`chart_of_accounts_presets`, `type = 'custom'`) tölthetnek fel cégeikhez PDF, CSV vagy XLSX formátumban. A feltöltött számlatükör számlái a `gl_accounts` táblában tárolódnak (`preset_id` idegen kulccsal).

Amikor egy cég könyvelése megkezdődik (gépi könyvelési javaslatok generálása vagy kézi bizonylatok rögzítése), a kettős könyvviteli naplótételek (`acc_journal_lines`) a `gl_account_id` idegen kulcson keresztül közvetlenül kapcsolódnak a `gl_accounts` tábla rekordjaihoz:
```sql
gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE RESTRICT
```
Hasonlóképpen, banki tranzakciók (`transactions`), számlák (`invoices`, `nav_invoices`), tárgyi eszközök (`fixed_assets`), és szabályok (`transaction_rules`) is hivatkozhatnak a számlákra.

### A felmerült incidens (2026. 09. 04. 08:55):
A TS Consult Kft. felhasználója korábban feltöltött egy számlatükröt, amely alapján 14 db naplótétel hivatalosan lekönyvelésre került (`status = 'KONYVELT'`), és 15 tranzakció kapott kontírozást. Később a felhasználó feltöltött egy javított számlatükröt ("Jó számlatükör"), aktiválta, majd a Főkönyv oldal "Sablonok kezelése" ablakában (`ManagePresetsModal`) megpróbálta törölni a régi sablont ("Számlatükör nem jó").

A korábbi frontend kód közvetlenül kliensoldalról próbálta futtatni a törlést:
```ts
await supabase.from('gl_accounts').delete().eq('preset_id', presetId);
```
Ez a művelet azonnal meghiúsult a PostgreSQL `23503 (foreign_key_violation)` megszorításán:
`update or delete on table "gl_accounts" violates foreign key constraint "acc_journal_lines_gl_account_id_fkey" on table "acc_journal_lines"`
Mivel a `useMutation` nem tartalmazott explicit `mutationKey`-t, az esemény `[UnknownMutation/mutation_error]` néven került a hibatáblába, a felhasználó pedig nyers adatbázis hibaüzenetet kapott.

---

## 2. Decision

### 2.1 Szerveroldali Tranzakcionális RPC Architektúra
A kliensoldali közvetlen táblatörlést megszüntetjük, és két biztonságos, multi-tenant és tranzakcionális RPC függvényt vezetünk be:

1. **`check_chart_of_accounts_preset_usage(p_preset_id UUID)`**:
   - `SECURITY DEFINER`, `STABLE`, multi-tenancy védelemmel (`company_members` ellenőrzés).
   - Felméri a sablonhoz tartozó összes hivatkozást (`acc_journal_lines`, `transactions`, `invoices`, `nav_invoices`, `fixed_assets`).
   - Visszaadja a pontos darabszámokat és az érintett főkönyvi számlák reprezentatív mintáját.
   - Eldönti, hogy a sablon közvetlenül törölhető-e (`can_delete_directly`).

2. **`delete_chart_of_accounts_preset(p_preset_id UUID, p_target_preset_id UUID DEFAULT NULL)`**:
   - `SECURITY DEFINER`, `VOLATILE`.
   - **Rendszerszintű sablon védelem:** Szigorúan tiltja a rendszerszintű és beépített sablonok törlését (`company_id IS NULL OR type <> 'custom'` esetén `42501` hiba).
   - **Aktív sablon védelem:** Ha a sablon `is_active = true`, szigorúan tiltja a törlést (`P0001` hiba).
   - **Függőség-ellenőrzés:** Ha léteznek hivatkozások, de nincs célsablon megadva, tiltja a törlést (`P0003` hiba).
   - **Automatikus Tétel-átkötés (Remapping):**
     - Megkeresi a célsablonban az azonos számlaszámú (`gl_number`, pontok és szóközök figyelmen kívül hagyásával) főkönyvi számlákat prioritási sorrendben (egzakt egyezés megelőzi a normalizált egyezést).
     - Ha bármely hivatkozott számla hiányzik a célsablonból, a tranzakció visszagördül (rollback), és felsorolja a hiányzó számlákat (`P0004` hiba).
     - Átköti az összes `acc_journal_lines`, `transactions`, `invoices`, `nav_invoices`, `fixed_assets`, `transaction_rules` rekordot a célszámlára.
     - Frissíti az `annual_reports` és `accrual_entries` táblákban a sablonmutatókat a célsablonra, megelőzve az integritássértést a `NOT NULL` mezőkön.
   - **Tranzakciós Immutability Védelem Feloldása:**
     - Az `acc_enforce_line_immutability` trigger felkészítésre került a lokális `visibill.allow_gl_remap` tranzakciós munkamenet-változóra (`is_local = true`). Kizárólag akkor engedi a `gl_account_id` cseréjét, ha az összeg, a tartozik/követel jelleg, a tételsorszám és a fejléc változatlan, így a zárt/lekönyvelt tételek könyvviteli egyensúlya garantáltan sértetlen marad.
   - **Tiszta és Hierarchikus Törlés:**
     - Törli a kapcsolódó mérleg- és eredménykimutatás leképezéseket (`bs_mapping`, `pnl_mapping`).
     - Nullázza a `gl_accounts.parent_id` mezőket (megelőzve a self-referencing idegen kulcs hibákat).
     - Törli a `gl_accounts` tételeket és a `chart_of_accounts_presets` fejlécet.

### 2.2 Frontend UI & UX Megújítás (`ManagePresetsModal.tsx`)
- **Aktív sablon tiltása a gombon:** Az aktív sablon melletti törlés gomb `disabled`, Lucide `Trash2` ikonnal és `CustomTooltip`-pel ellátva (*"Az aktív számlatükör sablon nem törölhető. Előbb aktiválj egy másik sablont!"*).
- **Megfelelés a P-067 és P-071 irányelveknek (AlertDialog):**
  - A korábbi böngésző `window.confirm()` helyett shadcn/ui `AlertDialog` jelenik meg.
  - Ha nincsenek hivatkozások: egyszerű, biztonságos megerősítő kérdés.
  - Ha vannak hivatkozások: borostyánsárga figyelmeztető kártya, tételes bontás (naplótételek, tranzakciók, számlák, eszközök, beszámolók), és legördülő választó a célszámlatükör kijelöléséhez (*"Hová kössük át a hivatkozásokat a törlés előtt?"*).
- **Strukturált React Query naplózás és gyorsítótár-kezelés:**
  - `mutationKey: ['deletePreset', companyId]` explicit kulcs hozzáadva, megszüntetve az `UnknownMutation` bejegyzéseket.
  - A sikeres törlés automatikusan hívja a kanonikus `invalidateGlQueries` függvényt a törölt és a célsablonra is, valamint frissíti az érintett számla- és tranzakciólistákat.
- **Akadálymentesség (a11y):** Minden gomb explicit `aria-label` attribútumot kapott.

---

## 3. Consequences

- **Pozitív:**
  - Zéró könyvelési adatvesztés: a számlatükör csere nem teszi tönkre a lekönyvelt naplótételeket és a banki tranzakciók kontírozását.
  - Tiszta felhasználói élmény és érthető magyar nyelvű hibajelzések nyers PostgreSQL kódok helyett.
  - Automatizált audit-barát naplózás a `queryClient` szintjén.
- **Integritási Garanciák:**
  - `ON DELETE RESTRICT` megmaradt az `acc_journal_lines` táblán.
  - Az immutability trigger szavatolja, hogy kézi vagy véletlen felülírás nem módosíthat lekönyvelt tételeket, kizárólag a tranzakciós RPC végezhet 1:1 számlaszám átkötést.
  - A beépített rendszerszintű sablonok törlése védett.

## Kapcsolódó
- [P-071: Biztonságos Számlatükör Törlés és Tételek Átkötése UX](../../product/decisions/P-071-safe-chart-of-accounts-preset-deletion-and-remapping-ux.md)
- [A-016: PostgreSQL Lekérdezési és Hozzáférési Stratégia](./A-016-postgresql-query-strategy.md)
- [P-067: Főkönyvi Könyvelési Státusz Szűrés és Naplózási Kormányzás](../../product/decisions/P-067-gl-posting-status-filter-and-journal-governance-ux.md)
