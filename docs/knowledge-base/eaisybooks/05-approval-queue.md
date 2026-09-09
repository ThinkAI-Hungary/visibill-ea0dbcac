# ✅ Jóváhagyó Rendszer és Várakozó Sor (Approval Queue)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Portfólió  
> **Szükséges szerepkör:** Irodavezető adminisztrátor, Szenior könyvelő  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Portfólió** csoport egyik menüpontja.
- **Ikon:** Levél pipa / Jóváhagyás ikon
- **Elérési útvonal:** Jóváhagyó rendszer menüpont a navigációs sávban
- **Gyorsműveletek:** Tételek egyenkénti vagy kötegelt jóváhagyása, visszaküldés javításra

---

## 2. A menü funkciója és célja

A **Jóváhagyó rendszer** a négykezes elv és a könyvelési minőségbiztosítás központi munkafolyamat-kezelője. Biztosítja, hogy a kezdő vagy junior könyvelők által rögzített kényes műveletek, a nagy értékű bizonylatok, az adóbevallások és a bérszámfejtési listák csak egy szenior könyvelő vagy irodavezető szakmai felülvizsgálata és ellenjegyzése után váljanak véglegessé.

### Fő feladatai és szerepe a könyvelési irodában:
1. **Minőségbiztosítás és kockázatcsökkentés:** Megakadályozza a hibás számlarögzítést, a téves főkönyvi számlaszámra könyvelést és a pontatlan adóbevallások hatóság felé történő beküldését.
2. **Különböző jóváhagyási kategóriák kezelése:**
   - Havi bérszámfejtési jegyzékek és átutalási listák jóváhagyása.
   - Havi és negyedéves ÁFA bevallások tervezetei (2665).
   - Magas összeghatárt meghaladó számlák (értékhatár-alapú kontroll).
   - Szokatlan vagy speciális költséghelyekre történő könyvelések.
   - Ügyfél általi bizonylat-visszautasítások kezelése.
3. **Auditálhatóság és naplózás:** Minden jóváhagyási döntés (ki, mikor, milyen indoklással hagyta jóvá vagy utasította vissza) visszakereshetően naplózásra kerül.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Várakozó Sor Táblázat és Típus Szűrők
- **Hogy hívják:** Jóváhagyási várólista táblázat és kategória szűrőgombok (*Összes*, *Bérek*, *ÁFA bevallások*, *Nagy értékű számlák*, *Vegyes bizonylatok*)
- **Mire való:** A junior könyvelők által beküldött, szakmai ellenjegyzést és jóváhagyást igénylő pénzügyi műveletek áttekintése és priorizálása.
- **Hol található a felületen:** A képernyő középső munkaterületén elhelyezkedő táblázat és a felette lévő szűrősáv.
- **Hogyan használhatja a felhasználó:**
  1. Válasszon kategóriát a felső gombokkal (pl. kattintson az **„ÁFA bevallások”** fülre).
  2. Tekintse át a táblázat oszlopait: Cég neve, Készítő munkatárs, Érintett összeg, Határidő és Sürgősségi jelvény.
  3. Kattintson a sorra a részletes szakmai vizsgálat megnyitásához.
  - **Eredmény:** Azonnal láthatóvá válnak a jóváhagyásra váró tételek adatai.

### 3.2 Részletes Felülvizsgálati Munkalap és Bizonylatelőnézet
- **Hogy hívják:** „Felülvizsgálati döntési panel” és bizonylatnézegető
- **Mire való:** A beküldött tétel főkönyvi kontírozásának (Tartozik/Követel számlák), ÁFA kódjának, levonási korlátozásainak és az eredeti számlaképnek az együttes vizsgálata.
- **Hol található a felületen:** A kiválasztott tételre kattintva megnyíló osztott ablakban.
- **Hogyan használhatja a felhasználó:**
  1. Bal oldalon tekintse meg a csatolt eredeti PDF számlát vagy bérszámfejtési jegyzéket.
  2. Jobb oldalon ellenőrizze a javasolt főkönyvi számlákat és a beküldő könyvelő szakmai megjegyzését (pl. *„Ellenőrizd a 70/30-as telefonarányosítást!”*).
  - **Eredmény:** Kétséget kizáró szakmai bizonyosság a döntés meghozatala előtt.

### 3.3 Jóváhagyás és Véglegesítés
- **Hogy hívják:** „Jóváhagyás” gomb (zöld pipa)
- **Mire való:** A négykezes elv szerinti jóváhagyás: a tétel véglegessé nyilvánítása, zárolása a könyvviteli naplóban, és engedélyezése az utalási csomagba vagy a hatósági beküldésbe.
- **Hol található a felületen:** A felülvizsgálati panel jobb alsó sarkában lévő nagyméretű zöld akciógomb.
- **Hogyan használhatja a felhasználó:**
  1. A számszaki helyesség ellenőrzése után kattintson a **„Jóváhagyás”** gombra.
  2. A rendszer rögzíti a felülvizsgáló nevét és az időbélyeget az audit naplóba.
  - **Eredmény:** A tétel állapota „Jóváhagyva”-ra vált, kikerül a várólistából, és élessé válik a könyvelésben.

### 3.4 Visszaküldés Javításra (Szakmai Instrukcióval)
- **Hogy hívják:** „Visszaküldés javításra” gomb (sárga nyíl)
- **Mire való:** Hibás kontírozás, hiányzó melléklet vagy téves adókulcs esetén a bizonylat visszairányítása az eredeti készítőhöz kötelező szöveges korrekciós utasítással.
- **Hol található a felületen:** A döntési panel alsó műveleti sávjában lévő sárga gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Visszaküldés javításra”** gombra.
  2. A felugró szövegmezőbe írja le pontosan a javítandó hibát (pl. *„A gépjármű bérletnél csak 50% ÁFA vonható le, módosítsd az adókódot!”*).
  3. Kattintson a **„Visszaküldés a készítőnek”** gombra.
  - **Eredmény:** A junior könyvelő azonnali feladatot és értesítést kap, a tétel pedig visszakerül az ő munkalistájába javításra.

### 3.5 Elutasítás és Érvénytelenítés
- **Hogy hívják:** „Elutasítás” gomb (piros x)
- **Mire való:** Nem jogszerű, duplikált vagy tévesen rögzített tételek végleges törlése és elutasítása.
- **Hol található a felületen:** A döntési panel jobb szélén lévő piros gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Elutasítás”** gombra.
  2. Adja meg az elutasítás indokát (pl. *Duplikált számlarögzítés*).
  3. Kattintson az **„Érvénytelenítés jóváhagyása”** gombra.
  - **Eredmény:** A tétel törlődik a jóváhagyási sorból, nem kerül be a könyvelésbe.

### 3.6 Kötegelt Jóváhagyási Műveleti Sáv
- **Hogy hívják:** Kijelölő négyzetek és „Kijelöltek jóváhagyása” lebegő sáv
- **Mire való:** Standard, alacsony kockázatú tételek (pl. rutin rezsiszámlák vagy telefonköltségek) gyors, tömeges ellenjegyzése egyetlen kattintással.
- **Hol található a felületen:** A táblázat soraiban a sor eleji négyzetek bepipálásakor alul megjelenő lebegő műveleti sáv.
- **Hogyan használhatja a felhasználó:**
  1. Pipálja be az ellenőrzött, rutinszerű tételek jelölőnégyzetét.
  2. Kattintson a megjelenő alsó sávban a **„Kijelöltek jóváhagyása”** gombra.
  - **Eredmény:** Az összes kiválasztott bizonylat egyszerre válik jóváhagyottá, jelentős időt megtakarítva az irodavezetőnek.
