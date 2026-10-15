# Session Summary — 2026-10-15 11:32

```text
feat(invoices, projects, db): számlatételek többes projekt-költségmegosztása (% felosztás), lebegő műveleti sáv és zero-jitter gyorsítótárazás

- Adatbázis & Séma Kiterjesztés (A-260, 074)
  - Új `project_allocations jsonb DEFAULT NULL` oszlop és GIN index (`idx_nav_invoice_items_project_allocations`, `idx_invoice_items_project_allocations`) a `nav_invoice_items` és `invoice_items` táblákon
  - Hibrid kompatibilitás: 100%-os egyedi projekt esetén `project_id` UUID és `project_allocations` szinkron, többes felosztás (>1) esetén `project_id = NULL` és a százalékos JSONB tömb tárolása
  - Szigorú kliens- és séma-oldali kerekítési validáció (`src/lib/projectAllocationValidation.ts`): pontosan 100.00% összegkényszer, duplikációmentesség és pozitív százalékok garantálása
  - Adatbázis migrációs szkript: `supabase/migrations/20261015120000_add_invoice_items_project_allocations.sql`

- Számlatételek Tételes Nézet & Költségmegosztó Popover (`InvoiceItemsDialog`, `ItemProjectAllocationPopover`)
  - Kompakt cellaelrendezés a tételszerkesztőben: egyedi legördülő menü + közvetlen százalék (`%`) funkciógomb, többes allokációnál `[ % ] X projekt (100%)` zöld interaktív gomb
  - Dinamikus sorok projektválasztóval, `%` mezővel és kuka ikonnal, automatikus kiszűréssel a már felhasznált projektekre a duplikáció megelőzésére
  - Gyorsműveleti gombok: „+ Hozzáadás”, „Egyenlő” (automatikus egyenlő arányosítás) és „Maradék” (utolsó projekt kiegészítése a 100%-hoz hiányzó összegre)
  - Valós idejű validációs sáv: zöld visszaigazolás pontosan 100% esetén; mentés azonnali letiltása és figyelmeztetés hiányzó vagy túllépő százaléknál
  - Testvérbizonylat szinkronizáció (`findTwinItems`): atomi átvezetés a NAV számlatételek és a feltöltött bizonylatok között

- Számlalista Sor Megjelenítés & Vizuális Státusz (`NavInvoiceRow.tsx`)
  - Korábbi hiba felszámolása: ha egy számla tételei projektekre voltak bontva, a fő számlalistában a számla projekt nélküliséget mutatott
  - Új interaktív zöld `% X projekt [count]` badge a számlasor Projekt oszlopában, azonnali vizuális tájékoztatást nyújtva a felosztásról

- Lebegő Műveleti Sáv Csoportos Allokáció (`InvoiceBulkActionsBar.tsx`, `floating-bulk-bar.tsx`)
  - Csoportos költségmegosztás: számlák tömeges kijelölésekor a lebegő akciósáv közvetlen `% Megosztás (%)` gombot kapott
  - Előzetes öröklés: a kiválasztott számlák meglévő többes vagy egyedi projektfelosztását a rendszer automatikusan betölti és megjeleníti prefillként
  - Zero-Focus-Ring: a gombokról az összes zavaró böngésző- és Tailwind aktivációs kék/fehér fókuszkeret maradéktalanul eltávolításra került (`[outline:none!important]`, `[box-shadow:none!important]`)
  - Adat-export szinkron: az `exportableInvoices` mostantól átadja a `project_allocations` és `project_id` mezőket az Excel és strukturált adatletöltéseknek

- Zero-Jitter TanStack Query Gyorsítótár & Uncheck Hibajavítás (`useInvoiceItemProjectAllocations.ts`, `InvoiceBulkActionsBar.tsx`)
  - Gyökérok (1s villódzás): új sor kijelölésekor a megváltozott `selectedIds` új queryKey-t generált, ami `placeholderData` hiányában 1 másodpercre `undefined`-re nullázta az állapotot, visszaesve az üres sávra
  - Megoldás: `placeholderData: (previousData) => ({ ...previousData, ...cachedQueries })` bevezetése és a `queryClient` memóriagyorsítótár integrációja; új sor kijelölésekor az állapot 0 ms alatt, folytonosan fennmarad
  - Gyökérok (Uncheck beragadás): a projektes sor uncheckelésekor az átmeneti stabilizációs állapot rajta maradt a sávon, mert a megmaradó üres sor nem rendelkezett tételszintű kulccsal a válaszban
  - Megoldás: az állapot közvetlen, tiszta reaktív levezetése a ténylegesen kiválasztott elemekből (`selectedItems`), azonnali visszaállást biztosítva az üres `Projekt...` állapotra

- Projektek Modul Pénzügyi Számítás (`Projects.tsx`)
  - Tényköltség és fedezetszámítás frissítése: a tételek bruttó értéke az arányosított képlet alapján kalkulálódik (`allocatedGross = itemGross × (percentage / 100)`)
  - A projektkártyák tétellistájában a felosztott tételek mellett explicit megjelenik a százalékos arány (pl. `Irodabútor beszerzés (60%)`)

- Minőségbiztosítás, Linter & IDE Integráció
  - Vitest egységtesztek: 13/13 teszt sikeres (`InvoiceBulkActionsBar.test.tsx` 9/9, `useInvoiceItemProjectAllocations.test.tsx` 2/2, `invoiceRowProjectAllocation.test.tsx` 2/2)
  - TypeScript típusellenőrzés: `npx tsc --project tsconfig.app.json --noEmit` 0 hibával lefutott
  - Oxlint: 0 hiba
  - IDE tisztítás: `@testing-library/jest-dom` importok hozzáadva, relatív import útvonalak javítva, `.vscode/settings.json` beállítva a Tailwind at-szabályok (`@tailwind`, `@apply`) elismerésére

- Dokumentáció Szinkronizáció (/visibill-doc-sync)
  - Architektúra döntési nyilvántartás: `A-260-multi-project-item-allocations-and-financial-split.md` létrehozva, `docs/architecture/decisions/index.md` frissítve (259 döntés)
  - Üzleti szabályzat: `074-multi-project-item-allocations-and-cost-split.md` létrehozva, `docs/business/decisions/index.md` frissítve (74 döntés)
  - Termékspecifikáció: `P-190-multi-project-item-allocations-ux.md` létrehozva, `docs/product/decisions/index.md` frissítve (206 döntés)
  - Adatbázis sémadokumentáció: `04-invoices.md` és `05-nav.md` frissítve az új JSONB oszloppal és GIN indexekkel
  - Kódbázis tudásgráf: `graphify update .` lefutott (27 828 csomópont, 47 463 él, 1 996 közösség)
```
