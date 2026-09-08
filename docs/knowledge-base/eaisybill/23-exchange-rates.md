# 📈 Árfolyamok (Devizaárfolyamok és Valutaváltó)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Pénzügyek  
> **Szükséges szerepkör:** Minden cégtag (Tulajdonos, Adminisztrátor, Könyvelő, Pénzügyi munkatárs, Megtekintő)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** A **Pénzügyek** blokk egyik menüpontja.
- **Ikon:** Növekvő trend ikon
- **Elérési útvonal:** Árfolyamok menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** Árfolyamok azonnali frissítése, devizaváltó használata

---

## 2. A menü funkciója és célja

Az **Árfolyamok** modul a Magyar Nemzeti Bank (MNB) hivatalos devizaárfolyamait jeleníti meg, követi nyomon és teszi elérhetővé a teljes vállalatirányítási és könyvelési rendszer számára.

### Fő feladatai és jogszabályi háttere:
1. **Hivatalos MNB devizaárfolyamok nyilvántartása:** A magyar számviteli törvény (Sztv. 60. §) és az Áfa törvény (80. §) alapján a devizás számlák és tranzakciók forintértékének megállapításához a vállalkozásoknak kötelezően a választott hitelintézet vagy a Magyar Nemzeti Bank hivatalos devizaárfolyamát kell alkalmazniuk. Az eaisyBill alapértelmezetten a hivatalos MNB árfolyamokat szinkronizálja.
2. **Napi automatikus árfolyam-szinkronizáció:** A rendszer az MNB hivatalos webszolgáltatásán keresztül naponta automatikusan lekéri és elmenti a napi záró devizaárfolyamokat.
3. **Kétirányú devizaváltó kalkulátor:** Beépített interaktív kalkulátor tetszőleges forint és devizaösszegek átszámításához a legfrissebb hivatalos adatok alapján.
4. **Globális integráció:** Az itt tárolt árfolyamokat használja automatikusan a számlanyilvántartás (külföldi számlák forintosítása és ÁFA forintértékének számítása), a banki tranzakció párosító motor, a főkönyvi könyvelés (árfolyamnyereség és -veszteség számítása), valamint az eredménykimutatás és mérleg riportok.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Kiemelt Deviza Kártyák és Testreszabás
- **Hogy hívják:** Kiemelt devizaárfolyam kártyasor (EUR, USD, GBP) és devizaválasztó
- **Mire való:** A cég számára legfontosabb külföldi fizetőeszközök aktuális MNB középárfolyamának és napi elmozdulásának (százalékos és forintos trend) azonnali áttekintése.
- **Hol található a felületen:** A képernyő legfelső sorában elhelyezkedő 3 nagyméretű információs kártya.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a kártyán a deviza aktuális forintértékét (pl. *1 EUR = 398,50 HUF*).
  2. Ellenőrizze a zöld/piros trendnyilat az előző banki munkanaphoz képesti változásról.
  3. Ha más devizát (pl. CHF, PLN vagy RON) szeretne kiemelni, kattintson a kártya sarkában lévő legördülő menüre és válassza ki a kívánt devizakódot.
  - **Eredmény:** A kiválasztott devizák adatai azonnal megjelennek a kiemelt blokkokban.

### 3.2 Kétirányú Valutaváltó Kalkulátor
- **Hogy hívják:** „Interaktív devizaváltó kalkulátor” és megfordító gomb
- **Mire való:** Tetszőleges forint vagy devizaösszeg azonnali, hivatalos MNB középárfolyamon alapuló átszámítása ajánlattételhez, külföldi utalások tervezéséhez vagy számlaellenőrzéshez.
- **Hol található a felületen:** A kiemelt kártyák alatt, a bal oldali különálló kártyán.
- **Hogyan használhatja a felhasználó:**
  1. Írja be az átváltani kívánt összeget a beviteli mezőbe (pl. *5 000*).
  2. Válassza ki a forrásdevizát (pl. *EUR*) és a céldevizát (pl. *HUF*).
  3. A devizák felcseréléséhez kattintson a két mező közötti kétirányú nyíl (megfordítás) gombra.
  4. Olvassa le az azonnal kiszámított eredményt a vastagon szedett alsó mezőben.
  - **Eredmény:** Pontos, hivatalos árfolyammal átszámított érték jelenik meg.

### 3.3 Hivatalos MNB Árfolyamtáblázat és Kereső
- **Hogy hívják:** „MNB Devizaárfolyamok táblázata” és keresőmező
- **Mire való:** A Magyar Nemzeti Bank által jegyzett összes hivatalos devizanem (AUD, CAD, CHF, CZK, DKK, EUR, GBP, JPY, NOK, PLN, RON, SEK, USD stb.) aktuális napi középárfolyamának és változásának tételes böngészése.
- **Hol található a felületen:** A képernyő jobb oldalán (vagy alsó felén) elhelyezkedő nagyméretű táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a keresett pénznem nevét vagy hárombetűs kódját a táblázat feletti keresőbe (pl. *PLN* vagy *Złoty*).
  2. Tekintse át az egységre vetített forintértéket és a napi változási százalékot.
  - **Eredmény:** Bármely ritkább külföldi deviza hivatalos árfolyama másodpercek alatt megtalálható.

### 3.4 Manuális Árfolyam-szinkronizálás
- **Hogy hívják:** „Árfolyamok frissítése” gomb (környíl ikon)
- **Mire való:** Az MNB által minden munkanap kora délután közzétett friss hivatalos árfolyamok azonnali lehívása a központi szerverekről az automatikus napi ütemezés megvárása nélkül.
- **Hol található a felületen:** A fejléc jobb szélén található kék **„Árfolyamok frissítése”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Árfolyamok frissítése”** gombra.
  2. A rendszer kapcsolatba lép az MNB webszolgáltatásával, frissíti az adatbázist, és zöld visszaigazoló üzenetet küld.
  3. Ellenőrizze a gomb mellett lévő *„Utolsó frissítés időpontja”* feliratot.
  - **Eredmény:** A rendszerben azonnal a legfrissebb hivatalos árfolyamok válnak aktívvá a devizás számlák és banki tételek könyveléséhez.
