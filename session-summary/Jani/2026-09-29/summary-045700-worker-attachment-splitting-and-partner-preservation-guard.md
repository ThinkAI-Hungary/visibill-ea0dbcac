# Session Summary — 2026-09-29 04:57

```text
fix(worker, splitter, db, docs): többoldalas számlamelléklet téves darabolás (bad-splitting) elhárítása, partner- és összegvédelem (Zero-as-Value), multi-invoice partner/kategória paritás, ADR-075

- PDF Splitter Számlamelléklet és Téves Chunkolás Védelem (`pdf_splitter.py`, ADR-075)
  - Hiba feltárása (Think AI Kft. incidens, `OE9044_2026-1.pdf`): az Opennetworks Kft. 3 oldalas számláját a rendszer 2 független chunkra vágta (`chunk-2`), mert a 2. és 3. oldalon a fejlécben "SZÁMLAMELLÉKLET" szerepelt `1/2. oldal` és `2/2. oldal` belső oldalszámozással.
  - Gyökérok: a Strategy 1 az oldalszám-indikátorok aránya (66% >= 50%) miatt aktiválódott, és a 2. oldal `1/2` számozását új számlakezdésnek tekintette. A Strategy 1-ben hiányzott a melléklet-detektálás és a számlaszám-egyezés ellenőrzés.
  - Megoldás:
    - `_ATTACHMENT_PAGE_RE` és `_is_attachment_page()` reguláris kifejezés bevezetése magyar, angol és német kulcsszavakra (`számla melléklet(e)?`, `számlamelléklet`, `attachment to invoice`, `annex to invoice`, `rechnungsbeilage`, `anlage zur rechnung`).
    - Strategy 1 védelem: ha egy oldal mellékletként azonosított és létezik már aktív számlacsoport, `current_page == 1` esetén sem kezd új számlát, hanem folytatólagosan az előző számlához fűzi.
    - Strategy 2 suppression: a melléklet oldalak kezdőoldalként való detektálásának tiltása (`suppressing_start_page_attachment_detected`).
    - `_merge_adjacent_same_invoice_groups()` & `_has_same_invoice_number()`: az azonos bizonylatsorszámra hivatkozó szomszédos és összetartozó oldalcsoportok automatikus egyesítése.
    - Eredmény: a valós 3 oldalas `OE9044_2026-1.pdf` számla mostantól 1 egységes chunkként (`[ [0, 1, 2] ]`) kerül átadásra.

- Létező Számla Adatvesztés Elleni Védelme és Zero-as-Value Finomítás (`db.py` -> `upsert_invoice`)
  - Hiba: amikor korábban a melléklet (Chunk 1) feldolgozásra került, az LLM kinyerte a fejlécből a számlaszámot, de partneradatok hiányában az eladó `Ismeretlen eladó` lett adószám nélkül, az összeg pedig 0 Ft. Az `upsert_invoice()` Check 1 és Check 2 vak UPDATE-tel felülírta a helyes Chunk 0 adatokat, kitörölve a partnert, lenullázva a végösszeget és lecserélve a csatolmányt a csonka `chunk-2.pdf`-re.
  - Megoldás: `_preserve_existing_invoice_fields()` bevezetése:
    - Partner adatok védelme: érvényes eladó/vevő név és adószám nem írható felül `Ismeretlen eladó`-val, `Ismeretlen`-nel vagy üres értékkel.
    - Összegmezők felülírási védelme (Opció A - Zero-as-Value): másodlagos chunkok (`chunk_index > 0`) 0 Ft-os összege nem írhatja felül a korábbi számlaösszeget; egyedi számlák újrafeldolgozásakor (`chunk_index is None`) a legitim 0 Ft-os sztornó/jóváíró összegek elfogadásra kerülnek, míg a hiányzó (`None`) értékek esetén a korábbi összeg megmarad.
    - Csatolmány URL védelem: másodlagos chunk URL nem írhatja felül az eredeti teljes dokumentum linkjét.

- Multi-Invoice Pipeline Funkcionális Paritás (`worker.py`)
  - Hiányosság megszüntetése: a `_process_multi_invoice_pipeline()` chunk-feldolgozási ciklusából (`_process_chunk`) korábban hiányzott a partner törzsadat-mentés és a kategóriabesorolás.
  - Implementáció: beépítésre került az `upsert_partner_from_invoice()` és az `auto_classify_invoice_category()` hívás minden egyes bejövő és kimenő chunkra, biztosítva a teljes funkcionális paritást az egyedi számlafeldolgozással.

- Dokumentáció & Architektúra Szinkronizáció (`docs/DECISIONS.md`, `docs/GOTCHAS.md`)
  - Új ADR: `docs/DECISIONS.md` -> **ADR-075: Számlamellékletek Téves Chunkolásának Megelőzése, Splitter Védelem és Multi-Invoice Partner/Kategória Paritás**.
  - Hibaelhárítási útmutató bővítése: `docs/GOTCHAS.md` -> **12. fejezet: PDF Splitter & Számlamelléklet Chunkolási Gotchas**.

- Minőségbiztosítás & Verifikációs Kapuk
  - Új unit tesztcsomag: `test/unit_test/test_attachment_and_splitting_guard.py` (6/6 passed in 0.24s).
  - Éles számla regressziós teszt: `test_oe9044_real_pdf_not_split` a valós `OE9044_2026-1.pdf` állománnyal igazolva.
  - Teljes worker tesztcsomag: `python run_tests.py` -> **113/113 passed** (33.77s alatt, 0 hiba, zéró regresszió).
  - Morfi Implementation Review mélyaudit lefolytatva és sikeresen lezárva.
```
