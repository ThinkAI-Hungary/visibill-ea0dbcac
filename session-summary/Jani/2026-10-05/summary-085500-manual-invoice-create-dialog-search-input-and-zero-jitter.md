# Session Summary — 2026-10-05 08:55

```text
feat(invoices, ui): Manuális beküldött számlarögzítés modal (ManualInvoiceCreateDialog), globális SearchInput komponens, Radix Dialog popover görgetésfeloldás és Zero-Jitter combobox architektúra

- Manuális Számlarögzítés és Dokumentum Csatolás (`ManualInvoiceCreateDialog.tsx`, ADR A-198, PRD P-157)
  - Új számla rögzítése modal kifejlesztése kétfüles elrendezésben (Számla adatok + Számlatételek) a számlák főoldalán (`/invoices`)
  - Közvetlen számlakép / PDF drag-and-drop feltöltő zóna (`InvoiceDocumentDropzone.tsx`), azonnali Supabase Storage feltöltéssel (`invoice-uploads` bucket) és csatolással
  - Intelligens NAV számlapár választó (`NavInvoicePicker.tsx`): kibocsátási dátum szerinti rendezés, még nem beküldött (`!submitted`) tételek prioritása, 1-kattintásos szűrőkapcsoló („Csak nyitottak" vs „Összes mutatása"), 20-as DOM render limit és találatszámláló badge
  - Többes banki tranzakció-összerendelés (`TransactionMultiPicker.tsx`): kijelölt és még párosítatlan tételek előresorolása, zsetonos (chip) megjelenítés, valós idejű egyenleg/fedezet számítás (teljesen kiegyenlítve, részfizetés, túlfizetés)
  - Dinamikus számlatétel-táblázat tétel-hozzáadással, összegszámítással és „Újraszámolás a tételekből" CTA gombbal
  - Számla státuszok (`verified`, `paid`, `partially_paid`) és kapcsolódó NAV `submitted` jelölő automatikus szinkronizálása és perzisztálása

- Globális `SearchInput` Komponens (`src/components/ui/search-input.tsx`)
  - Meglévő keresősávok felmérése és interaktív katalógus prototípus készítése (`scratch/search-bars-showcase.html`)
  - Option B (CommandInput) alapú prémium keresőmező komponens megvalósítása
  - 3 stílusvariáns (`borderless` popoverekbe, `boxed` űrlapokba, `ghost` minimalista nézetekbe) és 3 méret (`sm`, `md`, `lg`)
  - Beépített törlés gomb (`clearable`) és `Escape` billentyű kezelés fókusz-megőrzéssel
  - Aszinkron állapot (`isLoading` automatikus `Loader2` animációval) és tetszőleges számláló/badge slot (`rightElement`)
  - Unit tesztek készítése: `src/components/ui/__tests__/search-input.test.tsx` (7/7 passed)

- Radix Dialog + Popover Görgetés-blokkolás Feloldása és Zero-Jitter Ugrásvédelem (Design Docs 12 & 04)
  - `react-remove-scroll` trap elhárítása: a Radix Dialog globális scroll lockja blokkolta a lebegő popover egérgörgő és touch eseményeit
  - Megoldás: `<Popover modal={true}>` kötelezővé tétele beágyazott popovereknél, kiegészítve `overscroll-contain` és `e.stopPropagation()` védelemmel
  - Zero-Jitter popover architektúra: a dinamikus `max-h` miatti összeugrás és Popper átfordulás megszüntetése rögzített `h-[350px]` konténerrel és `flex-1 min-h-0` belső listával
  - Függőlegesen és vízszintesen középre zárt üres (`0 db`) és betöltési állapot kereső ikonnal és a keresési kifejezést tartalmazó visszajelzéssel

- Formázási és Placeholder Semlegesség
  - Szám és összeg input mezők böngészős fel-le nyilai (spinners) globális elnyomása `src/index.css`-ben, `type="text" inputMode="decimal"` mintával
  - Specifikus cég- és márkanevek helyett szakmailag semleges placeholderek (`pl. Partner Kft.`, `pl. Ügyfél Kft.`, `pl. SZLA-2026-001`)

- Dokumentáció & Döntési Nyilvántartás Szinkronizáció (Doc-Sync)
  - Új ADR: `docs/architecture/decisions/A-198-manual-submitted-invoice-creation-and-multi-pairing.md` (regisztrálva: `docs/architecture/decisions/index.md`)
  - Új PRD: `docs/product/decisions/P-157-manual-submitted-invoice-creation-dialog-and-pairings-ux.md` (regisztrálva: `docs/product/decisions/index.md`)
  - Információs architektúra szinkron: `docs/product/information-architecture.md` (P-157 és A-198 cross-link)
  - UI Design minták frissítése: `docs/design/12-dialogs-modals.md` és `docs/design/04-component-library.md` (SearchInput standard és kötelező használati irányelv rögzítése)

- Minőségbiztosítás (QA) & Verifikáció
  - Oxlint ellenőrzés: 0 hiba, 0 figyelmeztetés az érintett komponenseken
  - TypeScript fordítási ellenőrzés: `npx tsc --noEmit` hibamentes (code 0)
  - Unit tesztek: 12/12 sikeres (`ManualInvoiceCreateDialog.test.tsx`, `search-input.test.tsx`)
  - Production Vite build: `npm run build` hiba nélkül lefordult (18.23s)
  - Tudásgráf AST frissítés: `graphify update .` lefutott (23666 node, 39951 él)
```
