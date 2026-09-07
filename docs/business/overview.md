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

A platform két szorosan együttműködő, de önálló alkalmazási rétegből áll:

### 1. Elsődleges célcsoport: Magyar KKV Cégvezetők & Pénzügyesek (`eaisyBill`)
- Kettős könyvvitelt vezető kis- és középvállalkozások
- Szeretnék átlátni a cégük valós pénzügyi helyzetét valós időben
- Automatizálni kívánják a számlabegyűjtést, számlafeldolgozást és banki tranzakció-párosítást
- Szoros és gördülékeny digitális kapcsolatot akarnak fenntartani a könyvelőjükkel

### 2. Egyenrangú szakmai célcsoport: Könyvelőirodák, Könyvelők & Bérszámfejtők (`eaisyBooks`)
- Több tucat vagy több száz ügyfélcég könyvelését és bérszámfejtését végző szolgáltatók
- Havi zárási folyamatok, jóváhagyási sorok és hiányzó bizonylatok hatékony követése
- Egyéni vállalkozások (EV) átalány, VSZJA és KATA könyvelése, pénztárkönyv zárása
- Teljes körű havi bérszámfejtési ciklus, NAV 08-as XML import és rekonstrukció
- TAO és KIVA adónemek, előlegek és év végi korrekciós zárások kezelése
- Hivatalos hatósági kapcsolatok: Cégkapu / KÜNY tárhely szinkronizáció és EGYKE meghatalmazások

### 3. Iparági specializációk
- **E-commerce vállalkozások:** futárszolgálati (GLS, DPD, Foxpost, Packeta) és fizetési kapu (Stripe, Barion, Europay POS) elszámolások
- **Kiskereskedelmi cégek:** több regiszteres házipénztár és napi készpénzforgalom kezelése

---

## Hogyan működik?

### 1. Számlák beérkezése
A számlák több csatornán juthatnak be a rendszerbe:
- **Email:** A cég egyedi email címet kap (pl. `cegnev@inbox.visibill.hu`), ahonnan a rendszer a mellékleteket automatikusan feldolgozza.
- **NAV szinkronizáció:** Közvetlen NAV Online Számla 3.0 API szinkronizáció a bejövő és kimenő számlákra.
- **Kézi és tömeges feltöltés:** PDF, kép, vagy ZIP archívumok feltöltése drag-and-drop módon.
- **Cégkapu / KÜNY:** Hatósági levelek és bizonylatok közvetlen letöltése.

### 2. AI feldolgozás & Tanulás
Minden beérkezett dokumentumot a rendszer automatikusan feldolgoz:
- Optikai szövegfelismerés (Vision OCR + MarkItDown)
- Strukturált adatkinyerés (partner, adószám, deviza, bruttó/nettó/áfa, fizetési határidő)
- Automatikus kontírozás a számlatükör és a cég egyedi könyvelési szabálytára (`company_prompt_rules`) alapján
- Könyvelői visszajelzések és kézi korrekciók alapján folyamatos tanulás

### 3. Banki egyeztetés & Párosítás
A banki kivonatok (CSV, CAMT.053) feltöltése után az algoritmus automatikusan összerendeli a tranzakciókat a számlákkal többdimenziós heurisztika alapján (partner, összeg, közlemény, devizakonverzió).

### 4. Pénzügyi áttekintés & Könyvelői Jóváhagyási Kapu
- Dashboard és KPI mutatók a cégvezetőnek
- Dedikált könyvelői jóváhagyási sor az ellenőrzésre váró tételekről
- Lejárt követelések kezelése és hiányzó bizonylatok magic-linkes bekérése az ügyféltől

### 5. Zárás & Hatósági Bevallások
- Havi bérszámfejtési ciklus lezárása, bérjegyzékek kiküldése és NAV 08 ÁNYK XML export
- Havi / negyedéves ÁFA bevallás (2665) és 65M összesítő nyilatkozat összeállítása
- Egyéni vállalkozói pénztárkönyv zárása és járulékbevallások (58-as)
- Éves mérleg, eredménykimutatás, TAO és KIVA kalkuláció

---

## Főbb funkciók áttekintése

| Funkció | Mit csinál? | Kinek hasznos? |
|---------|-------------|----------------|
| **Számlafeldolgozás** | Email, NAV, feltöltés → automatikus OCR és adatkinyerés | Cégvezetők, könyvelők |
| **NAV szinkronizáció** | Bejövő + kimenő számlák kétirányú szinkronja NAV v3 API-val | Minden magyar cég |
| **Banki tranzakció párosítás** | CSV/CAMT import → AI párosítás számlákhoz | Cégvezetők, könyvelők |
| **Főkönyv (GL) & Kontírozás** | Automatikus kategorizálás, számlatükör, könyvelési naplók | Könyvelők |
| **Portfólió Menedzsment** | Grid, Lista és Kanban nézet az összes ügyfél zárási státuszával | Könyvelőirodák (eaisyBooks) |
| **Jóváhagyási Sor & Hiányzók** | Bizonylatok kötegelt jóváhagyása, hiányzók magic-link bekérése | Könyvelők, ügyfelek |
| **Bérszámfejtési Ciklus** | 4 fázisú havi bér, jelenlét, cafeteria, bérjegyzék, utalási lista | Bérszámfejtők, könyvelők |
| **NAV 08 XML Rekonstrukció** | Korábbi havi 08-as bevallásokból dolgozók és bérek visszaállítása | Könyvelők (eaisyBooks) |
| **EV & Egyszeres Könyvvitel** | Átalány/VSZJA/KATA, pénztárkönyv, 14 nyilvántartás, járulékok | Egyéni vállalkozók, könyvelők |
| **TAO & KIVA Modul** | Évközi követés, év végi korrekciós zárás, kalkulátorok | Társas vállalkozások, könyvelők |
| **Cégkapu & KÜNY Tárhely** | Hivatalos tárhely szinkronizáció és letöltés | Könyvelők, cégvezetők |
| **Képviselet & EGYKE** | Képviseleti jogosultságok nyilvántartása | Könyvelőirodák |
| **Könyvelési Szabálytár** | Cégre szabott AI szabályok és promptok könyvtára | Könyvelők |
| **Irodai Jogosultságok (RBAC)**| 4 szintű szerepkör és modul-szintű adatbázis felülbírálat | Irodavezetők |
| **Kintlévőség kezelés** | Lejárt számlák nyomon követése, felszólítás küldés | Cégvezetők |
| **Éves beszámoló** | Eredménykimutatás, mérleg és kiegészítő melléklet | Könyvelők, cégvezetők |
| **Tárgyi eszközök (TENY)** | Eszköznyilvántartás, értékcsökkenés kalkuláció | Cégvezetők, könyvelők |
| **Futárszolgálat riportok** | GLS, MPL, DPD, FoxPost elszámolások feldolgozása | E-commerce cégek |
| **Házipénztár** | Több regiszter, több deviza, szabály-alapú pénztárkönyvelés | Kiskereskedelmi cégek |
| **Árfolyamok** | MNB napi árfolyamok, devizás árfolyam-különbözet dashboard | Exportáló/importáló cégek |

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
- eaisyBooks modul (könyvelő irodák számára, együtt vásárolható)
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
- ✅ Multi-company támogatás + adószám-alapú cross-company invoice routing (2026-07-02)
- ✅ Email-alapú automatikus számlafeldolgozás
- ✅ eaisyBooks modul (könyvelő iroda nézet, korábban "Accounty")
- ✅ ÁFA bevallás modul
- ✅ Payroll (bérszámfejtés) modul
- ✅ Házipénztár multi-regiszter támogatás (több pénztár, több deviza, szabályok)
- ✅ MNB árfolyam integráció (SOAP API, auto-sync)
- ✅ Devizás árfolyam-különbözet dashboard
- ✅ Tranzakció párosítás ML tanulás (felülírás audit log)
- ✅ EV (Egyéni Vállalkozó) modul eaisyBooks-ban: 3 adóforma, járulék-kalkuláció minimumjárulékkal, pénztárkönyv, 14 nyilvántartás, bevallások (2026-07-08)
- ✅ EV adóforma-összehasonlítás TB-járulék + szocho kalkulációval (foglalkoztatási státusz, szakképzettség) (2026-07-08)

### Amin még dolgozunk
- 🟡 Árazási modell véglegesítése (egyszeri díj struktúra)
- 🟡 Jogosultsági rendszer finomítása (member korlátozások)
- 🟡 GDPR compliance dokumentáció

### Amit tervezünk
- 📋 Banki API integráció (Open Banking / PSD2)
- 📋 Mobil alkalmazás (PWA)
- 📋 eaisyBooks iroda nézet bővítés
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
