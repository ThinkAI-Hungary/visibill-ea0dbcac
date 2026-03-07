

## Kapcsolt bizonylatok megnyitása a Beküldött számlák lenyitható menüjében

### Probléma
A NAV számlák lenyitható sorában a `ExpandedInvoiceRow` komponens megkapja az `onViewInvoice` callback-et, így a kapcsolt beküldött számlák kattinthatóak és megnyitják a számla részleteit/képét. A Beküldött számlák lenyitható sorában viszont ez a prop hiányzik (sor ~2174-2180), ezért a kapcsolt bizonylatok nem kattinthatóak.

### Megoldás

**`src/pages/InvoicesPage.tsx`** -- 1 módosítás:

A Beküldött számlák `ExpandedInvoiceRow` komponensénél (sor ~2174-2180) hozzáadjuk az `onViewInvoice` prop-ot, ugyanazzal a logikával, mint a NAV számlák expandált soránál: a kattintásra beállítja a `selectedInvoice`-t és megnyitja az `imageDialogOpen`-t.

```tsx
<ExpandedInvoiceRow
  colSpan={10}
  matchedSubmittedInvoices={[]}
  matchedNavInvoices={matches.matchedNav}
  matchedTransactions={matches.matchedTransactions}
  linkedInvoices={matches.linkedInvoices}
  onViewInvoice={(inv) => {
    setSelectedInvoice(inv as any);
    setImageDialogOpen(true);
  }}
/>
```

Ezzel a kapcsolt bizonylatok kártyái kattinthatóak lesznek (kursor, hover effekt, szem ikon), és megnyitják a számla képét/részleteit.

