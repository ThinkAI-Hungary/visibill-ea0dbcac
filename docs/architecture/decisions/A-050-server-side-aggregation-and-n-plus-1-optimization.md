# A-050: Server-Side Aggregation & N+1 Query Optimization

## Státusz
Elfogadva (Accepted) — 2026. augusztus 24.

## Kontextus
Nagy adatmennyiség (10 000 – 100 000+ számlasor és tételek) esetén több kritikus szűk keresztmetszetet (bottleneck) azonosítottunk:
1. **Kliensoldali nagy letöltések:** A könyvelői hiányzó tételek darabszámlálása (`fetchAllMissingItems`) 15 000 sort töltött le a böngészőbe; a KATA 3M Ft partnerfigyelmeztetések pedig cég-szűrés nélkül olvasták be az összes kimenő NAV számlát az egész évre.
2. **N+1 Szekvenciális HTTP Lekérdezések:** A könyvelői riportokban (`useAccountyReports`) és a partnerek oldalán (`PartnersPage`) soros `for` ciklusok futottak cégenként és partnerenként (pl. 30 cégnél 60 egymást követő kérés).
3. **Hiányzó fedő indexek:** Idegen kulcsok nem rendelkeztek B-Tree indexekkel, lassítva a JOIN és ON DELETE CASCADE műveleteket.

## Döntés
1. **Új szerveroldali RPC függvények bevezetése:**
   - `get_accounty_missing_item_counts(p_company_ids uuid[], p_date_from, p_date_to)`: SQL `GROUP BY` segítségével azonnali darabszámokat és sürgős/értesítési adatokat ad vissza (< 2 ms).
   - `get_portfolio_kata_partner_totals(p_company_ids uuid[], p_year int)`: Cégekre szűrt SQL partner-összesítés (< 3 ms).
   - `get_ev_ytd_totals(p_company_ids uuid[], p_tax_year int)`: SQL szinten összesített EV bevételek és kiadások.
2. **N+1 hurkok kötegelése és in-memory gyorsítása:**
   - A könyvelői riport lekérdezéseket `.in('company_id', companyIds)` kötegelt lekérdezésekre cseréltük.
   - A külföldi partnerek számlálását az adatok memóriában tartásával végezzük extra hálózati kérések nélkül.
3. **Foreign Key Indexek pótlása:**
   - Létrehoztuk a fedő B-Tree indexeket (`company_bank_accounts`, `payment_transfers`, `petty_cash_entries`, `transaction_rules`, `accounty_*` táblák).

## Következmények
* A könyvelői portfólió és hiányzó tételek nézete ~12 másodperc helyett < 15 ms alatt tölt be.
* A KATA 3M partnerfigyelmeztetés 15 másodperc / túlcsordulás helyett < 25 ms alatt fut le.
* Az adatbázis hálózati forgalma megabájtokról bájtokra csökkent, a connection pool terhelése minimalizálódott.
