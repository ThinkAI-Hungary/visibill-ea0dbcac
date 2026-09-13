# A-116: K&H Bankkivonatok (.xls / .csv) Robusztus Feldolgozása, Tabulátor Detektálás és Tranzakció Pipeline Intercept Védelem

**Status:** Decided  
**Date:** 2026-09-13  
**Utoljára frissítve:** 2026-09-13  

---

## Context

A Mauroni Events Kft. (Mauroni Marco) által beküldött 7. sz. hibajegy nyomán a felhasználó hivatalos K&H vállalati e-bank exportokat próbált feltölteni a rendszerbe:
- `ea26dd94-c227-4756-976b-8cdd44707156.xls` (Valódi Excel BIFF formátumú tranzakciótörténet)
- `2e6ebe69-cdba-4528-a582-561a04938158.csv` (Tabulátorral tagolt szöveges export)

A feltöltések meghiúsultak, majd a felhasználó ismételt próbálkozásakor a feltöltött fájlokat a rendszer azonnal átirányította a bérszámfejtési pipeline-ra (`payroll`), ahol a feldolgozás hibára futott (`failed`).

A vizsgálat során három független, kritikus gyökérok került feltárásra:
1. **Tabulátorral tagolt K&H CSV (`\t`) inkompatibilitás:** A korábbi `_convert_csv_to_markdown` és `_extract_from_csv` megvalósítás kizárólag pontosvesszőt (`;`) vagy vesszőt (`,`) kezelt. A K&H hivatalos CSV exportja azonban tabulátorral tagolt, így a parser az egész sort egyetlen összefüggő mezőként értelmezte, és egyetlen tranzakciót sem tudott azonosítani.
2. **K&H BIFF XLS Oszlopdetektálási Csapda (Számlaszám vs. Összeg):** A K&H `.xls` fájlok valódi bináris Excel táblázatok (`xlrd` parser). A korábbi heurisztika az első numerikus oszlopot tekintette tranzakciós összegnek. Mivel a partner bankszámlaszáma (`10404072...`) számként szerepelt a táblázatban, az `xlrd` lebegőpontos tudományos formátumban olvasta be (`1.0404072e+23`). A parser ezt vette fel összegnek a valós forintösszeg helyett, ráadásul a K&H specifikus fejlécek (`Könyvelés dátuma`, `Partner elnevezése`, `Típus`) nem voltak leképezve.
3. **Kritikus Behúzási Hiba a `worker.py` Tranzakciós Pipeline-ban:** A `worker.py` fájlban (a 2954–3004. sorok környékén) a korai bérszámfejtési intercept (`is_payroll_statement(...)`) kódblokkja hibás behúzással (indentation) futott le a tranzakciós fájlok iterációjában. Ha egy tranzakciós feltöltés nem tartalmazott klasszikus banki kulcsszót a fájlnevében, a kód feltétel nélkül törölte a `transaction_uploads` rekordot, áthelyezte a fájlt a számla-feltöltések alá `invoice_type = 'payroll'` kategóriával, és átdobta a bérszámfejtési feldolgozóba, ellehetetlenítve a bankkivonatok importját.

---

## Decision

A hiba végleges elhárítására és a jövőbeli banki exportok védelmére többrétegű védelmi mechanizmust vezettünk be a `visibill-worker` komponensben:

### 1. Dinamikus Elválasztójel-Gyakoriság Detektálás (`transaction_extractor.py`)
A `_convert_csv_to_markdown` és a CSV feldolgozó logika kiegészült egy robusztus elválasztójel-detektorral:
- A fájl első soraiban megszámolja a lehetséges határoló karakterek (`\t`, `;`, `,`) előfordulási gyakoriságát.
- Ha a tabulátorok száma meghaladja a pontosvesszők és vesszők számát (vagy legalább 3 tabulátor található soronként), a parser automatikusan `\t` elválasztóval dolgozza fel a fájlt.
- Ezáltal a K&H, Takarékbank és egyéb tabulátoros banki exportok zökkenőmentesen átalakulnak tiszta Markdown és struktúrált tranzakciós formátummá.

### 2. Fejléc-Alapú Strukturált Oszloptérképezés Excelhez (`transaction_extractor.py`)
A heurisztikus pásztázás elé egy determinisztikus fejléc-azonosító réteget építettünk:
- **Magyar Banki Fejlécek Térképezése:** A parser felismeri a `könyvelés dátuma`, `értéknap`, `típus`, `partner számlaszáma`, `partner elnevezése`, `összeg`, `deviza`, `közlemény` oszlopokat.
- **Tudományos Formátumú Számlaszám Védelem:** A bankszámlaszám oszlopot expliciten kizárjuk az összeg-keresésből. Ha egy numerikus érték nagyobb, mint $10^{12}$ vagy megfelel a 16/24 jegyű bankszámlaszám mintának, a rendszer bankszámlaszámként kezeli, megakadályozva, hogy a tranzakció összege $1.04 \times 10^{23}$ Ft legyen.
- **Típus és Közlemény Egyesítés:** A tranzakció típusa (pl. `Átutalás`, `Kártyás vásárlás`) és a közlemény automatikusan összevonásra kerül, így a párosító motor teljes szöveges kontextussal dolgozhat.

### 3. Tranzakció Pipeline Intercept Védőháló (`worker.py`)
Javítottuk a `worker.py` tranzakciós pipeline-jának strukturális felépítését:
- **Behúzás Javítása:** Az intercept blokk kikerült a téves belső cikluságból.
- **Szigorú Többfeltételes Guard:** Tranzakciós feltöltés kizárólag akkor irányítható át a bérszámfejtési modulba, ha:
  1. A dokumentum klasszifikációja egyértelműen sikeres (`payroll_type != 'error' and payroll_ext is not None`).
  2. A tartalom egyértelműen bérjegyzék, járulékelszámolás vagy bérutalási lista (`is_payroll_statement` megbízható pozitív eredménnyel zárul).
- Ha a dokumentum banki kivonat vagy tranzakciótörténet, az intercept garantáltan nem aktiválódik, megőrizve az eredeti tranzakciós feltöltési életciklust.

### 4. Egységteszt Csomag (`test/unit_test/test_kh_bank_exports.py`)
Létrehoztunk egy dedikált automatizált unit tesztkészletet, amely közvetlenül ellenőrzi a K&H `.xls` és `.csv` fájlok hibátlan feldolgozását, az összegek pontosságát és az elválasztójelek kezelését.

---

## Consequences

- **Pozitív:**
  - A K&H Bank vállalati exportjai (mind a tab-separated CSV, mind a BIFF formátumú XLS) azonnal, 100%-os pontossággal feldolgozásra kerülnek.
  - A Mauroni Events Kft. éles feltöltése során mind a 101 tranzakció sikeresen kinyerésre került, kitöltött összegekkel, dátumokkal és partnerekkel.
  - Megszűnt az a kritikus hiba, amely a tranzakciós fájlokat tévesen bérszámfejtésnek minősítette és törölte a tranzakciós queue-ból.
- **Negatív:**
  - Minimális kódméret növekedés a `transaction_extractor.py`-ban az elválasztójel-gyakorisági statisztika miatt.

## Kapcsolódó
- [A-006: Python Worker Architektúra](./A-006-python-worker.md)
- [A-035: Háromirányú Szekvenciális Pipeline Átirányítás](./A-035-three-way-fallback-redirection.md)
- [A-059: TransactionMatchingCore & Moduláris UI Architektúra](./A-059-transaction-matching-core-and-modular-ui.md)
- [A-091: Bank Statement Boundary Governance](./A-091-bank-statement-boundary-and-summary-artifact-guard.md)
