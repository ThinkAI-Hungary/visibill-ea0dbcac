# Visibill — Business Overview

---

## Elevator Pitch

> **A magyar kisvállalkozók évente átlagosan 120 órát töltenek pénzügyi adminisztrációval. A Visibill ezt 10-re csökkenti.**
>
> A Visibill egy AI-alapú pénzügyi asszisztens, amely automatikusan feldolgozza a számlákat, szinkronizálja a NAV adatokat, párosítja a banki tranzakciókat, és elkészíti az éves beszámolót — mindezt egyetlen felületen. Nem számlázó szoftver, nem könyvelő program: egy intelligens köztes réteg, ami rendszert teremt a cégvezető pénzügyi adataiban.

---

## Mi a Visibill?

A Visibill egy webes platform, amely a magyar kis- és középvállalkozások napi pénzügyi adminisztrációját automatizálja mesterséges intelligencia segítségével.

A rendszer három fő problémát old meg:

1. **Számlák szétszórtsága** — A cégvezetők számlákat kapnak emailben, postán, NAV-on és futárszolgálatoktól. A Visibill mindet egy helyre gyűjti és automatikusan feldolgozza.

2. **Manuális könyvelési munka** — Az AI automatikusan kategorizálja a tételeket, hozzárendeli a főkönyvi számokat, és párosítja a bankszámlakivonattal. Ami korábban órákat vett igénybe, az másodpercek alatt megtörténik.

3. **Éves beszámoló bonyolultsága** — A rendszer a nap mint nap összegyűjtött adatokból automatikusan elkészíti az eredménykimutatást, a mérleget és az éves beszámolót.

---

## Kinek készül?

### Elsődleges célcsoport
**Magyar KKV cégvezetők** (Kft, Bt, Zrt), akik:
- Kettős könyvvitelt vezetnek
- Szeretnék átlátni a cégük pénzügyi helyzetét valós időben
- Nem akarnak órákat tölteni adminisztrációval
- Könyvelőjükkel hatékonyabban szeretnének együttműködni

### Másodlagos célcsoport (jövőkép)
- **Könyvelő irodák**, amelyek több ügyfél pénzügyeit kezelik egyetlen felületen
- **E-commerce vállalkozók**, akiknek futárszolgálati elszámolásokat is kezelniük kell

---

## Hogyan működik?

### 1. Számlák beérkezése
A számlák három úton juthatnak be a rendszerbe — a cégvezetőnek csak egyet kell ismernie:

- **Email:** A cég kap egy egyedi email címet (pl. `cegnev@inbox.visibill.hu`). Amit ide küldenek, az automatikusan feldolgozásra kerül.
- **NAV szinkronizáció:** A rendszer közvetlenül a NAV Online Számla rendszeréből kéri le a bejövő és kimenő számlákat.
- **Kézi feltöltés:** PDF vagy fénykép feltöltése a felületen.

### 2. AI feldolgozás
Minden beérkezett dokumentumot a rendszer automatikusan feldolgoz:
- Felismeri a szöveget (OCR)
- Kinyeri a releváns adatokat (szállító, összeg, ÁFA, fizetési határidő)
- Hozzárendeli a megfelelő főkönyvi kategóriához
- Megtanulja a cég egyedi kategorizálási szokásait

### 3. Banki egyeztetés
A banki kivonat feltöltése után a rendszer automatikusan összerendeli a tranzakciókat a számlákkal — a cégvezetőnek csak a kétes eseteket kell jóváhagynia.

### 4. Pénzügyi áttekintés
Az irányítópulton egy pillantás alatt látható:
- Bevételek és kiadások alakulása
- Kintlévőségek (ki mennyivel tartozik, mióta)
- Lejárt számlák (automatikus fizetési felszólítás küldés)
- Pénzforgalmi előrejelzés

### 5. Éves zárás
Az év végén a rendszer az összegyűjtött adatokból elkészíti:
- Az eredménykimutatást
- A mérleget
- Az éves beszámolót (kiegészítő mellékletekkel)

---

## Főbb funkciók áttekintése

| Funkció | Mit csinál? | Kinek hasznos? |
|---------|-------------|----------------|
| **Számlafeldolgozás** | Email, NAV, feltöltés → automatikus adatkinyerés | Minden felhasználó |
| **NAV szinkronizáció** | Bejövő + kimenő számlák lekérdezése a NAV-ból | Minden magyar cég |
| **Banki tranzakció párosítás** | CSV import → AI párosítás számlákhoz | Cégvezetők |
| **Főkönyv (GL)** | Automatikus kategorizálás, számlatükör | Könyvelők, cégvezetők |
| **Kintlévőség kezelés** | Lejárt számlák nyomon követése, felszólítás küldés | Cégvezetők |
| **Eredménykimutatás** | Bevételek és ráfordítások automatikus összesítése | Könyvelők |
| **Mérleg** | Eszközök és források kimutatása | Könyvelők |
| **Éves beszámoló** | Teljes beszámoló összeállítás és véglegesítés | Könyvelők, cégvezetők |
| **Tárgyi eszközök** | Eszköznyilvántartás, értékcsökkenés kalkuláció | Cégvezetők |
| **Bérek & járulékok** | Bérjegyzék feldolgozás, bérköltség nyilvántartás | Cégvezetők |
| **Munkaidő nyilvántartás** | Dolgozók munkaideje, szabadságkezelés | HR / cégvezetők |
| **Futárszolgálat riportok** | GLS, MPL, DPD, FoxPost stb. elszámolások | E-commerce cégek |
| **Házipénztár** | Több regiszter (pénztár), több deviza, alapertelm. regiszter, szabály-alapú tr. elosztás | Kiskereskedelmi cégek |
| **Árfolyamok** | MNB napi árfolyamok (SOAP API, auto-sync), devizás árfolyam-különbözet dashboard | Exportáló cégek |
| **XML főkönyv import** | Könyvelőprogram XML főkönyvi kivonat feltöltés és feldolgozás | Könyvelők |

---

## Miért más, mint a versenytársak?

| | Visibill | Hagyományos könyvelő szoftver | Számlázó (Billingo, Szamlazz.hu) |
|---|---------|------------------------------|--------------------------------|
| **Automatikus feldolgozás** | ✅ AI-alapú OCR + LLM | ❌ Manuális adatbevitel | ❌ Csak kimenő számlák |
| **NAV integráció** | ✅ Kétirányú szinkronizáció | 🟡 Részleges | 🟡 Csak kimenő |
| **Bejövő számlák** | ✅ Email + NAV + feltöltés | ❌ Manuális | ❌ Nem kezeli |
| **AI kategorizálás** | ✅ Tanuló GL osztályozás | ❌ Nincs | ❌ Nincs |
| **Éves beszámoló** | ✅ Automatikus generálás | ✅ Igen | ❌ Nem |
| **Banki párosítás** | ✅ AI-alapú | 🟡 Manuális | ❌ Nincs |
| **Self-service** | ✅ Cégvezető is használhatja | ❌ Könyvelő kell | ✅ Igen |

**A Visibill nem a számlázó szoftverek versenytársa** — a számlázás (kimenő számla kiállítás) nem része a rendszernek. A Visibill a *beérkező* pénzügyi adatok feldolgozására és a *pénzügyi áttekintés* biztosítására fókuszál.

---

## Üzleti modell

### Egyszeri díjas modell
A Visibill egyszeri vásárlással érhető el. A felhasználó megvásárolja a szoftvert, és korlátlanul használhatja.

> *Az árazás véglegesítése folyamatban — lásd: [004-pricing-model.md](./decisions/004-pricing-model.md)*

### Bevételi driverek
- Egyszeri licencdíj (one-time purchase)
- Accounty modul (könyvelő irodák számára, együtt vásárolható)
- Jövőbeli prémium funkciók (potential add-on)

---

## Jelenlegi állapot

### Amit már megépítettünk
- ✅ Teljes számla-feldolgozási pipeline (OCR + AI)
- ✅ NAV Online Számla v3 integráció (bejövő + kimenő)
- ✅ Banki tranzakció import és AI párosítás
- ✅ Főkönyvi rendszer AI kategórizálással
- ✅ XML főkönyv import (RLB/Novitax/Kulcs-Soft/KÖKÉNY)
- ✅ Eredménykimutatás, mérleg, éves beszámoló (főkönyvi + NAV adat alapú)
- ✅ Tárgyi eszköz nyilvántartás (11 TAO sablon)
- ✅ Kintlévőség kezelés és fizetési felszólítás
- ✅ Futárszolgálat riport feldolgozás (6 szolgáltató)
- ✅ Bér modul és munkaidő nyilvántartás
- ✅ Multi-company támogatás
- ✅ Email-alapú automatikus számlafeldolgozás
- ✅ Accounty modul (könyvelő iroda nézet)
- ✅ ÁFA bevallás modul
- ✅ Payroll (bérszámfejtés) modul
- ✅ Házipénztár multi-regiszter támogatás (több pénztár, több deviza, szabályok)
- ✅ MNB árfolyam integráció (SOAP API, auto-sync)
- ✅ Devizás árfolyam-különbözet dashboard
- ✅ Tranzakció párosítás ML tanulás (felülírás audit log)

### Amin még dolgozunk
- 🟡 Árazási modell véglegesítése (egyszeri díj struktúra)
- 🟡 Jogosultsági rendszer finomítása (member korlátozások)
- 🟡 GDPR compliance dokumentáció

### Amit tervezünk
- 📋 Banki API integráció (Open Banking / PSD2)
- 📋 Mobil alkalmazás (PWA)
- 📋 Könyvelő iroda nézet
- 📋 Számla kiállítás vagy számlázó integráció

---

## Kapcsolódó dokumentáció

| Dokumentum | Tartalom |
|-----------|----------|
| [brd.md](./brd.md) | Részletes üzleti követelmények (technikai) |
| [user-journeys.md](./user-journeys.md) | Felhasználói útvonalak |
| [use-cases.md](./use-cases.md) | Használati esetek |
| [decisions/index.md](./decisions/index.md) | 30 üzleti döntés nyilvántartása |
| [decisions/decision_helper.md](./decisions/decision_helper.md) | Nyitott döntések opciós elemzése |
