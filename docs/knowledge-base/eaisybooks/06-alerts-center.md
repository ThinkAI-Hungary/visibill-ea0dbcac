# 🚨 Riasztások Központ és NAV Határidők (Alerts Center & NAV Deadlines)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Portfólió  
> **Szükséges szerepkör:** Irodavezető adminisztrátor, Szenior könyvelő  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Portfólió** csoport menüpontja.
- **Ikon:** Figyelmeztető háromszög ikon (`AlertTriangle` / `Bell`)
- **Elérési útvonal:** Riasztások menüpont a navigációs sávban (`/eaisybooks/alerts`)
- **Gyorsműveletek:** Kritikus riasztások azonnali elhárítása, közvetlen navigálás az ügyfél adatlapjára, riasztások elutasítása vagy megoldottnak jelölése

---

## 2. A menü funkciója és célja

A **Riasztások Központ** a könyvelőiroda proaktív riasztási és eseménykezelő felülete, amely valós időben figyeli a portfólióban lévő vállalkozások összes jogi, technikai, adózási és pénzügyi határidejét, valamint a NAV rendszerek felől érkező kritikus jelzéseket.

### Fő feladatai és szerepe a kockázatkezelésben:
1. **NAV Határidő Riasztások:** A közeledő adó- és járulékbevallási határidők (5 napon belül, lejárt határidők) kiemelt, sürgősségi riasztása az érintett cégek és bevallástípusok (2658, KATA, HIPAK) megjelölésével.
2. **Technikai és integrációs vészjelzések:**
   - Lejárt vagy hiányzó NAV technikai felhasználói kapcsolat.
   - Megszakadt banki kapcsolat vagy sikertelen szinkronizáció.
   - Cégkapu hozzáférési hiba vagy hiányzó meghatalmazás.
3. **Adókockázati vészjelzések:**
   - KATA bevételi keret (18 millió Ft) közeledése vagy átlépése.
   - Egy partnertől származó 3 millió Ft-os KATA partnerlimit megközelítése (40%-os adóteher elkerülése).
   - Alanyi adómentes (AAM) keret (12 millió Ft) túllépési veszélye.
   - Házipénztár törvényi készpénzállományi korlátjának túllépése.
4. **Intelligens státuszkezelés és archiválás:** A kezelt feladatok egy gombnyomással megoldottá tehetők, az irreleváns tételek elutasíthatók, miközben az archivált tételek bármikor visszakereshetők.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Statisztikai Állapotkártyák (KPI Összegző)
- **Hogy hívják:** Kritikus, Figyelmeztetés, Tájékoztató, Megoldva számlálókártyák
- **Mire való:** Azonnali, egy pillantással átlátható számszaki képet ad az iroda teljes ügyfélkörében fennálló nyitott kockázatokról, súlyossági szintek szerint csoportosítva.
- **Hol található a felületen:** A képernyő tetején, a fejléc alatt elhelyezkedő 4 darab színes információs kártya (piros, borostyánsárga, kék, zöld).
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a piros „Kritikus” dobozt a legsürgősebb, azonnali beavatkozást igénylő teendők számának felméréséhez.
  2. Nézze meg a borostyánsárga „Figyelmeztetés” mezőt a közelgő (5 napon belüli) határidők ellenőrzésére.
  3. Kövesse a zöld „Megoldva” kártyán a munkatársak által az adott időszakban sikeresen elhárított feladatok számát.
  - **Eredmény:** Az irodavezető és a könyvelő azonnal fel tudja mérni a napi prioritásokat.

### 3.2 Szabadszavas Kereső és Kategória Szűrősáv
- **Hogy hívják:** „Keresés riasztásokban...” beviteli mező és Kategória választó fülek
- **Mire való:** Cégnevek, hibaüzenetek vagy adózási típusok szerinti szűrés a több tucatnyi riasztás közötti gyors tájékozódáshoz.
- **Hol található a felületen:** A statisztikai kártyák alatt, bal oldalon a keresőmező, jobb oldalán a horizontális szűrőgombok.
- **Hogyan használhatja a felhasználó:**
  1. Gépelje be a keresőmezőbe az érintett cég nevét, adószámát vagy a keresett kulcsszót (pl. „KATA”, „ÁFA”, „határidő”).
  2. Kattintson a kívánt kategória gombra a szűkítéshez:
     - **Mind:** Az összes aktív riasztás megjelenítése.
     - **NAV:** Kizárólag a NAV határidők és beküldési elakadások.
     - **Bank:** Banki egyenlegek és kivonathiányok.
     - **KATA:** KATA bevételi és partnerlimitek túllépési riasztásai.
     - **ÁFA:** Alanyi adómentes keret és ÁFA-bevallási figyelmeztetések.
     - **Beállítások:** Hiányzó beállítások és technikai hibák.
  - **Eredmény:** A riasztási lista azonnal lefrissül, csak az adott kategóriába tartozó vagy a keresési feltételnek megfelelő tételeket mutatva.

### 3.3 Archivált Riasztások Megjelenítése
- **Hogy hívják:** „Archivált mutatása” jelölőnégyzet
- **Mire való:** Lehetővé teszi a már megoldott vagy korábban elutasított riasztások visszakeresését és ellenőrzését.
- **Hol található a felületen:** A fejléc jobb felső sarkában, a cím és a kártyák felett.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az „Archivált mutatása” jelölőnégyzetre a bepipáláshoz.
  2. A lista kiegészül a halványított, áthúzott címmel megjelenő megoldott és elutasított tételekkel.
  3. A jelölőnégyzet újbóli megnyomásával visszatérhet a kizárólag aktív, megoldásra váró feladatok tiszta nézetéhez.
  - **Eredmény:** Teljes betekintés nyílik a korábbi intézkedések auditálható történetébe.

### 3.4 Riasztási Műveleti Kártyák és Intézkedések
- **Hogy hívják:** Riasztási tétel kártya, „Megtekint”, „Megoldva”, „Elutasít” és „Visszaállít” akciógombok
- **Mire való:** Az adott riasztás részletes leírásának megismerése, a hiba közvetlen helyszínére való navigálás, valamint a riasztás státuszának azonnali léptetése.
- **Hol található a felületen:** A fő képernyő középső részén sorakozó riasztási kártyák jobb felső és alsó sarkaiban.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa el a kártyán a cég nevét, a riasztás szintjét jelző ikont és a hiba pontos leírását.
  2. Ha a problémát a rendszerben kell elhárítani, kattintson az alsó sorban lévő **„Megtekint”** gombra. A rendszer azonnal az adott cég érintett felületére (pl. bevallások, KATA analitika, beállítások) irányítja át Önt.
  3. Ha elhárította a problémát, kattintson a zöld pipával jelölt **„Megoldva”** gombra. A tétel zöldre vált, és bekerül a megoldott tételek közé.
  4. Ha a figyelmeztetés alaptalan vagy tudatos döntés alapján nem igényel intézkedést, kattintson az **„Elutasít”** gombra.
  5. Ha egy korábban archivált riasztást újra aktívvá kíván tenni, az archivált nézetben kattintson a **„Visszaállít”** gombra.
  - **Eredmény:** A riasztás státusza valós időben frissül, nem terheli tovább a kollégák aktív feladatlistáját.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Reggeli határidő- és kockázatellenőrzés
1. A könyvelő a munkanap elején megnyitja a **Riasztások** menüt.
2. A piros **Kritikus** kártyára és a **NAV** fülre szűrve ellenőrzi, van-e olyan cég, amelynél aznap jár le bevallási határidő, vagy megszakadt a NAV Online Számla kapcsolata.
3. A kártyákon található **„Megtekint”** gombra kattintva azonnal az érintett cég bevallás-előkészítőjébe ugrik, befejezi a beküldést, majd visszatérve a **„Megoldva”** gombbal lezárja a riasztást.

### 4.2 KATA és Alanyi ÁFA keretfigyelés hóvégi záráskor
1. Hóvégi számlázási időszakban a könyvelő kiválasztja a **KATA** és **ÁFA** kategóriaszűrőket.
2. Áttekinti a 80-90%-os limitközelítési figyelmeztetéseket.
3. Ha egy egyéni vállalkozónál egy adott partner felé a forgalom közelíti a 3 millió Ft-ot, a könyvelő a **„Megtekint”** gombra kattintva leellenőrzi a partneri analitikát, és tájékoztatja az ügyfelet a 40%-os különadó elkerülése érdekében.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2017. évi CL. törvény az adózás rendjéről (Art.):** A bevallási határidők elmulasztásának szankciói (mulasztási bírság, adószám felfüggesztése).
- **2022. évi XIII. törvény a kisadózó vállalkozók tételes adójáról (új KATA):** 18 millió Ft-os éves bevételi keret és a kapcsolt/partneri limitek szabályozása.
- **2007. évi CXXVII. törvény az általános forgalmi adóról (Áfa tv.):** 12 millió Ft-os alanyi adómentes (AAM) értékhatár figyelése és az áttérés kötelezettsége.
- **2000. évi C. törvény a számvitelről (Sztv.):** Bizonylatmegőrzési és analitika-vezetési kötelezettségek megsértésének riasztásai.
