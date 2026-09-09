# Bérek és Járulékok (Bérszámfejtési Összesítő)

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Munkaügy** (vagy **HR**) csoportban található: **Bérek / Járulékok**.
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/salaries`
- **Jogosultság:** Cégtulajdonos, adminisztrátor, bérszámfejtő és könyvelő.

---

## 2. A menü funkciója és célja
A **Bérek / Járulékok** modul a munkavállalók bérköltségeinek, levonásainak és a munkáltatót terhelő adóknak a nyilvántartására, havi aggregációjára és a NAV havi 08-as járulékbevallás számszaki megalapozására szolgál.

### Fő feladatai:
- **Teljes bérköltség (Szuperbruttó) kalkuláció:**
  - *Bruttó bér:* Alapbér, bérpótlékok, prémiumok és egyéb juttatások.
  - *Munkavállalót terhelő levonások:* 15% Személyi jövedelemadó (SZJA) és 18,5% Társadalombiztosítási járulék (TB járulék).
  - *Nettó bér:* A dolgozóknak ténylegesen kifizetendő összeg.
  - *Munkáltatói közterhek:* 13% Szociális hozzájárulási adó (Szocho).
- **Munkavállalói csoportosítás:** Dolgozónkénti havi bérjegyzékek áttekintése, az érvényesített adókedvezmények (családi kedvezmény, 25 év alatti fiatalok kedvezménye, első házasok kedvezménye, személyi kedvezmény) feltüntetésével.
- **NAV Havi Összesítő:** A NAV 08-as bevallás szerinti adónemenkénti összesítés az adóhatóság felé fizetendő tételekről.
- **Bérjegyzék fájlkezelő:** Digitális bérjegyzékek (PDF bérlapok) feltöltése, tárolása és munkavállalóhoz rendelése.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Bérösszesítő Mutatók (KPI Kártyasor)
- **Hogy hívják:** Havi Bérköltség KPI Kártyák (*Összes Bruttó bér*, *Összes Nettó kifizetés*, *Munkáltatói Szocho*, *Teljes Munkaerőköltség*)
- **Mire való:** A vizsgált havi bérszámfejtési végösszegek azonnali áttekintése vezetői és likviditási szempontból.
- **Hol található a felületen:** A képernyő legfelső sorában elhelyezkedő 4 színes kártya.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a vizsgált elszámolási hónapot a fejlécben.
  2. Tekintse át az összesített nettó bérigényt (a dolgozók bankszámlájára utalandó teljes összeget) és a munkáltatói terheket.
  - **Eredmény:** Azonnali pénzügyi tervezési alap a havi bérfizetési nap előtt.

### 3.2 Új Havi Bér Rögzítése és Automatikus Bérkalkuláció
- **Hogy hívják:** „Bér rögzítése” gomb és számfejtő űrlap
- **Mire való:** Egy adott dolgozó havi bérének, pótlékainak és jutalékainak felvitele a levonások és közterhek automatikus kiszámításával.
- **Hol található a felületen:** A fejléc jobb szélén található kék **„Bér rögzítése”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Bér rögzítése”** gombra.
  2. Válassza ki a munkavállalót a listából (vagy adjon hozzá új dolgozót névvel és adóazonosítóval).
  3. Adja meg a tárgyhónapot és a bruttó alapbért (pl. 600 000 Ft).
  4. Adjon hozzá esetleges túlórapótlékot vagy bónuszt.
  5. A rendszer azonnal kiszámítja a 15% SZJA-t, a 18,5% TB járulékot, a nettó bért és a 13% munkáltatói Szocho-t.
  6. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** A tétel rögzül a havi bérlistában, és bekerül a cég munkaerőköltségei közé.

### 3.3 Munkavállalói Kártyák és Digitális Bérlap (PDF) Kezelése
- **Hogy hívják:** Munkavállalói sávok és „Bérlap letöltése” gomb
- **Mire való:** Alkalmazottankénti havi részletezés megtekintése, bérlapok csatolása vagy hivatalos PDF bérjegyzék generálása.
- **Hol található a felületen:** A képernyő középső munkaterületén, a dolgozók soraiban.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a munkavállaló sorára a kártya kibontásához.
  2. Tekintse át a bruttó-nettó levezetést, a FEOR kódot és a jogviszony típusát.
  3. Ha külső bérszámfejtő PDF lapját szeretné csatolni, kattintson a **„Fájl feltöltése”** gombra.
  4. Hivatalos letölthető bérlapért kattintson a **„Bérjegyzék (PDF)”** gombra.
  - **Eredmény:** A munkavállaló számára átadható, aláírásra alkalmas hivatalos havi bérlap áll rendelkezésre.

### 3.4 Adókedvezmények Érvényesítése
- **Hogy hívják:** „Adókedvezmények kezelése” panel
- **Mire való:** A törvényes adóalap- és adókedvezmények beállítása (25 év alatti fiatalok kedvezménye, Családi kedvezmény az eltartottak száma szerint, Első házasok kedvezménye, Személyi kedvezmény).
- **Hol található a felületen:** A dolgozó adatlapján a **„Kedvezmények”** fül alatt.
- **Hogyan használhatja a felhasználó:**
  1. Nyissa meg a dolgozó szerkesztési ablakát.
  2. Jelölje be az érvényesíteni kívánt kedvezményeket (pl. *3 eltartott gyermek családi kedvezménye*).
  3. Kattintson a **„Kalkuláció frissítése”** gombra.
  - **Eredmény:** A számológép automatikusan csökkenti az SZJA vagy a TB járulék levonását, növelve a dolgozónak kifizetendő nettó jövedelmet.

### 3.5 NAV Havi Járulékösszesítő Táblázat
- **Hogy hívják:** „NAV Járulékösszesítő (08-as analitika)”
- **Mire való:** A NAV felé hó 12-ig benyújtandó havi 08-as adó- és járulékbevallás ellenőrzése, valamint a pontos kincstári adószámlaszámokra utalandó összegek tételes listája.
- **Hol található a felületen:** A képernyő alsó harmadában található kék fejléces összefoglaló tábla.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át az adónemenként felsorolt sorokat:
     - *103-as adónem:* Személyi jövedelemadó (SZJA).
     - *124-es adónem:* Munkavállalói TB járulék.
     - *258-as adónem:* Szociális hozzájárulási adó (Szocho).
  2. Hasonlítsa össze az összegeket a bérszámfejtési feladással.
  - **Eredmény:** Pontos, hibamentes alap a havi adóhatósági átutalásokhoz.

### 3.6 Bérkifizetési Banki Utalási Lista
- **Hogy hívják:** „Bérutalási csomag export” gomb
- **Mire való:** A munkatársak bankszámláira utalandó nettó fizetések kötegelt átutalási állománnyá (GIRO fájl) formálása.
- **Hol található a felületen:** A fejléc export menüjében: **„Bérutalás GIRO”**.
- **Hogyan használhatja a felhasználó:**
  1. Ellenőrizze, hogy minden dolgozónál rögzítve van-e a bankszámlaszám.
  2. Kattintson a **„Bérutalás GIRO”** gombra.
  3. Mentse el az exportált banki fájlt és töltse be a vállalati netbankba.
  - **Eredmény:** A cég egyetlen kattintással és jóváhagyással elutalhatja az összes munkatárs havi fizetését.
