

## Terv: `reference_number`-rel rendelkező számlák elrejtése a listából

### Megoldás

A `filteredAndSortedSubmittedInvoices` useMemo-ban egy extra filter feltétel hozzáadása: a `reference_number`-rel rendelkező számlák kiszűrése a megjelenítésből. A teljes `submittedInvoices` tömb változatlan marad, így a linked invoices lookup (lenyíló kártyák) továbbra is megtalálja ezeket.

### Implementáció

**`src/pages/InvoicesPage.tsx`**, sor ~811-812:

```typescript
let filtered = submittedInvoices.filter(invoice => {
  if (invoice.invoice_direction !== submittedDirection) return false;
  // Hide invoices that have a reference_number (they appear as linked items instead)
  if (invoice.reference_number) return false;
```

Egyetlen sor hozzáadása. A linked invoices map (`linkedInvoicesMap`) és a `getLinkedInvoices` függvény a teljes `submittedInvoices` tömbön dolgozik, így a kapcsolt lenyíló elemek továbbra is megjelennek.

