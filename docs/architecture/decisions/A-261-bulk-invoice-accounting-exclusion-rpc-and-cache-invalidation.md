# A-261: Csoportos Számla Könyvelési Kizárás Atomi RPC és Reaktivitás

**Status:** Decided  
**Date:** 2026-10-15  
**Utoljára frissítve:** 2026-10-15  

---

## 🏛️ Context
A Visibill számlanézetében (`/invoices`) a felhasználók és könyvelők gyakran több tucat vagy több száz számlát kezelnek egyszerre. Az egyedi számlák könyvelésből való kizárását (végleges kizárás vagy Áfa tv. szerinti kérdéses számla / halasztott ÁFA) korábban a `set_invoice_accounting_exclusion` RPC biztosította ([A-234](./A-234-deferred-vat-deduction-and-questionable-invoices-architecture.md)).

Azonban csoportos kijelölés esetén (multiselect) nem állt rendelkezésre olyan lebegő műveleti funkció, amellyel a kijelölt számlák egyszerre, egyetlen hálózati kérésben és atomi tranzakcióban lettek volna kizárhatók vagy visszaállíthatók. Továbbá az eredeti, korábbi migrációból származó egyedi `set_invoice_accounting_exclusion` eljárás hibásan nem létező táblára (`submitted_invoices`) és hibás oszlopnévre (`is_excluded_from_accounting`) hivatkozott.

---

## 💡 Decision

### 1. Atomi Kötegelt Tárolt Eljárás (`bulk_set_invoice_accounting_exclusion`)
Létrehoztunk egy új, tranzakcionális, atomi PostgreSQL tárolt eljárást a `20261015140000_bulk_invoice_accounting_exclusion.sql` migrációban:

```sql
bulk_set_invoice_accounting_exclusion(
  p_company_id uuid,
  p_invoice_ids uuid[],
  p_is_submitted boolean,
  p_exclusion_type text DEFAULT 'PERMANENT',
  p_reason text DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid()
)
```

**Működési mechanizmus:**
1. **Biztonsági kapu:** Ellenőrzi a céghez való hozzáférést a `public.has_accounty_company_access(p_company_id)` segítségével, valamint megakadályozza az írást lezárt időszakban az `rls_write_denied_company_ids()` révén.
2. **Kötegelt frissítés `ANY(p_invoice_ids)` alapján:**
   - Beküldött számlák (`invoices` + `invoice_items`):
     - Ha `p_exclusion_type IS NULL` (visszaállítás): `exclude_from_accounting = false`, `accounting_exclusion_type = 'PERMANENT'`, `deferred_vat_reason = NULL`, `deferred_vat_since = NULL`, `deferred_vat_target_period = NULL`.
     - Ha kizárás (`'PERMANENT'` vagy `'DEFERRED_VAT'`): `exclude_from_accounting = true`, a megadott típus, az indoklás és az aktuális `now()` időbélyeg kerül mentésre.
   - NAV számlák (`nav_invoices` + `nav_invoice_items`): azonos szemantikával frissülnek a fejlécek és tételsorok.
3. **Könyvelési Napló és Pénzügyi Integritás:**
   - Kizárás esetén az eljárás automatikusan törli a kapcsolódó még nem zárt naplóbejegyzéseket (`acc_journal_headers`), így a kizárt számlák nem szemetelik a főkönyvet és a folyószámlát.

### 2. Egyedi RPC Javítása (`set_invoice_accounting_exclusion`)
Javításra került a korábbi `set_invoice_accounting_exclusion` eljárás is, amely mostantól a helyes `public.invoices` és `public.invoice_items` relációkat és az `exclude_from_accounting` oszlopot frissíti.

### 3. Frontend Optimista Frissítés és Multi-Domain Reaktivitás
A `useInvoiceMutations.ts` hook `handleBulkExcludeFromAccounting` metódusa:
1. **Optimista állapotfrissítés:** Azonnal átállítja a helyi React Query listát (`updateList`), így a felhasználói felület zökkenőmentes és villódzásmentes marad.
2. **Keresztmodul Cache Invalidáció:** A sikeres RPC végrehajtás után invalidálja a releváns lekérdezési kulcsokat:
   - `['questionable-invoices', companyId]`
   - `['vat-return', companyId]`
   - `['gl-balances', companyId]`
   - `['acc-journal-headers', companyId]`
   - `['invoices-summary', companyId]`
3. **Lebegő Akciósáv Integráció:** Az `InvoiceBulkActionsBar.tsx` komponens Radix `DropdownMenu` menügombbal bővült, amely dinamikusan jelzi a kijelölt tételek állapotát (`Kizárva` vs `Nem könyvelem`), és közvetlen visszaállítási vagy kizárási lehetőséget kínál.

---

## ⚡ Consequences

### Pozitív
- **100x Gyorsabb Kötegelt Kezelés:** 100 számla kizárása vagy visszaállítása 1 db atomi SQL utasítással fut le a korábbi N db egyedi kérés helyett.
- **Hibátlan Adatbázis Integritás:** A számla tételei és fejléce garantáltan szinkronban maradnak.
- **Nulla Főkönyvi Hulladék:** A kizárt számlák naplótételei automatikusan törlődnek.
- **Tökéletes UX:** Az optimista frissítésnek köszönhetően a lebegő sáv azonnal visszajelzést ad.

### Negatív & Kockázatok
- Ha a felhasználó véletlenül több száz számlát zár ki, az ÁFA analitika és a bevallás hirtelen lecsökkenhet; ezt a felugró megerősítő és kérdéses számla dialógus (`BulkExclusionDialog`), valamint a visszavonhatóság védi.

---

## 🔗 Kapcsolódó
- **PRD:** [P-191: Számlák Csoportos Könyvelési Kizárása UX](../../product/decisions/P-191-invoices-bulk-exclude-from-accounting-ux.md)
- **ADR:** [A-234: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák Architektúrája](./A-234-deferred-vat-deduction-and-questionable-invoices-architecture.md)
- **ADR:** [A-122: Nem Könyvelt Státusz Kétirányú Szinkronizációja](./A-122-exclude-from-accounting-sync-and-optimistic-ui.md)
- **BDR:** [065: ÁFA Levonásba Helyezés Halasztása](../../business/decisions/065-deferred-vat-deduction-and-questionable-invoices.md)
- **Migráció:** `supabase/migrations/20261015140000_bulk_invoice_accounting_exclusion.sql`
