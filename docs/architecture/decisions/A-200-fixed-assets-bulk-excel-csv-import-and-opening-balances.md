# A-200 — Tárgyi Eszközök és Nyitó Állomány Tömeges Excel/CSV Import Architektúra

**Státusz:** ✅ Decided  
**Dátum:** 2026-10-05  
**Szerző:** Antigravity  
**Kapcsolódó döntések:** [023-fixed-assets](../../business/decisions/023-fixed-assets.md) · [A-164: Fejlesztési Tartalék és Tárgyi Eszközök Adatmodell](./A-164-development-reserve-fixed-assets-db-and-depreciation.md) · [A-180: Tárgyi Eszköz Időszaki ÉCS Elszámolás](./A-180-fixed-assets-periodic-depreciation-posting-service.md) · [P-159: Tárgyi Eszközök Tömeges Import UX](../../product/decisions/P-159-fixed-assets-bulk-excel-csv-import-and-opening-balances-ux.md)

---

## 1. Kontextus és Problémafelvetés

Az eaisyBill / Visibill Tárgyi Eszköz Nyilvántartó (TENY) moduljában korábban csak manuálisan vagy számlatételekből lehetett eszközöket rögzíteni és aktiválni.
A Mandala Fogadó Kft. és más korábbi rendszerekből (pl. RLB-60) áttérő könyvelőirodák és cégek esetén azonban a több ezer eszközből álló (2,000–2,500 tétel) meglévő tárgyi eszköz és nyitó állomány kézi felvitele nem megvalósítható.

Az RLB-60 kétféle export formátumot biztosít:
1. **MyTargyi kartonlista:** részletes kartonlista leltári számmal, megnevezéssel, bruttó értékkel, aktiválási dátummal, utolsó ÉCS dátummal, leírási kulccsal, kivezetéssel és megjegyzésekkel.
2. **TE Összesítő tábla:** kontírszámmal (pl. 143100), megnevezéssel, aktiválási dátummal, számviteli nyitó és záró bruttó, écs és nettó értékekkel, TAO leírási kulccsal és kivezetéssel.

### Megoldandó kihívások:
1. **Formátum felismerés:** Automatikusan fel kell ismerni a fájl szerkezetét a fejléc alapján.
2. **Magyar szám- és dátumformátumok:** Excel sorozatszámok (`39265`), pontozott dátumok (`2007.07.02.`), ezres elválasztók (`134.000` / `134 000`) és tizedesvesszők (`16,67`).
3. **Hiányzó leltári számok:** A régebbi nyilvántartásokban a tételek jelentős részénél hiányzik a leltári szám, ezekhez szekvenciális, egyedi azonosítót (`TE-{év}-{sorszám}`) kell generálni.
4. **Kivezetett eszközök kezelése:** A már selejtezett / kivezetett eszközök történeti megőrzése a nyilvántartásban (`status: 'disposed'`).
5. **Főkönyvi számlaszámok feloldása:** Az RLB analitikus 6-számjegyű számláit (pl. 143100) hozzá kell rendelni a rendszer 1xx-es számláihoz prefix illesztéssel (`143`).
6. **Könyvelési duplikáció megelőzése:** A nyitó / előzmény eszközök importálásakor meg kell akadályozni a duplikált aktiválási vegyes napló tételeket (a tétel a nyitó mérlegben már szerepel).
7. **Nagy állományok biztonságos mentése:** 2000+ tétel kötegelt (chunked, 100 tétel/batch) mentése progresszív visszajelzéssel.

---

## 2. Megvalósítás és Architektúra

### 2.1. Parser Modul (`src/lib/fixed-assets/assetImportParser.ts`)
* **Formátum detektálás:**
  * `rlb_mytargyi`: `kell`, `számlasz`, `bruttó`, `aktiválás`, `leírás`
  * `rlb_osszesito`: `kontírszám`, `sz. bruttó`, `sz. écs`, `záró`
  * `generic`: általános mezőnevek (`megnevezés`, `bekerülési érték`, `leltári szám`, stb.)
* **Robusztus típuskonvertálás:**
  * `parseHungarianNumber`: kezeli a pontozott ezreseket (`134.000`), a szóközöket és a magyar vesszős tizedestörtet.
  * `parseExcelDate`: kezeli az Excel numerikus dátumkódjait (`SSF.parse_date_code`) és a magyar dátumformátumokat.
  * `ratePercentToMonths`: leírási kulcsból hasznos élettartam hónapok számítása (100% -> 1 hó/immediate, 14.5% -> 83 hó, 20% -> 60 hó, 33.3% -> 36 hó).
  * `resolveGlAccount`: prefix alapú főkönyvi számla keresés.
* **Minta sablon generálás:** `generateSampleAssetImportExcel()` kliensoldali XLSX sablon készítés.

### 2.2. Kliensoldali Import Modál (`src/components/fixed-assets/AssetImportModal.tsx`)
* 4-lépcsős interaktív munkafolyamat:
  1. **Upload:** Drag-and-drop dropzone, automatikus formátumfelismerés, minta sablon letöltése.
  2. **Preview:** Statisztikai kártyák, opciók (kivezetettek importálása, auto leltári szám generálás, alapértelmezett főkönyv), szűrhető és lapozható táblázat.
  3. **Importing:** 100-as batch kötegelés Supabase felé, progress bar és állapotjelző.
  4. **Complete:** Összesítő kártya az importált tételekről.
* **Eseménygenerálás:** Minden tételhez létrejön a megfelelő `asset_events` rekord (`activation` vagy `disposal`), `is_opening_historical: true` megjelöléssel.

### 2.3. Integráció a TENY felületen (`src/pages/FixedAssetsPage.tsx`, `AssetListTable.tsx`)
* Új „Eszközök importálása” műveleti gomb az eszköztárban.
* Üres állapotban közvetlen elérés az `AssetListTable` felületen.
* Lazy-loadolt modál betöltés.

### 2.4. Vakfolt Kezelés és Adatintegritási Garanciák
1. **0% ÉCS és Telek Szabály (Sztv. 52. § (5)):**
   * A `ratePercentToMonths(0)` determinisztikusan `{ months: 0, method: 'none' }` értéket ad.
   * Megszüntetve a `parseHungarianNumber(...) || 14.5` Falsy Zero hibát a parserben és a modálban.
   * A GL 121/122 vagy „telek” nevű eszközök automatikusan 0%-os leírást kapnak, megelőzve a jogszabályellenes amortizációt.
2. **Leltári szám Ütközésvédelem és Auto-feloldás:**
   * A fájl beolvasásakor a rendszer lekérdezi a cég meglévő leltári számait (`fixed_assets`).
   * Az ütköző sorok `hasDbCollision: true` jelölést és sárga `Létezik` státuszjelvényt kapnak.
   * Az `autoResolveCollisions` opcióval a beszúráskor a rendszer automatikusan feloldja az ütközést `-IMP` / `-IMP{N}` utótaggal.
3. **Részleges Hiba Biztonságos Folytatása (Safe Resume):**
   * Nagy állományok (100-as batchek) közben bekövetkező hálózati megszakadás esetén az `importedItemIdsRef` megőrzi a sikeresen rögzített elemeket.
   * A modál az előnézetben marad, figyelmeztető banner jelzi a részleges állapotot, és a gomb `Importálás folytatása ({N} hátralévő)` állapotba lép.
   * Az ismételt indítás kizárólag a még be nem szúrt tételeket küldi el az adatbázisnak, garantálva a duplikációmentességet.

---

## 3. Verifikáció

* **Valós fájlok tesztelése:** Mindkét RLB-60 exportfájl (2,262 és 2,045 sor) tesztelve és sikeresen beolvasva.
* **Vitest Suite (15/15 teszt sikeres):**
  * `src/test/fixed-assets/assetImportParser.test.ts`: 7 teszt sikeres (beleértve a 0% telek ÉCS tesztet).
  * `src/test/fixed-assets/AssetImportModal.test.tsx`: 4 teszt sikeres (beleértve a létező leltári szám ütközésvizsgálatot és -IMP feloldást, valamint a hibakezelést).
  * `src/test/fixed-assets/CreateFixedAssetDialog.test.tsx`: 4 teszt sikeres.
* **TypeScript & Lint:** 100% tiszta fordítás (`npx tsc --noEmit` -> 0 hiba).

