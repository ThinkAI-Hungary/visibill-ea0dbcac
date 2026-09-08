# 👥 Könyvelők és Munkatársak Kezelése (Accountant Management)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Iroda Adminisztráció  
> **Szükséges szerepkör:** Irodavezető adminisztrátor (`iroda_admin`)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében az **Adminisztráció** csoportban: **Könyvelők kezelése** menüpont (`/eaisybooks/admin/accountants`).
- **Ikon:** Csapat / Felhasználók (`Users`) ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → Könyvelők kezelése
- **Gyorsműveletek:** Új munkatárs meghívása e-mailben, cégportfólió hozzárendelése és elvétele, főkönyvelői státusz kijelölése, eaisyBill számlázói hozzáférés kapcsolása

---

## 2. A menü funkciója és célja

A **Könyvelők és Munkatársak Kezelése** az irodavezetés operatív személyzeti és erőforrás-gazdálkodási felülete. Itt kezelhetők a könyvelőiroda munkatársainak fiókjai, a hozzájuk rendelt ügyfélcégek, az elsődleges felelősségi körök, valamint a keresztfunkcionális rendszerhozzáférések.

### Fő feladatai és szerepe a munkaszervezésben:
1. **Munkatársi állomány nyilvántartása:** Az iroda összes aktív könyvelőjének, asszisztensének és adminisztrátorának listája, szerepkörük (Iroda Admin, Senior Könyvelő, Könyvelő, Asszisztens) feltüntetésével.
2. **Cégportfólió hozzárendelés:** Pontosan szabályozza, hogy melyik könyvelő mely ügyfélcégek anyagait látja és kezelheti.
3. **Főkönyvelői (Primary) felelősség:** Cégeknél egy kattintással kijelölhető az adott vállalkozásért felelős elsődleges könyvelő (csillag ikon).
4. **eaisyBill hozzáférés-szabályozás:** Egyetlen kapcsolóval tiltható vagy engedélyezhető, hogy a könyvelő közvetlenül beléphessen az ügyfél számlázó felületére is.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Keresősáv és „Új munkatárs meghívása” Gomb
- **Hogy hívják:** „Keresés munkatársak között...” beviteli mező és „Új munkatárs meghívása” gomb
- **Mire való:** A kollégák szűrése név alapján, valamint új kolléga bevonását indító dialógusablak megnyitása.
- **Hol található a felületen:** A képernyő felső fejlécében, a cím mellett jobbra a kék gomb, alatta a keresőmező.
- **Hogyan használhatja a felhasználó:**
  1. Gépelje be a keresőbe a kolléga nevét a lista azonnali szűréséhez.
  2. Új munkatárs felvételéhez kattintson az **„Új munkatárs meghívása”** gombra.
  - **Eredmény:** A felület megnyitja a meghívó űrlapot.

### 3.2 Új Munkatárs Meghívása Párbeszédablak
- **Hogy hívják:** „Munkatárs meghívása” modális ablak és „Meghívó elküldése” gomb
- **Mire való:** Új munkatárs digitális regisztrációjának kezdeményezése hivatalos e-mail címmel és szerepkörrel.
- **Hol található a felületen:** A felugró ablak közepén.
- **Hogyan használhatja a felhasználó:**
  1. Írja be az új munkatárs teljes nevét a **„Név”** mezőbe.
  2. Adja meg a hivatalos e-mail címét az **„E-mail cím”** mezőben.
  3. Válassza ki a kezdeti szerepkört: **Iroda Admin**, **Senior Könyvelő**, **Könyvelő** vagy **Asszisztens**.
  4. Kattintson a kék **„Meghívó elküldése”** gombra.
  - **Eredmény:** A rendszer meghívó e-mailt küld a kollégának a regisztrációs linkkel, és rögzíti a munkatársat az irodai névsorban.

### 3.3 Munkatársi Kártya és eaisyBill Hozzáférés Kapcsoló
- **Hogy hívják:** Munkatárs kártya, Szerepkör jelvény és „eaisyBill hozzáférés” kapcsoló (Switch)
- **Mire való:** A munkatárs adatainak, szerepkörének ellenőrzése, valamint a számlázói közvetlen belépési jog aktiválása/inaktiválása.
- **Hol található a felületen:** A fő lista minden egyes munkatársi dobozának fejlécében.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a munkatárs nevét és a hozzá rendelt szerepkör színkódolt címkéjét.
  2. Keresse meg a jobb felső sarokban lévő **„eaisyBill hozzáférés”** kapcsolót.
  3. Kattintson a kapcsolóra: zöld állapotban a könyvelő átléphet az ügyfél eaisyBill számlázójába; szürke állapotban kizárólag az eaisyBooks könyvelési felületet használhatja.
  - **Eredmény:** A hozzáférési jog azonnal frissül az adatbázisban.

### 3.4 Cég Hozzárendelése a Munkatárshoz
- **Hogy hívják:** „+ Cég hozzárendelése” gomb és cégválasztó dialógus
- **Mire való:** Egy meglévő ügyfélcég átadása a könyvelőnek feladatellátásra.
- **Hol található a felületen:** A munkatársi kártyán a „Hozzárendelt cégek” szakasz jobb szélén lévő kis gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„+ Cég hozzárendelése”** gombra a kiválasztott munkatárs dobozában.
  2. A felugró ablakban válassza ki az ügyfélcéget a legördülő listából.
  3. Válassza ki a cégre vonatkozó szerepkört (pl. *Könyvelő* vagy *Senior Könyvelő*).
  4. Jelölje be a **„Főkönyvelő kijelölése”** jelölőnégyzetet, ha ő lesz a cég elsődleges felelőse.
  5. Kattintson a **„Hozzárendelés mentése”** gombra.
  - **Eredmény:** A cég neve megjelenik a munkatárs kártyáján címkeként, és a könyvelő fiókjában azonnal elérhetővé válik a cég összes anyaga.

### 3.5 Főkönyvelői Státusz és Cég Levétel
- **Hogy hívják:** Főkönyvelő csillag ikon (`Star`) és Cég eltávolítása „X” gomb
- **Mire való:** Az elsődleges szakmai felelős megjelölése vagy a cég elvétele a munkatárstól.
- **Hol található a felületen:** A hozzárendelt cégek neve mellett elhelyezkedő sárga csillag és kis szürke „X” ikon.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a cég neve melletti **Csillag ikonra** a kiemeléshez: a csillag aranysárgára vált, jelezve, hogy hivatalosan ő a felelős könyvelő.
  2. Ha a munkatárs már nem kezeli a céget, kattintson a cégcímke jobb szélén lévő **„X”** ikonra.
  3. Erősítse meg a hozzárendelés törlését.
  - **Eredmény:** A cég lekerül a könyvelő portfóliójából anélkül, hogy maga a cég vagy annak könyvelési anyagai törlődnének.

### 3.6 Munkatárs Eltávolítása az Irodából
- **Hogy hívják:** „Munkatárs törlése” (Kuka) gomb és Megerősítő párbeszédablak
- **Mire való:** Kilépő vagy inaktivált munkatárs irodai hozzáférésének teljes visszavonása.
- **Hol található a felületen:** A munkatársi kártya jobb felső sarkában lévő piros kuka ikon.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a piros **Kuka ikonra**.
  2. A megjelenő megerősítő ablakban olvassa el a figyelmeztetést.
  3. Kattintson a **„Törlés megerősítése”** gombra.
  - **Eredmény:** A felhasználó azonnal elveszíti a hozzáférést a könyvelőiroda rendszeréhez, és törlődik a munkatársi listából.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Új ügyfélcég elosztása a csapatban
1. Egy új ügyfél szerződést kötött az irodával.
2. Az irodavezető belép a **Könyvelők kezelése** felületre.
3. Megkeresi Kovács Éva szenior könyvelő kártyáját, és rákattint a **„+ Cég hozzárendelése”** gombra.
4. Kiválasztja a céget, bepipálja a **„Főkönyvelő kijelölése”** opciót, majd menti.
5. Ugyanehhez a céghez hozzárendeli az iroda adminisztratív gyakornokát is **Asszisztens** szerepkörrel a számlák digitalizálásának segítésére.

### 4.2 Kilépő munkatárs feladatainak átadása
1. Egy könyvelő távozik az irodától.
2. Az irodavezető áttekinti a távozó munkatárs kártyáján lévő 12 céget.
3. A cégek mellett lévő „X” ikonnal sorban leválasztja az ügyfeleket, majd a **„+ Cég hozzárendelése”** funkcióval kiosztja őket a maradó kollégák között.
4. Végül a munkatársi kártyán a piros **Kuka ikonra** kattintva lezárja a volt kolléga hozzáférését.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **GDPR (2016/679/EU rendelet) 32. cikk (Az adatkezelés biztonsága):** Személyes adatokhoz és béradatokhoz való hozzáférés visszavonása a munkaviszony megszűnésekor.
- **2000. évi C. törvény a számvitelről (Sztv.):** Felelős könyvviteli szolgáltatást végző személy kijelölése és nyilvántartása.
