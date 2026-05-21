# Decision 020: Adó Modul Scope

**Status:** Open

**Category:** Pénzügyi Modulok

**Question:** Mi az adó modul pontos scope-ja? Csak nyilvántartás (ÁFA, TAO összegek rögzítése), vagy aktív kalkuláció is (ÁFA bevallás összeállítás, TAO alap számítás, SZJA)? Kell-e bevallás generálás (ÁNYK kompatibilis)?

**Decision:**

**Jelenlegi implementáció:** A `tax` tábla létezik (adonem, osszeg, datum, company_id) de jelenleg 0 rekord van benne production-ben. Az alap struktúra kész, de a funkció még nem aktív.

**Rationale:**
