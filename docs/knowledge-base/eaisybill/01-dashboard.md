# 📊 Irányítópult (Dashboard)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Fő navigáció  
> **Szükséges szerepkör:** Minden regisztrált céges felhasználó (Tulajdonos, Adminisztrátor, Könyvelő, Pénzügyi munkatárs, Megtekintő)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjének legelső eleme: **Irányítópult** (vagy **Áttekintés**).
- **Ikon:** Műszerfal / Oszlopdiagram ikon
- **Elérési útvonal:** Bejelentkezés és a kívánt cég kiválasztása után a rendszer automatikusan erre a kezdőoldalra navigál.
- **Gyorsbillentyűk:**
  - `Ctrl + B`: Bal oldali navigációs sáv összecsukása és kinyitása a munkaterület növeléséhez.
  - `Ctrl + K`: Globális gyorskereső és funkciólap megnyitása.

---

## 2. A menü funkciója és célja

Az **Irányítópult** a vállalkozás pénzügyi és gazdálkodási vezérlőközpontja. Célja, hogy a cégvezetők, pénzügyi döntéshozók és könyvelők számára egyetlen átlátható felületen, valós időben mutassa be a cég bevételeit, kiadásait, pillanatnyi likviditását, ÁFA pozícióját és legfontosabb határidős teendőit.

### Fő üzleti céljai:
- Valós idejű pénzügyi aggregáció (kimenő bevételek, bejövő költségek, eredmény).
- Likviditásfigyelés (banki egyenlegek és házipénztár készpénzállománya).
- Kintlévőségek és szállítói tartozások korosítása.
- Becsült ÁFA kötelezettség valós idejű előrejelzése a NAV adatok alapján.
- Devizás ügyletek árfolyamkülönbözetének kimutatása.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

Az alábbiakban bemutatjuk az Irányítópulton elérhető összes funkciót a megadott követelmények szerint:

### 3.1 Időszakválasztó (Dátumtartomány szűrő)
- **Hogy hívják:** Időszakválasztó / Dátumtartomány választó
- **Mire való:** Meghatározza, hogy az Irányítópulton látható összes pénzügyi mutató, grafikon és számlastatisztika mely naptári intervallumra vonatkozzon (pl. tárgyhó, előző hónap, negyedév, teljes üzleti év, vagy egyedi tól-ig időszak).
- **Hol található a felületen:** A képernyő legfelső fejléc sávjában, középen/jobb oldalon található naptár ikonnal ellátott legördülő vezérlő.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a fejlécben a dátumtartományt jelző gombra (pl. „2026. augusztus”).
  2. A lenyíló naptárban válasszon az előre definiált gyorsgombok közül (*Mai nap*, *Ez a hét*, *Ez a hónap*, *Előző hónap*, *I. negyedév*, *Idei év*), vagy a naptárban kattintással jelölje ki az egyedi kezdő és záró dátumot.
  3. Kattintson az „Alkalmaz” gombra.
  4. **Eredmény:** Az oldal összes mutatója (bevétel, költség, ÁFA, grafikon) azonnal, oldalújratöltés nélkül újraszámolódik a kijelölt időszakra.

### 3.2 Fő Teljesítménymutatók (KPI Kártyasor)
- **Hogy hívják:** KPI Kártyák (*Összes bevétel*, *Összes kiadás*, *Nyereség / Eredmény*, *Kintlévőség egyenleg*, *Fizetendő szállítók*)
- **Mire való:** A cég legfontosabb pénzügyi számainak pillanatnyi leolvasása és az előző bázisidőszakhoz viszonyított százalékos növekedés/csökkenés követése.
- **Hol található a felületen:** A fejléc alatt közvetlenül elhelyezkedő felső kártyasorban.
- **Hogyan használhatja a felhasználó:**
  1. A kártyákon a felhasználó azonnal leolvashatja a nettó és bruttó összegeket forintban (illetve devizában).
  2. Bármelyik kártyára kattintva a rendszer közvetlenül átirányít a részletes mögöttes analitikára:
     - Az *Összes bevétel* kártyára kattintva megnyílik a kimenő számlák listája.
     - Az *Összes kiadás* kártyára kattintva megnyílik a bejövő szállítói számlák listája.
     - A *Kintlévőség egyenleg* kártyára kattintva megnyílik a Kintlévőségek és fizetési felszólítások oldala.
     - A *Fizetendő szállítók* kártyára kattintva megnyílik a Szállítói átutalások menüpont.

### 3.3 Bevételek és Költségek Trendje (Interaktív Forgalmi Grafikon)
- **Hogy hívják:** Bevételek és Költségek Grafikon (Nettó / Bruttó nézetváltóval)
- **Mire való:** A vállalkozás gazdálkodásának havi idősoros vizuális elemzése, a bevételek és költségek arányának, valamint a profitmarzsnak a havi alakulása.
- **Hol található a felületen:** Az Irányítópult központi részén, a KPI kártyák alatt elhelyezkedő nagyméretű diagram.
- **Hogyan használhatja a felhasználó:**
  1. A grafikon jobb felső sarkában lévő kétállású kapcsolóval válasszon:
     - **Nettó nézet:** Számviteli eredményességi szemlélet (ÁFA nélküli valós fedezet).
     - **Bruttó nézet:** Pénzforgalmi szemlélet (ténylegesen mozgó összegek ÁFA-val együtt).
  2. Mozgassa a kurzort a diagram tetszőleges havi oszlopára vagy vonalponti elemére.
  3. **Eredmény:** Megjelenik a részletező információs buborék, amely kiírja az adott hónap pontos árbevételét, kiadásait és nettó marzsát.

### 3.4 ÁFA Pozíció és Adóteher Előrejelző Panel
- **Hogy hívják:** ÁFA Pozíció Szekció
- **Mire való:** Tájékoztatja a vállalkozót, hogy a NAV Online Számla adatai alapján az adott ÁFA időszakban a cég éppen befizető (tartozik a NAV-nak) vagy visszaigénylő pozícióban van-e.
- **Hol található a felületen:** Az oldal középső/jobb oldali információs dobozában.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a fizetendő (kimenő számlákból származó) és a levonható (bejövő költségszámlákból érvényesíthető) ÁFA összegeket.
  2. A panel alján található „ÁFA részletek” gombra kattintva azonnal átléphet a hivatalos 2665-ös ÁFA bevallás tervező oldalra a soronkénti adatok ellenőrzéséhez.

### 3.5 Deviza Árfolyamkülönbözet Analitika
- **Hogy hívják:** Árfolyamkülönbözet Kártya
- **Mire való:** Kimutatja a külföldi devizás (EUR, USD, GBP stb.) vevői és szállítói számlák teljesítéskori forintértéke és a tényleges banki kifizetés napján érvényes MNB árfolyam közötti árfolyamnyereséget vagy árfolyamveszteséget.
- **Hol található a felületen:** A pénzügyi összefoglaló blokk alsó részén.
- **Hogyan használhatja a felhasználó:**
  1. Ellenőrizze a realizált árfolyamnyereség (97-es számlaosztály) és árfolyamveszteség (87-es számlaosztály) egyenlegét.
  2. A sorokra kattintva megnyitható az érintett devizás számla és a banki jóváírás/terhelés adatlapon belüli összevetése.

### 3.6 Gyors Teendők és Riasztások Doboz
- **Hogy hívják:** Teendők és Figyelmeztetések Központ
- **Mire való:** Riasztást ad a pénzügyi kockázatokról: bizonylat nélküli banki kifizetésekről, feldolgozatlan új NAV számlákról és lejáró fizetési határidőkről.
- **Hol található a felületen:** Az oldal jobb oldali oldalsávjában vagy alsó figyelmeztető sávjában.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a piros és sárga figyelmeztető kártyákat.
  2. Kattintson a figyelmeztetés melletti közvetlen akciógombra:
     - „Számlák bekérése” -> Bizonylatbekérő e-mail előkészítése.
     - „Számlák jóváhagyása” -> Ugrás a számlák kontírozó felületére.
     - „Kintlévőségek megtekintése” -> Ugrás a fizetési felszólító kezelőbe.
