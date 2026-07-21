# Decision 042: Sztornó Számla Üzleti Kezelési Szabály

**Status:** Decided  
**Category:** Business Rule / Invoice Management  
**Question:** Mi a teendő ha egy NAV-ból érkező sztornó számlához nem érkezik banki tranzakció?  
**Decision:** A sztornó számlához nem kötelező banki tranzakció — a felhasználó manuálisan zárhatja le "kifizetett" státuszba az összes kapcsolt bizonylatot együtt.  
**Rationale:** A sztornó számla az eredeti számla érvénytelenítése, nem hoz létre új pénzügyi kötelezettséget. A lezárás üzletileg helyes, könyvelési szempontból is indokolt — a sztornó + az eredeti számla összege nullát ad.

## Üzleti Szabályok

1. **Sztornó számla ≠ fizetési kötelezettség** — a sztornó a követelés érvénytelenítése, nem új egyenleg
2. **Atomikus lezárás** — a sztornó és az összes kapcsolt bizonylat (eredeti számla, beküldött képek) egyszerre kerül "Kifizetett" státuszba
3. **Visszavonhatóság** — ha a lezárás téves volt, a user visszavonhatja, és a bizonylatok ismét "Nyitott" státuszba kerülnek
4. **Biztonsági zárolás** — csak a `storno_settled` típusú lezárás vonható vissza automatikusan, valódi kézi fizetések érintetlenek maradnak
5. **Szükséges-e beküldött sztornó számlakép?** — Nem kötelező. A rendszer NAV-NAV direkt összekötéssel is megtalálja az eredeti számlát (ha az `original_invoice_number` mező ki van töltve a NAV szinkronból)

## Érintett Bizonylatok

| Bizonylat típus | Hol? | Lezárás módja |
|---|---|---|
| Sztornó NAV számla | `nav_invoices` | `is_manual_payment = true` |
| Beküldött sztornó számlakép | `invoices` | `is_manual_payment = true` |
| Eredeti NAV számla | `nav_invoices` | `is_manual_payment = true` |
| Beküldött eredeti számlakép | `invoices` | `is_manual_payment = true` |

## Kapcsolódó

- [A-042: Sztornó Settle Architektúra](../../architecture/decisions/A-042-storno-settle-architecture.md)
- [P-048: Sztornó Lezárás UX](../../product/decisions/P-048-storno-settle-ux.md)
- [040: Számla Kapcsolatok és Párosítási Logikák](./040-invoice-relations-matching.md)
- [041: Manuális Kifizetés Rögzítése](./041-manual-payment-recording.md)
