

## Reference_number-es számlák: szürke+dőlt összegek + kizárás az összesítésekből

### Összefoglaló

A `reference_number` mezővel rendelkező beküldött számlák (pl. előlegszámlák, díjbekérők) megjelennek a táblázatban, de Nettó/Bruttó/ÁFA értékeik szürkék és dőltek lesznek, és kizárásra kerülnek minden összesítésből, grafikonból.

### Érintett fájlok és változások

**1. `src/pages/InvoicesPage.tsx` - Szürke + dőlt összegek (~2153-2177)**

A Nettó, Bruttó, ÁFA cellák `className`-jében: ha `invoice.reference_number` truthy, a szín `text-muted-foreground italic` lesz a szokásos piros/zöld helyett. Az ÁFA cella jelenleg mindig `text-muted-foreground` -- ott is dőlt lesz, ha van reference_number.

**2. SQL migráció - `get_invoice_aggregates` RPC frissítése**

A `WHERE` feltételbe bekerül: `AND i.reference_number IS NULL`, hogy a reference_number-es tételek ne számítsanak bele a Dashboard beküldött számla összesítésbe.

**3. `src/pages/Index.tsx` - Kategória statisztikák (~703)**

Az invoices lekérdezés már `*`-ot selectel, tehát a `reference_number` mező elérhető. A `getCategoryBreakdownData` függvényben a `categoryInvoices` szűrőbe bekerül: `&& !invoice.reference_number`.

**4. `src/pages/Index.tsx` - Készpénzes kiadás lekérdezés (~657-662)**

A `cashExpensesQuery`-hez hozzáadás: `.is('reference_number', null)`.

**5. `src/pages/PettyCashPage.tsx` - Készpénzes kiadás lekérdezés (~110-114)**

A beküldött számlák lekérdezéséhez: `.is('reference_number', null)`.

### Megjegyzés

A `nav_invoices` tábla nem tartalmaz `reference_number` mezőt, ezért a NAV füleken és a `get_nav_invoice_aggregates` RPC-ben, valamint a havi grafikonban (ami NAV számlákat használ) nincs teendő.

