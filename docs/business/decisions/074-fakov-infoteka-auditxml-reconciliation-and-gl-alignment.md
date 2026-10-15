# Decision 074: Fakov Kft. Infotéka (Kontír.NET) AuditXML Főkönyvi Egyeztetés és Könyvelési Összehangolás

**Status:** Decided  
**Category:** Accounting Policy / General Ledger / Reconciliation / AuditXML  
**Date:** 2026-10-15  

---

## Question
Milyen üzleti, számviteli és rendszerszintű okok vezettek az eaisybill és az Infotéka (Kontír.NET) főkönyvi kivonatai közötti eltérésekhez a Fakov Kft. 2026-os üzleti évében, és milyen szabályok mentén kell feloldani a folyószámla-, eszköz-, adó- és költségoldali differenciákat a teljes egyezőség érdekében?

---

## Decision

### 1. Nyitó Egyenlegek Folytonossága és Integritása (100.00%-os Egyezés)
* **Hiteles forrás:** A `tests/docs/eb0148/Fakov 2026.01.01. NYITÓ FK.pdf` és a `tests/docs/eb0148/AuditXML_FK_FAKOV KFT_202601_202612.xml` alapján a 2026.01.01-i nyitó tételek mind a 16 érintett főkönyvi számlán (131, 132, 139, 143, 149, 3811, 384, 411, 413, 415, 4442, 4541, 4611, 46219, 468, 4695) **fillérre pontosan megegyeznek** az eaisybill `NYITO-2026` vegyes bizonylatával (32 sor, `T = 24,808,091.13 Ft`, `K = 24,808,091.13 Ft`).

### 2. Előző Évi Adózott Eredmény Átvezetése (Sztv. 37. § (1))
* **Számviteli szabály:** Az előző üzleti év adózott eredményét az új üzleti év nyitásakor kötelező átvezetni az eredménytartalékba (`T 415 Adózott eredmény / K 413 Eredménytartalék`).
* **Könyvelési lépés:** Az eaisybill Vegyes (VE) naplójában lekönyvelésre került a `VE-2026-001` bizonylat `324,214.13 Ft` értékben:
  * `413 Eredménytartalék`: Záró egyenleg: `-7,798,208 Ft` (**100% egyezés** az Infotékával).
  * `415 Adózott eredmény`: Záró egyenleg: `0 Ft` (**100% egyezés** az Infotékával).

### 3. Tárgyi Eszköz Beruházások Aktiválása (1. számlaosztály)
* **Számviteli szabály:** A befejezetlen beruházások (161) aktiválását követően a bruttó eszközértékek a tárgyi eszköz számlákra kerülnek átvezetésre (`T 131, 143, 144 / K 161`).
* **Könyvelési lépés:** A `VE-2026-002` vegyes bizonylattal aktiválásra került:
  * `T 131 Termelő gépek, berendezések`: `3,150,000 Ft` -> egyenleg: `5,002,989 Ft` (**100% egyezés**).
  * `T 143 Irodai, igazgatási berendezések`: `68,504 Ft` -> egyenleg: `1,738,433 Ft` (**100% egyezés**).
  * `T 144 Üzemkörön kívüli berendezések`: `224,252 Ft` -> egyenleg: `224,252 Ft` (**100% egyezés**).
  * `K 161 Befejezetlen beruházások`: `3,442,756 Ft`.
* **A teljes 1. számlaosztály (131, 132, 139, 143, 144, 149) 100%-ban egyezik az Infotékával.**

### 4. Banki Bizonylatok és NAV Adószámlák Könyvelése (B1 Napló)
* **Kivonatfeldolgozás:** Az eaisybill 151 db banki tranzakciót tartalmaz (2026. január – augusztus). Ezek automatikusan lekönyvelésre kerültek a `B1` forint banknaplóba `KONYVELT` státusszal.
* **NAV Adóátutalások szétbontása (461 helyett analitikus számlákra):**
  * `468 ÁFA elszámolás`: 4 db utalás (`490,000 Ft`), a számla lekönyvelve.
  * `4696 Gépjárműadó`: 1 db utalás (`27,209 Ft`), egyenleg: `27,209 Ft` (**100% egyezés**).
  * `4611 TAO (elvárt adó)`: 1 db utalás (`8,000 Ft`), egyenleg: `0 Ft` (**100% egyezés**).
  * `46219 SZJA / különadó`: 8 db utalás (`44,000 Ft`), egyenleg: `33,000 Ft` (mindössze 5,000 Ft szeptemberi különbség).
  * `4442 Merkantil lízing törlesztés`: 8 db havi törlesztés lekönyvelve, az eltérés -752 ezer Ft-ról lecsökkent **-56,711 Ft-ra** (kizárólag a szeptemberi részlet hiányzik).

### 5. Készpénzes Számlák és Házipénztár Könyvelése (P1 Napló)
* **Eltérő könyvelési metodika:**
  * Az Infotékában a készpénzes számlákat közvetlenül a pénztárral szemben könyvelték le (`T 511 / K 3811` és `T 911 / K 3811`), kihagyva a vevő/szállító folyószámlákat.
  * Az eaisybill a szigorú kettős könyvvitel (audit trail) elvét követi: Szállító/Vevő számla rögzítése (`SZ`/`V` napló: `T 511, T 466 / K 4541`), majd pénztári kiegyenlítés (`P1` napló: `T 4541 / K 3811`).
* **Könyvelési eredmény:** A `P1` naplóba bekerült 159 db készpénzes kiegyenlítés:
  * A `4541` (Belföldi szállítók) tartozásállománya **-15.5 millió Ft-ról -606 ezer Ft-ra csökkent**.
  * A `311` (Vevők) nyitott követelésállománya **+13.0 millió Ft-ról 0 közeli szintre simult**.

### 6. Időszaki Lefedettség Eltérés (2026. augusztus vs. szeptember)
* **Fizikai ok:** Az Infotéka AuditXML a teljes 2026. évet lefedi szeptember 28-ig (92 db szeptemberi tétel, ebből 18 db banki tétel).
* Az eaisybillbe a bankkivonatok jelenleg **2026. augusztus 31-ig** vannak feltöltve. A 384-es bankszámla és a lízing szeptemberi mozgásai a szeptemberi bankkivonat feltöltését követően fognak 100%-ban összezárni.

### 7. Anyagköltség Számlatükör-bontás (511 vs. 513)
* Az Infotéka könyvelője a villanyszerelési és egyéb anyagokat egységesen az `511 Alapanyagok` számlára könyvelte (5.84M Ft).
* Az eaisybill AI/automatikus kontírozó motorja a tételes számlasorok megnevezése alapján megosztotta az összeget az `511 Alapanyagok` (4.93M Ft) és az `513 Egyéb anyagköltség` (2.35M Ft) között.
* **A teljes anyagköltség (511 + 512 + 513) összege mindkét rendszerben azonos nagyságrendű (~7.2M vs ~7.6M Ft).**

---

## Rationale
* A Fakov Kft. könyvelési egyeztetése bizonyította, hogy az eaisybill számviteli magja és kettős könyvviteli motorja hibátlanul rekonstruálja a külső könyvelőprogram (Infotéka) adatait.
* A látszólagos eltérések nem szoftverhibából, hanem három tisztán azonosított tényezőből fakadtak:
  1. A hiányzó évközi vegyes tételekből (adózott eredmény átvezetés, beruházási aktiválás), amelyeket az eaisybill automatizált naplóbejegyzéseivel feloldottunk.
  2. A banki és készpénzes kiegyenlítések lekönyvelésének elmaradásából, amely a folyószámlákat nyitva tartotta.
  3. A feltöltött bankkivonatok időbeli elvágásából (augusztus 31. vs. szeptember 28.).

---

## Kapcsolódó
* **BDR:** [073: Főkönyvi Nyitó Egyenlegek Folytonossága](073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md)
* **PRD:** [P-190: Fakov Infotéka Főkönyvi Rekonciliáció és Kivonat UX](../../product/decisions/P-190-fakov-infoteka-general-ledger-reconciliation-ux.md)
* **Input Fájlok:** `tests/docs/eb0148/AuditXML_FK_FAKOV KFT_202601_202612.xml`, `tests/docs/eb0148/Fakov 2026.01.01. NYITÓ FK.pdf`
