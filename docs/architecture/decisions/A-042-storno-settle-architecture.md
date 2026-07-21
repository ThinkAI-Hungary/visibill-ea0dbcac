# A-042: Sztornó Számla Kézi Lezárás (Storno Settle) Architektúra

**Status:** Decided  
**Date:** 2026-07-21  
**Utoljára frissítve:** 2026-07-21

## Context

A NAV rendszerből érkező STORNO típusú számlákhoz nem mindig érkezik banki tranzakció/utalás, mivel a sztornózás önmagában nullázza az eredeti követelést. A Visibill rendszerben ugyanakkor a számla "Nyitott" státuszban marad, amíg nem párosul tranzakcióval — ez félrevezető a könyvelők számára.

Az üzleti igény: a user jelezze a rendszernek, hogy a sztornó számlát és az összes kapcsolt bizonylatot "kifizetett" állapotba kell helyezni, visszavonható módon, anélkül hogy valódi tranzakciót kellene feltölteni.

## Decision

### Kézi lezárás toggle gomb (Sztornó lezárása / Visszavonás)

A sztornó NAV számlák kibontott nézetében (`ExpandedInvoiceRow`) megjelenik egy "Sztornó lezárása" gomb, amely:
1. Confirm dialogot nyit (`StornoSettleDialog`)
2. Az `mark_storno_group_settled` RPC-t hívja
3. Cache invalidálás után a modal bezárul, a sorok zöldre váltanak
4. Visszavonható: "Visszavonás" gomb újra megjelenik, az `unmark_storno_group_settled` RPC-t hívja

### Kétlépéses láncolat logika

Az RPC-k két prioritásos úton keresik az eredeti számlát:

**Régi ÚT (prioritás 1 — ha van beküldött sztornó számlakép):**
```
STORNO NAV invoice
  → invoices.bizonylatsorszam egyezés (beküldött sztornó kép)
  → invoices.reference_number → eredeti NAV invoice
  → eredeti NAV → invoices.bizonylatsorszam (eredeti beküldött kép)
```

**Fallback ÚT (prioritás 2 — ha nincs beküldött számlakép):**
```
STORNO NAV invoice.original_invoice_number
  → eredeti NAV invoice (közvetlen NAV-NAV match)
  → eredeti NAV → invoices.bizonylatsorszam (beküldött kép ha van)
```

A két ÚT egymást kizárja (`IF/ELSE`), nem ütköznek. Ha a felhasználó utólag beküldi a sztornó számlaképet, a régi ÚT fut — ez a pontosabb (user-validated) adat.

### `original_invoice_number` mező

Az `nav_invoices` táblában új `original_invoice_number TEXT` oszlop tárol NAV XML `<invoiceReference><originalInvoiceNumber>` értéket. Ezt a `nav-auto-sync` Edge Function tölti ki a részletes lekéréskor (`details_fetched` ág).

### `is_manual_payment` és row rendering

A `InvoicesPage.tsx` `isPaid` számításában az `invoice.is_manual_payment` feltétel is szerepel — ezt a sessionunkban pótoltuk, mert a régi logikából hiányzott. Teljes `isPaid` feltétel:
```js
invoice.paid === true || !!invoice.transaction_id || !!invoice.is_manual_payment 
  || directlyMatched || indirectlyMatched || linkedChainMatched
```

### Biztonsági zárolás (unmark)

Az `unmark_storno_group_settled` RPC csak `manual_payment_type = 'storno_settled'` jelzővel ellátott rekordokat állít vissza — valódi kézi fizetést (pl. `'manual'` type) véletlenül nem törölhet.

## Consequences

**Pozitív:**
- Sztornó számlák kezelhetők tranzakció nélkül is
- Atomikus RPC — partial update nem lehetséges
- Reversible design — visszavonható, nincs adatvesztés
- Két réteg robusztus: beküldött számlakép ÚT + NAV-NAV direkt fallback
- Zöld sorok (`Kifizetve` badge) azonnal az RPC visszatérte + cache invalidálás után

**Negatív / Trade-off:**
- A `original_invoice_number` mező feltöltése a részletes NAV lekérés (INBOUND invoices: `QueryInvoiceData` API hívás) után történik — régebbi STORNO számlák csak re-fetch után kapják meg
- A fallback ÚT (NAV-NAV direkt) nem fedi azt az esetet, ha az eredeti számla más periódusból van és nincs a DB-ben — ilyenkor csak a STORNO NAV számla kerül lezárásra

## RPC-k

| RPC | Funkció |
|-----|---------|
| `mark_storno_group_settled(p_storno_nav_id UUID)` | Lezárja a láncolatot (SECURITY DEFINER, company check) |
| `unmark_storno_group_settled(p_storno_nav_id UUID)` | Visszavonja — csak `storno_settled` type-on |

## Kapcsolódó

- [A-012: NAV Online Számla API v3 integráció](./A-012-nav-integration.md) — NAV sync pipeline
- [A-016: PostgreSQL query stratégia — RPC katalógus](./A-016-postgresql-query-strategy.md) — 2 új RPC
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md) — company_id check SECURITY DEFINER
- [A-014: React Query cache stratégia](./A-014-react-query-cache.md) — `invalidateInvoiceData` invalidálás
