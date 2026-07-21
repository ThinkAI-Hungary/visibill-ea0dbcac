# P-048: Sztornó Számla Kézi Lezárás UX

**Status:** Decided  
**Category:** Workflow / Invoice Management  
**Question:** Hogyan jelezze a felhasználó, hogy egy sztornó számlát (amelyhez nem érkezik tranzakció) kifizetett állapotba kell helyezni?  
**Decision:** "Sztornó lezárása" toggle gomb a sztornó NAV számla kibontott sorában, confirm dialoggal, visszavonható.  
**Current Implementation:** `ExpandedInvoiceRow.tsx` → `StornoSettleDialog.tsx`  
**Rationale:** A sztornó számlák nem generálnak valódi pénzáramlást, ezért soha nem kapnak banki tranzakciót. A rendszer számára mégis jelezni kell a lezárást, hogy ne maradjanak örökre "Nyitott" státuszban.

## UX Részletek

### Gomb — "Sztornó lezárása" / "Visszavonás"
- Kizárólag NAV oldali `invoice_operation = 'STORNO'` számlákon jelenik meg
- Lezárt állapotban a gomb felirata "Visszavonás" lesz, destructive piros helyett semleges szín
- Elhelyezés: `ExpandedInvoiceRow` akció sávja, a "Kézi fizetés" gomb mintájára

### Confirm Dialog (`StornoSettleDialog`)
- **Settle szöveg:** "A `<számla>` sztornó számla és minden hozzá kapcsolt bizonylat lezárásra, kifizetett státuszra kerül."
- **Unsettle szöveg:** "Visszavonja a `<számla>` sztornó számla lezárást."
- Async Modal UX pattern: API hívás → cache invalidálás → modal zár → sorok zöldre váltanak
- Loading fázis: csak `Loader2` spinner, nincs szöveges felirat

### Row státusz
- Lezárás után: sor zöld háttér + "Kifizetve" badge — azonnal a cache invalidálás után
- Visszavonás után: sor visszatér narancssárga/Nyitott állapotba

### Visszavonhatóság
- A "Visszavonás" gomb mindig elérhető lezárt sztornó számlákon
- Visszavonás után a rendszer ismét vár tranzakcióra

## Kapcsolódó

- [A-042: Sztornó Settle Architektúra](../../architecture/decisions/A-042-storno-settle-architecture.md)
- [BRD 042: Sztornó számla üzleti kezelési szabály](../../business/decisions/042-storno-invoice-business-rule.md)
- [12-dialogs-modals.md](../../design/12-dialogs-modals.md) — Async Modal UX pattern
