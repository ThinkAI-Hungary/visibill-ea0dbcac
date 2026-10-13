# Decision 071: Bérszámfejtés, Sztv. 471 Főkönyvi Egyeztetés és Banki GIRO Kifizetés-ellenőrzési Szabályzat

**Status:** Decided  
**Category:** Business Rule / Payroll / General Ledger / Banking  
**Date:** 2026-10-12  

---

## Question
Milyen jogszabályi (Mt., Sztv.) és számviteli követelményeknek kell érvényesülniük a bérszámfejtési béranalitika, a havi adóhatósági bevallások (08-as NAV bevallás), a banki kifizetések (GIRO átutalási köteg) és a kettős könyvvitel (Sztv. 471. Jövedelemelszámolási számla) havi rendszerű, automatikus egyeztetése és auditja során?

---

## Decision

### 1. Sztv. 471. Jövedelemelszámolási Egyeztető Egyenlet (Reconciliation Equation)
* Minden havi bérszámfejtési ciklus végén a rendszer kötelezően ellenőrzi és auditálja a 471. Jövedelemelszámolási főkönyvi számla egyenlegét az alábbi képlet szerint:
  $$\text{Záró Egyenleg} = \text{Nyitó Egyenleg} + \text{Tárgyhavi Nettó Bérfeladás} (T 541/561 - K 471) - \text{Tárgyhavi Banki/Pénztári Kifizetések} (T 471 - K 384/381)$$
* **Számviteli egyensúly kritérium:**
  * **0 Ft egyenleg:** A havi számfejtett bérek maradéktalanul kifizetésre és lekönyvelésre kerültek. A rendszer `BALANCED` státusszal és zöld pipával jelzi az egyezőséget (`Sztv. 471 Egyezik (0 Ft)`).
  * **Követel (pozitív) egyenleg:** Függő bértartozás áll fenn a dolgozók felé (még nem teljesült a banki utalás, vagy a kifizetési határidő előtt vagyunk).
  * **Tartozik (negatív) egyenleg:** Túlfizetés vagy hiányzó bérfeladási könyvelési tétel, amelyet a rendszer azonnali számviteli kockázatként (`MISMATCH` / `OVERPAID`) jelöl meg.

### 2. Mt. 157. § Szerinti Kifizetési Határidő és Eltérés-Audit
* A Munka Törvénykönyve (Mt. 157. §) alapján a munkabért a tárgyhónapot követő hónap 10. napjáig ki kell fizetni.
* A rendszer automatikusan számolja és figyeli a kifizetési határidőt:
  * Ha a tárgyhót követő 10. nap letelte után is fennáll kifizetetlen nettó bér, a rendszer kiemelt figyelmeztetést generál: `Kifizetetlen Munkabér (Határidő Lejárt)`.
  * Eltéréslista készítése minden olyan tételről, ahol a számfejtett nettó bér és a ténylegesen lekönyvelt banki tranzakció összege vagy kedvezményezettje eltér.

### 3. Banki GIRO XML Köteg Generálás és Tömeges Átutalási Szabályok
* A vállalkozások és könyvelők számára a rendszer közvetlenül generálja a magyar banki szabványnak (GIRO / MNB SEPA pain.001 formátum) megfelelő csoportos átutalási állományt.
* **Kötelező érvényesítési feltételek GIRO export előtt:**
  * Dolgozó érvényes belföldi (vagy nemzetközi IBAN) bankszámlaszáma.
  * Havi lezárt számfejtési státusz (`calculated` vagy `approved`).
  * Pozitív nettó kifizetendő összeg.
  * Jogcím és közlemény formátum (pl. `Bérkifizetés 2026.01 - Dolgozó Név`).

### 4. Rendszer-szétválasztási Architektúra (Visibill vs. eaisyBooks)
* **Visibill (Ügyfél/Vállalkozó nézet):** Likviditási és operatív fókusz. Megjeleníti a dolgozók nettó bérét, a levont SZJA/TB-t, a SZOCHO terheket, kezeli a kifizetetlen béreket és biztosítja a banki GIRO exportot.
* **eaisyBooks (Könyvelői nézet):** Kettős könyvviteli és adóhatósági fókusz. Ellenőrzi a 471-es főkönyvi karton egyezőségét, a banki kivonatok automatikus bérpárosítását, valamint a 08-as adó- és járulékbevallásokkal való konzisztenciát.

---

## Rationale
A bérszámfejtés és a hozzá kapcsolódó kifizetések a vállalkozások egyik legszigorúbban auditált területei (NAV, Munkaügyi Felügyelet, könyvvizsgáló). A béranalitika, a banki mozgások és a kettős könyvvitel közötti automatikus havi egyeztető egyenlet megszünteti a manuális exceles ellenőrzést és megakadályozza a jogosulatlan kifizetéseket, túlfizetéseket vagy elmulasztott járulékbevallásokat.

---

## Kapcsolódó
* **ADR:** [A-250: 14. Bérszámfejtés és Főkönyvi Bérfeladás Modul Architektúra, GIRO Motor és Tab Konszolidáció](../../architecture/decisions/A-250-payroll-module-14-reconciliation-giro-and-tab-architecture.md)
* **PRD:** [P-184: Bérszámfejtési Irányítópult Tabosítás, Bérkontroll és Letisztult Menükezelés UX](../../product/decisions/P-184-payroll-dashboard-tabs-and-reconciliation-ux.md)
* **Adatbázis séma:** [14-eaisybooks-payroll.md](../../architecture/database/14-eaisybooks-payroll.md)
