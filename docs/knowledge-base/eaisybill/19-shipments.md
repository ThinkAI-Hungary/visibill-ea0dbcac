# 🚚 Fuvarok és Szállítmányozás (CMR és Fuvarmegbízások)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Szállítmányozás  
> **Szükséges szerepkör:** Tulajdonos (Owner), Adminisztrátor, Pénzügyi munkatárs (Member)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** A **Szállítmányozás** csoport 1. menüpontja.
- **Ikon:** Teherautó ikon
- **Elérési útvonal:** Fuvarok menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** Fuvar részleteinek megnyitása, számla hozzárendelés, CMR megtekintése

---

## 2. A menü funkciója és célja

A **Fuvarok** modul a fuvarozási, speditőr és logisztikai vállalkozások számára készült, amely a fuvarmegbízások (pozíciószámok), a CMR fuvarlevelek és a beérkező vagy kibocsátott fuvarszámlák digitális összerendelését, ellenőrzését és költségfedezeti elemzését végzi.

### Fő funkciók:
- **Pozíciószám-alapú nyilvántartás:** Minden fuvarmegbízás egyedi pozíciószámmal rendelkezik, amely összeköti a megbízást a fuvarszámlával.
- **Fuvarszámla és Megbízás automatikus párosítása:** A diszpécser által rögzített megállapodott fuvardíj (HUF / EUR) és a partner által kiállított számla egyezőségének algoritmikus ellenőrzése.
- **Párosítási státuszok:**
  - *Párosítva (Zöld):* A pozíciószám, a partner és az összeg hibátlanul egyezik.
  - *Javasolt (Sárga):* Valószínűsíthető egyezés összeg- vagy névhasonlóság alapján.
  - *Párosítatlan (Szürke):* Még nem érkezett meg a számla a fuvarhoz, vagy a számlához nincs rögzített fuvarmegbízás.
  - *Eszkalált (Piros):* Eltérés mutatkozik a megrendelt és a számlázott díj között (pl. felár, túlsúly, állásidő).
- **CMR és Fuvarokmányok digitális kezelése:** Szkennelt CMR fuvarlevelek, átvételi elismervények és menetlevelek tárolása közvetlenül a fuvarhoz csatolva.
- **Logisztikai KPI mutatók és grafikonok:** Havi fuvarszám, párosítási arány (%), átlagos fuvardíj és nyitott fuvarok összege.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Pozíciószám Kereső és Státusz Szűrősáv
- **Hogy hívják:** Gyorskereső mező és fuvarstátusz szűrőgombok (*Összes*, *Párosított*, *Javasolt*, *Párosítatlan*, *Eszkalált*)
- **Mire való:** A fuvarmegbízások gyors visszakeresése egyedi pozíciószám, fuvarozó partner neve vagy rendszám alapján, valamint szűrés hibás vagy vitás számlákra.
- **Hol található a felületen:** A táblázat feletti vízszintes keresősávban.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a megbízás pozíciószámát (pl. *POZ-2026-0842*) vagy a fuvarozó nevét a keresőbe.
  2. Kattintson a piros **„Eszkalált”** szűrőgombra, ha kizárólag a számla-megbízás összegeltéréssel rendelkező fuvarokat kívánja vizsgálni.
  - **Eredmény:** A táblázat azonnal frissül a feltételeknek megfelelő fuvarokra.

### 3.2 Logisztikai KPI Kártyák és Párosítási Kördiagram
- **Hogy hívják:** Fuvar KPI kártyasor és feldolgozási kördiagram
- **Mire való:** A fuvarozási volumen, a futó és lezárt megbízások összértékének (HUF/EUR), valamint az automatikus párosítási sikerességének vizuális követése.
- **Hol található a felületen:** A képernyő felső harmadában.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a teljes fuvardíj állományt és a lezáratlan fuvarok összegét.
  2. A kördiagramra pillantva ellenőrizze, hány százaléka zárult le automatikusan a számláknak (zöld szelet).
  - **Eredmény:** Azonnali vezetői kép a logisztikai kifizetések állásáról.

### 3.3 Fuvarok Táblázata és Számlakép Megtekintése
- **Hogy hívják:** Fő fuvarlista táblázat és előnézeti gomb
- **Mire való:** A megbízások részleteinek (felrakó, lerakó, fuvardíj, alvállalkozó) és a hozzájuk rendelt bejövő számlák adatainak ellenőrzése.
- **Hol található a felületen:** A képernyő középső részén lévő nagyméretű táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a fuvar sorát.
  2. Olvassa le a megállapodott fuvardíjat és a ténylegesen beérkezett számla összegét.
  3. Kattintson a sorban lévő számlaszámra a felugró elektronikus számlakép és a tételek megtekintéséhez.
  - **Eredmény:** Másodpercek alatt ellenőrizhető a számlázott összeg jogossága.

### 3.4 Kézi Számlapárosítás és Szétkapcsolás
- **Hogy hívják:** „Számla párosítása” lánc ikon és „Szétkapcsolás” gomb
- **Mire való:** Ha az AI nem ismerte fel a számla és a fuvarmegbízás kapcsolatát, vagy a diszpécser rossz pozíciószámot adott meg, manuális összerendelés vagy kapcsolatbontás végezhető.
- **Hol található a felületen:** A fuvarsor végén lévő lánc/olló műveleti ikonok.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a párosítatlan fuvar sora mellett a **„Párosítás”** (lánc) ikonra.
  2. A megnyíló keresőablakban jelölje ki a partner beérkezett számláját.
  3. Kattintson a **„Hozzárendelés jóváhagyása”** gombra.
  4. Téves összerendelésnél kattintson a **„Szétkapcsolás”** gombra.
  - **Eredmény:** A fuvarmegbízás és a számla összekapcsolódik (vagy felszabadul a helyes párosításhoz).

### 3.5 CMR és Fuvarokmányok Feltöltése és Csatolása
- **Hogy hívják:** „CMR okmánykezelő” és dokumentumfeltöltő zóna
- **Mire való:** Az átvételt igazoló aláírt nemzetközi fuvarlevél (CMR), mérlegjegy vagy menetlevél digitális tárolása a fuvar mellett.
- **Hol található a felületen:** A fuvarsor **„Okmányok”** oszlopában lévő gémkapocs ikonra kattintva.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a gémkapocs ikonra.
  2. Húzza be a szkennelt CMR PDF vagy JPG fájlt a felugró ablakba.
  3. Kattintson a **„Dokumentum csatolása”** gombra.
  - **Eredmény:** A CMR rögzül a megbízáshoz, a diszpécserek és könyvelők bármikor egy kattintással megnyithatják a fuvarigazolást.

### 3.6 Fuvarlista Exportálása (Excel / CSV)
- **Hogy hívják:** „Exportálás” gomb
- **Mire való:** A szűrt fuvarmegbízások, fuvardíjak, CMR státuszok és számlaszámok kimentése táblázatkezelőbe diszpécseri elszámolásokhoz.
- **Hol található a felületen:** A fejléc jobb szélén lévő zöld **„Excel letöltése”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Állítsa be a kívánt időszaki vagy partner szerinti szűrőket.
  2. Kattintson az **„Excel letöltése”** gombra.
  - **Eredmény:** Letöltődik a komplett szállítmányozási nyilvántartás minden műszaki és pénzügyi adattal.
