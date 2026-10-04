# A-195: NAV 26A60 Hivatalos Nyomtatvány Digitális Replika Architektúra

**Állapot:** Elfogadva (Accepted)  
**Dátum:** 2026-10-04  
**Döntéshozó:** Architecture, Tax & Frontend Engineering Team  
**Kapcsolódó döntések:** P-155, A-167, P-126, A-181, P-144  

---

## 1. Döntési Kontextus és Igény

A magyar adózók az EU-s közösségi termék- és szolgáltatásügyleteikről az ÁFA bevallás (2665) mellett a NAV 26A60 jelű havi/negyedéves összesítő nyilatkozatot kötelesek benyújtani.
A korábbi megoldás (`VatA60Table`) kizárólag egy keresztellenőrző analitikát és tételes számlalistát biztosított. A könyvelők számára a zárás és beküldés előtt elengedhetetlen a tényleges NAV ÁNYK nyomtatványkép ellenőrzése, elkerülve a hatósági elutasítást és az adatszinkronizációs hibákat.

---

## 2. Architektúra Döntés

A `src/features/vat/components/replica/` alrendszerben kifejlesztettük a **100%-ban natív React / HTML / CSS alapú, hivatalos ÁNYK 26A60 digitális nyomtatvány replikát**.

### 2.1 Komponens Hierarchia és Felelősségek

```
src/features/vat/components/replica/
├── Nav26A60SheetFolap.tsx       # 26A60 Főlap (Címer, B azonosítás HU közösségi adószámmal, C időszak)
├── Nav26A60SheetTable.tsx       # Standard 24+1 soros ÁNYK sorszámozott táblázat (01-től 05-ig)
├── Nav26A60ReplicaContainer.tsx # Vezérlősáv, lapfülek, zoom (65-130%), KPI banner, DB újraszámítás
├── Nav2665PageFrame.tsx         # A4 lapszimuláció, nyomtatási keret, lábléc
└── index.ts                     # Barrel export
```

### 2.2 Determinisztikus Adatkötés és Partner Aggregáció

1. **Partnerenkénti göngyölés:** Az ÁNYK szabályai szerint a 01–04 részletező lapokon nem számlánként, hanem közösségi adószámonként aggregálva jelennek meg a tételek (`aggregateA60CategoryItems`).
2. **2-karakteres Országkód izoláció:** Az EU adószám prefixe (`DE`, `IE`) és a törzsszám automatikusan szétválasztásra kerül, és a megfelelő oszlopokban szegmentált dobozokban jelenik meg.
3. **ezer Ft (eFt) Kerekítés:** Minden összeg az ÁNYK elvárásainak megfelelően kerekítve szerepel a lapokon és az Összesen sorban.
4. **24 Soros Laponkénti Tördelés:** Amennyiben egy kategóriában 24-nél több partner szerepel, automatikus többoldalas lapozás és lapszámozás (`chunkArray`, Lapszám: X / Y) lép életbe.

### 2.3 Felületi Integráció

- **Tab 5 (`VatReturnContainer.tsx`):** Sub-toggle vezérli a két nézet közötti azonnali váltást (`Keresztellenőrzés & Számlák` vs `Hivatalos 26A60 Nyomtatvány Replika`), megőrizve az URL állapotot (`?tab=a60&a60View=replica`).
- **Export Menü (`VatReturnViewTab.tsx`):** Új menüpont a közvetlen átváltásra.

---

## 3. Következmények és Előnyök

- **Könyvelői bizonyosság:** 100%-os egyezés az állami ÁNYK nyomtatvánnyal.
- **Zéró késleltetés:** Nincs backend PDF generálási várakozás; tiszta SPA renderelés.
- **Teljes nyomtatási támogatás:** `@media print` direktíva A4 lapszimulációval papírra és PDF-be.
