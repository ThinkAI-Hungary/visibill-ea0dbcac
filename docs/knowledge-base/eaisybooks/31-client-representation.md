# 🛡️ Képviselet és NAV-meghatalmazások (Client Representation & UJEGYKE)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Beállítások  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő), akinek jogosultsága van a céghez  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a bal oldali menüben az aktív ügyfél-munkamenet alatt: **Képviselet** menüpont.
- **Ikon:** Pajzs / Ellenőrzött képviselő ikon (`Shield`)
- **Elérési útvonal:** eaisyBooks munkamenet -> Képviselet
- **Gyorsműveletek:** Új állandó NAV-meghatalmazás indítása az UJEGYKE varázslóval, hatáskörök testreszabása, érvényességi idők felülvizsgálata, meghatalmazás visszavonása

---

## 2. A menü funkciója és célja

A **Képviselet és NAV-meghatalmazások** modul az ügyfélcég nevében az adóhatóság (NAV) előtt eljáró állandó meghatalmazottak hivatalos nyilvántartását, az UJEGYKE nyomtatvány adatainak digitális kezelését és a képviseleti jogosultságok életciklusát kezeli.

### Fő feladatai és jogszabályi háttere:
1. **Air. 17. § (1) g) pontja szerinti szervezeti meghatalmazás:** 2025. február 1-jétől a hatályos adóigazgatási rendtartás szerint a könyvelőiroda mint jogi személy (szervezet) közvetlenül is bejegyezhető állandó meghatalmazottként az adóhatóságnál, nem szükséges minden egyes alkalmazott könyvelőt külön természetes személyként bejelenteni.
2. **UJEGYKE nyomtatvány digitális előkészítése:** 5 lépéses strukturált folyamatban gyűjti össze és ellenőrzi a képviselet típusát, a pontos hatásköröket és a határidőket.
3. **Képviseleti hatáskörök pontos lehatárolása:** Lehetőséget ad teljes körű képviseletre, kifejezetten csak bérszámfejtésre (pl. ha a cég bérügyeit és könyvelését két külön szolgáltató látja el), vagy adónemenként és nyomtatványonként egyedileg kiválasztott hatáskörökre.
4. **Lejárt és visszavont jogosultságok auditálása:** Biztosítja a könyvelőiroda és az ügyfél számára a tiszta jogi felelősségi határokat megbízás megszűnése vagy módosulása esetén.

---

## 3. Mit lehet benne a felhasználónak csinálni? (Funkciók részletes leírása)

### 3.1 Navigációs fejléc és „Vissza” gomb
- **Hogy hívják:** Vissza gomb (Balra mutató nyíl ikon)
- **Mire való:** Lehetővé teszi a gyors visszalépést az előző oldalra vagy az ügyfél áttekintő műszerfalára.
- **Hol található a felületen:** A fejléc bal szélén, az ügyfélnév és a cím előtt található kis négyzet alakú gomb (`ChevronLeft`).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a fejléc bal szélén található nyíl gombra.
  - **Eredmény:** A rendszer visszanavigál a közvetlen előzményre vagy az ügyfél központi áttekintő oldalára.

---

### 3.2 „Új meghatalmazás” gomb
- **Hogy hívják:** Új meghatalmazás gomb
- **Mire való:** Elindítja a strukturált, 5 lépéses UJEGYKE meghatalmazás-rögzítő varázslót.
- **Hol található a felületen:** A képernyő jobb felső sarkában található lila/indigó színű kiemelt gomb plusz jellel (`Plus`).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a jobb felső **„Új meghatalmazás”** gombra.
  - **Eredmény:** A képernyőn megjelenik a teljes képernyős UJEGYKE varázsló ablak, annak első lépésével.

---

### 3.3 UJEGYKE Varázsló — 1. lépés: Típus és alapadatok
- **Hogy hívják:** 1. lépés: Meghatalmazott típusa és azonosító adatai
- **Mire való:** Meghatározza, hogy a meghatalmazás jogi személy (könyvelőiroda) vagy természetes személy (egyéni könyvelő) javára szól, és rögzíti a hivatalos azonosítókat.
- **Hol található a felületen:** Az UJEGYKE felugró ablak első lépése.
- **Hogyan használhatja a felhasználó:**
  1. Válasszon a két kártya közül:
     - **Könyvelőiroda (szervezet):** Az Air. 17. § (1) g) pontja alapján a teljes iroda kerül bejegyzésre.
     - **Magánszemély könyvelő:** Egyéni regisztrált mérlegképes könyvelő személyes adatai.
  2. A **Meghatalmazott neve** mezőbe írja be a szervezet vagy a személy pontos hivatalos nevét.
  3. A második mezőbe adja meg a szervezeti **Adószámot** (8+1+2 jegy) vagy a magánszemély **Adóazonosító jelét** (10 számjegy).
  4. Kattintson a **„Tovább”** gombra.
  - **Eredmény:** A rendszer ellenőrzi a megadott adatok formai érvényességét, és átlép a 2. lépésre.

---

### 3.4 UJEGYKE Varázsló — 2. lépés: Hatáskör részletezése
- **Hogy hívják:** 2. lépés: Hatáskör részletezése
- **Mire való:** Pontosan meghatározza, hogy a meghatalmazott mely adónemekben és nyomtatványokban járhat el a NAV előtt a képviselt cég nevében.
- **Hol található a felületen:** Az UJEGYKE varázsló második lépése.
- **Választható hatáskör szintek:**
  - **Minden adóügyre kiterjedő:** Teljes körű általános adóhatósági képviselet az összes adónemben.
  - **Csak bérszámfejtésre:** Kimondottan a bérügyi és járulékbevallásokra korlátozva (SZJA, TB, SZOCHO, 08E, 2608).
  - **Egyedi (checkbox lista):** Részletes testreszabási lehetőség jelölőnégyzetekkel:
    - *SZJA bevallás*
    - *2608 járulékbevallás*
    - *08E bejelentés*
    - *KIVA bevallás*
    - *TAO bevallás*
    - *HIPA bevallás*
    - *Rehabilitációs hozzájárulás*
    - *KATA nyilatkozat*
    - *Meghatalmazás módosítása*
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a megfelelő hatásköri kártyára.
  2. Ha az **Egyedi** opciót választotta, pipálja be a releváns nyomtatványokat a megjelenő listában.
  3. Kattintson a **„Tovább”** gombra.
  - **Eredmény:** A meghatalmazás terjedelme pontosan rögzítésre kerül.

---

### 3.5 UJEGYKE Varázsló — 3. lépés: Időtartam megadása
- **Hogy hívják:** 3. lépés: Időtartam és érvényesség beállítása
- **Mire való:** Rögzíti a képviseleti jogviszony kezdetét és záró dátumát, vagy a határozatlan idejű érvényességet.
- **Hol található a felületen:** Az UJEGYKE varázsló harmadik lépése.
- **Hogyan használhatja a felhasználó:**
  1. A **Kezdő dátum** mezőben adja meg a képviselet hatályba lépésének napját (alapértelmezetten a mai nap).
  2. Válassza ki az érvényesség jellegét:
     - Ha határozatlan idejű: Hagyja bepipálva a **„Visszavonásig érvényes”** jelölőnégyzetet.
     - Ha határozott idejű: Vegye ki a pipát, és a megjelenő **Záró dátum** mezőben válassza ki a lejárat napját.
  3. Kattintson a **„Tovább”** gombra.
  - **Eredmény:** Az időbeli hatály rögzítésre kerül.

---

### 3.6 UJEGYKE Varázsló — 4. lépés: Hivatalos űrlap előnézet
- **Hogy hívják:** 4. lépés: UJEGYKE-űrlap előnézet
- **Mire való:** Szemléletes, a hivatalos NAV nyomtatvány felépítését tükröző összegző táblázatban jeleníti meg az összes rögzített adatot a véglegesítés előtt, minimalizálva a hibázási lehetőséget.
- **Hol található a felületen:** Az UJEGYKE varázsló negyedik lépése.
- **Hogyan használhatja a felhasználó:**
  1. Ellenőrizze a meghatalmazott típusát, nevét, adószámát/adóazonosítóját.
  2. Vizsgálja felül a kiválasztott hatásköröket és a megadott dátumokat.
  3. Olvassa el a sárga figyelmeztető doboz felhívását: *„A beküldést követően az adatokat az UJEGYKE revíziós űrlappal lehet módosítani.”*
  4. Kattintson a **„Tovább”** gombra.
  - **Eredmény:** A rendszer jóváhagyja az előnézetet és a záró megerősítő lépésre lép.

---

### 3.7 UJEGYKE Varázsló — 5. lépés: AVDH aláírás és rögzítés
- **Hogy hívják:** 5. lépés: AVDH aláírás, megerősítés és rögzítés
- **Mire való:** A könyvelői felelősségvállalási nyilatkozat megtétele és a meghatalmazás bejegyzése az eaisyBooks belső nyilvántartásába egyedi iktatószámmal (pl. `UJ-2026-XXXXXX`).
- **Hol található a felületen:** Az UJEGYKE varázsló ötödik, befejező lépése.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a tájékoztató szöveget a hitelesítés módjáról.
  2. Pipálja be a kötelező megerősítő jelölőnégyzetet: **„Kijelentem, hogy az adatokat ellenőriztem, és hozzájárulok a meghatalmazás rögzítéséhez az eaisybooks rendszerben.”**
  3. A jelölőnégyzet bepipálása után az alsó gomb zöldre vált és aktívvá válik.
  4. Kattintson a **„Megerősítés és rögzítés”** gombra (`Shield` ikon).
  - **Eredmény:** A rendszer generálja a hivatalos iktatószámot, elmenti a meghatalmazást, a varázsló bezárul, és zöld felugró értesítés jelenik meg: *„Meghatalmazás létrehozva — [Név] hozzáadva.”*

---

### 3.8 Aktív meghatalmazások listája és lapozója
- **Hogy hívják:** Aktív meghatalmazások tábla és lapozó
- **Mire való:** Részletesen felsorolja a cég nevében jelenleg érvényben lévő összes NAV-képviseleti jogosultságot.
- **Hol található a felületen:** A képernyő középső részén elhelyezkedő fehér kártya, fejlécében zöld darabszám jelvénnyel.
- **Megjelenő adatok soronként:**
  - **Típus ikon:** Szervezet (`Users`) vagy Magánszemély (`FileText`).
  - **Meghatalmazott neve és Adószáma:** Vastag betűs név és monospace formázású adószám.
  - **Státusz jelvény:** Zöld **„Aktív”** felirat.
  - **Hatáskör:** *Teljes körű*, *Bérszámfejtés* vagy *Egyedi*.
  - **Érvényességi idő:** Kezdő dátum és záró dátum vagy „visszavonásig” megjelölés.
  - **Lapozó vezérlő:** 10, 25 vagy 50 elem/oldal választási lehetőséggel.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a listát a hatályos képviseletek ellenőrzésére.
  2. Több meghatalmazás esetén használja az alsó lapozó sávot az oldalak közötti navigáláshoz.
  - **Eredmény:** A könyvelő azonnal látja, hogy a cég nevében ki jogosult joghatályos adóbevallások benyújtására.

---

### 3.9 Meghatalmazás visszavonása gomb
- **Hogy hívják:** Meghatalmazás visszavonása (Piros kuka ikon)
- **Mire való:** Lehetővé teszi az adott meghatalmazás azonnali megszüntetését, a jogviszony lezárását és az elem áthelyezését a visszavont tételek közé.
- **Hol található a felületen:** Minden aktív meghatalmazási sor jobb szélén található kuka gomb (`Trash2`).
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a visszavonni kívánt meghatalmazottat.
  2. Kattintson a sor végén lévő piros kuka ikonra.
  - **Eredmény:** A meghatalmazás státusza azonnal *„revoked”* (Visszavont) állapotba kerül, átkerül az alsó Lejárt / Visszavont blokkba, és felugró értesítés igazolja a műveletet: *„Visszavonva — [Név] meghatalmazása visszavonva.”*

---

### 3.10 „Lejárt / Visszavont” meghatalmazások történeti blokkja
- **Hogy hívják:** Lejárt és Visszavont meghatalmazások archívuma
- **Mire való:** Történeti visszakereshetőséget biztosít a korábban érvényben volt, de időközben megszűnt, lejárt vagy visszavont képviseleti jogviszonyokról.
- **Hol található a felületen:** Az aktív meghatalmazások táblázata alatt elhelyezkedő, halványabb szürke tónusú kártya.
- **Hogyan használhatja a felhasználó:**
  1. Görgessen a képernyő alsó részére.
  2. Tekintse át a korábbi meghatalmazottak adatait, a megszűnés okát (piros *Visszavont* vagy szürke *Lejárt* jelvénnyel) és a korábbi érvényességi intervallumot.
  - **Eredmény:** Teljes körű számviteli és jogi auditálhatóság a korábban benyújtott bevallások aláírói hátteréről.

---

## 4. Jogosultságok és Szerepkörök

| Szerepkör | Megtekintés | Új UJEGYKE indítása | Hatáskör testreszabása | Meghatalmazás visszavonása |
| :--- | :---: | :---: | :---: | :---: |
| **Irodavezető adminisztrátor** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Szenior könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő asszisztens** |  Teljes | ❌ Csak előkészítés | ❌ Nincs | ❌ Nincs |
| **Ügyfél (Cégvezető)** |  Megtekintés | ❌ Nincs | ❌ Nincs | ❌ Nincs |

---

## 5. Kapcsolódó jogszabályi és szakmai hivatkozások

- **2017. évi CLI. törvény az adóigazgatási rendtartásról (Air.):**
  - **17. § (1) g) pontja:** 2025. február 1-jétől hatályos rendelkezés: állandó meghatalmazottként jogi személy, egyéb szervezet (könyvelőiroda, adótanácsadó társaság) is eljárhat.
  - **18. §:** Az állandó meghatalmazás adóhatósági bejelentésének és nyilvántartásba vételének eljárásrendje (UJEGYKE nyomtatvány).
  - **20. §:** A meghatalmazás megszűnésének és visszavonásának bejelentési kötelezettsége az adóhatóság felé.
