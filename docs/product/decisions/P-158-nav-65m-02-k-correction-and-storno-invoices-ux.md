# P-158: NAV 65M-02-K Korrekciós és Sztornó Számlák Felhasználói Élménye és Tételes Megjelenítése (UX)

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-10-05  
> **Szerző:** Antigravity Pairing  
> **Érintett területek:** ÁFA Bevallás (`/vat-return`), Tételes M-lapok (NAV 65M), Számlarészletező Táblázat (`VatMLineMasterDetail.tsx`), ÁNYK XML Export  
> **Kapcsolódó döntések:** [A-199](../architecture/decisions/A-199-nav-65m-02-k-correction-and-storno-invoices-architecture.md), [P-119](./P-119-statutory-vat-views-upgrade-and-reverse-charge-ux.md), [P-121](./P-121-vat-image-scope-selector.md)

---

## 1. Üzleti Háttér és Igény

Az ÁFA-bevallás belföldi tételes összesítő jelentésében (NAV 65M) a könyvelőknek nemcsak az alapszámlákat (65M-02 lap), hanem a sztornó és helyesbítő számlákat is tételesen szerepeltetniük kell a **65M-02-K** lapon.

A jogszabály és a könyvelői elvárás szerint a korrekciós lapon kötelező párhuzamosan bemutatni:
1. Az **eredeti (hivatkozott) számlát (`E` sor)**: eredeti sorszám, kelt, teljesítés dátuma, adóalap és áfa pozitív előjellel.
2. A **tárgyidőszaki korrekciós számlát (`KT` sor)**: korrekciós sorszám, kelt, teljesítés dátuma, valamint a sztornózott/korrigált összegek.
   - **Sztornó számla esetén:** az adóalap és a levonható adó pontosan az eredeti számla összegével, de **mínusz előjellel (negatív értékként)** szerepel.
   - **Helyesbítő számla esetén:** a módosítás különbözete szerepel.

A felület korábban nem tette láthatóvá a számla korrekciós jellegét, nem mutatta meg az eredeti számla adatait, és minden számlát egységesen `02` jelöléssel listázott.

---

## 2. Felületi Megvalósítás és UX Megoldások

### 2.1. Gyorsszűrő Vezérlősáv (Segmented Quick Filter)
A kiválasztott partner számláinak táblázata felett, a jobb felső sarokban egy 3-állású modern szegmentált szűrőkapcsoló kapott helyet:
- **Összes ({total})**: Az adott partner összes tárgyidőszaki belföldi számlája.
- **Normál 02 ({normal})**: Csak a 65M-02 lapra tartozó normál alapszámlák.
- **Korrekciós 02-K ({corr})**: Csak a helyesbítő és sztornó bizonylatok, kiemelt borostyánsárga badge-dzsel.

### 2.2. Vizuális Megkülönböztetés a Táblázatban
- **ÁNYK Oszlop:**
  - Normál számlák: szürke körvonalas `<Badge variant="outline">02</Badge>`.
  - Korrekciós számlák: feltűnő, tetszetős borostyánsárga `<Badge className="bg-amber-100 text-amber-800 border-amber-300">02-K</Badge>`.
- **Korr. tip Oszlop:**
  - `Sztornó`: élénk rózsavörös (`text-rose-600 font-semibold`).
  - `Helyesbítő`: meleg borostyánsárga (`text-amber-600 font-semibold`).
  - `Normál`: visszafogott diszkrét szöveg.
- **Adóalap és Adó előjelek:**
  - Sztornó számláknál a figyelembe vett adóalap és áfa összegek piros/rózsavörös színnel, mínusz jellel (pl. `-50 000 Ft`, `-13 500 Ft`) jelennek meg, egyértelműsítve az adólevonási hatást.

### 2.3. Kibontható Kétkártyás 65M-02-K Részletező Nézet
A korrekciós számlák sorszáma mellett egy interaktív nyíl (`ChevronRight` / `ChevronDown`) található. Rákattintva kinyílik a 65M-02-K hivatalos tételbontása:
- **Fejléc státuszjelző:**
  - `✓ Hivatkozott számla feloldva az adatbázisból` (zöld badge, ha megtalálható a partner korábbi számlái között).
  - `⚠ Hivatkozott számla korábbi időszaki / becsült adat` (sárga badge, ha külső papírarchívumból származik).
- **Bal oldali kártya (`E` sor - Eredeti számla adatai):**
  - Eredeti bizonylatsorszám
  - Kiállítás napja (kelt)
  - Teljesítés dátuma
  - Eredeti adóalap (`+` előjellel)
  - Eredeti levonható adó (`+` előjellel, zöld kiemeléssel)
- **Jobb oldali kártya (`KT` sor - Korrekció / sztornó tárgyidőszak):**
  - Módosító bizonylatsorszám
  - Kiállítás napja (kelt)
  - Teljesítés dátuma
  - Korrekciós adóalap (mínusz előjellel, piros kiemeléssel)
  - Korrekciós levonható adó (mínusz előjellel, piros kiemeléssel)

---

## 3. Felhasználói Előnyök

1. **Azonnali vizuális biztonság:** A könyvelőnek nem kell a NAV ÁNYK-ban kézzel keresgélnie és javítgatnia a korrekciós sorokat; a felületen pontosan ugyanaz a struktúra jelenik meg, mint a hivatalos nyomtatványon.
2. **Gyors hibafeltárás:** Ha egy sztornó számla hivatkozása hiányzik vagy nem azonosítható, a rendszer sárga jelzéssel figyelmeztet, így még a bevallás leadása előtt ellenőrizhető.
3. **Zéró zavarodottság:** A negatív előjelek és az `E`/`KT` bontás kiküszöböli a bizonylatok előjelhelyességéből fakadó korábbi kétségeket.
