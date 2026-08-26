# P-018: Manuális Párosítás Felülírás

**Status:** Decided  
**Category:** Tranzakció & Párosítás  
**Updated:** 2026-08-26

**Question:** Hogyan írhatja felül a felhasználó az AI párosítást?

**Decision:** Dialógusban keresés + hozzárendelés, is_verified flag-gel, audit log-gal és ML tanulási rétegéssel.

**Current Implementation:**
- TransactionDetailsDialog-ban manuális számla keresés és hozzárendelés
- is_verified flag: felhasználó jóváhagyta a párosítást
- Audit log: minden felülírás naplózva (`match_transaction_overrides_log` tábla)
- **ML tanulás:** A felülírások adatait (partner név, összeg, eredeti/javított párosítás) a rendszer rögzíti, a worker pipeline a jövőben ezeket a mintákat használja az AI párosítás pontosságának javítására
- **Deviza-tudatos összehasonlítás:** 
  - Azonos devizanemű tranzakció↔számla: direkt összeg-összehasonlítás (pl. EUR↔EUR)
  - Eltérő devizánál: mindkét oldal HUF-ra konvertálva (approximate rate-tel)
  - Eltérés mindig a helyes devizanemben jelenik meg
- **Minimum 10 számla megjelenítés:** Ha az összeg-tolerancia szűrő (±30% azonos deviza, ±50% cross-currency) kevesebb mint 10 eredményt ad, a legközelebbi összegű számlákat mutatja összeg-proximítás szerint
- **Prioritás:** Azonos devizanemű számlák előre kerülnek a listában
- **Multi-match & Multi-select:** `transaction_invoice_matches` join tábla — egy tranzakcióhoz több számla is rendelhető (részfizetés, gyűjtő utalás) interaktív checkbox-os többes kijelöléssel.
- **Keresési UX & Debounce:** A manuális számla keresőmező 300ms debouncing-ot használ és in-memory gyorsítótárazást kombinál aszinkron adatbázis-lekéréssel. Gépelés közben az inline loading spinner fixált pozícióban marad a sor végén a layout ugrálása nélkül.

**Rationale:** Stabil és auditálható megoldás. A deviza-tudatos összehasonlítás megoldja az EUR/USD tranzakciók helyes párosítását. A minimum 10 tétel biztosítja, hogy a felhasználó soha ne lásson üres listát, ami félrevezető volt. A debounced keresés és fix spinner pozíció megszünteti a gépelés közbeni villódzást.

