# Eredménykimutatás (Profit & Loss / PnL)

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Könyvelés** csoportban található: **Eredménykimutatás**.
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/profit-and-loss`
- **Jogosultság:** Cégtulajdonos, adminisztrátor, pénzügyi vezető és könyvelő.

---

## 2. A menü funkciója és célja
Az **Eredménykimutatás** a vállalkozás jövedelmezőségének, bevételeinek, költségeinek és működési nyereségének hivatalos számviteli kimutatása a magyar Számviteli törvény (Sztv.) előírásainak megfelelő összköltség-eljárású struktúrában.

### Fő feladatai:
- **Törvényi eredményszintek levezetése:**
  1. *Értékesítés nettó árbevétele (I.)*
  2. *Aktivált saját teljesítmények értéke (II.)*
  3. *Egyéb bevételek (III.)*
  4. *Anyagjellegű ráfordítások (IV.)* — Anyagköltség, igénybe vett szolgáltatások, eladott áruk beszerzési értéke (ELÁBÉ).
  5. *Személyi jellegű ráfordítások (V.)* — Bérköltség, személyi jellegű egyéb kifizetések, bérjárulékok (Szocho).
  6. *Értékcsökkenési leírás (VI.)*
  7. *Egyéb ráfordítások (VII.)*
  - **A. Üzemi (üzleti) tevékenység eredménye**
  8. *Pénzügyi műveletek bevételei (VIII.)* — Kapott kamatok, realizált árfolyamnyereség.
  9. *Pénzügyi műveletek ráfordításai (IX.)* — Fizetett kamatok, realizált árfolyamveszteség.
  - **B. Pénzügyi műveletek eredménye**
  - **C. Adózás előtti eredmény (A + B)**
  10. *Adófizetési kötelezettség (X.)* — Társasági adó (TAO) vagy Kisvállalati adó (KIVA).
  - **D. Adózott eredmény**
- **Év-év összehasonlítás (Bázisidőszaki analitika):** Tárgyév és bázisév azonos időszakának automatikus összevetése forintban és százalékban, intelligens státuszjelzőkkel (*„Nyereségbe fordult"*, *„Veszteségbe fordult"*).
- **Pénzügyi folyamatábra (Sankey diagram):** Vizuális értékáramlás-diagram, amely bemutatja, hogyan oszlik meg a bruttó árbevétel a különböző költségnemek, adók és a megmaradó tiszta profit között.
- **Beépített AI pénzügyi elemző:** Mesterséges intelligencia által készített vezetői összefoglaló a cég gazdálkodásának erősségeiről, kockázatairól és a költségnövekedések okairól.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Ezer Forintos Megjelenítés Kapcsoló
- **Hogy hívják:** „Ezer Ft-ban megjelenítés” kapcsoló
- **Mire való:** A számlák forint pontosságú összegeinek átváltása a hivatalos számviteli éves beszámolókban előírt ezer forintos (eFt) kerekítésre.
- **Hol található a felületen:** A fejléc jobb oldalán, az export gombok mellett elhelyezkedő kapcsoló.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„eFt”** kapcsolóra.
  2. Tekintse át a táblázatot és a grafikonokat, amelyek azonnal ezer forintra kerekítve mutatják az összes tételt.
  - **Eredmény:** A kimutatás megegyezik a hivatalos letétbe helyezendő mérlegformátummal.

### 3.2 Eredménysorok Kibontása és Számlaszintű Mélyfúrás
- **Hogy hívják:** Eredménysor lenyitó nyíl és kapcsolódó számlák panel
- **Mire való:** Az aggregált eredménysorok (pl. *Anyagjellegű ráfordítások* vagy *Személyi jellegű ráfordítások*) mögött lévő 5-ös, 8-as vagy 9-es számlák, illetve a konkrét bizonylatok megtekintése.
- **Hol található a felületen:** Az eredménykimutatás táblázatának minden sorának bal szélén található kis nyíl.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a vizsgálni kívánt sort (pl. *Igénybe vett szolgáltatások értéke*).
  2. Kattintson a sor elején lévő nyílra.
  3. A sáv lenyílik, és megjelennek az oda kontírozott főkönyvi számlák (pl. 521 Bérleti díjak, 522 Marketing, 529 Egyéb).
  4. Kattintson bármely főkönyvi számlára a kapcsolódó számlák és bizonylatképek azonnali megtekintéséhez.
  - **Eredmény:** Azonnal azonosítható, hogy melyik beszállító vagy költségtétel okozta a kiadások emelkedését.

### 3.3 Sankey Értékáramlás és Forgalmi Grafikon Nézet
- **Hogy hívják:** „Értékáramlás diagram” és „Grafikon nézet” fülek
- **Mire való:** Vizuális diagram a bevétel eloszlásáról (árbevételből mennyi ment anyagra, bérre, adóra és mennyi maradt tiszta nyereségként), valamint havi bontású trendelemzés.
- **Hol található a felületen:** A táblázat felett lévő nézetváltó gombok: **„Táblázat”**, **„Grafikon”**, **„Értékáramlás”**.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Értékáramlás”** fülre.
  2. Kövesse a balról jobbra áramló színes sávokat az árbevételtől a profitig.
  3. Vigye az egeret bármely ágra a pontos forintösszeg és a százalékos arány megtekintéséhez.
  - **Eredmény:** Vizuális, könnyen értelmezhető vezetői prezentációs felület a cég pénzáramairól.

### 3.4 AI Pénzügyi Elemző Asszisztens Futtatása
- **Hogy hívják:** „AI Elemzés” gomb
- **Mire való:** Mesterséges intelligencia által generált, emberi nyelven megfogalmazott szöveges vezetői összefoglaló a cég eredményének változásáról, árrésekről és kockázatokról.
- **Hol található a felületen:** A fejléc műveleti sávjában található csillag ikonnal jelölt **„AI Elemzés”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„AI Elemzés”** gombra.
  2. A felugró ablakban a rendszer másodpercek alatt kielemezi a tárgyév és bázisév adatait.
  3. Olvassa el a szöveges értékelést: legfontosabb költségnövekedések, fedezeti hányad változása, és javaslatok a profitabilitás javítására.
  - **Eredmény:** Azonnali vezetői tájékoztató szöveg, amely egy kattintással kimásolható a tulajdonosi beszámolóba.

### 3.5 Hivatalos Eredménykimutatás Exportálása
- **Hogy hívják:** „Export (PDF / Excel)” gombok
- **Mire való:** Banki hitelkérelemhez, pályázathoz vagy tulajdonosi egyeztetéshez alkalmas hivatalos eredménykimutatás letöltése.
- **Hol található a felületen:** A képernyő jobb felső sarkában elhelyezkedő export gombok.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a vizsgált időszakot (pl. teljes üzleti év vagy Q1–Q3).
  2. Kattintson az **„Excel export”** gombra a képletekkel ellátott táblázatért, vagy a **„PDF”** gombra a nyomtatható dokumentumért.
  - **Eredmény:** Letöltődik a magyar (igény esetén angol-magyar kétnyelvű) hivatalos eredménykimutatás.
