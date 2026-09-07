# Decision 054: eaisyBooks Kliensközpontú Navigáció és Dual-Mode Sidebar

**Status:** Decided

**Category:** eaisyBooks & Integrált Modulok

**Question:** Hogyan szerveződjön az eaisyBooks navigációja, hogy a könyvelő egyszerre tudja kezelni a teljes ügyfélportfólióját, és zavartalanul tudjon dolgozni egy-egy kiválasztott ügyfél belső bizonylatain anélkül, hogy elveszítené az irodai kontextust?

**Decision:**

1. **Kettős Navigációs Mód (Dual-Mode Navigation):**
   - **Portfólió Mód (`/eaisybooks/*`):** Az iroda átfogó feladatai, ahol a sidebar az aggregált menüpontokat jeleníti meg:
     - Portfólió (Kanban, Grid, Lista)
     - Hiányzó számlák & Ügyfélportál
     - Könyvelői jóváhagyási sor
     - NAV határidők & Adónaptár
     - Riasztási központ
     - Irodai riportok & AI asszisztens
     - Rendszeradminisztráció (Jogosultsági mátrix, Könyvelők, Adómértékek, Sablonok, Audit napló)
   - **Ügyfél Kontextus Mód (`/eaisybooks/:companyId/:dateRange/*`):** Amikor a könyvelő kiválaszt egy céget, a sidebar automatikusan átvált az adott ügyfél moduljaira:
     - "← Vissza a portfólióhoz" kiemelt navigációs gomb
     - Ügyfél áttekintés (Overview)
     - Számlák & Könyvelési tételek
     - Banki tranzakciók & Kivonatok
     - Könyvelői jóváhagyási sor (ügyfélszintű)
     - Főkönyv & Kontírozás
     - Bérszámfejtés (Payroll)
     - Egyéni Vállalkozó & Szervezeti Könyvvitel (EV modul)
     - Cégkapu & KÜNY tárhely
     - Házipénztár & Analitikák
     - Riportok & Könyvelési szabálytár (`company_prompt_rules`)

2. **Fejléc Cégváltó (`CompanySwitcher`):**
   - Ügyfél kontextus módban a felső lécben elhelyezett cégváltó listázza a könyvelőhöz rendelt összes ügyfelet.
   - Cégváltáskor a rendszer megőrzi az aktuális aloldal útvonalát (pl. ha a `/payroll` oldalon vált céget, azonnal az új cég `/payroll` oldalára jut a meglévő dátumtartomány megtartásával).

**Rationale:** A könyvelők munkaidejük jelentős részében ügyfelek között váltogatnak, miközben azonos típusú feladatokat végeznek (pl. egymás után három cég bérszámfejtését ellenőrzik). A kliens kontextus megtartása és az aloldal-megőrző cégváltó drasztikusan csökkenti a felesleges kattintások számát és az áttekinthetetlenséget.
