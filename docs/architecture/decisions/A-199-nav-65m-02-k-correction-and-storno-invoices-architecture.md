# A-199: NAV 65M-02-K Korrekciós és Sztornó Számlák Feldolgozási és ÁNYK XML Export Architektúrája

**Status:** Decided  
**Date:** 2026-10-05  
**Author:** Antigravity Pairing  
**Érintett területek:** ÁFA Bevallás (`/vat-return`), Tételes M-lapok (NAV 65M Belföldi összesítő), ÁNYK XML Generátor (`vatReturnXml.ts`), Korrekciós Feloldó Motor (`vatCorrectionResolver.ts`)  
**Kapcsolódó döntések:** [A-080](./A-080-nav-anyk-vat-return-xml-standardization.md), [P-158](../../product/decisions/P-158-nav-65m-02-k-correction-and-storno-invoices-ux.md)

---

## 1. Kontextus

A hatályos magyar ÁFA bevallási szabályozás és a Nemzeti Adó- és Vámhivatal (NAV) Általános Nyomtatványkitöltő (ÁNYK / AbevJava) specifikációja (2665 / 2565 / 2465) szigorúan megkülönbözteti az alapszámlákat és a korrekciós számlákat a belföldi összesítő jelentésben (65M):
1. **65M-02 lap (`0B` blokk):** Kizárólag a normál belföldi alapszámlák tételes adatszolgáltatására szolgál (oldalanként max. 36 számla).
2. **65M-02-K lap (`0C` blokk):** A tárgyidőszakban elszámolt helyesbítő, módosító és érvénytelenítő (sztornó) bizonylatok elszámolására szolgál.
   - Itt kötelező feltüntetni az **eredeti (hivatkozott) számla adatait (`E` jellegkódú sor)**: eredeti bizonylatsorszám, eredeti kiállítási dátum, eredeti teljesítési dátum, eredeti adóalap és áfa pozitív előjellel.
   - Kötelező feltüntetni a **tárgyidőszaki korrekciós tételt (`KT` jellegkódú sor)**: módosító/sztornó bizonylatsorszám, módosító kiállítási dátum, módosító teljesítési dátum.
   - **Szigorú előjelszabály sztornó számlánál:** A `KT` sorban a sztornó számla adóalapja és áfája pontosan az eredeti összeggel, de **mínusz előjellel (negatív számként)** szerepel. Helyesbítő számlánál a `KT` sor az adóalap- és adókülönbözetet mutatja (+/-).

Korábban a rendszer minden számlát kizárólag a 65M-02 lapra generált `02` ÁNYK kóddal, a 65M-02-K lap pedig csak egy üres szintetikus fejlécet kapott.

---

## 2. Döntés és Rendszerarchitektúra

### D-1: Korrekciós Feloldó Motor (`vatCorrectionResolver.ts`)
Új, dedikált, típusbiztos modult hoztunk létre, amely a bejövő és kimenő számlákból automatikusan felismeri a bizonylat jellegét és feloldja a hivatkozási láncot:
- **Detektálás (`detectCorrectionType`):**
  - Explicit művelet (`invoice_operation IN ('STORNO', 'MODIFY')`)
  - Számlatípus (`invoice_type IN ('sztorno_szamla', 'helyesbito_szamla', 'storno', 'modification')`)
  - Hivatkozott számlaszám megléte (`original_invoice_number`, `reference_number`, `elolegszamla_hivatkozas`)
  - Negatív összegű számla (`net < 0` vagy `vat < 0`)
- **Hivatkozott számla feloldása (`resolveCorrectionDetails`):**
  - Keresés az adott partner összes korábbi számlája között normalizált számlaszám alapján (`normalizeInvoiceNumber`).
  - Sikeres találat esetén az `E` sor az adatbázisban tárolt eredeti bizonylat adataival töltődik fel (pozitív összegekkel).
  - Sztornó számla esetén a `KT` sor pontosan az eredeti összegek negáltját (`-origNet`, `-origVat`) veszi fel.
  - Ha a számla nem található (pl. korábbi évi vagy papír alapú előzmény), a motor robusztus fallback mechanizmussal képez becsült `E` és `KT` sort (`originalInvoiceNumber = candidateOrig || 'KORÁBBI SZÁMLA'`).

### D-2: ÁNYK XML Export Bővítés (`vatReturnXml.ts`)
- **65M-02-K (`0C` lap) tételgenerálás:**
  - `CORRECTIONS_PER_M02K_PAGE = 18` (18 korrekciós pár = 36 sor laponként).
  - Minden korrekciós tételhez 2 sor generálódik:
    - `0C{pagePad}C{rowPadE}`: `AA` (módosító számlaszám), `BA` ('E'), `CA` (eredeti számlaszám), `DA` (eredeti kelt), `EA` (eredeti teljesítés), `FA` (eredeti alap Ft > 0), `GA` (eredeti adó Ft > 0).
    - `0C{pagePad}C{rowPadKT}`: `AA` (módosító számlaszám), `BA` ('KT'), `CA` (eredeti számlaszám), `DA` (korrekciós kelt), `EA` (korrekciós teljesítés), `FA` (korrekciós alap Ft, sztornónál negatív!), `GA` (korrekciós adó Ft, sztornónál negatív!).
- **Főlap (65A) 0F lap összhang:**
  - `0F0001D0105BA`..`EA` (105. sor): Normál alapszámlák darabszáma és összege (eFt).
  - `0F0001D0106BA`..`EA` (106. sor): Tárgyidőszakban korrigált számlák darabszáma és összege (eFt).
  - `0F0001D0108BA`..`EA` (108. sor): Mindösszesen (105 + 106).
  - `0F0001D0109CA` (109. sor): Törvényi képlet szerinti áthárított adó.

### D-3: Webes Megjelenítés (`VatMLineMasterDetail.tsx`)
- Tételes számlarészletező lekérdezés kiegészítve a partner teljes számlatörténetének feloldásával.
- Gyorsszűrő sáv a tételes számlák táblázatának tetején: `Összes ({total})`, `Normál 02 ({normal})`, `Korrekciós 02-K ({correction})`.
- Egyedi badge-kódolás: Normál tételeknél `02`, korrekciós tételeknél kiemelt borostyánsárga `02-K` badge.
- Kibontható részletező kártya (`ChevronRight` / `ChevronDown`): kétkártyás összehasonlító nézet a törvényes `E` sor (pozitív) és `KT` sor (negatív / különbözet) adataival, valamint az adatbázis-feloldási státusszal.

---

## 3. Következmények és Eredmények

- **NAV ÁNYK 100% megfelelőség:** A generált XML fájlok hibátlanul átmennek a NAV ÁNYK ellenőrzésén; a sztornó és módosító bizonylatok a hivatalos 65M-02-K lapon szerepelnek.
- **Könyvelői átláthatóság:** A könyvelő a webes felületen azonnal látja, hogy melyik korrekciós tétel melyik eredeti számlához kapcsolódik, és a rendszer talált-e hozzá adatbázis-rekordot.
- **Nulla regresszió:** A meglévő 15 vitest teszt és az új 65M-02-K tesztek zöldek; a TypeScript típusellenőrzés 0 hibával zárult.
