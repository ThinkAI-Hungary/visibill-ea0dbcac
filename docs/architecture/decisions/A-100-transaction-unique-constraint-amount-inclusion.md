# A-100: Banki Tranzakció Egyediségi Megkötés Bővítése Összeggel és Csendes Duplikátum-kezelés

**Status:** Decided  
**Date:** 2026-09-06  
**Utoljára frissítve:** 2026-09-06  

## Context

A banki kivonatok és számlatörténetek (PDF, Excel, CSV, XML, ZIP) feltöltése és feldolgozása során a rendszernek meg kell előznie a tranzakciók duplikálódását abban az esetben, ha a felhasználó újra feltölt egy korábbi kivonatot, vagy a kivonatok dátumtartománya részben átfedést mutat.

### A Felmerült Problémák és Gyökérok Elemzés

A 2026-09-06 16:40 körüli bankkivonat-feltöltési események során a Supabase PostgreSQL hibanaplóban sorozatos `23505 duplicate key value violates unique constraint "unique_transaction_entry"` hibaüzenetek jelentek meg, miközben a PostgREST API `HTTP 409 Conflict` válaszokat adott.

A mélyreható vizsgálat két különálló architektúrális és üzleti problémát tárt fel:

1. **Üzleti Adatvesztési Kockázat (Hiányzó `amount` a megkötésből):**
   A korábbi migrációban (`20260710000000_add_accounty_push_subscriptions.sql`) a tranzakciók egyediségét az alábbi megkötés biztosította:
   ```sql
   UNIQUE (company_id, transaction_date, description)
   ```
   A megkötésből hiányzott az `amount` (összeg) oszlop. Valós banki környezetben gyakori, hogy egy cégnek ugyanazon a naptári napon több azonos leírású, de eltérő összegű tranzakciója keletkezik:
   - Banki költségek: *"Számlavezetési díj"*, *"Készpénzfelvételi díj"*, *"Tranzakciós illeték"*, *"SMS szolgáltatás díja"*, *"Zárlati díj"*.
   - Kártyás vásárlások ugyanannál a kereskedőnél: pl. több tankolás vagy vásárlás egy napon (*"MOL Nyrt."*, *"SPAR"*, *"BKK"*).
   - Munkabér / megbízási utalások egységes közleménnyel.
   A korábbi megkötéssel a rendszer a napon belüli második valós tételt tévesen duplikációnak minősítette és eldobta.

2. **Felesleges Postgres ERROR Logok Re-upload / Átfedő Feltöltéskor:**
   Amikor a felhasználó egy kivonatot újra feltöltött, a worker kötegelt beszúrási fallback ága (`_insert_transactions_one_by_one`) sima `INSERT` utasításokat küldött PostgREST-en keresztül. A PostgreSQL motor minden meglévő tételnél `ERROR 23505` kivételt dobott, amit a worker Python kódban ugyan elkapott és átugrott (`skipped += 1`), de a PostgreSQL hibanaplója tele lett riasztásokkal.

---

## Decision

1. **Adatbázis Megkötés Bővítése (`20260906180000_expand_unique_transaction_entry_with_amount.sql`):**
   A 3-oszlopos megkötést 4-oszloposra cseréltük a `transactions` táblán:
   ```sql
   ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS unique_transaction_entry;
   ALTER TABLE public.transactions ADD CONSTRAINT unique_transaction_entry 
     UNIQUE (company_id, transaction_date, description, amount);
   ```

2. **Worker Upsert és Fallback Igazítás (`worker/db.py`):**
   * Az elsődleges kötegelt beszúrás `on_conflict` paramétere frissült:
     `on_conflict="company_id,transaction_date,description,amount"`.
   * Az egyenkénti fallback (`_insert_transactions_one_by_one`) szintén az `upsert(..., ignore_duplicates=True)` eljárást használja először, így a PostgreSQL `ON CONFLICT DO NOTHING` logikával csendben elnyeli a létező tételeket, megelőzve az `ERROR 23505` naplózási zajt.

---

## Consequences

**Pozitív:**
* **Adatbiztonság:** Nem vesznek el az azonos napon, azonos leírással, de eltérő összeggel érkező valós tranzakciók.
* **Tiszta Naplózás:** Az újrafeltöltött kivonatok duplikált tételei csendben szűrődnek ki, nem szennyezik felesleges hibákkal a Supabase hibanaplót.
* **Idempotens működés:** Ugyanazon kivonat többszöri feltöltése stabil és biztonságos marad.

**Negatív / Figyelembe veendő:**
* Ha egy cégnél ugyanazon a napon két valóban azonos leírású ÉS hajszálpontosan azonos összegű külön tétel szerepel (pl. 2 db pontosan 1 290 Ft-os kávé ugyanabban a kávézóban), az a bankkivonat egyedi tranzakció-azonosítója hiányában duplikátumnak minősül. Ez banki szinten minimális kockázat a korábbi állapothoz képest.

---

## Kapcsolódó
- [06-transactions-bank.md](../database/06-transactions-bank.md)
- [A-059: Transaction Matching Core](../decisions/A-059-transaction-matching-core-and-modular-ui.md)
- [A-098: Készpénzes és Manuális Kifizetések](../decisions/A-098-cash-and-manual-payment-matching-status-consistency.md)
