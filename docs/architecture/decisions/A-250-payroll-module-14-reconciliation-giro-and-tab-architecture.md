# A-250: 14. Bérszámfejtés és Főkönyvi Bérfeladás Modul Architektúra, GIRO Motor és Tab Konszolidáció

**Status:** Decided  
**Date:** 2026-10-12  
**Utoljára frissítve:** 2026-10-12  

---

## Context

A Visibill és eaisyBooks rendszerekben a bérszámfejtés (Module 14) egy komplex, szigorúan szabályozott pénzügyi terület, ahol a munkaügyi adatok (dolgozók, jogviszonyok, havi bérszámfejtési ciklusok), a havi adóhatósági bevallások (NAV 08-as havi járulékbevallás), a banki pénzforgalom (GIRO átutalási csomagok) és a kettős könyvviteli főkönyv (Sztv. 471. Jövedelemelszámolási számla) találkoznak.

Korábban az ügyféloldalon (`SalariesPage.tsx`) a nettó bér- és járulékösszesítők voltak elérhetők, a könyvelői oldalon pedig létezett a bérfeladás (`payrollAutoPoster.ts`), de hiányzott:
1. A 471-es havi főkönyvi egyeztető egyenlet és automatikus auditálás.
2. A banki kivonatok automatikus összevetése a számfejtett nettó bérekkel.
3. A szabványos magyar banki GIRO / SEPA XML köteg export.
4. A felületi menüstruktúra rendezetlensége: a bal oldali sávban különálló menüpontként jelent meg a Bérkontroll és a NAV bevallások, ami zsúfoltságot és navigációs redundanciát okozott.
5. Egy route-matching hiba a `ClientNav.tsx`-ben, ami miatt a Bérszámfejtés és a Bérkontroll menüpont egyidejűleg kapott aktív kiemelést.
6. Egy versenyhelyzet (race condition) a `useAppReady.ts` és `ProtectedRoute.tsx` rétegekben, ami az admin felhasználókat (`support_admin` szerepkörű cégtagokat) bejelentkezéskor időnként indokolatlanul visszairányította a `/management` képernyőre.

---

## Decision

### 1. Adatbázis Modell és Atomi RPC-k (`20261012170000_payroll_reconciliation_and_payouts.sql`)
* **`accounty_payroll_reconciliations` tábla:** Cégenként és havi ciklusonként tárolja a 471-es egyenleget:
  * Nyitó egyenleg (`opening_balance`)
  * Tárgyhavi bérfeladás (`total_net_accrued`)
  * Tárgyhavi banki és pénztári kifizetések (`total_bank_paid`, `total_cash_paid`)
  * Záró egyenleg (`closing_balance`) és eltérés (`discrepancy_amount`)
  * Audit státusz: `BALANCED`, `PENDING_PAYOUT`, `MISMATCH`, `OVERPAID`
* **`accounty_payroll_payout_matches` tábla:** Kapcsolat a havi dolgozói bérszámfejtési sor (`accounty_payroll_calculations`), a dolgozó (`accounty_employees`) és a banki tranzakció (`bank_transactions`) között, tárolva a párosítás típusát (`AUTO_IBAN`, `AUTO_AMOUNT`, `AUTO_NAME`, `MANUAL`, `GIRO_BATCH_SPLIT`).
* **`get_payroll_471_reconciliation` RPC:** Szerveroldali `SECURITY DEFINER` függvény, amely egyetlen lekérdezésben összeveti a főkönyvi 471-es karton nyitó/forgalmi adatait a havi bérszámfejtési tételekkel és a banki párosításokkal, azonnali eltéréslistát adva a felületnek.

### 2. Algoritmikus Motorok (`src/lib/payroll/`)
* **`payrollBankMatcher.ts`:** Többlépcsős determinisztikus banki tranzakció-kereső motor:
  1. Dolgozói IBAN / belföldi számlaszám egyezés
  2. Közlemény szöveg elemzés (név, adóazonosító jel, "bér", "fizetés", "munkabér" kulcsszavak)
  3. Összeg egyezőség (számfejtett nettó bér = banki terhelés)
* **`giroXmlGenerator.ts`:** MNB és GIRO Zrt. specifikációnak megfelelő, UTF-8 kódolású csoportos átutalási XML fájl generáló banki terminálokba (OTP Electra, George, K&H, Erste, Spectra) való közvetlen betöltéshez.

### 3. Főoldali Tab Konszolidáció (`PayrollDashboardPage.tsx`)
* A korábbi szétaprózott menüpontokat beépítettük a `PayrollDashboardPage.tsx` belső fülrendszerébe (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`):
  * `overview`: Áttekintés & Ciklusok (KPI kártyák, 3 oszlopos ciklus- és dolgozókezelés)
  * `reconciliation`: Bérkontroll & Bank (beágyazott `PayrollReconciliationPage embedded`)
  * `filings`: NAV bevallások (beágyazott `FilingsPage embedded`)
* URL szinkronizáció: A kiválasztott fül az URL `?tab=` paraméterében tárolódik, támogatva a közvetlen könyvjelzőzést és deep-linkelést.
* Címek tisztítása: A szakmai 471-es kód átkerült a főcímből a státuszjelvénybe (`Sztv. 471 Egyezik (0 Ft)`).

### 4. ClientNav Longest-Prefix Match Algoritmus
* A naiv `pathname.startsWith(item.path)` logikát lecseréltük a teljes menülistára kiterjedő leghosszabb prefix egyezésre:
  ```ts
  const matchingItems = items.filter(it => pathname === it.path || pathname.startsWith(it.path + '/'));
  const activeItem = matchingItems.sort((a, b) => b.path.length - a.path.length)[0];
  ```
  Ez garantálja, hogy egy időben szigorúan csak egyetlen menüpont legyen kiemelve, megelőzve a kettős kijelölési hibát.

### 5. Impersonációs Versenyhelyzet Elhárítása (`useAppReady.ts`, `ProtectedRoute.tsx`)
* A `thinkai` és `management` szerepkörű felhasználóknál a support_admin impersonációs lekérdezés (`active-impersonation-check`) befejezését kötelezően megvárja a rendszer (`impPending`), mielőtt döntést hozna az esetleges `/management` átirányításról, megszüntetve a hibás visszadobásokat.

---

## Consequences

### Pozitív:
* **Teljes körű auditálhatóság:** A bérszámfejtés és a banki kivonatok automatikusan szinkronban vannak a könyvelési főkönyvvel.
* **Ergonomikus, tiszta UI:** A bal oldali menü áttekinthető maradt, a bérszámfejtési feladatok egyetlen integrált irányítópultról kezelhetők.
* **Gyors banki utalás:** A cégvezetők és bérszámfejtők egy kattintással tölthetik le a GIRO XML köteget, elkerülve a téves kézi utalásokat.
* **Hibamentes navigáció:** Megszűnt a kettős menükijelölés és az admin visszadobási hiba.

### Negatív:
* A több banki tranzakcióból álló részletfizetések (pl. előleg + hóközi utalás + hóvégi kiegészítés) kezelése jelenleg aggregált egyeztetést igényel a tételes bontás helyett.

---

## Kapcsolódó
* [071: Bérszámfejtés, Sztv. 471 Főkönyvi Egyeztetés Szabályzata](../../business/decisions/071-payroll-statutory-reconciliation-and-bank-giro-policy.md)
* [P-184: Bérszámfejtési Irányítópult Tabosítás és Letisztult Menü UX](../../product/decisions/P-184-payroll-dashboard-tabs-and-reconciliation-ux.md)
* [P-143: 3-Oszlopos Bérszámfejtés és EFO Elkülönítés UX](../../product/decisions/P-143-payroll-3column-dashboard-and-efo-separation-ux.md)
* [14-eaisybooks-payroll.md](../database/14-eaisybooks-payroll.md)
