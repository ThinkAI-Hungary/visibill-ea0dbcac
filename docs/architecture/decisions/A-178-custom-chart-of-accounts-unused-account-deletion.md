# A-178: Egyéni Számlatükör Főkönyvi Szám Törlése és Relációs Integritás Védelem

**Dátum:** 2026-09-29  
**Státusz:** ✅ Elfogadva (Decided)  
**Érintett komponensek:** `GeneralLedgerTable.tsx`, `gl_accounts`, `bs_mapping`, `pnl_mapping`, `acc_journal_lines`, `gl_journal_entries`, `chart_of_accounts_presets`  
**Kapcsolódó PRD:** [P-139](../../product/decisions/P-139-custom-chart-of-accounts-unused-account-deletion-ux.md)  
**Előzmény:** [P-071](../../product/decisions/P-071-safe-chart-of-accounts-preset-deletion-and-remapping-ux.md), [A-003](../../architecture/decisions/A-003-multi-tenancy-rls.md)

---

## 1. Kontextus és Problémafelvetés

Az alkalmazásban az `AddGlAccountModal.tsx` segítségével a felhasználók új főkönyvi számokat vagy alábontásokat hozhatnak létre saját egyéni számlatükör sablonjukban (`chart_of_accounts_presets.type = 'custom'`). Ugyanakkor korábban nem létezett közvetlen felületi mechanizmus a tévesen létrehozott főkönyvi számok törlésére:
1. Ha egy könyvelő véletlenül téves számlát rögzített (pl. `4668` az általános ÁFA alá), az bent ragadt a sablonban és megjelent a főkönyvi kivonat fastruktúrájában.
2. A közvetlen adatbázis törlést korlátozza a PostgreSQL idegen kulcs (Foreign Key) védelem:
   - `bs_mapping.gl_account_id` $\to$ `gl_accounts.id` (`RESTRICT`)
   - `pnl_mapping.gl_account_id` $\to$ `gl_accounts.id` (`RESTRICT`)
3. Könyvelési audit és integritási szempontból szigorúan tilos olyan számlát törölni, amelyre már rögzítettek könyvelési tételt (`acc_journal_lines`, `gl_journal_entries`), vagy amelynek léteznek alszámlái (`gl_accounts.parent_id`).

---

## 2. Architektúrális Döntés

Bevezetésre került az egyéni számlatükör számlatörlési mechanizmusa az alábbi garanciákkal és integritás-ellenőrzési láncolattal:

### 2.1. Sablon és Cég Jogosultság Validáció
- A törlés kizárólag olyan számlatükör sablon esetén engedélyezett, amely:
  - `preset.type === 'custom'`
  - `preset.company_id === selectedCompany.id`
- Beépített / törvényi mintasablonokból (`type === 'generic'`, pl. számla_hu, számla_hr) nem törölhetők elemek.

### 2.2. Tranzakciós és Hierarchia Védelmi Kapuk (Pre-Deletion Guards)
Mielőtt bármilyen törlés megtörténne, a kliens atomi ellenőrzést hajt végre:
1. **Alszámla (Child Accounts) Retesz:**
   - Lekérdezés: `SELECT id FROM gl_accounts WHERE preset_id = :presetId AND parent_id = :accountId LIMIT 5;`
   - Ha létezik gyermek számla, a törlés blokkolva van és hibaüzenetet kap a felhasználó.
2. **Könyvelési Naplósor (Journal Lines) Retesz:**
   - Lekérdezés: `SELECT count(*) FROM acc_journal_lines WHERE company_id = :companyId AND account_code = :code;`
   - Ha `count > 0`, a törlés blokkolva van.
3. **Főkönyvi Tétel (gl_journal_entries) Retesz:**
   - Lekérdezés: `SELECT count(*) FROM gl_journal_entries WHERE debit_account = :code OR credit_account = :code;`
   - Ha `count > 0`, a törlés blokkolva van.

### 2.3. Függőségi Törlés (Cascade Cleanup)
Amennyiben a számla tiszta (nincs gyermek és nincs tétel):
1. Kapcsolódó mérleg-leképezés törlése: `DELETE FROM bs_mapping WHERE gl_account_id = :accountId;`
2. Kapcsolódó eredménykimutatás-leképezés törlése: `DELETE FROM pnl_mapping WHERE gl_account_id = :accountId;`
3. Főkönyvi számla törlése: `DELETE FROM gl_accounts WHERE id = :accountId AND preset_id = :presetId;`

### 2.4. Cache Érvénytelenítés és Reaktív UI Frissítés
Sikeres törlést követően azonnal lefut:
- `invalidateGlQueries(queryClient, companyId, presetId)`
- `glBalances`, `glItems`, `glJournalEntries`, `general-ledger-tree` TanStack Query cache invalidáció
- Részletező `<Sheet>` és `<AlertDialog>` bezárása, sikeres zöld visszajelző toast megjelenítése.

---

## 3. Következmények és Előnyök
- **Nulla adatvesztési kockázat:** Csak üres, tétellel nem rendelkező számlák törölhetők.
- **FK integritás:** Nincs PostgreSQL foreign key constraint violation hiba a leképezések szinkron takarítása miatt.
- **Önkiszolgáló ügyfélélmény:** A könyvelők azonnal, ügyfélszolgálati beavatkozás nélkül eltávolíthatják a tévesen rögzített számlaszámokat.
