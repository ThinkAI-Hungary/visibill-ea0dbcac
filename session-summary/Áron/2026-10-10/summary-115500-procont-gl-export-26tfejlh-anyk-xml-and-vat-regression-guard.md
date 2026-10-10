# Session Summary — 2026-10-10 11:55

```text
feat(accounting, gl, vat): PROCONT Főkönyvi kivonat A4 PDF és Excel export egyezőség-számítással, NAV 26TFEJLH ÁNYK XML v3.0 generátor, és Taxology ÁFA regresszióvédelmi kapu

- PROCONT Főkönyvi Kivonat Export és Kétoldalas Egyezőség-számítás (PRCNT FŐKÖNYV.pdf mintára)
  - Üzleti igény és struktúra: a PROCONT könyvelőprogram standard főkönyvi kivonatának hű leképezése A4 álló formátumú PDF-be és Excel táblázatba a főkönyvi számlák hierarchikus aggregálásával
  - Számlaosztály- és szint-hierarchia építő motor (src/lib/procontGlData.ts):
    - Számlaosztályok csoportosítása és PROCONT sorrendje (1. Befektetett eszközök, 2. Készletek, 3. Követelések/Pénzeszközök, 4. Források, 5. Költségnemek, 8. Ráfordítások, 9. Bevételek)
    - Háromszintű aggregációs fa felépítése: Szintetikus gyűjtők (3 jegyű számlák) és Analitikus alszámlák (4+ jegyű számlák) szülő-gyermek felgöngyölítése
    - 4 monetáris oszlop számítása elemenként: Tartozik Forgalom, Követel Forgalom, Tartozik Egyenleg, Követel Egyenleg
    - Számviteli egyenleg-elhelyezés jelleg szerint (1-3., 5., 8. számlaosztály alapértelmezetten T-többlet, 4., 9. számlaosztály K-többlet), nettó egyenlegek kizárólag a megfelelő oldalra pozicionálva
    - Mindösszesen sor aggregáció a forgalmak és egyenlegek pontos összegzésével
  - Hivatalos PROCONT „EGYEZŐSÉG SZÁMÍTÁS” mérleg-egyeztető blokk:
    - 1-4. számlaosztály nettó egyenlege (Mérleg eszköz-forrás egyenleg)
    - 5-9. számlaosztály nettó egyenlege (Eredménykimutatás bevétel-ráfordítás egyenleg)
    - Különbözet (Mérleg szerinti eredmény: Követel - Tartozik), mely a kettős könyvvitel alaptörvénye alapján kötelezően 0 Ft
  - A4 Álló PDF export motor (src/lib/procontGlPdf.ts):
    - jsPDF és jspdf-autotable integráció cégadat fejléccel, időszakkal, lekérdezési időbélyeggel, 6 oszlopos táblázattal és vizuálisan elkülönülő osztály-/szintetika-/analitika stílusokkal
    - Különálló egyezőség-számítási összesítő doboz a táblázat alatt és lapozó lábléc (X / Y oldal)
  - Strukturált Excel export motor (src/lib/procontGlExcel.ts):
    - ExcelJS munkafüzet formázott oszlopszélességekkel, könyvelési pénznem formátumokkal (#,##0 "Ft"), szintenkénti vizuális hierarchiával és kiemelt egyeztető táblával
  - Felhasználói felület és vezérlés (GlToolbar.tsx, GeneralLedgerTable.tsx, GeneralLedgerPage.tsx):
    - Új „PROCONT Főkönyvi kivonat (PDF)” és „PROCONT Főkönyvi kivonat (Excel)” menüpontok az Exportálás legördülő menüben
    - Imperatív ref metódusok (exportProcontPdf, exportProcontExcel) bekötése a szűrt számlatörzs közvetlen átadásával

- PROCONT PDF Többoldalas Layout Csúszás és Fejléc-Ütközés Hibajavítása (src/lib/procontGlPdf.ts)
  - Felhasználói hibajelentés: a generált PDF a 2. oldaltól szétcsúszott, a táblázat sorai és oszlopfejlécei rácsúsztak a fejléc szövegeire
  - Gyökérok: a jspdf-autotable a startY: 33 paramétert kizárólag az 1. oldalon veszi figyelembe; a lapozás utáni további oldalakon a táblázat a margin.top értéknél indul újra (ami alapértelmezetten 14mm volt), közvetlenül átfedve a fejléc által kirajzolt céges címsorokat (y=11-27mm között)
  - Megoldás: explicit margin: { top: 33, bottom: 15, left: 10, right: 10 } beállítása a táblázat konfigurációjában és a header kirajzolásának elszigetelése, garantálva a hibátlan margótartást és átfedésmentes renderelést minden oldalon

- NAV 26TFEJLH Hivatalos ÁNYK XML Export Generátor (AbevJava v3.0)
  - Jogszabályi és formátum specifikáció (tests/docs/eb0148/26TFEJLH.xml minta alapján): Turizmusfejlesztési hozzájárulás havi bevallás hivatalos NAV AbevJava v3.0 XML formátumban
  - XML generáló motor (src/lib/tfejlhXml.ts):
    - <nyomtatvanyok>, <nyomtatvany>, <mezo> hierarchikus XML fa generálása
    - Adózó törzsadatok tagolása (8-1-2 digites adószám, név, székhely, bevallási időszak)
    - 01-es lap mezőleképezése: 01. sor (vendéglátás / étel-ital forgalom és 4% adó), 02. sor (szálláshely szolgáltatás és 4% adó), 03. sor (összesített adóalap és hozzájárulás), 06. sor (kerekített fizetendő hozzájárulás)
    - Tiszta UTF-8 kódolás, XML karakter-escape és AbevJava dátumformátumok (YYYY.MM.DD, YYYYMMDD)
  - UI integráció (VatTourismTaxSection.tsx, Nav26TfejlhReplicaContainer.tsx):
    - Közvetlen „ÁNYK XML letöltése (.xml)” gomb a PDF export mellett a turizmusfejlesztési fülön és a replika nézetben
    - Dinamikus fájlnév képzés (26TFEJLH_<adoszam>_<idoszak>.xml) és letöltés kezelése közvetlen böngészős blob mentéssel

- Taxology 2026-07 ÁFA Regresszióvédelmi Kapu (VAT Safety Gate)
  - Felhasználói irányelv: Zéró böngészős E2E teszt, maximális sebesség és stabilitás Vitest Golden Master + Node CLI Guard kombinációval
  - Vitest Golden Master regressziós teszt (src/test/vat/vatRegressionTaxology.test.ts):
    - A Taxology Kft. 2026-07-es éles NAV XML bevallása alapján 14 ellenőrzési pont (összes fizetendő áfa, levonható áfa, nettó különbözet, főlap sorok, 65M belföldi tételes lapok, 5/18/27% bontások, 0 tolerancia)
    - Futási idő: <10ms
  - Élő DB Snapshot Guard CLI script (scripts/vat-snapshot-guard.mjs, npm run vat:guard):
    - Közvetlenül meghívja a Supabase calculate_vat_return tárolt eljárást a Taxology Kft éles adataival és összeveti a rögzített baseline snapshottal
    - Bármilyen eltérés esetén azonnali hibával leáll és kiírja a pontos diffet
  - Kötelező szabály rögzítése (.agents/rules/verification.md):
    - Bármilyen ÁFA logikát vagy számítást érintő feladat esetén kötelező a vatRegressionTaxology.test.ts és npm run vat:guard lefutása 100%-os egyezéssel

- Minőségbiztosítás, Tesztlefedettség és Kódminőség
  - Oxlint kódminőségi kapu: 0 hiba az érintett fájlokon (<170ms)
  - TypeScript típusellenőrzés: npx tsc --noEmit hibamentes (exit code 0)
  - Unit és integrációs tesztek (Vitest): 4 test suite, 32/32 sikeres teszt (100% zöld, 3.14s)
    - src/lib/__tests__/procontGlData.test.ts: 7/7 passed
    - src/lib/__tests__/tfejlhXml.test.ts: 7/7 passed
    - src/components/general-ledger/__tests__/GlToolbar.test.tsx: 4/4 passed
    - src/test/vat/vatRegressionTaxology.test.ts: 14/14 passed
  - Élő DB ÁFA Verifikáció (npm run vat:guard): 100% egyezés, ép és sérülésmentes
```
