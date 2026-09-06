# A-099: Számlakép Törlés Kettős Döntési Modell (Dual Choice), Lebegő Műveletsáv Kijelölés-kezelés és Lapozási Határeset Auto-Recovery

**Status:** ✅ Decided  
**Dátum:** 2026-09-06  
**Érintett modulok:** `src/components/InvoiceFullEditDialog.tsx`, `src/features/invoices/components/actions/InvoiceBulkActionsBar.tsx`, `src/features/invoices/components/dialogs/BulkDeleteDialog.tsx`, `src/hooks/useInvoiceMutations.ts`, `src/hooks/useInvoiceFilters.ts`, `src/components/ui/unified-pagination.tsx`

---

## 1. Kontextus és Problémafelvetés

A számlák kezelése során a felhasználók két szinten kezdeményezhetnek bizonylattörlést:
1. **Egyedi számla szintjén:** Az `InvoiceFullEditDialog` felületén szükség volt egy dedikált "Számlakép törlése" gombra, amennyiben a számlához tartozik csatolt számlakép vagy feltöltött fájl.
2. **Tömeges kijelölés szintjén:** A lebegő csoportos műveleti sávban (`InvoiceBulkActionsBar`) a "Törlés" gomb megnyomásakor a felhasználónak lehetőséget kell kapnia a törlés mélységének megválasztására.

### A korábbi működés hiányosságai
* **Nem volt egyértelmű a dokumentum sorsa:** A törlésnél nem lehetett szétválasztani azt az esetet, amikor a felhasználó pusztán a tévesen rögzített számlasort (`invoices` rekordot) kívánta törölni (de a feltöltött eredeti dokumentumfájlt meg akarta őrizni a DB-ben későbbi manuális feldolgozásra), attól az esettől, amikor a feltöltött fájlt és a tárolt fizikai objektumot is véglegesen meg kellett semmisíteni (`invoice_uploads` és Supabase Storage).
* **Lebegő műveletsáv UI/UX rétegződési és kijelölési hibák:**
  - A "Mégse" gomb megnyomásakor nem tűnt el a kijelölés és a lebegő sáv a képernyőről, mert az `activeSetSelected` hiányzott a lebegő sáv komponensében.
  - A csoportos Kategória és Projekt `DropdownMenuContent` rétegei becsúsztak a lebegő sáv (`z-[9999]`) alá, és vizuális stílusuk nem illeszkedett a Visibill modern űrlap-designjához.
* **Lapozási határ-inkonzisztencia (Pagination Boundary Bug):**
  - Ha egy listázásban 2 oldalnyi számla volt, és a felhasználó a 2. oldalon (ahol pl. csak 2 számla szerepelt) törölte a számlákat, a háttérben lefutó szerveroldali lekérdezés a 2. oldalon már 0 találatot adott vissza (`[]`).
  - Mivel a találati lista üres volt, a szerveroldali `(result[0] as any)?.total_count` `undefined` lett, ami miatt a `totalCount` 0-ra váltott, a `currentPage` viszont 2 maradt.
  - A felhasználó az üres 2. oldalon ragadt ("Nincs megjeleníthető számla"), és csak akkor tért magához a rendszer, ha kézzel visszakattintott az 1. oldalra.

---

## 2. Döntések és Architektúra

### A. Kettős Törlési Modell (Dual Choice Deletion Governance)

Mind az egyedi (`InvoiceFullEditDialog`), mind a tömeges (`BulkDeleteDialog`) törlésnél egy egységes megerősítő modál (`AlertDialog`) jelenik meg, amely két jól elkülönülő opciót kínál:

1. **1. Opció — Csak a számlasor törlése (`row_only`):**
   - Csak a kijelölt `invoices` rekord(ok) és a hozzájuk tartozó `invoice_items` tételek törlődnek a relációs adatbázisból (cascade törléssel).
   - Az `invoice_uploads` táblában lévő eredeti feltöltési rekord és a Supabase Storage vödrökben (`invoice-uploads`, `szla_image`) tárolt fájlok sértetlenek maradnak.
2. **2. Opció — Számlasor és feltöltött fájl törlése (`row_and_file`):**
   - Törlődnek az `invoices` rekordok.
   - Ellenőrzésre kerül, hogy a hivatkozott `invoice_uploads` rekordhoz tartozik-e még más aktív számla (referential safety guard). Ha nem tartozik hozzá más számla, az `invoice_uploads` rekord és a hozzá tartozó Storage objektumok is véglegesen törlésre kerülnek.
   - A törlés után azonnal érvénytelenítésre kerülnek a vonatkozó TanStack Query kulcsok (`invoices`, `submittedInvoices`, `filteredSubmittedInvoices`, `invoiceKpis`, `invoice_uploads_with_invoices`, `uploadHistory`).

### B. Lebegő Csoportos Műveleti Sáv Kijelölés-kezelés és Dropdown Javítás

1. **Kijelölés törlése ("Mégse"):**
   - Az `InvoiceSelectionContext` és `InvoiceContext` felületek kiegészültek egy dedikált `clearSelection` függvénnyel (`setSelectedInvoiceIds(new Set())` / `setSelectedSubmittedIds(new Set())`).
   - A lebegő sáv "Mégse" gombja erre van bekötve, így a kattintásra azonnal kiürül a kijelölés, és a lebegő sáv animáltan eltűnik.
2. **Z-index és Stílus Illeszkedés:**
   - A Kategória és Projekt `DropdownMenuContent` z-indexe megnövelve `z-[10001]`-re, `sideOffset={8}`-cal, megakadályozva a `z-[9999]` lebegő sáv alá csúszást.
   - A dropdown tranzakciós gombok megkapták a Visibill szabványos input és gomb stílusát (`bg-background`, `border-border/80`, `rounded-lg`, `Tag`, `Folder` és `X` ikonokkal).

### C. Lapozási Határeset Auto-Recovery (Pagination Boundary Auto-Recovery)

A `useInvoiceFilters.ts` hook két szinten védi ki az üres oldalra ragadást:

1. **Összesített darabszám (Total Count) Fallback:**
   - Amennyiben a lapozott eredménytömb üres (`submittedResult.length === 0` vagy `navResult.length === 0`), a `totalCount` nem értékelődik ki 0-ra, hanem fallbackként a szerveroldali `invoiceKpis` összesítőjét (`total`, illetve az aktív `kpiFilter` szerint a `matched` / `suggested` / `unmatched` értéket) használja.
   - Ez garantálja, hogy a `totalPages` azonnal a valós, maradék oldalszámot tükrözi.
2. **Reaktív Auto-Recovery Hatás (`useEffect`):**
   - Ha a szerveroldali lekérdezés lezárult (`!filterLoading && !isFetching`), és a felhasználó az 1-nél nagyobb oldalon áll (`currentPage > 1`), de az aktuális oldal üres (`result.length === 0`) vagy `currentPage > totalPages`:
   ```ts
   const validPage = Math.max(1, Math.min(currentPage - 1, totalPages));
   setCurrentPage(validPage);
   ```
   - Ez a reaktív állapotváltás azonnal visszalépteti az oldalszámot a legmagasabb érvényes oldalra (pl. oldal 2-ről oldal 1-re, vagy oldal 5-ről oldal 2-re).
   - A lekérdezési kulcs azonnal frissül az új érvényes oldalszámra, a TanStack Query lekéri a meglévő számlákat, és a táblázat üres állapot villanása nélkül azonnal megjeleníti az előző oldal adatait.
   - Az `InvoiceContext` URL szinkronizációja ezzel párhuzamosan automatikusan frissíti a böngésző címsorát (`?p=...`).

3. **`UnifiedPagination` Védelmi Korlát:**
   - Az `isLastPage` feltétel szigorítva lett: `currentPage >= totalPages || totalPages <= 1`, meggátolva az érvénytelen lapozógombok kattinthatóságát abban az átmeneti render ciklusban is, amíg a szülő hook állapota szinkronizálódik.
   - A `getPageNumbers` kezdőoldal-számítása korlátozva lett: `Math.min(currentPage, totalPages)`.

---

## 3. Következmények & Érvényesítés

* ✅ **Biztonságos fájl- és számlakezelés:** A felhasználó tudatos döntést hoz, hogy a fizikai dokumentumot is megsemmisíti-e, megelőzve a véletlen adatvesztést.
* ✅ **Zökkenőmentes UX lapozáskor:** A felhasználónak soha többé nem kell manuálisan visszakattintania az 1. oldalra egy utolsó oldali törlés után; az állapotváltás automatikus és azonnali.
* ✅ **Megbízható lebegő sáv:** A tömeges műveletek elvetése egyértelmű, a legördülő menük nem esnek a menüsáv mögé.
* ✅ **Tesztlefedettség:** A működést 5 dedikált egységteszt fedi le a `src/features/invoices/__tests__/invoicePaginationRecovery.test.tsx` fájlban, a teljes 103 tesztfájlból álló tesztcsomag (1206 teszt) zölden fut le.
