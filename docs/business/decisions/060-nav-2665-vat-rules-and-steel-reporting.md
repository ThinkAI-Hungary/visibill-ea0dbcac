# Decision 060: NAV 2665 ÁFA Bevallási Szabályok, Gyűjtőkódok és 6/B Acélipari Kötelezettség

**Status:** Decided  
**Category:** Adózás & Jogszabályi Megfelelőség (Áfa tv.)  
**Date:** 2026-09-20  

---

## Question
Milyen üzleti és adózási szabályok mentén kell lebontani a bizonylatok tételeit a NAV 2665 ÁFA bevallás hivatalos soraiba, hogyan kell kezelni a fordított adózást, és mik az Áfa tv. 6/B. melléklete szerinti kötelező adatszolgáltatási elvárások?

---

## Decision

A rendszer az Áfa törvény (2007. évi CXXVII. törvény) és a NAV 2665 hivatalos nyomtatványkitöltési útmutatójának megfelelően az alábbi 15 pontban rögzített üzleti és adózási szabályrendszert alkalmazza:

### 1. Belföldi Adókulcsok & Értékesítési Sorok
- **05. sor**: Belföldi 5%-os adómérték alá tartozó termékértékesítés és szolgáltatásnyújtás adóalapja és fizetendő adója.
- **06. sor**: Belföldi 18%-os adómérték alá tartozó értékesítés adóalapja és fizetendő adója.
- **07. sor**: Belföldi 27%-os normál adómérték alá tartozó értékesítés adóalapja és fizetendő adója.
- **08. sor**: Közérdekű vagy speciális jellegére tekintettel adómentes értékesítés (TAM: pl. humánegészségügyi ellátás, fogorvos, oktatás, lakóingatlan bérbeadás).
- **01. sor**: Közösség területén kívülre történő termékértékesítés (harmadik országos export). *Szigorúan tilos ide sorolni a belföldi tárgyi adómentes tételeket.*
- **04. sor**: Belföldi fordított adózású értékesítés adóalapja (ahol az adó megfizetésére a vevő kötelezett). A sor felirataként tilos „0%”-ot feltüntetni, kizárólag a **„mentes”** jelölés megengedett.
- **Univerzális „mentes” szabály**: Bármely 0%-os kulcsú vagy adómentes tétel (AAM, TAM, FAD, EXP, 0.00) esetén a felületen és a riportokban egységesen a **„mentes”** felirat jelenik meg.
- **91. és 92. sorok**: Az ÁFA területi hatályán kívüli ügyleteknél a feliratban kötelezően szerepelnie kell: **„SZOLGÁLTATÁSOK”**.

### 2. Fordított Adózás (FAD) Kettős Elszámolása
- Minden belföldi fordított adózású beszerzési tétel (`BE_FORD_27`, `FAD_EPIT_27`, `FAD_HULL_27`, `FAD_ACEL_27`) kötelezően kettős könyvelési jogcímen jelenik meg a bevallásban:
  1. **Fizetendő ÁFAként a 29. sorban** (az adóalap 27%-a).
  2. **Levonható ÁFAként a 66. sorban** (a cég ÁFA levonási jogosultságának / levonási hányadának mértékéig).

### 3. Gyűjtőkód Törzs Tisztítása & Redundanciák Felszámolása
- **Megszüntetett redundanciák**: A bejövő kódok egységesen `_LEV` formátumot használnak (`BE_27_LEV`, `BE_18_LEV`, `BE_5_LEV`). A korábbi duplikációk (`BE_27`, `BE_18`, `BE_5`, `BE_FORD_5`, `KIM_0`, `BE_0`) törlésre kerültek.
- **`BE_0_NEM`**: Hibás, jogalap nélküli kód; a rendszerből teljes körűen törölve.
- **`FAD_EPIT_5`**: A magyar jogszabályok szerint építőipari fordított adózás kizárólag 27%-os kulccsal lehetséges; az 5%-os kód törölve.
- **`BE_FORD_27` és `FAD_EPIT_27`**: Konszolidálva, mindkettő azonos 29. és 66. sormegfeleltetéssel bír.

### 4. Áfa tv. 6/B. Melléklet — Vas- és Acéltermékek Kötelező Analitikája
- A Kombinált Nómenklatúra (KN) 72. és 73. árucsoportja alá tartozó vas- és acélipari termékek fordított adózása esetén a jogszabály tételes adatszolgáltatást ír elő:
  - **2665-07 lap**: Az értékesítő adatszolgáltatása (vevő adószáma, számlaszám, teljesítés, VTSZ, tömeg, adóalap).
  - **2665-08 lap**: A beszerző adatszolgáltatása (eladó adószáma, számlaszám, teljesítés, VTSZ, tömeg, adóalap).
- **Kötelező adatelemek**: Minden érintett tételnél kötelező a **VTSZ / KN kód** és a **nettó tömeg (kg)** megadása.
- **Egész kilogrammos kerekítési szabály**: A NAV 2665-07 és 2665-08 nyilatkozati lapok az adatokat kerekített egész kilogrammban kérik. Ennek megfelelően az analitikai export a `Math.round(net_weight_kg)` értéket tünteti fel a hivatalos nyilatkozati oszlopban, megőrizve a pontos tizedes tömeget a mérlegjegy szerinti egyeztetéshez.
- **Pre-Export Minőségbiztosítási Kapu**: A rendszer megakadályozza, hogy a könyvelő figyelmeztetés nélkül adhasson be vagy tölthessen le ÁNYK XML fájlt olyan időszakra, amelyben hiányos 6/B acélipari tétel található.

---

## Rationale
A NAV az utóbbi években szigorította a fordított adózású ügyletek, különösen az acélipari és fémkereskedelmi forgalom ellenőrzését. A helytelen sorba állítás (pl. TAM és export összekeverése) vagy a hiányzó 6/B analitika automatikus adóhatósági hibaüzenetet, javítási felszólítást és mulasztási bírságot eredményez. A pontos szabályozás garantálja az ügyfelek jogbiztonságát.

---

## Kapcsolódó
- **ADR**: [A-131: NAV 2665 ÁFA Bevallás Sormegfeleltetés, Gyűjtőkódok Tisztítása, 6/B Acélipari Nyilatkozat és Egész Kilogrammos Kerekítés](../../architecture/decisions/A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md)
- **PRD**: [P-097: NAV 2665 Nyomtatvány Replika, 6/B Acélipari Analitika és ÁNYK Validáció UX](../../product/decisions/P-097-nav-2665-replica-steel-analytics-and-anyk-validation-ux.md)
- **Kapcsolódó BRD**: [Decision 033: ÁFA bevallás modul](./033-vat-return-module.md)
