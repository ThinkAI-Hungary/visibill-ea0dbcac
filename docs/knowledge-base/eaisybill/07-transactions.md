# Banki Tranzakciók (Bankkivonatok, Párosítás és Futár Riportok)

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Pénzügyek** csoportban található: **Tranzakciók** (vagy **Bank**).
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/transactions`
- **Fő nézetek (Fülek a képernyőn):**
  - **Általános banki tranzakciók:** A bankszámlák forgalma.
  - **Futárszolgálati riportok:** GLS, MPL, Mixpack utánvétes gyűjtőátutalások elszámolása.
  - **SZÉP Kártya:** Vendéglátás, szálláshely és szabadidő alszámlák forgalma.
- **Jogosultság:** Cégtulajdonos, adminisztrátor, könyvelő és pénzügyi munkatárs.

---

## 2. A menü funkciója és célja
A **Tranzakciók** modul a vállalkozás pénzforgalmi mozgásainak digitális központja, amely kezeli a banki kivonatok beolvasását, a tranzakciók és számlák intelligens összerendelését, valamint a webáruházas futárcégek kötegelt elszámolásait.

### Fő feladatai:
- **15+ pénzintézet és fintech szolgáltató támogatása:** Hazai bankok (OTP, CIB, Raiffeisen, K&H, Erste, UniCredit, MagNet, Gránit, MBH, MKB, Binx, Oberbank), valamint nemzetközi fintech platformok (Wise, Revolut, PayPal).
- **Szabványos kivonatfeldolgozás:** CAMT.053 XML, banki export CSV és szöveges állományok automatikus betöltése duplikáció-szűréssel.
- **Háromszintű számlapárosítás:**
  1. *Pontos egyezés (Zöld):* Közleménybeli számlaszám és összeg egyezése esetén azonnali automatikus lezárás.
  2. *Intelligens javaslat (Sárga):* Partnernév és összegazonosság alapján algoritmikus felajánlás.
  3. *Kézi / Részösszegű párosítás:* Tranzakció megbontása több számla vagy előleg kiegyenlítésére.
- **Futár riportok felbontása:** GLS, MPL és Mixpack utánvétes gyűjtőátutalások automatikus tételes szétbontása csomagszám és bizonylat szerint, levonva a futárszolgálati díjat.
- **SZÉP Kártya alszámlák kezelése:** Speciális alszámlák forgalmának elszámolása.
- **Párosítási szabályrendszer:** Közlemény kulcsszavak alapján automatikus partner- és számla-hozzárendelés.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Bankkivonat Feltöltése és Kezelése
- **Hogy hívják:** „Kivonatok feltöltése” gomb és fájlkezelő panel
- **Mire való:** Elektronikus banki kivonatok (CAMT.053 XML, CSV, TXT) beolvasása, automatikus duplikáció-szűréssel és tranzakció-feldolgozással.
- **Hol található a felületen:** A fejléc jobb felső sarkában található kék **„Kivonatok”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a fejlécben lévő **„Kivonatok”** gombra.
  2. A megjelenő ablakban húzza be (drag-and-drop) a letöltött banki kivonatfájlt, vagy kattintson a tallózás területre.
  3. A rendszer azonnal ellenőrzi a banki azonosítókat, kiszűri a már korábban feltöltött tételeket, és betölti az új tranzakciókat.
  4. Tekintse át a feltöltött kivonatok listáját, ahol látható a számlaszám, időszak, tételek száma és a feldolgozás állapota.
  - **Eredmény:** Az új banki tételek bekerülnek a tranzakciós listába, és a rendszer a háttérben azonnal lefuttatja az automatikus számlapárosító algoritmust.

### 3.2 Számlapárosítás és Jóváhagyás
- **Hogy hívják:** Párosítási státusz gomb és párosító ablak
- **Mire való:** A banki bejövő jóváírások és kimenő utalások összerendelése a kiállított vevői vagy beérkezett szállítói számlákkal.
- **Hol található a felületen:** A tranzakciós táblázat minden sorában a **„Kapcsolt számla / Művelet”** oszlopban.
- **Hogyan használhatja a felhasználó:**
  1. **Zöld jelzés (Pontos egyezés):** A rendszer automatikusan összerendelte a közlemény és összeg alapján – a felhasználónak nincs teendője, a számla automatikusan fizetettre vált.
  2. **Sárga jelzés (Javasolt egyezés):** Kattintson a javasolt számlára a megerősítéshez, vagy kattintson a pipa gombra az elfogadáshoz.
  3. **Szürke jelzés (Párosítatlan):** Kattintson a **„Párosítás”** gombra a sor végén.
  4. A megnyíló párosító ablakban a keresőmező segítségével keresse meg a kívánt számlát (partnernév, számlaszám vagy összeg alapján), majd jelölje ki.
  5. Kattintson a **„Párosítás jóváhagyása”** gombra.
  - **Eredmény:** A tranzakció és a számla összekapcsolódik, a számla státusza „Fizetett”-re vált, és a főkönyvi könyvelés lezárul.

### 3.3 Tranzakció Felbontása és Részfizetés
- **Hogy hívják:** „Megbontás / Részfizetés” funkció
- **Mire való:** Egyetlen banki átutalási tétel szétosztása több különálló számla között (pl. ha a vevő egy utalással 3 számlát egyenlített ki), vagy részletfizetés könyvelése.
- **Hol található a felületen:** A kézi párosító ablak jobb alsó sarkában lévő **„Tranzakció bontása”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a sorvégi **„Párosítás”** gombra, majd válassza a **„Bontás”** opciót.
  2. Válassza ki az első kifizetendő számlát, és adja meg a hozzárendelni kívánt összeget.
  3. Kattintson az **„Új részösszeg hozzáadása”** gombra a fennmaradó összeg felosztásához.
  4. Válassza ki a további számlá(ka)t, amíg a fennmaradó banki egyenleg 0 Ft nem lesz.
  5. Kattintson a **„Mentés és lezárás”** gombra.
  - **Eredmény:** A banki tétel megbontásra kerül a főkönyvben, és minden érintett számlán rögzül a pontos kiegyenlítés vagy részfizetés.

### 3.4 Nem Számlaköteles Tétel Könyvelése
- **Hogy hívják:** „Közvetlen könyvelés” (Adó, banki költség, hitel, átvezetés)
- **Mire való:** Olyan banki mozgások lekönyvelése, amelyekhez nem kapcsolódik klasszikus számla (pl. NAV adóbefizetések, banki számlavezetési díj, kamatok, tagi kölcsön, készpénzfelvétel).
- **Hol található a felületen:** A párosító ablak **„Nem számlához kapcsolódó tétel”** fülén.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a párosítatlan tranzakció sorában a **„Párosítás”** gombra.
  2. Váltson a **„Közvetlen könyvelés”** lapfülre.
  3. Válassza ki a jogcímet a legördülő menüből (pl. *NAV adókötelezettség*, *Bankköltség*, *Pénztár átvezetés*, *Kamatbevétel*).
  4. A rendszer automatikusan felajánlja a kapcsolódó főkönyvi ellenszámlát (pl. bankköltségnél 532, adónál a megfelelő 46x adónem számlát).
  5. Kattintson a **„Könyvelés”** gombra.
  - **Eredmény:** A tétel lekönyvelődik a vegyes naplóban és a főkönyvben anélkül, hogy számlához lenne rendelve.

### 3.5 Futár és SZÉP Kártya Riportok Munkaterület
- **Hogy hívják:** „Futár riportok” és „SZÉP Kártya” lapfülek
- **Mire való:** E-kereskedelmi utánvétes gyűjtőátutalások (GLS, MPL, Mixpack stb.) automatikus szétbontása csomagszám szerint számlákra és futárdíjakra, valamint SZÉP kártyás alszámlák elszámolása.
- **Hol található a felületen:** A tranzakciós képernyő felső részén elhelyezkedő nézetváltó fülek.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Futár riportok”** fülre.
  2. Töltse fel a futárszolgálattól kapott CSV vagy Excel elszámolást.
  3. A rendszer összekapcsolja a gyűjtő jóváírást a futárfájlban lévő csomagokkal és számlákkal.
  4. Tekintse át az egyeztető táblázatot, amely kimutatja a levont utánvétkezelési díjat és a nettó kifizetést.
  5. Kattintson a **„Kötegelt párosítás jóváhagyása”** gombra.
  - **Eredmény:** A futár által beszedett utánvétek egyetlen kattintással lezárják az összes érintett vevői számlát, a levont jutalék pedig költségként könyvelődik.

### 3.6 Párosítási Szabályok Kezelése
- **Hogy hívják:** „Automatikus szabályok” gomb
- **Mire való:** Ismétlődő tranzakciók (pl. havi előfizetések, állandó partnerek) automatikus felismerési szabályainak létrehozása közlemény kulcsszavak alapján.
- **Hol található a felületen:** A fejlécben a szűrősáv mellett lévő fogaskerék ikon vagy a **„Szabályok”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Automatikus szabályok”** gombra.
  2. Kattintson az **„Új szabály”** gombra.
  3. Adja meg a keresett feltételt (pl. ha a közlemény tartalmazza a „Google” szót).
  4. Adja meg az automatikus műveletet (pl. rendelje hozzá a Google Ireland partnerhez és a 529-es költségnemhez).
  5. Kattintson a **„Szabály mentése”** gombra.
  - **Eredmény:** A jövőbeni kivonatok feltöltésekor a rendszer ezen szabályok alapján automatikusan lekönyveli az érintett tranzakciókat.
