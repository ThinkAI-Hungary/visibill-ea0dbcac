# ⚠️ Fuvar Eszkaláció és Vitás Ügyek

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Szállítmányozás  
> **Szükséges szerepkör:** Tulajdonos (Owner), Adminisztrátor, Pénzügyi munkatárs (Member)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** A **Szállítmányozás** csoport 3. menüpontja.
- **Ikon:** Figyelmeztető háromszög ikon
- **Elérési útvonal:** Fuvar Eszkaláció menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** Vitás tétel jóváhagyása, elutasítása, számla és fuvarlevél vizsgálata

---

## 2. A menü funkciója és célja

Az **Eszkaláció** modul a logisztikai és fuvarozási folyamatok minőségbiztosítási és pénzügyi védelmi központja. Ide kerül minden olyan fuvarmegbízás és beérkező fuvarszámla, ahol az automatikus ellenőrzés eltérést, árkülönbözetet vagy hibás adatot észlelt.

### Fő funkciók:
- **Eltérések automatikus detektálása:**
  - *Árkülönbözet:* A számlán szereplő végösszeg magasabb vagy alacsonyabb, mint a fuvarmegbízásban rögzített megállapodott fuvardíj.
  - *Pótdíjak és felárak:* Állásidő, túlsúly, útdíj-korrekció vagy üzemanyag-felár jogosultságának vizsgálata.
  - *Deviza és árfolyam eltérés:* Eltérő devizanemben történő számlázás vagy vitatott átváltási árfolyam.
  - *Pozíciószám anomáliák:* Hiányzó, hibás vagy duplikált pozíciószámok felderítése.
- **Kétpaneles összehasonlító felület:** Bal oldalon a beérkezett szállítói számla adatai, jobb oldalon a diszpécser által rögzített fuvarmegbízás látható egymás mellett.
- **Döntési munkafolyamat:**
  - *Elfogadás és jóváhagyás:* Az eltérés indokolt (pl. igazolt állásidő), a pénzügy jóváhagyja a magasabb összeget, a tétel párosítottá válik és kifizethető.
  - *Vitás státuszba helyezés:* A számla kifizetése zárolásra kerül, amíg a fuvarozó partner helyesbítő vagy sztornó számlát nem küld.
  - *Szétkapcsolás:* Ha a rendszer tévesen kapcsolt össze két független megbízást, a kapcsolat azonnal bontható.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Kétpaneles Összehasonlító Nézet (Számla vs. Megbízás)
- **Hogy hívják:** „Összehasonlító vizsgálati panel”
- **Mire való:** A szállító által kiállított számla tételeinek és a fuvarszervező által rögzített megállapodott feltételeknek az egymás melletti, szimultán vizsgálata.
- **Hol található a felületen:** Az eszkalált tétel sorára vagy kártyájára kattintva a megnyíló osztott ablakban.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az eszkalált fuvar sorára.
  2. Bal oldalon tekintse át a beérkezett számla összegeit, tételeit (pl. fuvardíj + állásidő felár).
  3. Jobb oldalon tekintse át az eredeti megbízás pozíciószámát, leegyeztetett díját és a diszpécser megjegyzéseit.
  - **Eredmény:** Azonnal látható a különbség pontos forrása.

### 3.2 Differencia és Anomália Címkék
- **Hogy hívják:** Eltérés típusjelvények (*„Árkülönbözet: +45 000 Ft”*, *„Hiányzó CMR”*, *„Eltérő devizanem”*)
- **Mire való:** A hiba okának azonnali vizuális azonosítása anélkül, hogy a felhasználónak kézzel kellene kiszámolnia a differenciát.
- **Hol található a felületen:** A táblázat soraiban a számla és pozíciószám mellett elhelyezkedő színes jelvények.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a piros címkén szereplő összeget és eltérési százalékot.
  2. Vigye az egeret a címke fölé az észlelt anomália részletes magyarázatáért.
  - **Eredmény:** Másodpercek alatt kiderül, hogy jogos felárról vagy elszámlázásról van szó.

### 3.3 Jóváhagyás és Kifizetés Engedélyezése
- **Hogy hívják:** „Jóváhagyás” gomb (zöld pipa)
- **Mire való:** Az eltérés elfogadása indokolt esetben (pl. a fuvarozó igazolta az 5 órás határon túli állásidőt, a diszpécser jóváhagyta a felárat), a számla státuszának „Párosított”-ra váltása és a banki utalási csomagba engedése.
- **Hol található a felületen:** A vitás tétel sora végén, illetve az összehasonlító ablak jobb alsó sarkában lévő zöld gomb.
- **Hogyan használhatja a felhasználó:**
  1. Győződjön meg az eltérés jogosságáról.
  2. Kattintson a **„Jóváhagyás”** gombra.
  3. Adjon meg egy rövid indoklást (pl. *Diszpécser által igazolt állásidő*).
  4. Kattintson a **„Megerősítés”** gombra.
  - **Eredmény:** A számla kikerül az eszkalációs listából, párosítottá válik, és átkerül az utalható számlák közé.

### 3.4 Vitatás és Kifizetési Zárolás
- **Hogy hívják:** „Vitatás és zárolás” gomb (piros x)
- **Mire való:** Jogtalan felár vagy téves összeg esetén a számla kifizetésének azonnali letiltása, és hivatalos reklamációs értesítő generálása a fuvarozó felé helyesbítő számla kiállítására.
- **Hol található a felületen:** A sorvégi műveleti gombok között, valamint az adatlap alsó sávjában lévő piros gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Vitatás”** gombra.
  2. Írja be a kifogás szövegét (pl. *A megállapodás 1 200 EUR volt, a számla 1 350 EUR-ról érkezett, az állásidő nem volt bejelentve*).
  3. Kattintson a **„Zárolás és értesítés küldése”** gombra.
  - **Eredmény:** A számla piros zárolást kap, nem kerülhet be a banki utalási csomagba, és a rendszer elküldi a reklamációt a partnernek.

### 3.5 Szétkapcsolás (Téves Gépi Összerendelés Bontása)
- **Hogy hívják:** „Szétkapcsolás” gomb (olló / láncbontás ikon)
- **Mire való:** Ha a gépi tanulás vagy az algoritmus tévesen kötött össze egy számlát egy nem hozzá tartozó fuvarmegbízással (pl. azonos fuvardíj miatt).
- **Hol található a felületen:** A fuvarsor műveleti menüjében a **„Szétkapcsolás”** opció.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Szétkapcsolás”** gombra.
  2. A megerősítő kérdésre kattintson az **„Igen, szétkapcsolom”** gombra.
  - **Eredmény:** A kapcsolat feloldódik, a fuvar és a számla ismét külön-külön megjelenik a párosítatlan tételek között.

### 3.6 Csatolt CMR Okmány és Számlakép Együttes Ellenőrzése
- **Hogy hívják:** „Dokumentumok összevetése” nézegető
- **Mire való:** A számla eredeti PDF képének és az alvállalkozó által leadott szkennelt CMR fuvarlevélnek a párhuzamos áttekintése az aláírások és bélyegzők ellenőrzésére.
- **Hol található a felületen:** Az összehasonlító ablak tetején lévő **„Dokumentumok megtekintése”** link.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Dokumentumok”** gombra.
  2. A felugró nézegetőben egymás mellett vagy fülönként válthat a számlakép és a CMR között.
  3. Ellenőrizze a CMR 24-es rovatát (vevői átvétel dátuma és aláírása).
  - **Eredmény:** Dokumentált, vitathatatlan döntési alap a jóváhagyáshoz vagy reklamációhoz.
