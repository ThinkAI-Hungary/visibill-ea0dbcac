# A-263: Készpénzes Számlák 381-es Kontírozása, Házipénztár Hozzárendelés és Routing Szabály Létrehozás

**Dátum:** 2026-10-15  
**Státusz:** ✅ Elfogadva  
**Kontextus:** VisiBill Számlák (`/invoices`), Házipénztár modul (`petty_cash_registers`, `petty_cash_routing_rules`)  
**Kapcsolódó döntések:** [A-125](./A-125-atomic-petty-cash-invoice-settlement-and-auth-resilience.md), [A-142](./A-142-customer-and-vat-gl-rules-enforcement.md), [A-249](./A-249-petty-cash-invoice-linking-and-unlinking-atomic-rpcs.md), [P-193](../../product/decisions/P-193-cash-invoice-petty-cash-assignment-and-rule-prompt.md)

---

## 1. Kontextus és Problémafelvetés
A készpénzes számlák könyvelése sajátos számviteli eljárást igényel:
1. **Kimenő készpénzes számlák:** Nem a hagyományos vevőkövetelés (311) főkönyvi számlára könyvelendők, hanem azonnal a pénztárszámlára (381 Pénztár). A felhasználói visszajelzések alapján az ilyen számlák manuális 311-ről 381-re állítása felesleges adminisztrációs teher volt.
2. **Készpénzes számlák és házipénztárak kapcsolata:** Egy vállalkozásnak több házipénztára is lehet (pl. Főpénztár, Bolti kassza, Valutapénztár). Korábban nem volt közvetlen lehetőség a számla kinyitott nézetében vagy tételes dialógusában megadni, hogy az adott készpénzes bizonylat melyik házipénztárba kerüljön be, illetve nem létezett partner alapú szabályalkotás sem a pénztári automatizációhoz.

---

## 2. Döntési Invariánsok és Szabályok
1. **381 Default, de Kézzel Felülbírálható:** Kimenő készpénzes számlák esetén az alapértelmezett partneri főkönyvi számlaszám a `381` (Pénztár). Ha a könyvelő expliciten más főkönyvi számra (pl. 311, 312) módosítja, a rendszer tiszteletben tartja a kézi döntést és a trigger nem írja felül.
2. **Atomi Pénztár Hozzárendelés (`assign_invoice_to_petty_cash_register` RPC):** A pénztár kiválasztásakor vagy leválasztásakor atomi tranzakcióban frissül a számla `petty_cash_register_id` idegen kulcsa, valamint a `petty_cash_entries` tábla megfelelő bejegyzése. Fontos sémainvariáns, hogy a `petty_cash_entries` tábla `direction` check constraintje kisbetűs értékkészletet követel meg: kimenő számlánál `'in'`, bejövő számlánál `'out'`. A `nav_invoices` relációban az összegek a kanonikus `invoice_gross_amount`, `invoice_net_amount`, `invoice_vat_amount` oszlopokból származnak, és nem létezik `updated_at` mező.
3. **Azonnali Szabály-felajánlás (`PettyCashRuleQuickSaveDialog`):** Amint a felhasználó manuálisan pénztárhoz rendel egy készpénzes számlát, a rendszer felugró dialógusban felajánlja az automatikus szabály mentését az adott partnerre a `petty_cash_routing_rules` táblába (`create_petty_cash_routing_rule` RPC).
4. **Trigger Alapú Automatikus Feloldás és Felülírás-védelem:** Új számla beérkezésekor (`TG_OP = 'INSERT'`) vagy a fizetési mód készpénzre változásakor az adatbázis trigger (`trg_auto_cash_invoice_gl_and_register`) automatikusan feloldja a célpénztárat a meglévő routing szabályok vagy a cég alapértelmezett pénztára alapján. `UPDATE` esetén a trigger nem bírálja felül a mezőt, így a manuális leválasztás (`p_register_id := NULL`) perzisztens marad.

---

## 3. Megvalósítás

### 3.1 Adatbázis Migráció (`supabase/migrations/20261015160000_cash_invoices_petty_cash_and_381_gl.sql`)
1. **Séma bővítés:**
   - `nav_invoices.petty_cash_register_id` (FK `petty_cash_registers.id`, ON DELETE SET NULL),
   - `invoices.petty_cash_register_id` (FK `petty_cash_registers.id`, ON DELETE SET NULL),
   - B-tree indexek a gyors szűréshez és kapcsoláshoz.
2. **Trigger:** `trg_auto_cash_invoice_gl_and_register()`
   - Kimenő készpénzes számla esetén `partner_gl_number := '381'` (ha korábban nem volt beállítva).
   - `petty_cash_routing_rules` kiértékelése partner név és adószám alapján.
   - Guarded trigger végrehajtás: csak `INSERT` vagy fizetési mód változás esetén rendel automatikusan alapértelmezett kasszát, elkerülve a manuális leválasztás visszacsinálását.
3. **RPC-k:**
   - `assign_invoice_to_petty_cash_register(p_company_id, p_invoice_id, p_is_submitted, p_register_id)` (SECURITY DEFINER, RLS és jogosultság-ellenőrzéssel, szigorúan kisbetűs `direction` értékekkel és pontos mezőnevekkel).
   - `create_petty_cash_routing_rule(p_company_id, p_target_register_id, p_partner_pattern, p_source_type, p_currency, p_priority)`.
   - `acc_generate_drafts_from_ledger` frissítve a `381` partner GL kód kezelésére (V vevői naplóban a Tartozik oldalon a 381 terhelődik a 311 helyett).

### 3.2 Frontend Komponensek
- **`PettyCashRegisterSelect.tsx`:** Újrafelhasználható pénztár választó Select komponens, alapértelmezett pénztár jelzéssel és leválasztási opcióval.
- **`PettyCashRuleQuickSaveDialog.tsx`:** Szabály mentési dialógus előre kitöltött partner névvel és célpénztárral.
- **`InvoiceGlAccountSelector.tsx`:** Kibővítve a `381 - Készpénz / Pénztár` opcióval kimenő oldalon és automatikus 381 fallbackkel készpénzes fizetési módnál.
- **`ExpandedInvoiceRow.tsx` & `InvoiceItemsDialog.tsx`:** Mind a kinyitott számlasorban, mind a tételes dialógus fejlécében megjelenik a Házipénztár választó kártya és a szabálymentő dialógus.

---

## 4. Következmények és Eredmények
- **Automatikus könyvelési pontosság:** A készpénzes kimenő számlák azonnal a megfelelő pénztári főkönyvi számlára (381) kerülnek a vevőkövetelés helyett.
- **Zökkenőmentes házipénztár integráció:** A felhasználónak nem kell átnavigálnia a Házipénztár modulba; a számlalistából egy kattintással hozzárendelheti a bizonylatot és létrehozhatja az ismétlődő szabályt.
- **Adatintegritás:** Az atomi RPC gondoskodik a számla és a pénztárkönyv bejegyzések egyidejű és hibabiztos konzisztenciájáról.
