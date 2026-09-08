# Szállítói Átutalások (Utalási Csomagok és Banki Export)

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Pénzügyek** csoportban található: **Utalások** (vagy **Szállítói átutalások**).
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/transfers`
- **Jogosultság:** Cégtulajdonos, adminisztrátor, pénzügyi vezető és könyvelő.

---

## 2. A menü funkciója és célja
Az **Utalások** modul a fizetésre váró szállítói számlák kötegelt banki kifizetési megbízássá szervezését, formai ellenőrzését és a netbankokba közvetlenül betölthető GIRO és SEPA fájlok exportálását végzi. Megszünteti a számlák egyesével történő kézi gépelését a netbanki felületeken.

### Fő feladatai:
- **Szállítói kötelezettségek szűrése:** A lejárt, a mai napon esedékes és a közeljövőben esedékessé váló bejövő számlák átlátható listája.
- **Bankszámlaszám ellenőrzés (Validáció):**
  - Hazai 2x8 vagy 3x8 jegyű magyar GIRO bankszámlaszámok formai ellenőrzése.
  - Nemzetközi IBAN számlaszámok strukturális és ellenőrzőösszeg-vizsgálata.
- **Szállítónkénti csoportosítás:** Egy adott beszállító több számlájának összevonása egyetlen utalási tétellé, a közlemény rovatban automatikusan felsorolva az összes bizonylatszámot (jelentősen csökkentve a banki tranzakciós költségeket).
- **Szabványos banki exportállományok előállítása:**
  - **GIRO XML / TXT:** A hazai pénzintézetek (OTP, Erste, Raiffeisen, MBH, CIB, K&H, UniCredit) által elfogadott kötegelt átutalási formátum.
  - **SEPA XML:** Európai uniós eurós átutalások nemzetközi szabványos formátuma.
- **Utalási történet és csomagkövetés:** Korábban legenerált és kifizetésre küldött utalási csomagok archívuma, megelőzve a számlák kétszeri kifizetését.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Számlák Kijelölése és Utalási Csomag Összeállítása
- **Hogy hívják:** Kijelölő négyzetek és lebegő összegző sáv
- **Mire való:** A kifizetendő számlák egyedi vagy tömeges kiválasztása, és a tervezett utalási végösszeg azonnali felügyelete.
- **Hol található a felületen:** A szállítói számlák táblázatának első oszlopában minden sornál, valamint a táblázat fejlécében (összes kijelölése).
- **Hogyan használhatja a felhasználó:**
  1. Szűrje le a listát a kívánt határidőre (pl. *Lejárt számlák* vagy *Ma esedékes* fül).
  2. Kattintson a kifizetendő számlák melletti jelölőnégyzetre, vagy a fejlécben lévő összesítő négyzetre az egész oldal kijelöléséhez.
  3. Figyelje a képernyő alsó részén megjelenő lebegő információs sávot, amely mutatja a kijelölt tételek darabszámát és a fizetendő bruttó összeget.
  - **Eredmény:** A kiválasztott tételek bekerülnek az összeállítandó utalási csomagba.

### 3.2 Partnerenkénti Csoportosítás Kapcsoló
- **Hogy hívják:** „Csoportosítás szállítónként” kapcsoló
- **Mire való:** Egy adott beszállítóhoz tartozó több nyitott számla egyetlen átutalássá vonása össze, a közlemény rovatban automatikusan felsorolva az összes számlaszámot (banki tranzakciós díjmegtakarítás).
- **Hol található a felületen:** A táblázat feletti szűrősáv jobb szélén elhelyezkedő kapcsoló.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Csoportosítás szállítónként”** kapcsolóra.
  2. Tekintse át az összevont partnertáblázatot, ahol a partner neve alatt látható a bevont számlák darabszáma és összesített tartozása.
  - **Eredmény:** A generált banki állományban nem számlánként, hanem partnerenként egyetlen tétel szerepel majd.

### 3.3 Forrás Bankszámla és Értéknap Kiválasztása
- **Hogy hívják:** „Forrás számla és értéknap” beállító panel
- **Mire való:** Meghatározza, hogy a cég melyik saját bankszámlájáról menjen a terhelés, és milyen banki teljesítési dátummal történjen az utalás.
- **Hol található a felületen:** A fejléc jobb oldalán, a generálási gombok mellett elhelyezkedő két legördülő mező.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a forrás céges bankszámlát a legördülő menüből (pl. *OTP Fő forintszámla*).
  2. Válassza ki az értéknapot (alapértelmezetten a mai nap, de jövőbeli értéknap is beállítható).
  - **Eredmény:** Az exportállomány fejlécébe a kiválasztott terhelendő bankszámla és a kívánt terhelési nap kerül.

### 3.4 Partner Bankszámlaszám Azonnali Rögzítése és Javítása
- **Hogy hívják:** „Soron belüli bankszámla szerkesztő” és validáció
- **Mire való:** A partnertörzsből hiányzó vagy formailag hibás bankszámlaszámok azonnali, helyben történő pótlása anélkül, hogy el kellene hagyni az utalási oldalt.
- **Hol található a felületen:** A számlák táblázatának **„Bankszámlaszám”** oszlopában.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a piros felkiáltójellel vagy *„Hiányzó számlaszám”* felirattal jelölt sort.
  2. Kattintson a bankszámla cellájára vagy a mellette lévő ceruza ikonra.
  3. Gépelje be vagy illessze be a partner 16 vagy 24 jegyű GIRO, illetve IBAN számlaszámát.
  4. Nyomjon Entert vagy kattintson a pipa gombra.
  - **Eredmény:** A rendszer azonnal leellenőrzi az ellenőrzőösszeget; ha érvényes, a jelvény zöldre vált, és a számlaszám automatikusan elmentődik a partnertörzsbe is.

### 3.5 GIRO és SEPA Export Fájl Generálása
- **Hogy hívják:** „GIRO XML generálása” és „SEPA XML letöltése” gombok
- **Mire való:** A netbankokba közvetlenül importálható kötegelt átutalási megbízás fájl legenerálása.
- **Hol található a felületen:** A képernyő felső fejlécében, illetve az alsó lebegő műveleti sáv jobb szélén lévő kék akciógombok.
- **Hogyan használhatja a felhasználó:**
  1. Győződjön meg róla, hogy minden kijelölt tétel érvényes bankszámlaszámmal rendelkezik.
  2. Forint átutalások esetén kattintson a **„GIRO XML generálása”** gombra (vagy a speciális banki CSV formátumra).
  3. Nemzetközi eurós utalások esetén kattintson a **„SEPA XML letöltése”** gombra.
  4. Mentse el a fájlt a számítógépére.
  5. Lépjen be a vállalati netbankba (pl. OTP Electra, Erste NetBank, K&H Electra stb.), válassza a *Kötegelt megbízás importálása* funkciót, és töltse fel az állományt.
  - **Eredmény:** A netbank másodpercek alatt betölti az összes tételt, amelyet a cégjegyzésre jogosult egyetlen SMS vagy token kóddal jóváhagyhat.

### 3.6 Utalási Csomagok Története és Visszavonása
- **Hogy hívják:** „Utalási történet” lapfül
- **Mire való:** A korábban legenerált exportcsomagok visszakeresése, újbóli letöltése, vagy téves generálás esetén a csomag visszavonása a duplikált kifizetések elkerülésére.
- **Hol található a felületen:** A fejléc lapfülei között: **„Előzmények / Csomagok”**.
- **Hogyan használhatja a felhasználó:**
  1. Váltson az **„Előzmények”** fülre.
  2. Tekintse át a korábbi csomagokat (dátum, forrás számla, tételek száma, végösszeg).
  3. Ha újra le kell tölteni a banki fájlt, kattintson a **„Letöltés”** ikonra.
  4. Ha a bankban elutasították a csomagot, vagy törölni szeretné, kattintson a **„Csomag feloldása”** gombra.
  - **Eredmény:** A csomagban lévő számlák újra megjelennek a kifizetésre váró nyitott számlák között.
