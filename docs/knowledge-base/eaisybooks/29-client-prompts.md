# 🧠 Könyvelési Szabályok és AI Promptok (Client Prompts & Rules)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Beállítások  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő), akinek jogosultsága van a céghez  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a bal oldali navigációs menüben az aktív ügyfél-munkamenet alatt: **Könyvelési Szabályok** menüpont.
- **Ikon:** Agy / Intelligens szabályok ikon (`Brain`)
- **Elérési útvonal:** eaisyBooks munkamenet -> Könyvelési Szabályok
- **Gyorsműveletek:** Új kontírozási szabály felvétele, AI instrukciók szerkesztése, szabálysablonok azonnali alkalmazása, szabályok egykattintásos aktiválása és inaktiválása, prioritások felülvizsgálata

---

## 2. A menü funkciója és célja

A **Könyvelési Szabályok és AI Promptok** modul a kiválasztott ügyfélcégre szabott mesterséges intelligencia szabályrendszerének, automatikus kontírozási és számlapárosítási logikájának, valamint természetes nyelvű könyvelési preferenciáinak vezérlőpultja.

### Fő feladatai és szerepe az automatizálásban:
1. **Cégspecifikus kontírozási szabályok érvényesítése:** Lehetővé teszi, hogy a könyvelő pontos természetes nyelvű instrukciókat vagy logikai feltételeket adjon a rendszernek a cég sajátos gazdasági eseményeire (pl. szoftverlicencek egyéb szolgáltatások közé sorolása, üzemanyagköltség 513-as számlára könyvelése, kisértékű eszközök azonnali költségként való elszámolása).
2. **Kiemelt prioritású lefutás:** Az itt definiált egyedi szabályok a legmagasabb prioritással hajtódnak végre a központi AI motorban, megelőzve az általános gépi tanulási logikát.
3. **Hibamentes tömeges feldolgozás:** Megszünteti az ismétlődő kézi számlakontírozást, miközben teljes szakmai felügyeletet biztosít a könyvelő kezében.
4. **Gyors sablontár:** Előre kidolgozott, a magyar számviteli gyakorlatban leggyakrabban előforduló szabályminták azonnali átvétele és testreszabása.

---

## 3. Mit lehet benne a felhasználónak csinálni? (Funkciók részletes leírása)

### 3.1 „Új szabály hozzáadása” gomb és rögzítő ablak
- **Hogy hívják:** Új szabály hozzáadása
- **Mire való:** Lehetővé teszi egyedi, cégszintű könyvelési szabály definiálását természetes nyelven megfogalmazott AI prompt formájában. Az AI ezen instrukció alapján automatikusan az előírt főkönyvi számlára könyveli a feltételnek megfelelő bejövő vagy kimenő számlatételeket.
- **Hol található a felületen:** A képernyő jobb felső részén, a címsor mellett található kék, kiemelt gomb plusz jellel.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a jobb felső **„Új szabály hozzáadása”** gombra.
  2. A megjelenő felugró ablakban adja meg a **Szabály neve** mező értékét (pl. *„Telekom számlák kontírozása”*, *„Google Ads reklámköltség”*).
  3. Az **AI Instrukció (Prompt)** szövegdobozban fogalmazza meg magyarul a szabályt, pontosan megjelölve a partnernevet, a számla kulcsszavait és a cél főkönyvi számlaszámot (pl. *„Minden Google és Facebook számlát könyvelj az 529-es egyéb igénybe vett szolgáltatások közé uniós fordított ÁFA-val!”*).
  4. Kattintson a **„Szabály mentése”** gombra (vagy a mégsemhez a **„Mégse”** gombra).
  - **Eredmény:** Az új szabály bekerül az aktív szabályok listájába, és a rendszer a következő számlafeldolgozási ciklustól kezdve automatikusan alkalmazza az adott ügyfél bizonylataira.

---

### 3.2 Aktív Szabályok listája és kártyái
- **Hogy hívják:** Aktív Szabályok tábla és szabálykártyák
- **Mire való:** Átlátható képet ad a céghez jelenleg rögzített összes egyedi könyvelési szabályról, azok érvényességi állapotáról (Aktív / Inaktív), a szabály pontos szövegéről és az utolsó frissítés időpontjáról.
- **Hol található a felületen:** A képernyő bal oldali, széles főterületén, a szabályok darabszámát mutató számláló jelvénnyel a fejlécében.
- **Hogyan használhatja a felhasználó:**
  1. Görgessen végig a rögzített szabályok listáján.
  2. Minden szabálykártyán olvassa el a szabály nevét és a kódblokkban kiemelt AI prompt szövegét.
  3. Ellenőrizze az **Aktív** (zöld címke) vagy **Inaktív** (szürke áthúzott címke) státuszt.
  4. Tekintse át az **Utoljára frissítve** sorban a legutóbbi módosítás pontos dátumát és időpontját.
  - **Eredmény:** A könyvelő azonnal látja, hogy a mesterséges intelligencia mely szabályok mentén végzi az automatikus számlabontást és főkönyvi osztályozást.

---

### 3.3 Szabály állapota kapcsoló (Aktív / Inaktív státuszváltó)
- **Hogy hívják:** Szabály állapota kapcsoló (Switch)
- **Mire való:** Lehetővé teszi bármely szabály azonnali ki- vagy bekapcsolását anélkül, hogy a szabályt törölni kellene. Hasznos időszaki akciók, jogszabályváltozások miatti átmeneti felfüggesztés vagy tesztelés során.
- **Hol található a felületen:** Minden egyes szabálykártya jobb szélén, a törlés gomb mellett található kétállású kapcsoló.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a felfüggeszteni vagy újraaktiválni kívánt szabályt a listában.
  2. Kattintson a kártya jobb szélén lévő kapcsolóra.
  3. Kikapcsolás esetén a kapcsoló szürkére vált, a szabály címe áthúzottá válik, a kártya halványabb lesz, és a státuszcímke **Inaktív** feliratra változik.
  4. Ismételt rákattintással a kapcsoló kékeszöldre vált, és a szabály azonnal újra **Aktív** státuszba lép.
  - **Eredmény:** Az inaktív szabályt az AI motor a feldolgozás során figyelmen kívül hagyja, az aktív szabályt pedig azonnal alkalmazza.

---

### 3.4 Szabály törlése gomb
- **Hogy hívják:** Szabály törlése (Kuka ikon)
- **Mire való:** Véglegesen eltávolítja a már nem releváns, elavult vagy hibásan rögzített egyedi szabályt az ügyfél szabálytárából.
- **Hol található a felületen:** Minden szabálykártya jobb szélén, a státuszkapcsoló mellett található piros kuka ikon (`Trash2`).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a törölni kívánt szabály sorának végén lévő kuka ikonra.
  2. A megjelenő böngésző megerősítő kérdésre (*„Biztosan törlöd ezt a könyvelési szabályt?”*) kattintson az **OK / Megerősítés** gombra.
  - **Eredmény:** A szabály véglegesen törlődik a rendszerből, a lista azonnal frissül, és zöld felugró értesítés jelenik meg: *„Szabály törölve — A szabály eltávolítva a könyvtárból.”*

---

### 3.5 Gyors Sablonok kártya és sablonkiválasztó gombok
- **Hogy hívják:** Gyors Sablonok (Gyors prompt-sablonok betöltése)
- **Mire való:** Előre kidolgozott, szakmailag bevált könyvelési logikákat kínál fel egyetlen kattintással. Megkíméli a könyvelőt a szabályok nulláról történő megfogalmazásától.
- **Hol található a felületen:** A képernyő jobb oldali sávjának felső részén található kiemelt kártya, csillag ikonnal.
- **Elérhető sablonok:**
  - *Szoftver licenc előfizetések:* Minden bejövő szoftveres/licenc díj (pl. Adobe, Slack, Zoom, Cashbook) automatikus kontírozása az 529-es Egyéb igénybe vett szolgáltatások közé.
  - *Kisértékű eszközök értékhatár:* 100 000 Ft alatti informatikai eszközök azonnali 511-es anyagköltségbe könyvelése tárgyi eszköz helyett (Sztv. szerinti azonnali elszámolás).
  - *MOL üzemanyag beszerzés:* Üzemanyag számlák (MOL, OMV, Shell) 513-as üzemanyag költség számlára könyvelése.
  - *Könyvelési és jogi díjak:* Szakértői és ügyvédi számlák az 522-es Könyvvizsgálati, jogi és szakértői díjak közé sorolása.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a használni kívánt sablont a jobb oldali sávból.
  2. Kattintson a sablon kártyájára.
  3. A rendszer automatikusan megnyitja a rögzítő űrlapot, feltöltve a sablon pontos elnevezésével és bevált prompt szövegével.
  4. Szükség esetén módosítsa a feltételeket (pl. írja át a számlaszámot vagy az értékhatárt a cég egyedi számlatükrének megfelelően).
  5. Kattintson a **„Szabály mentése”** gombra.
  - **Eredmény:** A sablon alapján létrehozott új szabály azonnal bekerül az ügyfél egyedi könyvelési szabályai közé.

---

### 3.6 „Hogyan írj hatékony könyvelési szabályokat?” útmutató kártya
- **Hogy hívják:** Szabályírási útmutató kártya (Tudásbázis súgó)
- **Mire való:** Gyakorlati tanácsokat és szintaktikai segítséget nyújt a könyvelőnek a legpontosabb, félreértésektől mentes instrukciók megfogalmazásához.
- **Hol található a felületen:** A jobb oldali sáv alsó részén, információs ikonnal (`Info`).
- **Hogyan használhatja a felhasználó:**
  1. Olvassa el a három alapszabályt:
     - **Légy pontos:** Mindig adja meg a konkrét partnert vagy a kulcsszavakat (pl. *„MOL”*, *„Telekom”*).
     - **Add meg a főkönyvi számot:** Mindig írja le a pontos főkönyvi számot (pl. *„522”*, *„511”*, *„529”*).
     - **Irány figyelembevétele:** Szükség esetén rögzítse, hogy a szabály bejövő (költség) vagy kimenő (árbevétel) számlára vonatkozik.
  - **Eredmény:** A könyvelő a legjobb gyakorlatoknak megfelelő szabályokat készít, minimalizálva az AI félreértelmezési esélyét.

---

## 4. Jogosultságok és Szerepkörök

| Szerepkör | Megtekintés | Új szabály rögzítése | Aktiválás / Inaktiválás | Törlés |
| :--- | :---: | :---: | :---: | :---: |
| **Irodavezető adminisztrátor** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Szenior könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő asszisztens** |  Teljes | ❌ Csak jóváhagyással | ❌ Nincs | ❌ Nincs |
| **Ügyfél (Cégvezető)** | ❌ Nem látható | ❌ Nincs | ❌ Nincs | ❌ Nincs |

---

## 5. Kapcsolódó jogszabályi és szakmai hivatkozások

- **2000. évi C. törvény a számvitelről (Sztv.):**
  - **165. § (1)–(3):** Bizonylati elv és bizonylati fegyelem — minden gazdasági műveletről olyan bizonylatot kell kiállítani és rögzíteni, amely hűen és megbízhatóan tükrözi a valóságot.
  - **166. § (2):** Számviteli bizonylat tartalmi hitelessége — az AI által kontírozott tételeknek és az alkalmazott szabályoknak összhangban kell lenniük a cég számviteli politikájával és számlatükrével.
  - **80. § (2):** Kisértékű tárgyi eszközök egyösszegű leírásának szabályozása (egyedi beszerzési értékhatárok alkalmazása a szabályokban).
