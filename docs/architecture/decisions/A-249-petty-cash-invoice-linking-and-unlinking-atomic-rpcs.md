# A-249: Házipénztári Utólagos Számla-hozzárendelés és Leválasztás Atomi RPC Architektúra

**Status:** Decided  
**Date:** 2026-10-12  
**Utoljára frissítve:** 2026-10-12  

---

## Context

A Visibill / eaisyBooks Házipénztár moduljában a felhasználók mindennapi munkája során gyakran előfordul, hogy készpénzes bizonylatokat rögzítenek (vagy pénztárgép zárásokból kerülnek be tételek), amelyekhez a számla abban a pillanatban még nem áll rendelkezésre, vagy később érkezik be a könyvelésre. Korábban, ha egy pénztári kiadás vagy bevétel önálló manuális tételként (`manual_standalone`) került rögzítésre, a rendszer nem biztosított utólagos felületet vagy atomi tranzakciót arra, hogy egy nyitott szállítói vagy vevői számlát hozzákössenek a már meglévő pénztári sorhoz.

Emellett a téves hozzárendelések biztonságos visszavonása is kritikus igényként merült fel: ha egy számlát hibásan rendeltek hozzá egy pénztári tételhez, azt úgy kellett tudni leválasztani, hogy a számla azonnal visszakerüljön kifizetetlen nyitott státuszba (`fizetve = false`), elkerülve a „fantom kiegyenlítéseket” és a folyószámla-eltéréseket.

---

## Decision

Kifejlesztettünk egy kétlépcsős, atomi adatbázis-szintű és kliensoldali hibatűrő megoldást:

### 1. Atomi PostgreSQL RPC-k (`SECURITY DEFINER`)
Létrehoztunk két atomi eljárást a `20261012121500_link_petty_cash_entry_to_invoice.sql` migrációban:

* **`public.link_petty_cash_entry_to_invoice(p_company_id uuid, p_entry_id uuid, p_invoice_id uuid) RETURNS jsonb`:**
  1. **Jogosultság-ellenőrzés:** Csak a cég tagjai (`company_members`) vagy `is_support_admin()` futtathatja.
  2. **Partner feloldás:** Ha a pénztári tétel még nem rendelkezett `partner_id`-val, adószám (első 8 jegy) vagy név alapján automatikusan megkeresi és kitölti a partnert a `partners` törzsből.
  3. **Pénztári tétel frissítése:** `source_table = 'invoices'`, `source_id = p_invoice_id`, `source_type = 'invoice_settlement'`.
  4. **Számla lezárása:** `fizetve = true`, `is_manual_payment = true`, `manual_payment_date = entry.entry_date`, `manual_payment_type = 'cash'`, `manual_payment_note = 'Házipénztár bizonylathoz kapcsolva'`.
  5. Egyetlen atomi tranzakcióban garantálja az állapotkonzisztenciát (ha a számla vagy tétel nem található, `ROLLBACK`).

* **`public.unlink_petty_cash_entry(p_company_id uuid, p_entry_id uuid) RETURNS jsonb`:**
  1. Törli a hivatkozást a pénztári tételből: `source_table = NULL`, `source_id = NULL`.
  2. Ha a tétel számlához kapcsolódott, automatikusan visszanyitja a számlát: `fizetve = false`, `is_manual_payment = false`, `manual_payment_date = NULL`, `manual_payment_type = NULL`, `manual_payment_note = NULL`.

### 2. Kettős Végrehajtási Réteg (Resilient Execution Layer)
A frontend komponens ([AttachInvoiceDialog.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/petty-cash/AttachInvoiceDialog.tsx)) és a lenyitott sor ([EntriesTab.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/petty-cash/EntriesTab.tsx)) elsődlegesen az RPC-t hívja meg. Amennyiben az RPC valamilyen okból még nem elérhető (pl. folyamatban lévő DB rollout), egy determinisztikus Supabase kliensoldali tranzakciós fallback fut le, garantálva, hogy a felhasználói művelet soha ne akadjon el.

---

## Consequences

### Pozitív:
* **Nulla folyószámla-fantom:** A számla és a pénztári tétel állapota elválaszthatatlanul szinkronban van, mind összekapcsoláskor, mind leválasztáskor.
* **Egyszerű hibajavítás könyvelőknek:** Téves összerendelés esetén egyetlen kattintással és megerősítéssel leválasztható a számla, nem igényel adatbázis-szintű manuális beavatkozást.
* **Automatikus cache-érvénytelenítés:** A React Query kulcsok (`pettyCashEntries`, `pettyCashSummary`, `open-settlement-invoices`, `invoices`) azonnal frissülnek.

### Negatív / Kockázatok:
* Részfizetések esetén a számla jelenleg teljes egészében fizetettként jelölődik meg; a részösszegű készpénzes rendezés további analitikai bontást igényel.

---

## Kapcsolódó
* [P-183: Házipénztári Utólagos Számla-hozzárendelés és Leválasztás UX](../../product/decisions/P-183-petty-cash-invoice-attachment-and-unlink-ux.md)
* [070: Házipénztári Kézi Tételek és Számlák Összerendelésének Számviteli Szabályzata](../../business/decisions/070-petty-cash-invoice-settlement-and-unlink-policy.md)
* [A-204: Online Pénztárgép (OPG) Modul Architektúra és Házipénztár Integráció](./A-204-online-cash-register-opg-architecture.md)
* [A-233: Tranzakció Készpénzes Kiegyenlítés Házipénztárba](./A-233-transfers-manual-cash-settlement-to-petty-cash-and-gls-compensation-normalization.md)
