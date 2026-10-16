# P-196: Tárgyi Eszközök Ergonómia, Content Splitting (38/62%), Név Csonkolás és Többéves Mozgástábla UX

**Status:** Decided  
**Date:** 2026-10-16  
**Utoljára frissítve:** 2026-10-16  
**Category:** UI / UX / Layout / Fixed Assets  

---

## Context

A Tárgyi Eszközök (`FixedAssetsPage.tsx`) felületén a könyvelők nagy felbontású kijelzőkön (1920×1080 és afelett) és hordozható laptopokon egyaránt dolgoznak. A korábbi felületi struktúrában több ergonómiai és vizuális probléma jelentkezett:

1. **Szűk jobb oldali panel és horizontális scroll a mozgástáblánál:** A korábbi 60% bal / 40% jobb felosztás miatt a bal oldali listában indokolatlanul sok üres hely maradt, miközben a jobb oldali részletlapon a 11-oszlopos *Többéves Amortizációs Mozgástábla* (`MultiYearMovementTable.tsx`) jobb széle levágódott, horizontális görgetősáv jelent meg, és az oszlopfejlécek (pl. *Tárgyévi Sztv ÉCS*, *Növekedés (+)*, *Záró Nettó (Sztv)*) 2-3 sorba törtek.
2. **Értékcsökkenés Lekönyvelése felugró ablak szűkössége:** A `DepreciationRunDialog.tsx` modal `max-w-4xl` (896px) mérete miatt a 8-oszlopos előnézeti táblázat jobb széle levágódott, a leltári számok 3 sorba törtek és alul vízszintes görgetősáv alakult ki.
3. **Oldalnyúlás és Layout Shift eszközváltáskor:** Amikor a bal oldali listában olyan eszközre kattintottak, amely még nem volt a memóriában, egy `min-h-[400px]` magas loading spinner jelent meg, ami függőlegesen megnyújtotta az oldalt, eltolva a láblécet és a görgetési pozíciót.
4. **Végtelenül hosszú eszközlista:** Pagináció nélkül a több száz elemből álló eszközlista lassította a böngészőt, és a hosszú megnevezések szétnyomták a táblázat oszlopait.

---

## Decision

### 1. Dinamikus Content Splitting (38% Bal / 62% Jobb)
- **Bal oldali eszközlista:** `w-[40%] xl:w-[38%] 2xl:w-[35%]`.
  - A 7 lényegi oszlop feszesen, felesleges üres rések nélkül jelenik meg.
- **Jobb oldali részletpanel:** `w-[60%] xl:w-[62%] 2xl:w-[65%]`.
  - A panel tágas (~1000–1150px) szélességet kap, így az eszközkarton kártyái és az analitikai táblázatok teljes pompájukban elférnek.

### 2. Többéves Mozgástábla: Egy Sorba Kiférő Fejlécek és Scrollmentesség
- A `MultiYearMovementTable.tsx` táblázatban minden oszlopfejléc és adatcella megkapta a `whitespace-nowrap`, `px-2 py-2` és `text-[11px]` kompakt formázást.
- A 11 oszlop (Év, Bruttó Nyitó, Növekedés (+), Csökkenés (-), Bruttó Záró, Tárgyévi Sztv ÉCS, Tárgyévi Tao ÉCS, Tao Különbözet, Halmozott ÉCS, Záró Nettó (Sztv), Záró Nettó (Tao)) garantáltan egyetlen sorban marad törések és horizontális scroll nélkül.

### 3. ÉCS Lekönyvelés Modal Kiszélesítése (`max-w-6xl xl:max-w-7xl`)
- A `DepreciationRunDialog.tsx` dialógus mérete `max-w-4xl`-ről `max-w-6xl xl:max-w-7xl w-[95vw]`-re bővült.
- A leltári szám és numerikus oszlopok `whitespace-nowrap` rögzítést kaptak, így a teljes 8 oszlop kényelmesen áttekinthető egyben.

### 4. Pagináció és Intelligens Szövegcsonkolás (`AssetListTable.tsx`)
- Standardizált `UnifiedPagination` beépítése: alapértelmezett **50 elem/oldal** (választható 25, 50, 100).
- `truncateText(name, 28)`: 28 karakter felett elegáns csonkolás (`...`) és lebegő natív `title` tooltip az eszköz teljes megnevezésével, HTML entitások automatikus dekódolásával.

### 5. Layout Shift Mentes Shimmer Skeleton (`AssetDetailSkeleton.tsx`)
- Az eszközkarton betöltési állapota sima, pulzáló shimmer skeleton komponenst kapott, amely azonos magasságot és struktúrát tükröz, megelőzve az oldal függőleges ugrálását.
- A `useFixedAssetDetail` hook 60 másodperces `staleTime` gyorsítótárat kapott, így az eszközök közötti visszaváltás azonnali (0ms).

---

## Consequences

**Előnyök:**
- A könyvelő a többéves amortizációs mozgástáblát és az adóalap korrekciót (Tao vs Sztv) egyetlen pillantással átlátja, anélkül, hogy vízszintesen kellene görgetnie.
- A felületi navigáció gyors, stabil és villogásmentes.
- A párbeszédablakok és táblázatok illeszkednek a modern VisiBill design irányelvekhez.

---

## Kapcsolódó
- [P-141: Tárgyi Eszközök Időszaki Értékcsökkenés (ÉCS) Elszámolás és Vegyes Napló Feladási Varázsló UX](./P-141-fixed-assets-periodic-depreciation-posting-wizard-ux.md)
- [P-186: TENY Raktár és Felelős Kezelés, Kétnyelvű Átadási Bizonylat UX](./P-186-fixed-assets-phase2-and-phase3-ux.md)
- [A-252: TENY Phase 2 & Phase 3 Architektúra](../../architecture/decisions/A-252-fixed-assets-phase2-and-phase3-inventory-grants-components-pie.md)
