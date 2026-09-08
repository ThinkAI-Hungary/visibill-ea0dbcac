# 💼 Ügyfélportfólió és KPI Műszerfal (Portfolio Dashboard)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Portfólió  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő, Bérszámfejtő, Gyakornok; a látható ügyfelek köre a könyvelőhöz rendelt portfólió jogosultságoktól függ)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjének legfelső eleme a **Portfólió** csoportban.
- **Ikon:** Aktatáska ikon
- **Elérési útvonal:** Portfólió menüpont a navigációs sávban
- **Gyorsműveletek:** Gyors keresés ügyfélre, szűrés beavatkozást igénylő cégekre, belépés ügyfél munkaterületére

---

## 2. A menü funkciója és célja

A **Portfólió** oldal a könyvelőiroda központi irányítóterme, amely konszolidált képet ad az iroda által kezelt összes ügyfél (társas vállalkozások, egyéni vállalkozók, civil szervezetek) könyvelési, adózási és bérszámfejtési állapotáról.

### Fő feladatai és üzleti értéke:
1. **Irodai szintű KPI műszerfal:** Azonnali áttekintést nyújt a feldolgozandó számlák mennyiségéről, a hiányzó bizonylatokról, a közeledő adóhatáridőkről és a függő jóváhagyásokról.
2. **Ügyféllista státuszjelzőkkel:** Valós idejű, színkódolt státuszok (Rendben - zöld, Feldolgozandó - sárga, Hiányos / Figyelem - piros) mutatják, hogy melyik vállalkozásnál van azonnali beavatkozást igénylő teendő.
3. **Lapfülek szerinti szegmentálás:** Lehetőséget biztosít az ügyfelek adózási és működési forma szerinti csoportosítására: Teljes portfólió, Bérszámfejtési portfólió, Társasági adós cégek, Egyéni vállalkozók.
4. **Gyors kontextusváltás:** Egyetlen kattintással át lehet lépni bármelyik cég részletes ügyfél-munkaterületére, ahol az adott cég bizonylatai, főkönyve és bevallásai azonnal elérhetővé válnak.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Irodai KPI Összesítő Kártyasor
- **Hogy hívják:** Portfólió KPI kártyák (*Kezelt cégek*, *Feldolgozandó számlák*, *Hiányzó bizonylatok*, *Következő adóhatáridő*, *Függő jóváhagyások*)
- **Mire való:** A könyvelőiroda teljes feladatterhelésének, feldolgozatlan bizonylatmennyiségének és a közeledő adóhatósági határidőknek az irodai szintű konszolidált monitorozása.
- **Hol található a felületen:** A képernyő legfelső sávjában elhelyezkedő 5 nagyméretű információs kártya.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a feldolgozandó számlák és hiányzó bizonylatok számát.
  2. Kattintson közvetlenül a **„Hiányzó számlák”** kártyára: a rendszer azonnal átnavigál a hiányzó bizonylatok központi kezelőjébe.
  3. Kattintson a **„Következő határidő”** kártyára az érintett cégek listájának megnyitásához.
  - **Eredmény:** Azonnali áttekintés arról, hogy az irodában melyik terület igényel sürgős kapacitást.

### 3.2 Portfólió Szegmentáló Lapfülek
- **Hogy hívják:** Nézetválasztó fülsor (*Összes ügyfél*, *Bérszámfejtési fókusz*, *TAO és KIVA cégek*, *Egyéni vállalkozók*)
- **Mire való:** Az ügyfélkör gyors szétválasztása adózási és működési formák szerint, megkönnyítve a szakosodott könyvelők (pl. bérszámfejtő vagy EV szakértő) napi munkáját.
- **Hol található a felületen:** A KPI kártyák alatt elhelyezkedő vízszintes fülsor.
- **Hogyan használhatja a felhasználó:**
  1. Bérszámfejtési időszakban (pl. hó 1–10. között) kattintson a **„Bérszámfejtési fókusz”** fülre a havi bérlisták és 08-as bevallások státuszának ellenőrzéséhez.
  2. Átalányadós és KATA-s ügyfelek vizsgálatához kattintson az **„Egyéni vállalkozók”** fülre.
  - **Eredmény:** A táblázat azonnal leszűkül a releváns vállalkozási típusra.

### 3.3 Felelős Könyvelő és Státusz Szűrők
- **Hogy hívják:** „Felelős könyvelő szűrő” és „Beavatkozást igénylő cégek” gyorskapcsoló
- **Mire való:** Irodavezetők számára az egyes könyvelő kollégákhoz rendelt cégállomány szűrése, valamint az azonnali teendőt igénylő (sárga/piros státuszú) vállalkozások leválogatása.
- **Hol található a felületen:** A táblázat feletti szűrősáv jobb oldalán.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a vizsgálni kívánt könyvelő munkatárs nevét a legördülő menüből (pl. *Nagy Anna*).
  2. Kapcsolja be a **„Csak a teendőt igénylő cégek”** kapcsolót.
  - **Eredmény:** A képernyőn kizárólag az adott könyvelőhöz tartozó, feldolgozatlan számlákkal vagy hiányzó bizonylatokkal rendelkező cégek jelennek meg.

### 3.4 Ügyféltáblázat és Feldolgozottsági Arányjelző
- **Hogy hívják:** Fő Ügyfélportfólió táblázat és feldolgozottsági haladási sáv
- **Mire való:** Cégek tételes listája cégnévvel, adószámmal, felelős könyvelővel, hiányzó számlák összegével és a lekönyvelt bizonylatok százalékos arányával.
- **Hol található a felületen:** A képernyő középső nagy munkaterületén.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg az ügyfelet a keresőmezővel (név vagy adószám alapján).
  2. Olvassa le a feldolgozottsági sávot (pl. *85% lekönyvelve*).
  3. Tekintse meg a hiányzó számlák összegét és darabszámát.
  - **Eredmény:** Pontos, naprakész kép az ügyfél könyvelésének pillanatnyi készültségéről.

### 3.5 Belépés az Ügyfél Munkaterületére (Kontextusváltás)
- **Hogy hívják:** Ügyfélsor kattintás és „Belépés az ügyfélhez” gomb
- **Mire való:** Átváltás az irodai gyűjtőnézetből az adott cég konkrét bizonylataihoz, főkönyvéhez, bevallásaihoz és analitikáihoz.
- **Hol található a felületen:** Az ügyféltáblázat bármely sorára kattintva, vagy a sor végén lévő nyíl ikonra bökve.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kívánt vállalkozás sorára (pl. *Alfa Kft.*).
  2. A rendszer azonnal átvált **Ügyfél Kontextus** módba:
     - Az oldalsáv menü átáll az ügyfél saját moduljaira (Számlák, Főkönyv, ÁFA, EV/TAO, Bérek).
     - A fejlécben megjelenik az aktív cég neve és a könyvelési időszak választója.
  - **Eredmény:** A könyvelő közvetlenül az ügyfél könyveiben folytathatja a munkát anélkül, hogy kijelentkezne.
