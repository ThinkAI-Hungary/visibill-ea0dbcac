# P-042 — Kategóriák és Projektek: Dual-table szinkronizáció és fallback megjelenítés

**Státusz:** ✅ Decided  
**Dátum:** 2026-06-26  
**Implementálva:** `InvoicesPage.tsx`, `Onboarding.tsx`, `Projects.tsx`, `useInvoiceData.ts`

---

## Kontextus

A számlák kategorizálása (GL kategória) és projekthez rendelése kritikus fontosságú a pénzügyi beszámolók elkészítéséhez. Mivel a rendszerben a számlák két külön táblában élnek (a feltöltött `invoices` és a NAV-ból lekért `nav_invoices`), felmerült az igény arra, hogy az azonos számlaszámmal rendelkező, párosított számlák kategóriája és projektje mindig szinkronban legyen, függetlenül attól, hogy melyik felületen végzik a hozzárendelést.

---

## Döntések

### 1. Dual-table frissítés (Szinkronizáció)
Bármelyik felületen (Kategória hozzárendelő kereső az Onboarding oldalon, vagy a Számlák oldal sor-szintű dropdownjai) történik meg a hozzárendelés, a rendszer mindkét Supabase táblát frissíti a számlaszám alapján:
- `invoices` táblában a `bizonylatsorszam` mező egyezése alapján.
- `nav_invoices` táblában az `invoice_number` mező egyezése alapján.

### 2. Keresőbar deduplikáció
Az Onboarding oldali kategória hozzárendelő keresőmező a két táblából lekérdezett számlákat számlaszám alapján deduplikálja (az `invoices` táblából jövő, feltöltött számla prioritást élvez), így a felhasználó számára egy számla csak egyszer jelenik meg. Mentéskor azonban mind a feltöltött, mind a NAV párja megkapja a kategóriát.

### 3. Fallback megjelenítés a számlalistában
A NAV számlák sorában a kategória és projekt oszlopban fallback logikát alkalmazunk: ha a NAV rekordban még nincs kitöltve a kategória/projekt, de a hozzárendelt beküldött számlán igen, akkor a felület automatikusan a beküldött számla értékeit jeleníti meg és teszi kiválaszthatóvá a NAV sor legördülő menüjében is.

### 4. Reaktív szín és név frissítés (Cache Invalidáció)
A kategóriák vagy projektek név- vagy színmódosítása után a React Query cache-t invalidáljuk (`queryClient.invalidateQueries`), így a számlalistában szereplő badge-ek (kategória pötty, projekt badge) azonnal frissülnek az új színnel és névvel a UI villogása nélkül:
- Kategória szerkesztés után invalidált kulcs: `['categories', companyId]`
- Projekt szerkesztés után invalidált kulcsok: `['projects', companyId]` és `['projectsList', companyId]`

---

## Kapcsolódó fájlok

- `src/pages/InvoicesPage.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/Projects.tsx`
- `src/hooks/useInvoiceData.ts`
- `src/components/ExpandedInvoiceRow.tsx`
- Táblák: `nav_invoices`, `invoices`, `categories`, `projects`
