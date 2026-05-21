# P-026: Cégprofil Adatok

**Status:** Decided  
**Category:** Beállítások & Profil

**Question:** Milyen cég adatokat lehet szerkeszteni?

**Decision:** Alap cég adatok + alias + telephely. Logó és bővített adatok nem prioritás.

**Current Implementation:**
- Cégnév, adószám, cím
- Email alias kezelés (EmailAliasManager)
- Share token (csatlakozáshoz)
- Telephely kezelés (company_locations: headquarters / branch)

**Rationale:** A jelenlegi adatok lefedik a működési igényt. Logó, bankszámla, szektorkód bővítés akkor lesz aktuális ha PDF export/felszólítás branding igény felmerül (lásd P-021).
