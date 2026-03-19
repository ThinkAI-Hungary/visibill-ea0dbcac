

# Computed Status konzisztencia — Végső javítások

## Összefoglaló
6 fájl + 1 DB trigger frissítés szükséges ahhoz, hogy a `fizetve`/`paid` státusz sehol ne legyen manuálisan állítható, és mindenhol a `transaction_id` jelenlétéből származzon.

---

## 1. DB Migration — Trigger kibővítés (`invoices` + `salary` transaction_id beállítás)

A `mark_nav_invoice_paid_on_transaction_match` trigger jelenleg csak `nav_invoices.transaction_id`-t állítja be match-kor. Ki kell bővíteni:
- Ha a `matched_invoice_id` az `invoices` táblára mutat → `invoices.transaction_id = NEW.id`
- Ha a `matched_invoice_id` a `salary` táblára mutat → `salary.transaction_id = NEW.id`

Ez biztosítja, hogy manuális párosítás (`handleMatch`) után is azonnal helyes legyen a `transaction_id` mindhárom táblában.

## 2. `InvoiceEditDialog.tsx` — Fizetve checkbox eltávolítása
- Törlés: `isPaid` state, `Checkbox` UI elem, `fizetve: isPaid` az update-ből
- A dialógus leírásából is kivenni a "fizetési státuszát" szöveget
- Read-only badge mutatása a `transaction_id` alapján (ehhez az `Invoice` type-ból kinyerni)

## 3. `InvoiceDetailPopup.tsx` — `fizetve` boolean → `transaction_id` badge
- A `select('*')` már mindent lekérdez, tehát a `transaction_id` elérhető
- 154. sor: `invoice.fizetve` → `!!invoice.transaction_id` (vagy a `FullInvoice` interfészhez `transaction_id` hozzáadása)

## 4. `ExpandedInvoiceRow.tsx` — NAV invoice `paid` → `transaction_id`
- `MatchedNavInvoice` interfészben: `paid: boolean | null` → `transaction_id: string | null`
- 287. sor badge: `inv.paid` → `!!inv.transaction_id`
- A hívó komponensben a select query-t is frissíteni: `paid` → `transaction_id`

## 5. `TransactionDetailsDialog.tsx` — Három javítás
- **Interfész**: `MatchedNavInvoice.paid` → `transaction_id: string | null`
- **Select query** (155. sor): `paid` → `transaction_id`
- **Badge** (519. sor): `matchedNavInvoice.paid` → `!!matchedNavInvoice.transaction_id`
- **matchStatus** (337-341. sor): Lecserélni `computeMatchStatus` importra a shared hookból

## 6. `InvoiceDetailPopup.tsx` interfész frissítés
- `FullInvoice` interfészbe felvenni `transaction_id: string | null`
- Badge: `!!invoice.transaction_id`

---

## Implementációs sorrend
1. DB migration (trigger kibővítés)
2. `InvoiceEditDialog.tsx` — checkbox eltávolítás
3. `InvoiceDetailPopup.tsx` — badge fix
4. `ExpandedInvoiceRow.tsx` — badge fix
5. `TransactionDetailsDialog.tsx` — badge + matchStatus fix

