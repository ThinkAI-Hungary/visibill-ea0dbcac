# A-205: NAV 2665M Digitális Nyomtatvány Replika és Partner Tördelő Motor Architektúrája

> **Státusz:** ✅ Decided & Implemented  
> **Dátum:** 2026-10-06  
> **Szerző:** Antigravity Pairing  
> **Érintett területek:** ÁFA Bevallás (`/vat-return`), Tételes M-lapok (NAV 65M), `nav65MPaginationHelper.ts`, `Nav2665MReplicaContainer.tsx`  
> **Kapcsolódó döntések:** [P-164](../../product/decisions/P-164-nav-2665m-digital-replica-and-partner-pagination-ux.md), [A-199](./A-199-nav-65m-02-k-correction-and-storno-invoices-architecture.md), [A-003](./A-003-multi-tenancy-and-rls-architecture.md)

---

## 1. Kontextus és Technikai Kihívás

A NAV 2665M belföldi partnerösszesítő nyomtatvány digitális replikálásakor az alábbi technikai sajátosságokat kellett egyszerre kezelni:
1. **Oldalankénti szigorú tördelés (Chunking):**
   - **2665M-02:** szigorúan oldalanként legfeljebb 36 alapszámlasor, alatta a 37. sorban az oldal forintos összegzője.
   - **2665M-02-K:** szigorúan oldalanként legfeljebb 18 korrekciós ügylet (18 pár = 36 sor: páratlan sorok `E` eredeti pozitív, páros sorok `KT` tárgyidőszaki korrekció negatív/különbözeti értékekkel).
2. **Kettős mértékegység rendszer:**
   - A Főlap összesítő táblázata (04., 05., 07. sorok) ezer forintban (eFt) számítandó.
   - A részletező lapok tételsorai és 37. összegző sorai forintban (Ft) tüntetendők fel.
3. **DOM-méret és Skálázhatósági védelem (Multi-partner Scale Guard):**
   - Egy aktív cégnél több száz partner is létezhet. Az összes partner összes A4-es oldalának egyszerre történő DOM-ba illesztése DOM-robbanáshoz és memóriafagyáshoz vezetne.

---

## 2. Architektúra és Döntések

### D-1: Típusbiztos Tördelő és Számítási Motor (`nav65MPaginationHelper.ts`)
- Dekomponált, tisztán funkcionális helper modul, amely a partnerből és annak bizonylataiból (`invoice_details` vagy query adatok) felépíti a `Nav65MPartnerSheetData` struktúrát.
- Automatikusan szétválogatja a normál számlákat és a korrekciós bizonylatokat a `vatCorrectionResolver.ts` szabályai szerint.
- Szintetikus fallback mechanizmus: ha nincsenek betöltve egyedi számlasorok, az aggregált partneradatokból képez reprezentatív lapot, így a replika sosem üres vagy hibás.

### D-2: Komponens Dekompozíció (Maker-Checker & Vercel React Purity)
- **`Nav2665MSheetFolap.tsx`**: A4-es partnerösszesítő főlap, címerrel, adózó és partner azonosító dobozokkal, időszak karakterdobozokkal és eFt-os 04, 05, 07 sorokkal.
- **`Nav2665MSheet02.tsx`**: A4-es normál lap fix 36 tételsoros ÁNYK ráccsal (üres soroknál diszkrét ÁNYK "forint" vízjellel) és 37. forintos összegző sorral.
- **`Nav2665MSheet02K.tsx`**: A4-es korrekciós lap `E` és `KT` sorpárokkal, a negatív sztornó tételek kiemelt piros/rózsaszín kontrasztos jelölésével.
- **`Nav2665MReplicaContainer.tsx`**: Konténer és vezérlősáv, kereshető partner selecttel, léptető gombokkal, zoommal és a lapozható/egybefűzött nézetmód kapcsolóval.
- **`VatNav65MReplica.tsx`**: Tiszta facade komponens a moduláris importáláshoz.

### D-3: Partner-Izolált Lazy Renderelés
- Egyszerre a DOM-ban kizárólag az aktív partner lapjai renderelődnek.
- A partnerek közötti váltás azonnali (`O(1)` indexelés a memóriában tartott partnerlistán), így a böngésző memóriaterhelése minimális marad még 500+ partnernél is.

---

## 3. Minőségi és Verifikációs Eredmények

- **Oxlint:** 0 hiba, 0 figyelmeztetés; a React 19 és pure render szabályok maradéktalanul érvényesülnek.
- **TypeScript:** `npx tsc --noEmit` 0 hibával zárult.
- **Vitest tesztek:** `src/test/vat/nav2665MReplica.test.tsx` (7/7 teszt sikeres).
- **Vite Build:** `npm run build` sikeres (26.13s).
