

## Mélységi korlát növelése a bizonylatláncban

### Probléma
A jelenlegi BFS iteráció `depth < 5` korlátozással fut. Ez **nem** az egyetlen számlához tartozó kapcsolódó elemek számát korlátozza, hanem a **lánc mélységét** (A→B→C→D→E→F). Tehát ha A-ból indulunk és 6 lépés mélyen van G, az már nem kerül lekérdezésre.

A gyakorlatban 5 mélység ritkán fogy el (minden szinten több elem is jöhet egyszerre), de biztonsági szempontból érdemes növelni.

### Megoldás

**`src/pages/InvoicesPage.tsx`** (~588. sor):
- `depth < 5` → `depth < 20`
- A meglévő `break` feltétel (ha nincs új elem) garantálja, hogy felesleges query-k nem futnak — a 20 csak egy biztonsági felső határ.

Egy soros változtatás, a logika és a korai kilépés (`if (newInvoices.length === 0) break`) változatlan marad.

