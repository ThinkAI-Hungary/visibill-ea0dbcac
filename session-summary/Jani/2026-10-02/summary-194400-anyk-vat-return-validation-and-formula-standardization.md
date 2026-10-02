# Session Summary — 2026-10-02 19:44

```text
fix(vat, anyk): NAV ÁNYK 2665A/2665M XML import- és összefüggés-hibák elhárítása (36., 76., 83., 109. számított sorok, 27% kulcsgarancia, 0C-66DA sablonhiba javítás)

- NAV ÁNYK 2665A Sablonhiba Elhárítása (`src/lib/vatReturnXml.ts`)
  - Hiba: ÁNYK AbevJava importáláskor azonnali elutasító figyelmeztetés: "A sablon nem tartalmazza az adatállományban található (0C0001C0066DA mezőkódú) mezőt. Ez az adat nem kerül betöltésre."
  - Gyökérok: a 0C lap (levonható adó) 66. sorához kizárólag `0C0001C0066BA` (adóalap) és `0C0001C0066CA` (levonható adó) mező létezik a NAV sablonban; a korábbi kísérleti fordított áfa mező generálása feleslegesen történt meg.
  - Megoldás: a `0C0001C0066DA` mező kiírásának teljes és végleges megszüntetése.

- ÁNYK Belső Összefüggés-vizsgálatok és Részletezőkből Számított Összesítők (A-080)
  - 36. sor fizetendő áfa összesítés (<1087150/R621> & <1087151/R622>):
    - Hiba: "A fizetendő áfa adóalap/összeg értékének (36b/36c) egyeznie kell a részletező fizetendő adóalapok összegével (3753 vs 3752, 1012 vs 1013)".
    - Megoldás: az XML generátor a 36. sort nem a DB-ben lévő nyers összegzésből, hanem a kibocsátott 01..35. részletező sorok kerekített összegeként generálja (Round-then-Sum konszenzus).
  - 66. sor 27%-os törvényi kulcsgarancia (<1087305/R914>):
    - Hiba: "A 27%-os kulcs alá tartozó belföldi beszerzés utáni adó összegének (66c) egyeznie kell az adóalap (66b) 27%-ával".
    - Megoldás: ha a számlaszintű kerekítések miatt eltérés mutatkozik a kerekített eFt alap 27%-ához képest, a generátor kikényszeríti a törvényes `Math.round(base * 0.27)` adóértéket (hasonlóan a 65. sor 18%-hoz és 64. sor 5%-hoz).
  - 76. sor levonható áfa összesítés (<1087248/R767>):
    - Hiba: "A levonható áfa adóalap/összeg értékének (76b/76c) egyeznie kell a részletező levonható adóalapok összegével".
    - Megoldás: a 76. sor (alap és adó) közvetlenül a levonható sorok (63..75, 111) kibocsátott értékeiből képződik.
  - 83., 84. és 85. sorok elszámolási lánca:
    - A különbözet (`0D0001D0083CA`) és a visszaigényelhető adó (`0D0001D0085CA`) automatikusan a számított 36c és 76c mezők alapján kerül képzésre ($36c - 76c - 82c$), megelőzve az elszámolási lánc kerekítési hibáit.
  - 109. sor ÁNYK jogszabályi képletének érvényesítése (<1095069/R975>):
    - Hiba: "A levonásba helyezett, áthárított adó számított összegének (109c) egyeznie kell a 64c-64a+65c-65a+66c-66a+68c-68a-31a értékével (helyes érték: 680/1274, mezőben lévő érték: 674/1269)".
    - Megoldás: a mezőbe korábban tévesen beírt `mTotalTax` kiváltása az ÁNYK törvényi képlete alapján számított összeggel ($64c + 65c + 66c + 68c$).

- 65M-02 Tételes Számlaadatok Mezőillesztése és Kettős Mértékegység Integráció
  - Az `invoice_details` rekordok mezőinek kettős lekezelése: mind a mock `net` / `vat`, mind az adatbázisban tárolt `net_amount` / `vat_amount` mezőket támogatja.
  - A 65M-02 tételes sorok és a lapzáró 37. sor pontos forintértékei (HUF) helyesen átadásra kerülnek, míg a 65M-01 partnerösszesítő és a főlap 0F lapja a jogszabály szerinti ezer forintos (eFt) összesítést kapja meg.
  - A részletező sorok szigorúan numerikusan növekvő sorrendbe rendezve kerülnek kiírásra a 0B és 0C lapokon.

- Minőségbiztosítás, Build és Dokumentáció
  - Egységtesztek: `src/lib/__tests__/vatReturnXml.test.ts` (15/15 passed), benne a Taxology Kft. 2026. júliusi eseteit lefedő dedikált ÁNYK regressziós tesztcsomaggal.
  - DocumentEngine teszt: `src/lib/documents/__tests__/documentEngine.test.ts` (8/8 passed).
  - TypeScript típusellenőrzés: `npx tsc --noEmit` hibamentes (code 0).
  - Production Vite build: `npm run build` sikeres (22.05s).
  - Tudásgráf szinkronizáció: `graphify update .` lefutott (23 675 node, 39 635 él frissítve).
  - Architektúra döntési nyilvántartás frissítése: `docs/architecture/decisions/A-080-nav-anyk-vat-return-xml-standardization.md`.
  - Éles adatbázis adatokkal validált tesztfájl kigenerálva: `tests/NAV_2665_2026_07_Taxology_Kft.xml`.
```
