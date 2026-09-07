# Decision 031: [eaisyBooks] Modul Teljes Scope & Könyvelőirodai Architektúra (korábban: Accounty)

**Status:** Decided

**Category:** eaisyBooks & Integrált Modulok

**Question:** Mi a könyvelőiroda-specifikus platform (eaisyBooks) üzleti és funkcionális scope-ja, hogyan különül el és hogyan integrálódik a fő eaisyBill alkalmazással? Milyen szerepkörök, jogosultsági szintek és adatmodellek támogatják a többügyfeles könyvelési folyamatokat?

**Decision:**

1. **Önálló, egyenrangú könyvelőirodai ERP platform (`eaisyBooks`):**
   - Az eaisyBooks nem pusztán egy kiegészítő aloldal, hanem egy komplex, dedikált könyvelőirodai ERP rendszer, amely saját keretrendszerrel (`AccountyLayout`), navigációval és szerepkör-kezeléssel rendelkezik.
   - **Kettős Navigációs Mód (Dual-Mode Navigation):**
     - **Portfólió Mód (`/eaisybooks/*`):** Irodai szintű nézetek: ügyfélcégek konszolidált kezelése (Grid, Lista, Kanban), aggregált KPI dashboard, központi hiányzó számlák, jóváhagyási sor, NAV határidők és adónaptár, irodai riportok, AI asszisztens és rendszeradminisztráció.
     - **Ügyfél Kontextus Mód (`/eaisybooks/:companyId/:dateRange/*`):** Mélyfúrás egy kiválasztott ügyfél könyvelésébe: áttekintés, számlák, banki tranzakciók, jóváhagyási sor, kontírozás, bérszámfejtés, EV egyszeres könyvvitel, Cégkapu, házipénztár, riportok és könyvelési prompt szabályok.
     - **Gyors Cégváltás (`CompanySwitcher`):** Az ügyfél módban a felső navigációs lécben elhelyezett cégváltó lehetővé teszi a közvetlen átváltást egy másik cég azonos aloldalára (pl. számlákról számlákra), valamint egyetlen kattintással a visszalépést a portfólióba.

2. **Teljes Körű Szakmai Funkciókészlet:**
   - **Portfólió Menedzsment & Kanban:** Ügyfelek szűrése könyvelőre, zárási státuszra (*Adatbekérés folyamatban* → *Feldolgozás alatt* → *Ellenőrzésre vár* → *Havi zárás kész*).
   - **Hiányzó Számlák & Ügyfélportál:** Automatikus hiányzó számla detektálás banki tranzakciók és NAV adatok alapján. Email értesítő küldése testreszabható előnézeti modallal és jelszómentes, biztonságos Magic Linkkel (`/eaisybooks/client-portal?token=...`).
   - **Könyvelői Jóváhagyási Sor (Approval Queue):** Beérkező bizonylatok kötegelt jóváhagyása vagy elutasítása könyvelői indoklással.
   - **Havi Bérszámfejtési Ciklus:** 4 fázisú folyamat (Tervezet → Számfejtés → Ellenőrzés/Audit → Lezárva). Jelenléti ív, cafeteria, kedvezmények (25 év alatti, családi), bérjegyzék PDF generálás, SEPA/HUF banki átutalási csomag és NAV 08 ÁNYK XML export.
   - **NAV 08 ÁNYK XML Rekonstrukció:** Korábbi havi bevallásokból munkavállalók, jogviszonyok és béradatok automatikus tömeges importja és visszaállítása.
   - **Egyéni Vállalkozói (EV) & Szervezeti Könyvvitel:** 3 adóforma (Átalány, VSZJA, KATA), Pénztárkönyv zárási varázslóval és stornózással, 14 kötelező analitikus nyilvántartás, havi 58-as járulékbevallás XML, Civil szervezetek és Társasházak egyszeres könyvvitele.
   - **TAO & KIVA Modul:** Évközi adóalap és előleg követés, év végi zárási ellenőrző lista korrekciós tételekkel, kalkulátorok és összehasonlító szimulációk.
   - **Cégkapu / KÜNY Tárhely & EGYKE:** Hivatalos tárhely szinkronizáció, NAV dokumentumok letöltése, hatósági meghatalmazások nyilvántartása lejárati riasztásokkal.
   - **Cég-specifikus Könyvelési Szabálytár (`company_prompt_rules`):** Egyedi kontírozási szabályok rögzítése, amelyek irányítják az AI osztályozót.

3. **Négyszintű Szerepkör-alapú Hozzáférés (RBAC) & Dinamikus DB Felülbírálat:**
   - Az `accounty_assignments` táblában rögzített irodai szerepkörök:
     - `iroda_admin`: Teljes hozzáférés az iroda összes funkciójához, beállításokhoz, könyvelők kezeléséhez és jogosultságokhoz.
     - `senior_könyvelő`: Riportok, jóváhagyási sor, adónaptár, zárások felügyelete és jóváhagyása.
     - `könyvelő`: Hozzárendelt ügyfelek operatív könyvelése, számlák, tranzakciók, bérszámfejtés, EV modul.
     - `asszisztens`: Részleges adatrögzítés, hiányzó számlák követése, bizonylatok feltöltése.
   - **Modul-szintű DB Felülbírálat (`accounty_module_permissions`):** Az irodavezető a `PermissionMatrixPage` felületen munkatársanként egyedileg felülbírálhatja bármely modul olvasási (`can_read`) vagy írási (`can_write`) jogosultságát. A `useAccountyPermissions` hook ezt a dinamikus felülbírálást prioritásként kezeli a statikus szerepkörrel szemben.

4. **Adatbázis Modell:**
   - `accounty_assignments`: Könyvelő ↔ cég ↔ iroda összerendelés és alapértelmezett szerepkör.
   - `accounty_module_permissions`: Egyedi modul jogosultsági mátrix.
   - `accounty_missing_items`: Detektált és követett hiányzó bizonylatok.
   - `accounty_audit_log`: Biztonsági és műveleti eseménynapló.
   - `payroll_employees`, `payroll_contracts`, `payroll_cycles`, `payroll_slips`: Bérszámfejtési alrendszer.
   - `company_prompt_rules`: Cégre szabott könyvelési promptok és szabályok.

5. **Elnevezési és Migrációs Stratégia:**
   - **Hivatalos terméknév:** `eaisyBooks` (a dokumentációban, marketingben és felhasználói felületen).
   - **Kód- és DB-szintű megnevezés:** A korábbi `Accounty` elnevezés technikai örökségként (`accounty_*` táblák, `AccountyLayout`, `useAccounty*` hookok) stabilan fennmarad a visszafelé kompatibilitás biztosítására.
   - **Útvonalak:** A modern `/eaisybooks/*` útvonalak az elsődlegesek, az örökölt `/accounty/*` hivatkozásokat a rendszer automatikusan átirányítja.

**Rationale:** A könyvelőirodák igényei gyökeresen eltérnek a mikro- és kisvállalkozói cégvezetők igényeitől. A könyvelők nem egyetlen cég adatait nézik, hanem többtucatnyi céget felügyelnek párhuzamosan, szigorú törvényi határidők, havi zárási kontrollok, adónemek és hatósági kapcsolatok mentén. Az eaisyBooks önálló architektúrája biztosítja a skálázhatóságot, a precíz jogosultságkezelést és a modern, hatékony irodai munkavégzést anélkül, hogy az eaisyBill egyszerűségét kompromittálná.
