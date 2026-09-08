# Éves Beszámoló és Kiegészítő Melléklet

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Könyvelés** csoportban található: **Beszámoló** (vagy **Éves beszámoló**).
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/annual-report`
- **Jogosultság:** Cégtulajdonos, adminisztrátor, pénzügyi vezető és könyvelő.

---

## 2. A menü funkciója és célja
Az **Éves Beszámoló** modul a kettős könyvvitelt vezető gazdasági társaságok (Kft., Zrt., Bt., Kkt.) számára biztosítja a törvényben kötelezően előírt éves számviteli beszámoló, a kiegészítő melléklet, valamint az eredményfelosztási és osztalékfizetési taggyűlési határozat előkészítését és lezárását.

### Fő feladatai:
- **Hatlépéses auditált beszámolási munkafolyamat:** Lépésről lépésre vezeti végig a könyvelőt és a cégvezetőt a beszámoló összeállításán.
- **Mérleg és Eredménykimutatás integráció:** A lezárt üzleti év mérlegének és eredménykimutatásának automatikus beemelése.
- **Számviteli és matematikai validációs motor:** Szigorú összefüggés-vizsgálat (Mérlegegyezőség, Eredménykimutatás és Mérleg adózott eredményének azonossága, Saját tőke megfelelőség a jegyzett tőkéhez képest).
- **Intelligens Kiegészítő Melléklet generátor:** Szöveges indoklások, alkalmazotti létszám- és béradatok, tárgyi eszköz bruttó és nettó mozgástábla automatikus kitöltése.
- **Osztalékfizetési korlát kalkuláció (Ptk. és Sztv. szerint):** Vizsgálja, hogy a szabad eredménytartalék és a tárgyévi adózott eredmény lehetővé teszi-e az osztalék kifizetését a saját tőke sérelme nélkül.
- **Zárolás és OBR letétbe helyezési előkészítés:** A véglegesített beszámoló adatai zárolhatók, megakadályozva a visszamenőleges módosításokat.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Beszámoló Varázsló Lépésválasztó Sávja
- **Hogy hívják:** Beszámoló folyamatjelző és lépésváltó sáv (1–6. lépés)
- **Mire való:** Strukturált, szekvenciális végigvezetés az éves zárás, a kiegészítő melléklet kitöltése és a közzététel teljes folyamatán.
- **Hol található a felületen:** A képernyő felső részén vízszintesen elhelyezkedő számozott lépéssor.
- **Hogyan használhatja a felhasználó:**
  1. Kövesse a lépéseket balról jobbra (1. Alapadatok → 2. Adatimport → 3. Validáció → 4. Melléklet → 5. Határozat → 6. Lezárás).
  2. Bármikor visszakattinthat a korábbi, már kitöltött lépésekre a zöld pipával jelölt körökre kattintva.
  - **Eredmény:** Lépésről lépésre, kihagyás nélkül összeáll a teljes jogszabályi beszámoló csomag.

### 3.2 Alapadatok és Céginformációk Beállítása (1. Lépés)
- **Hogy hívják:** „Beszámoló alapadatok” űrlap
- **Mire való:** Az üzleti év kiválasztása, a cégjegyzéki és statisztikai adatok, képviselők, valamint a könyvvizsgálati kötelezettség törvényi feltételeinek rögzítése.
- **Hol található a felületen:** Az 1. lépés munkaterületén.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a lezárandó üzleti évet (pl. 2025 vagy 2026).
  2. Ellenőrizze az automatikusan betöltött cégadatokat (székhely, cégjegyzékszám, ügyvezető neve).
  3. Jelölje be a jelölőnégyzetet, ha a cég könyvvizsgálatra kötelezett (a rendszer az árbevétel és létszám alapján automatikus javaslatot is ad).
  4. Kattintson a **„Következő lépés”** gombra.
  - **Eredmény:** Az alapadatok rögzülnek a beszámoló fejlécében és a kiegészítő melléklet bevezetőjében.

### 3.3 Automatikus Mérleg és Eredmény Adatimport, Validáció (2–3. Lépés)
- **Hogy hívják:** „Adatok betöltése és Számviteli validációs motor”
- **Mire való:** A főkönyvi modulokból a véglegesített mérleg- és eredményszámok automatikus átemelése, valamint a számtani összefüggések (mérlegegyezőség, adózott eredmény azonosság, negatív tételek kizárása) ellenőrzése.
- **Hol található a felületen:** A 2. és 3. lépés felületén elhelyezkedő import gomb és ellenőrző táblázat.
- **Hogyan használhatja a felhasználó:**
  1. A 2. lépésben kattintson a **„Főkönyvi adatok beemelése”** gombra (vagy töltsön fel külső AuditXML fájlt).
  2. A 3. lépésben tekintse át a 8 pontos automatikus ellenőrzőlistát:
     - Eszközök = Források egyezősége (Zöld pipa)
     - Mérleg adózott eredménye = Eredménykimutatás adózott eredménye (Zöld pipa)
     - Saját tőke megfelelőség a jegyzett tőkéhez képest (Zöld pipa)
  3. Ha piros hiba jelenik meg, javítsa ki a könyvelésben a jelzett számlát, majd kattintson az **„Újraellenőrzés”** gombra.
  4. Kattintson a **„Következő lépés”** gombra.
  - **Eredmény:** Hibátlan számszaki alapok a kiegészítő melléklethez.

### 3.4 Kiegészítő Melléklet Intelligens Szerkesztője (4. Lépés)
- **Hogy hívják:** „Kiegészítő melléklet varázsló” és táblázatkezelő
- **Mire való:** A Számviteli törvény által kötelezően előírt szöveges indoklások, számviteli politika, eszközmozgás-táblázat (bruttó érték, ÉCS, nettó érték), létszám- és béradatok kitöltése.
- **Hol található a felületen:** A 4. lépés munkaterületén, blokkokra osztva.
- **Hogyan használhatja a felhasználó:**
  1. Válasszon az előre megírt jogi és számviteli sablonszövegekből (számviteli politika összefoglalása, alkalmazott leírási módszerek).
  2. Tekintse át a tárgyi eszközök mozgástábláját, amelyet a rendszer automatikusan feltölt a Tárgyi eszköz (TÉNY) modulból.
  3. Ellenőrizze a statisztikai állományi létszám és bérköltségek kimutatását (amelyet a bérszámfejtési modulból vesz át).
  4. Írja be az esetleges egyedi környezetvédelmi vagy K+F megjegyzéseket.
  5. Kattintson a **„Mentés és tovább”** gombra.
  - **Eredmény:** Teljeskörű, jogilag kifogástalan kiegészítő melléklet szöveg és számszaki melléklet jön létre.

### 3.5 Osztalékfizetési Korlát Kalkulátor és Határozat Készítő (5. Lépés)
- **Hogy hívják:** „Osztalék kalkulátor és Taggyűlési határozat készítő”
- **Mire való:** A Ptk. és az Sztv. szerinti szabad eredménytartalék és adózott eredmény alapján a maximálisan kifizethető osztalék kiszámítása, és a hivatalos taggyűlési határozat megfogalmazása.
- **Hol található a felületen:** Az 5. lépés képernyőjén.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a rendszer által kiszámított maximális osztalékkeretet.
  2. Adja meg a tulajdonosok által jóváhagyni kívánt tényleges osztalék összegét (vagy válassza a *„Nem fizet osztalékot, a teljes eredmény eredménytartalékba kerül”* opciót).
  3. Adja meg a taggyűlés napját és a jelenlévők adatait.
  4. Kattintson a **„Határozat generálása”** gombra.
  - **Eredmény:** Elkészül a hivatalos Taggyűlési Határozat tervezet a tulajdonosok aláírásához.

### 3.6 Hivatalos Beszámoló Csomag Exportálása és Üzleti Év Zárolása (6. Lépés)
- **Hogy hívják:** „Beszámoló csomag letöltése (PDF)” és „Üzleti év zárolása” gombok
- **Mire való:** Az OBR (Online Beszámoló Rendszer) feltöltéshez és az Igazságügyi Minisztérium felé történő letétbe helyezéshez alkalmas komplett PDF csomag összeállítása, valamint a könyvelés visszamenőleges módosításának letiltása.
- **Hol található a felületen:** A 6. lépés záró képernyőjén.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg az élő előnézetet a képernyőn (Mérleg, Eredménykimutatás, Kiegészítő melléklet, Határozat egyetlen fűzött dokumentumban).
  2. Kattintson a **„Teljes beszámoló letöltése (PDF)”** gombra.
  3. A tulajdonosi aláírás és az OBR feltöltés után kattintson az **„Üzleti év végleges zárolása”** gombra.
  - **Eredmény:** A rendszer letölti a hivatalos dokumentumot, és lezárja a könyvelési évet, így abba véletlenül sem kerülhet új vagy módosított tétel.
