# A-225: Duplex PDF Darabolás Robusztusítás, Táblázatfejléc Védelem és Számlaszám Fuzzy NAV Párosítás (EB-0250)

**Státusz:** ✅ Elfogadva  
**Dátum:** 2026-10-06  
**Döntéshozó:** Antigravity Architect & User Approval (EB-0250)  
**Kapcsolódó Hibajegy:** EB-0250 (Kiss-Százi Emese / Ván Iroda Kft.)  
**Kapcsolódó ADR-ek:**  
- [A-145: Tömeges PDF Szeletelés (Physical Chunk Slicing), NAV Determinisztikus Fallback és Többszörös Mellékletkezelés](./A-145-bulk-invoice-slicing-and-multi-attachment-architecture.md)  
- [A-096: Hivatalos NAV Tételsor Védőháló, Sorszám Szinkronizáció és 23505 Ütközésvédelem](./A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md)  
- [A-128: Szigorított Számlaszám Határ-illesztés (Boundary Matching)](./A-128-strict-invoice-number-boundary-matching-and-subsumption-guard.md)  
- Worker ADR: `worker/docs/DECISIONS.md#adr-079`

---

## 1. Architektúrális Háttér & Indoklás

Az EB-0250 hibajegy kivizsgálása során (Ván Iroda Kft. – 102 oldalas beszkennelt köteg, `VI_bejo_augusztus.pdf`) a rendszer három kritikus hibát tárt fel a háttérbeli számladaraboló és NAV párosító folyamatban:

1. **Magyar tételtáblázati fejlécek számlaszámként való félreértelmezése:**
   A tételtáblázatok oszlopfejléceit (`Sorszám`, `Megnevezés`, `Mennyiség`, `Nettó`, `Bruttó`) az OCR felismerő a `_INV_NUM_FIELD_RE` regex alapján gyakran számlaszámnak tekintette (pl. `Megnevezés` értéket nyerve ki).
2. **Különböző számlák téves összeolvadása laza al-sztring keresés miatt:**
   A `_has_same_invoice_number` eljárás korábban egyszerű al-sztring keresést (`num.lower() in text.lower()`) alkalmazott. Ha az 1. szeleten felismert szó (`Megnevezés`) szerepelt a 2. szelet számlájának tételtáblázatában is, a rendszer az eltérő partnerek számláit (pl. Siesta, Merkbau, Halasi, VBV Vision) tévesen egyetlen többoldalas számlává vonta össze.
3. **Kétoldalas (duplex) szkenner üres hátlapjai miatti lapszámozási aránytorzulás:**
   Egyoldalas számlák duplex szkennelésekor a lapok mintegy fele üres hátlap. A korábbi `_group_pages_into_invoices` az összes oldalhoz viszonyította az `Oldal X/Y` jelölők jelenlétét (`pages_with_indicators >= len(pages) * 0.5`). Az üres oldalak miatt ez az arány 50% alá esett, így a rendszer eldobta a lapszámozási stratégiát és hibás fejlécmintákra támaszkodott.
4. **OCR karakterelütések (perjel / 1, levágott prefixek) miatti NAV párosítási elakadások:**
   - A `HZ09767/26-V` számlaszámot az OCR `HZ09767126-V`-ként olvasta (a perjel `/` egyessé `1` torzult).
   - Az `SZVT-2026-8` számlaszámból az OCR levágta a prefixet (`VT-2026-8`).
   - Mivel a NAV matcher csak egzakt al-sztringeket keresett, a számlák `missing_nav` státuszban rekedtek, miközben a NAV adatbázisban a partner és a végösszeg fillérre megegyezett.

---

## 2. Rendszerdöntések (Decisions D-1 .. D-4)

### Decision D-1: Táblázatfejlécek és Banki Adatok Szigorú Feketelistázása (`worker/pdf_splitter.py`)
- Létrehoztuk a `_clean_extracted_invoice_number(val)` validátort:
  - Feketelista a tipikus magyar tételtáblázat-oszlopnevekre: `megnevezés`, `mennyiség`, `egységár`, `nettó`, `bruttó`, `tétel`, `áfa`, `számla`, `összesen`, `bankszámla`, `érték`, `cikkszám`.
  - Magyar és nemzetközi bankszámlaszám-formátumok (`\d{8}-\d{7,8}(?:-\d{8})?$`) automatikus elutasítása.
  - Szigorú formátumkövetelmény: minimum 4 karakter hosszúság, és **kötelezően legalább egy számjegy** megléte.
- Szigorítottuk az `_INV_NUM_FIELD_RE` reguláris kifejezést:
  - `\bSorszám\s*:\s*`: kötelezővé tettük a kettőspontot, így a tételsorok táblázatfejléce (`Sorszám Megnevezés...`) nem illeszkedhet.
  - `\bszámlaszám\b`: szóhatár-védelem felvétele, megelőzve a `Bankszámlaszám:` felirat téves egyezését.
  - Új indító minták (`_STRONG_START_PATTERNS`): `Számla száma`, `online számlázó program`, `E-számla`, `SZÁMLA`.

### Decision D-2: Determinisztikus Halmazmetszet és Token-szintű Összetartozás (`worker/pdf_splitter.py`)
- A laza `num in text` logikát felváltotta a szigorú kétlépcsős vizsgálat a `_has_same_invoice_number`-ben:
  1. **Halmazmetszet:** Ha minden vizsgált csoport rendelkezik határozottan azonosított számlaszámmal, kizárólag akkor minősülnek azonos számlának, ha létezik közös metszetük (`common = group_numbers[0] & other`).
  2. **Szóhatárolt token-illesztés:** Ha az egyik csoportból kinyert legalább 5 karakteres számlaszám szóhatárolt önálló tokenként (`rf'(?:\b|^){re.escape(num)}(?:\b|$)'`) szerepel a többi csoportban.

### Decision D-3: Duplex-Tudatos Lapszámozási Arány (`worker/pdf_splitter.py`)
- A `_group_pages_into_invoices` eljárásban az 50%-os `Oldal X/Y` küszöböt az üres lapok kiszűrése utáni effektív oldalszámhoz viszonyítjuk:
  ```python
  non_blank_pages = [p for p in pages if not _is_page_blank(p)]
  effective_total = len(non_blank_pages) if non_blank_pages else len(pages)
  if pages_with_indicators >= effective_total * 0.5:
      # Lapszámozás alapú csoportosítás aktiválása
  ```

### Decision D-4: Intelligens Számlaszám Fuzzy NAV Párosító (`worker/db.py`)
- Megvalósítottuk az `is_invoice_number_fuzzy_match(target_norm, cand_norm)` függvényt:
  1. Egzakt normalizált egyezés.
  2. Prefix / suffix egyezés minimum 4 karakter hossz esetén (pl. `vt20268` $\leftrightarrow$ `szvt20268`).
  3. OCR perjel/1 konfúzió kezelése: az `1`-es karakterek eltávolítása utáni normalizált azonosság (`hz0976726v` $\leftrightarrow$ `hz09767126v`).
  4. Levenshtein távolság $\le 2$ minimum 6 karakter hosszúságú azonosítóknál.
- **Szigorú Pénzügyi Védőháló (`find_matching_nav_invoice_and_items`):**
  A fuzzy illesztés kizárólag azonos bérlő cégnél (`company_id`), fillérre megegyező nettó és bruttó végösszegnél, valamint partnernév-egyezésnél lép működésbe, hermetikusan megelőzve a téves párosításokat.

---

## 3. Érintett Rendszerkomponensek

1. **Python Worker:**
   - [`worker/pdf_splitter.py`](file:///d:/ThinkAI/Visibill/worker/pdf_splitter.py): Fejléc szűrés, duplex detektálás, szóhatár regexek, halmazmetszet.
   - [`worker/db.py`](file:///d:/ThinkAI/Visibill/worker/db.py): `is_invoice_number_fuzzy_match` és NAV illesztési integráció.
   - [`worker/test/unit_test/test_pdf_splitter_and_nav_matcher_eb0250.py`](file:///d:/ThinkAI/Visibill/worker/test/unit_test/test_pdf_splitter_and_nav_matcher_eb0250.py): 4/4 sikeres célzott unit teszt.

---

## 4. Verifikáció & Minőségbiztosítás

- **Automatizált Tesztek:**
  - `pytest test_pdf_splitter_and_nav_matcher_eb0250.py`: 4/4 PASSED (0.04s).
  - Teljes worker tesztcsomag: `python run_tests.py` (135/135 PASSED).
- **Valós E2E Ügyfél Szeletelés:**
  - `VI_bejo_augusztus.pdf` 14 oldalas mintáján futtatva pontosan 7 önálló számlaszelet képződött összetapadás nélkül.
- **Éles Adatbázis Javítás:**
  - `HZ09767/26-V`, `SZVT-2026-8` és `VBV-2026-29` sikeresen helyreállítva, NAV-val ellenőrizve és jóváhagyva a termelési adatbázisban.
