# A-128: Szigorított Számlaszám Határ-illesztés (Boundary Matching), Részhalmaz Kiszűrés (Subsumption Filter) és Többszörös Párosítási Jóváhagyási Kapu

**Status:** Decided  
**Date:** 2026-09-18  
**Category:** Architecture / AI Worker / Transactions / Matching / Database Triggers  
**Érintett komponensek:** `visibill-worker/transaction_matcher.py`, `visibill-worker/db.py`, `supabase/migrations/20260918180000_fix_multi_match_and_unmatch_triggers.sql`, `transaction_invoice_matches`, `transactions`, `invoices`, `nav_invoices`  
**Kapcsolódó döntések:** [A-039: Transaction Matcher Performance Optimization](./A-039-transaction-matcher-performance-optimization.md), [A-059: TransactionMatchingCore & Moduláris UI Architektúra](./A-059-transaction-matching-core-and-modular-ui.md), [A-082: Részben Fizetett Számlák Státusz](./A-082-partially-paid-invoices-status.md), [A-100: Banki Tranzakció Egyediségi Megkötés Bővítése](./A-100-transaction-unique-constraint-amount-inclusion.md), [BRD 040: Számla Kapcsolatok és Párosítási Logikák](../../business/decisions/040-invoice-relations-matching.md), [P-017: AI Párosítás Megjelenítés](../../product/decisions/P-017-matching-display.md)

---

## Context

A banki tranzakciók és számlák automatikus összerendelését a Visibill háttér-worker (`transaction_matcher.py`) végzi. A 2026. szeptemberi éles üzem során (elsőként a Rába Kalandpark Kft. esetében, hibajegy: `#EB-0143`) kritikus pénzügyi adatintegritási anomália merült fel:

1. **Számlaszám Részstring / Előtag Ütközés (Prefix Collision):**  
   A banki közleményben szereplő `RABA-2026-309` sorszámú kifizetésre a korábbi párosító logika nemcsak a helyes `RABA-2026-309` számlát találta meg, hanem a rövidebb, de részstringként megegyező `RABA-2026-30` és `RABA-2026-3` bizonylatszámokat is. Ennek oka az volt, hogy a normalizált számlaszámot reguláris szóhatár (`\b`) nélkül, egyszerű `clean_inv_num in clean_tr_desc` részstring-kereséssel vizsgálta a kód.

2. **Téves Többszörös Párosítás (False Multi-Match) és Automatikus Fizetett Státusz:**  
   Mivel a párosító 3 különböző számlát is megtalált ugyanazon közleményben, a tételt "Bizonylatszám multi-egyezés"-nek minősítette, és a `trg_mark_invoice_paid_on_multi_match` adatbázis trigger mindhárom számlán azonnal beállította a `paid = true` állapotot. Így a `RABA-2026-30` (3 798 824 Ft) és a `RABA-2026-3` valójában kifizetetlen számlák tévesen rendezettként jelentek meg a követelésállományban.

3. **Inkonzisztens Törlési és Lekapcsolási Életciklus (Missing Unmatch / Delete Triggers):**  
   Amikor a téves többszörös párosításokat a könyvelő lekapcsolta vagy törölte a `transaction_invoice_matches` kapcsolótáblából, nem létezett `BEFORE DELETE` trigger a `paid` státusz visszaállítására. Ennek következtében a számlák `paid = true` és `transaction_id = NULL` állapotban ragadtak (fantom fizetett számlák). Hasonlóan, a `transactions.matched_invoice_id` módosításakor a meglévő `reset_paid_on_transaction_unmatch()` függvény csak `NEW.matched_invoice_id IS NULL` esetén futott le, de másik számlára történő átkapcsoláskor (`NEW <> OLD`) nem állította vissza a korábbi számlát fizetetlenre.

4. **Banki Import Duplikáció Védelem (Bank Reference Dedup):**  
   Ismételt bankkivonat-feltöltések vagy átfedő időszaki importok során elengedhetetlen volt, hogy a banki egyedi referenciaszám (`reference` / `transaction_ref`) alapján a worker már a beszúrás előtt szűrje a már feldolgozott tranzakciókat.

---

## Decision

### 1. Szigorú Reguláris Token-Határ Illesztés (`_is_exact_invoice_number_in_description`)

A `clean_inv_num in clean_tr_desc` naiv részstring-keresést felváltotta a determinisztikus reguláris kifejezés alapú token-határ vizsgálat a `transaction_matcher.py` modulban:

```python
def _is_exact_invoice_number_in_description(inv_num: str, tr_desc: str) -> bool:
    # Karakterek szétválasztása opcionális határolójelekkel (szóköz, kötőjel, aláhúzás, perjel, pont)
    pattern = r"(?<![a-zA-Z0-9])" + r"[\s\-_/.]*".join(re.escape(c) for c in clean_inv) + r"(?:szla|szamla|számla)?(?![a-zA-Z0-9])"
    return bool(re.search(pattern, tr_desc, re.IGNORECASE))
```

- **Negatív visszatekintés és előretekintés:** `(?<![a-zA-Z0-9])` és `(?![a-zA-Z0-9])` biztosítja, hogy a számlaszám előtt és után ne állhasson alfanumerikus karakter (így a `30` vagy `3` nem matchelhet a `309` belsejében).
- **Rugalmas belső határolók:** Támogatja a banki közleményekben előforduló szóközöket és elválasztókat (pl. `RABA - 2026 - 309`).
- **Magyar számlautótag-tűrés:** Engedélyezi az opcionális `szla`, `szamla`, `számla` végződéseket közvetlenül a számlaszám után (pl. `RABA-2026-309szla`).

### 2. Részhalmaz-Kiszűrés és Leghosszabb Egyezés Elve (`_filter_subsumed_hits`)

Ha a leírásban több számlaszám-találat is adódik, a rendszer alkalmazza a részhalmaz-szűrőt:
- Ha egy találat normalizált számlaszáma szigorú részstringje vagy előtagja egy hosszabb talált számlaszámnak (pl. `RABA202630` részstringje a `RABA2026309`-nek), a rövidebb találatot a rendszer automatikusan eldobja.
- Kizárólag valódi, kölcsönösen független bizonylatszámok maradhatnak meg többszörös találatként (pl. `SZLA-001` és `SZLA-002`).

### 3. Többszörös Párosítás Jóváhagyási Kapu (Multi-Match Confidence Gate)

Amikor egy banki tétel valóban több független számlaszámot tartalmaz a közleményében:
- **Összeg-egyezés vizsgálata:** A rendszer összeadja az összes talált számla bruttó végösszegét (`sum(abs(inv.gross_amount))`), és összeveti a tranzakció összegével (`abs(tr.amount)`).
- **Automata hitelesítés (Auto-Verify):** Ha az összegek pontosan megegyeznek (±1 HUF kerekítési tűréssel), a párosítás `confidence_score = 0.95` értéket kap és `is_verified = True` lesz.
- **Jóváhagyási retesz (Approval Gate):** Ha a számlák összege nem egyezik a tranzakció összegével:
  - A megbízhatósági pontszám fixen `0.85`-re korlátozódik (a `0.90`-es automata küszöb alatt marad).
  - A rendszer a párosítás indoklásához hozzáfűzi: `(összeg eltér: számlák X Ft != tranzakció Y Ft) (jóváhagyásra vár)`.
  - A tranzakció `is_verified = False` állapotban marad, megkövetelve a könyvelő explicit manuális jóváhagyását.

### 4. Adatbázis-szintű Törlési és Lekapcsolási Triggerek

A pénzügyi konzisztencia védelmére a `20260918180000_fix_multi_match_and_unmatch_triggers.sql` migráció bevezette a hiányzó életciklus-triggereket:

1. **`trg_reset_paid_on_multi_match_delete`:**
   - Esemény: `BEFORE DELETE ON public.transaction_invoice_matches`
   - Függvény: `reset_paid_on_multi_match_delete()`
   - Logika: Megvizsgálja, hogy a törlés alatt álló számlához kapcsolódik-e még bármilyen egyéb tranzakció a `transactions` vagy a `transaction_invoice_matches` táblában. Ha nem, azonnal visszaállítja a számla állapotát: `paid = false`, `transaction_id = NULL` (mind az `invoices`, mind a `nav_invoices` táblában).

2. **Kibővített `reset_paid_on_transaction_unmatch()`:**
   - Esemény: `BEFORE UPDATE ON public.transactions`
   - Feltétel: `OLD.matched_invoice_id IS NOT NULL AND (NEW.matched_invoice_id IS NULL OR NEW.matched_invoice_id <> OLD.matched_invoice_id)`
   - Logika: Számlaváltás (`NEW <> OLD`) esetén is lekapcsolja és fizetetlenre állítja a korábbi (`OLD`) számlát, ha nincs hozzá más kapcsolt tétel.

3. **`trg_reset_paid_on_transaction_delete`:**
   - Esemény: `BEFORE DELETE ON public.transactions`
   - Logika: Tranzakció fizikai törlésekor automatikusan rendezi a korábban hozzá kapcsolt számla státuszát (`paid = false, transaction_id = NULL`).

### 5. Banki Referenciaszám Alapú Import Deduplikáció (`db.py`)

A `visibill-worker/db.py` modul `insert_transactions()` eljárása kibővült a banki referenciaszám alapú előzetes deduplikációval:
- A beszúrás előtt lekérdezi a cég meglévő tranzakcióinak referenciaszámait (`reference`).
- Az azonos referenciaszámmal rendelkező tételeket kiszűri a batch-ből, elkerülve a duplikátumok bekerülését és a felesleges PGMQ/matching terhelést.

---

## Consequences

### Pozitív:
- **Nulla prefix ütközés:** A `RABA-2026-309` soha többé nem párosítja a `RABA-2026-30` és `RABA-2026-3` számlákat.
- **Követelés-integritás:** Megszűntek a fantom fizetett számlák; a kifizetetlen követelések pontosan és valósághűen látszanak a kintlévőség-kezelőben és a pénzügyi beszámolókban.
- **Összeg-védett csoportos párosítás:** Ha több számlaszám szerepel egy utalásban, a rendszer csak akkor jelöli fizetettnek, ha a banki összeg maradéktalanul lefedi a számlák összegét; ellenkező esetben könyvelői jóváhagyást kér.
- **Atomikus életciklus-kezelés:** Bármely kézi vagy scriptes törlés esetén a DB triggerek automatikusan és konzisztensen helyreállítják a számlák fizetetlen státuszát.
- **100%-os tesztlefedettség:** 83 automatizált egységteszt fut le és passzol a worker pipeline-ban (köztük 6 dedikált prefix és boundary teszt a `test_prefix_matching_guard.py`-ban).

### Kötöttségek:
- Olyan rendkívül ritka esetekben, ahol egy cég egyetlen utalással fizet ki több számlát, de a banki tétel összege eltér (pl. banki díj levonás vagy részfizetés miatt), a számlák nem kapnak azonnal automata `paid = true` státuszt, hanem a könyvelőnek a felületen egy kattintással jóvá kell hagynia a párosítást.

---

## Kapcsolódó

- [A-039: Transaction Matcher Performance Optimization](./A-039-transaction-matcher-performance-optimization.md)
- [A-059: TransactionMatchingCore & Moduláris UI Architektúra](./A-059-transaction-matching-core-and-modular-ui.md)
- [A-082: Részben Fizetett Számlák Státusz](./A-082-partially-paid-invoices-status.md)
- [A-100: Banki Tranzakció Egyediségi Megkötés Bővítése](./A-100-transaction-unique-constraint-amount-inclusion.md)
- [BRD 040: Számla Kapcsolatok és Párosítási Logikák](../../business/decisions/040-invoice-relations-matching.md)
- [P-017: AI Párosítás Megjelenítés](../../product/decisions/P-017-matching-display.md)
- [PostgreSQL RPC Katalógus](../rpc-catalog.md)
- [Adatbázis Séma: Tranzakciók & Bank](../database/06-transactions-bank.md)
