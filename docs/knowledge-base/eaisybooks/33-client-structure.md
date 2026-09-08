# 🌳 Szervezeti és Bérezési Struktúra (Company Structure, Sites & Cost Centers)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Beállítások  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő), akinek jogosultsága van a céghez  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a bal oldali menüben az aktív ügyfél-munkamenet alatt: **Cégstruktúra** (vagy Bérezési struktúra) menüpont.
- **Ikon:** Szervezeti egység / Épület ikon (`Building` / `FolderTree`)
- **Elérési útvonal:** eaisyBooks munkamenet -> Cégstruktúra
- **Gyorsműveletek:** Új telephely felvétele, többdimenziós költséghelyi hierarchia bővítése, szervezeti részlegek telephelyhez rendelése, létszám-eloszlás vizsgálata

---

## 2. A menü funkciója és célja

A **Szervezeti és Bérezési Struktúra** modul a vállalkozás fizikai telephelyeinek, költségviselő és költséghelyi fastruktúrájának, valamint szervezeti részlegeinek és osztályainak integrált modellezője.

### Fő feladatai és számviteli-bérügyi jelentősége:
1. **Telephelyi nyilvántartás és HIPA megosztás (Htv. 39. §):** A helyi iparűzési adó törvényi kötelezettsége előírja az adóalap telephelyek közötti pontos megosztását a telephelyenkénti személyi jellegű ráfordítások és eszközértékek arányában. A telephelyek rögzítése megalapozza az automatikus HIPA kalkulációt.
2. **Költséghelyi hierarchia és analitika:** Támogatja a 6-os és 7-es számlaosztályok költséghelyi és költségviselői bontását, lehetővé téve a vezetőség számára a divíziónkénti (pl. Értékesítés, Logisztika, Gyártás, IT) költséghatékonyság elemzését.
3. **Részlegek és bérszámfejtési csoportok kezelése:** A munkavállalók szervezeti egységekbe sorolásával a havi 08-as járulékbevallások és a bérköltség-feladások automatikusan a megfelelő telephelyekre és költséghelyekre allokálódnak.
4. **Valós idejű létszám-aggregáció:** Automatikusan összesíti a munkavállalói fejszámot telephelyenként, költséghelyenként és részlegenként.

---

## 3. Mit lehet benne a felhasználónak csinálni? (Funkciók részletes leírása)

### 3.1 Navigációs fejléc és „Vissza” gomb
- **Hogy hívják:** Vissza gomb (Balra mutató nyíl ikon)
- **Mire való:** Lehetővé teszi az azonnali visszalépést az előző képernyőre vagy az ügyfél áttekintő műszerfalára.
- **Hol található a felületen:** A fejléc bal szélén, a struktúra címe előtt elhelyezkedő négyzet alakú gomb (`ChevronLeft`).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a fejléc bal szélén lévő vissza nyíl gombra.
  - **Eredmény:** A rendszer visszanavigál a közvetlen előzmény oldalra vagy az ügyfél áttekintő oldalára.

---

### 3.2 Felső összefoglaló statisztikai kártyák
- **Hogy hívják:** Struktúra összegző mérőszám-kártyák (Telephelyek / Költséghelyek / Részlegek számlálók)
- **Mire való:** Vizuális, színes kártyákon ad gyors áttekintést a céghez felvett telephelyek, költséghelyek és szervezeti részlegek aktuális darabszámáról.
- **Hol található a felületen:** Közvetlenül a fejléc alatt elhelyezkedő 3 oszlopos kártyasor.
- **Megjelenő mérőszámok:**
  - **Telephelyek:** Narancssárga kártya térképjelölő ikonnal (`MapPin`), az aktív telephelyek számával.
  - **Költséghelyek:** Indigókék kártya hierarchia fa ikonnal (`FolderTree`), a fastruktúra összes elemének darabszámával.
  - **Részlegek:** Smaragdzöld kártya rétegek ikonnal (`Layers`), a működő részlegek darabszámával.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a kártyákon szereplő számokat az alapvető szervezeti nagyságrend felméréséhez.
  - **Eredmény:** Azonnali összkép a struktúra kiterjedtségéről.

---

### 3.3 Fülválasztó sáv (Telephelyek / Költséghelyek / Részlegek)
- **Hogy hívják:** Navigációs fülváltó
- **Mire való:** Vált a három fő szervezeti dimenzió között: fizikai telephelyek, pénzügyi költséghelyek vagy humánerőforrás részlegek.
- **Hol található a felületen:** A statisztikai kártyák alatt elhelyezkedő szürke kapcsolósáv.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kívánt fülre:
     - **Telephelyek:** Földrajzi címek és TEÁOR tevékenységek kezelése.
     - **Költséghelyek:** Hierarchikus költségbontás és felelősök.
     - **Részlegek:** Szervezeti egységek és vezetők.
  - **Eredmény:** Az alsó munkafelület azonnal átvált a kiválasztott dimenzió listájára.

---

### 3.4 Telephelyek fül — „Új telephely” gomb és rögzítő panel
- **Hogy hívják:** Új telephely hozzáadása űrlap
- **Mire való:** Új székhely, fióktelep vagy telephely rögzítése a céghez a pontos cím és a végzett tevékenység megadásával.
- **Hol található a felületen:** A **Telephelyek** fül jobb felső sarkában elhelyezkedő narancssárga gomb (`Plus` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új telephely”** gombra.
  2. A megjelenő rögzítő dobozban töltse ki a mezőket:
     - **Telephely kód:** Egyedi belső azonosító kód (pl. *SZ-01*, *BP-HQ*).
     - **Megnevezés:** A telephely elnevezése (pl. *Szegedi iroda*, *Győri raktárbázis*).
     - **Cím:** Teljes irányítószámos hivatalos cím (pl. *6720 Szeged, Kárász utca 10.*).
     - **Főtevékenység (TEÁOR):** A telephelyen végzett fő gazdasági tevékenység száma és neve (pl. *6920 - Számviteli, könyvvizsgálói tevékenység*).
  3. Kattintson a **„Mentés”** gombra (vagy elvetéshez az **X** gombra).
  - **Eredmény:** Az új telephely bekerül a cégjegyzékbe, és zöld felugró üzenet nyugtázza: *„Telephely hozzáadva”*.

---

### 3.5 Telephelyek táblázata és Létszám-összesítés
- **Hogy hívják:** Telephelyek táblázata és Összesített létszám sáv
- **Mire való:** Felsorolja a telephelyeket a hozzájuk rendelt munkavállalói létszámmal (amely a hozzá kapcsolt részlegek létszámából automatikusan összegződik), valamint a sorvégi törlési lehetőséggel.
- **Hol található a felületen:** A **Telephelyek** fül fő táblázata.
- **Hogyan használhatja a felhasználó:**
  1. Ellenőrizze a táblázatban a Kód, Megnevezés, Cím és Főtevékenység oszlopokat.
  2. Tekintse át a **Létszám** oszlopban megjelenő szürke jelvényeket (pl. *12 fő*).
  3. Telephely törléséhez kattintson a sor végén lévő piros **Kuka** ikonra (`Trash2`), majd erősítse meg a törlést a felugró ablakban.
  4. A táblázat láblécében ellenőrizze az **Összesen: [X] fő** összegző sort.
  - **Eredmény:** Naprakész telephelyi analitika az önkormányzati adóbevallások előkészítéséhez.

---

### 3.6 Költséghelyek fül — „Új költséghely” gomb és rögzítő panel
- **Hogy hívják:** Új költséghely hozzáadása űrlap
- **Mire való:** Új pénzügyi költséghely (pl. Igazgatóság, Marketing, Értékesítés, IT Üzemeltetés) felvétele a felelős vezető és a tervezett létszám megjelölésével.
- **Hol található a felületen:** A **Költséghelyek** fül jobb felső sarkában elhelyezkedő gomb (`Plus` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **Költséghelyek** fülre.
  2. Kattintson az **„Új költséghely”** gombra.
  3. Töltse ki a mezőket:
     - **Kód:** Monospace formátumú azonosító (pl. *CC-100*, *CC-210*).
     - **Megnevezés:** Költséghely neve (pl. *Pénzügy és Számvitel*).
     - **Felelős:** A költséghelyért felelős vezető neve (pl. *Kovács Péter*).
     - **Létszám:** A költséghelyhez rendelt munkatársak száma.
  4. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** Az új költséghely elmentődik és beépül a hierarchiába; felugró értesítés jelenik meg: *„Költséghely hozzáadva”*.

---

### 3.7 Költséghelyek fül — Hierarchikus interaktív fastruktúra
- **Hogy hívják:** Költséghelyi hierarchia fa (Fastruktúra nézet és kibontó nyilak)
- **Mire való:** Többszintű, szülő-gyermek viszonyokat ábrázoló fa nézetben jeleníti meg a vállalat költséghelyeit, ahol a magasabb szintű egységek (pl. Divízió) alatt megjelennek az alárendelt al-költséghelyek (pl. Csoportok).
- **Hol található a felületen:** A **Költséghelyek** fül kártyájának belső területe.
- **Hogyan használhatja a felhasználó:**
  1. Az al-költséghelyekkel rendelkező sorok előtt megjelenő kis nyílra (`ChevronRight`) kattintva nyissa le az alárendelt szinteket.
  2. A kibontott állapotban a nyíl lefelé mutat (`ChevronDown`), és a belső egységek behúzva jelennek meg.
  3. Minden sorban ellenőrizheti a kódot, a felelős személyt és a létszámot (`Users` ikonnal).
  4. Költséghely törléséhez kattintson a sor végén lévő kis piros kuka ikonra.
  - **Eredmény:** Átlátható, fentről lefelé és lentről felfelé is követhető költséghelyi struktúra a kontrolling feladásokhoz.

---

### 3.8 Részlegek fül — „Új részleg” gomb és rögzítő panel
- **Hogy hívják:** Új részleg hozzáadása űrlap
- **Mire való:** Szervezeti egység vagy funkcionális munkacsoport (pl. Ügyfélszolgálat, Raktározás, Bérszámfejtés) felvétele és konkrét telephelyhez rendelése.
- **Hol található a felületen:** A **Részlegek** fül jobb felső sarkában elhelyezkedő zöld gomb (`Plus` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **Részlegek** fülre.
  2. Kattintson az **„Új részleg”** gombra.
  3. Töltse ki az űrlapot:
     - **Részleg neve:** A részleg megnevezése (pl. *Pénzügyi osztály*).
     - **Telephely:** Válassza ki a legördülő listából azt a telephelyet, ahol a részleg fizikailag működik (pl. *Szegedi iroda*).
     - **Vezető:** A részlegvezető neve (pl. *Kiss Júlia*).
     - **Létszám:** A részlegben dolgozó személyek száma.
  4. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** A részleg létrejön, azonnal összekapcsolódik a kiválasztott telephellyel, és felugró üzenet igazolja: *„Részleg hozzáadva”*.

---

### 3.9 Részlegek és csoportok táblázata
- **Hogy hívják:** Részlegek és csoportok táblázata és sorvégi Törlés gomb
- **Mire való:** Összegzi a vállalat részlegeit, bemutatja, hogy melyik telephelyhez tartoznak, ki irányítja őket, hány fő dolgozik bennük, és lehetőséget biztosít az elavult részlegek törlésére.
- **Hol található a felületen:** A **Részlegek** fül táblázata.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a Részleg, Telephely, Vezető és Létszám oszlopokat.
  2. Részleg megszüntetése esetén kattintson a sor végén lévő **Kuka** ikonra, majd hagyja jóvá a megerősítő kérdést.
  3. A láblécben ellenőrizze az **Összesen: [X] fő, [Y] telephelyen** összegző statisztikát.
  - **Eredmény:** Pontos HR és szervezeti kimutatás áll rendelkezésre a bérszámfejtési modul számára.

---

## 4. Jogosultságok és Szerepkörök

| Szerepkör | Megtekintés | Telephely kezelése | Költséghely szerkesztése | Részleg kezelése |
| :--- | :---: | :---: | :---: | :---: |
| **Irodavezető adminisztrátor** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Szenior könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő asszisztens** |  Teljes | ❌ Csak megtekintés | ❌ Csak megtekintés | ❌ Csak megtekintés |
| **Ügyfél (Cégvezető)** |  Megtekintés | ❌ Nincs | ❌ Nincs | ❌ Nincs |

---

## 5. Kapcsolódó jogszabályi és szakmai hivatkozások

- **1990. évi C. törvény a helyi adókról (Htv.):**
  - **39. § (2):** Ha a vállalkozó több önkormányzat illetékességi területén folytat tevékenységet, az adóalapját a telephelyek között meg kell osztania.
  - **39/A. §:** Az adóalap-megosztás komplex módszere személyi jellegű ráfordítások és eszközértékek arányában.
- **2000. évi C. törvény a számvitelről (Sztv.):**
  - **88–90. §:** A költségek elszámolásának rendje költségnemek, valamint költséghelyek és költségviselők szerint (elsődleges és másodlagos számlaosztályok alkalmazása).
