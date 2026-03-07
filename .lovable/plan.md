

## Kapcsolt bizonylatok kattinthatóvá tétele

### Változás

Az `ExpandedInvoiceRow.tsx`-ben a linked invoices kártyák jelenleg csak akkor kattinthatóak, ha van `image_url` vagy `melleklet_url`. A módosítás: **mindig kattinthatóak lesznek**, ha van `onViewInvoice` callback.

### Érintett sorok (`ExpandedInvoiceRow.tsx`)

1. **Sor ~122-130**: A `Card` className és onClick feltétel módosítása — az `image_url`/`melleklet_url` ellenőrzés eltávolítása, mindig legyen `cursor-pointer` és kattintható, ha `onViewInvoice` létezik.

2. **Sor ~148-152**: Az "Eye" ikon / "Kattints a részletekért" felirat feltételének módosítása — mindig jelenjen meg, ha `onViewInvoice` van.

Ez egyetlen fájl, ~6 sor módosítás.

