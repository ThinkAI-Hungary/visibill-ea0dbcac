# A-127: Számlatáblázat Tab-Váltási Render-Skálázás (Lazy Combobox / DOM Pruning) és CSS Grid Accordion Re-Render Retesz

**Status:** Decided  
**Date:** 2026-09-18  
**Utoljára frissítve:** 2026-09-18  

## Context
A `/invoices` útvonalon a NAV OSA fülek közötti váltáskor és a 2. oldalra lapozáskor észrevehető késleltetés (input lag) jelentkezett. Emellett a számlasorok kibontásakor egy átmeneti, félig nyitott (~60px magas) sötét üres doboz villant fel, mielőtt a tartalom megjelent volna.

A profilozás és vizsgálat két független architektúrális szűk keresztmetszetet tárt fel:
1. **Felesleges DOM-fa burjánzás (DOM Node Explosion):** A lapozott táblázat soraiban (`NavInvoiceRow`) a Kategória és Projekt oszlopok mindegyike egy-egy teljes Radix UI `<Select>` komponenst mountolt. 50 számlasor és átlagosan 55 kategória/projekt opció mellett ez oldalanként **2 750 darab `<SelectItem>` DOM csomópont** egyidejű létrehozását, stílusszámítását és memóriában tartását jelentette. Ez fülváltáskor és lapozáskor megterhelte a böngésző főszálát.
2. **Animáció alatti Router Újrarenderelés & Rejtett Tartalom:** Az `ExpandedInvoiceRow` CSS harmonika animációja (`grid-template-rows: 0fr -> 1fr`) mellett a belső kártyák `opacity: 0` állapotról indultak egy 80 ms-os késleltetésű fade-in-nel, miközben a konténer 48 px üres paddinggel (`py-6`) rendelkezett. Ráadásul az `InvoiceTableContainer` a sorra kattintáskor azonnal (`setTimeout(..., 0)`) meghívta a `setSearchParams`-t az URL-ben való állapotmentéshez (`?invoice=<id>`). Ez az animáció legelső fázisában (kb. 50-80 ms-nál) elindított egy teljes React Router útvonal-reconciliációt, ami megakasztotta a böngésző renderelő szálát, és egy üres, sötét sávban fagyasztotta be a sort.

## Decision

1. **DOM Pruning & Lusta Kiválasztók (`LazyRowSelect`):**
   - A táblázat soraiban a nehéz Radix `<Select>` fákat lecseréltük egy könnyűsúlyú `LazyRowSelect` komponensre.
   - Kezdeti állapotban a komponens kizárólag egy statikus trigger gombot renderel az aktuális névvel és stílussal. A teljes interaktív legördülő listát (`SelectContent`, `SelectItem` elemek) csak akkor mountolja be, ha a felhasználó a mutatót az elem fölé viszi (`onMouseEnter`) vagy rákattint (`onClick` / `onFocus`).
   - Ezzel 2 750 DOM csomópont azonnali létrehozása szűnt meg oldalváltásonként, azonnalivá téve a tabváltást és lapozást.

2. **Azonnali Opacity & Finomított CSS Grid Accordion:**
   - Az `ExpandedInvoiceRow` stílusdefiníciójában megszüntettük a belső kártyák elrejtését: a `.expand-animate` és az összes `.expand-stagger-*` osztály azonnal `opacity: 1`-gyel bír.
   - A felső paddinget `py-6`-ról `pt-3 pb-5`-re csökkentettük, a belső `.accordion-overflow` rétegre pedig kötelező `min-height: 0` szabályt alkalmaztunk a CSS Grid 0fr specifikáció tökéletes böngészőkompatibilitásáért.
   - Az animációt feszes, 180 ms-os `cubic-bezier(0.16, 1, 0.3, 1)` gördülésre kalibráltuk. Ennek hatására a tartalom már az első pillanattól látható és folytonosan gördül lefelé.

3. **Router Re-render Retesz (`searchParamsTimeoutRef`):**
   - Az `InvoiceTableContainer.tsx` `handleRowClick` eseménykezelőjében bevezettünk egy referenciát (`searchParamsTimeoutRef`), amely kinyitás esetén 200 ms-mal elhalasztja a `setSearchParams` hívást (`isExpanding ? 200 : 0`).
   - Ha a felhasználó gyors egymásutánban kattint, az előző időzítőt töröljük (`clearTimeout`), valamint a komponens unmountolásakor is takarítjuk az időzítőt.
   - Így a 180 ms-os CSS átmenet 60 fps sebességgel, JavaScript megszakítás és router-freeze nélkül fut végig, és az URL szinkronizáció csak a befejezést követően, észrevétlenül történik meg.

## Consequences

**Pozitív:**
- A NAV OSA tabok közötti navigálás és a táblázat lapozása azonnalivá és akadásmentessé vált (DOM fa méretcsökkentés: -2 750 csomópont per oldal).
- A sorok lenyitásakor megszűnt az átmeneti üres sötét doboz; a felület azonnal látható fejléc- és kártyainformációval, fizikai gördülés hatását keltve nyílik ki.
- A React Router nem versenyez a CSS Grid animációval a böngésző főszálán.

**Negatív / Trade-off:**
- Az URL `?invoice=<id>` deep-link paramétere a kinyitást követően 200 ms késleltetéssel frissül (ez a felhasználó számára nem észrevehető, de technikai szempontból aszinkron).

## Kapcsolódó
- [A-062: Invoices Feature Slice Modularization](./A-062-invoices-feature-slice-modularization.md)
- [A-065: Invoices God Context Decomposition and Expanded Row Modularization](./A-065-invoices-god-context-decomposition-and-expanded-row-modularization.md)
- [P-095: NAV OSA Tabok Elnevezése és Azonnali Sorlenyitási Animáció UX](../../product/decisions/P-095-nav-osa-tabs-performance-and-immediate-row-expansion-ux.md)
- [P-057: Invoices Feature Slice UX](../../product/decisions/P-057-invoices-feature-slice-ux.md)
