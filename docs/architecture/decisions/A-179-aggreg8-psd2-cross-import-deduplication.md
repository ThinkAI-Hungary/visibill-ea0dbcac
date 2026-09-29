# A-179: Aggreg8 PSD2 és Fájlimport Cross-Deduplikációs Architektúra

**Status:** Decided  
**Date:** 2026-09-29  
**Utoljára frissítve:** 2026-09-29  

## Context

A Visibill rendszerben a banki tranzakciók két forrásból érkezhetnek:
1. **Manuális kivonatimport:** PDF, CSV, XLS fájlok feltöltése a felületen (`transaction_uploads`).
2. **Aggreg8 PSD2 Open Banking:** AISP banki API szinkronizáció valós időben és történeti lekérdezéssel (`bank_transactions` $\rightarrow$ `transaction_jobs`).

Amikor egy vállalkozás (pl. Mauroni Events Kft., EB-0211) már hónapok óta fájlokból importálta a bankszámlakivonatait, és utólag összeköti a számláját az Aggreg8 PSD2 szolgáltatással, a banki aggregátor a jogszabályi időablakban (90–180 nap) automatikusan letölti az összes múltbeli tranzakciót.

Mivel a két forrás leírási formátuma eltér:
- Fájlimport: `Értéknap: 2026.06.01 Közlemény: XY... Partner: Foo` vagy `BNK... Azonnali átutalás...`
- Aggreg8: `Partner - IBAN - közlemény` vagy `Közlemény /REF/...`

A `transactions` tábla korábbi egyedi korlátja (`UNIQUE(company_id, transaction_date, description, amount)`) nem illeszkedett a két eltérő leírásra. Ennek következtében az Aggreg8 pipeline a már létező, könyvelt tranzakciókat másodszor is beszúrta a rendszerbe, és a kétlépcsős számlapárosító motor újból párosította őket számlákhoz (gyakran eltérő számlákhoz, mint a meglévő tételeket). Ez egyenleg-duplikációt és kettős számlakiegyenlítettséget eredményezett.

## Decision

Kétlépcsős, cross-import védelmi architektúrát vezettünk be a Python Workerben és az adatbázis-kezelő rétegben:

### 1. Korai Deduplikáció AI és Párosítás Előtt (`aggreg8_processor.py`)
Az Aggreg8 folyamatban a normalizálás után, de az AI kategóriabesorolás (Phase 3) és a számlapárosítás (Phase 6) **előtt** beépítettük a `deduplicate_aggreg8_candidates()` fázist (Phase 2b):
1. **Már szinkronizált rekordok szűrése:** Ellenőrzi, hogy a beérkező `a8_transaction_id`-k léteznek-e már a `transactions` táblában. Ha igen, azonnal kihagyja őket.
2. **Időablakos DB keresés:** Lekérdezi a cég meglévő tranzakcióit a köteg dátumtartományában ($\pm 2$ nap ráhagyással).
3. **Kétszintű párosítási prioritás:**
   - **Prioritás 1 (Banki referencia):** Ha mind a beérkező Aggreg8 tétel, mind a meglévő fájl tétel tartalmaz azonos banki hivatkozást (pl. K&H `MSV...`, `MSK...`, `MS0...`, `AAACT...`, `BNK...`, `/REF/...`, vagy napi POS kártyafedezeti ID-t), és az összeg azonos, akkor 100%-os biztonsággal azonosítja a duplikátumot.
   - **Prioritás 2 (Egzakt dátum + összeg):** Ha nincs banki referencia, de a `transaction_date` és az `amount` forintra pontosan megegyezik, 1-to-1 leköti a rekordot a meglévő fájlimportos tételhez.
4. **Meglévő Rekord Gazdagítása (Enrichment over Duplication) & Atomi Konkurenciavédelem:**
   - Ahelyett, hogy új sort szúrna be, a meglévő fájlimportos tranzakciót gazdagítja az Aggreg8 azonosítóval: `UPDATE transactions SET a8_transaction_id = a8_id WHERE id = matched_file_tx_id AND a8_transaction_id IS NULL`.
   - **Atomi versenyhelyzet-védelem:** A frissítés `.is_("a8_transaction_id", "null")` feltétellel fut le. Amennyiben egy párhuzamos worker vagy folyamat már összekötötte a tételt (0 sor frissült), a rendszer nem tekinti lefoglaltnak a rekordot, hanem új tranzakcióként továbbengedi, kivédve a race condition miatti adatvesztést vagy 23505-ös ütközést.
   - Sikeres összekötés esetén a tétel kikerül a feldolgozási listából: nem fut rá AI kategorizálás (tokenköltség megtakarítás) és nem fut rá számlapárosítás (a meglévő párosítások és egyenlegek sértetlenek maradnak).

### 2. Kibővített Banki Referencia-Felismerés (`db.py:extract_bank_reference`)
A magyar banki formátumok sajátosságait lefedve a reguláris kifejezést kiterjesztettük:
- K&H specifikus fejlécek: `K&H ref:`, `Tranz.ref.:`, `Banki ref:`, `Ref.:`
- ISO/SEPA strukturált hivatkozások: `/REF/<kód>`
- Banki prefixek: `MSV...`, `MSK...`, `MS0...` (K&H kártya- és termináltranzakciók), `BNK...`, `AAACT...`
- POS terminál és napi kártyafedezeti azonosítók: `\b\d{9,10}-\d{9,10}(?:-\d{8})?\b` (pl. `1900954468-1001956476-20260601`)

### 3. Insert-szintű Védelem és PostgreSQL 23505 Megelőzés (`db.py:insert_transactions`)
A `transactions` tábla parciális egyedi indexszel rendelkezik az `a8_transaction_id` mezőre (`idx_transactions_a8_tx_id`).
Ha az `insert_transactions` hívásban olyan tétel szerepelne, amelynek `a8_transaction_id`-ja már szerepel az adatbázisban, az `ON CONFLICT (company_id, transaction_date, description, amount)` nem védi ki az `idx_transactions_a8_tx_id` megsértését, ami tranzakció-megszakadást okozna.
Ezért az `insert_transactions` beszúrás előtt szűri a már létező `a8_transaction_id`-kat (`Pre-filtering 3`).

## Consequences

**Pozitív:**
- Zéró duplikáció az Aggreg8 és a fájlimportos adatok között.
- A meglévő számlapárosítások nem sérülnek és nem tolódnak el.
- Jelentős LLM token-megtakarítás (a korábban már importált tételeket nem küldjük el AI osztályozásra).
- A fájlimportos tranzakciók felvérteződnek az Aggreg8 azonosítóval, így a jövőbeli webhookok és lekérdezések azonnal felismerik őket.

**Negatív / Kötöttségek:**
- Ha egy cég egyetlen napon több teljesen azonos összegű, referencia nélküli készpénzfelvételt vagy bankköltséget hajt végre, a rendszer 1-to-1 sorrendben köti össze őket.

## Kapcsolódó
- [A-119: Aggreg8 PSD2 Open Banking Integráció](./A-119-aggreg8-psd2-open-banking-integration.md)
- [A-039: Transaction Matcher Performance Optimization](./A-039-transaction-matcher-performance-optimization.md)
- [A-059: Transaction Matching Core](./A-059-transaction-matching-core-and-modular-ui.md)
- [06-transactions-bank.md Adatbázis séma](../database/06-transactions-bank.md)
- Hibajegy: #EB-0211
