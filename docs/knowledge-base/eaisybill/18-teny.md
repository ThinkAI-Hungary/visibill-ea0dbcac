# 📦 TENY (Tárgyi Eszköz Nyilvántartás és Értékcsökkenés)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** HR & Eszközök  
> **Szükséges szerepkör:** Tulajdonos (Owner), Adminisztrátor, Pénzügyi munkatárs (Member)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** A **HR & Eszközök** csoport 3. menüpontja.
- **Ikon:** Csomag / Eszköz doboz ikon
- **Elérési útvonal:** TENY menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** Eszköz közvetlen megnyitása, leltárellenőrzés indítása

---

## 2. A menü funkciója és célja

A **TENY (Tárgyi Eszköz Nyilvántartó)** modul a vállalkozás tartós használatú befektetett eszközeinek (ingatlanok, műszaki berendezések, gépek, járművek, irodai és informatikai eszközök, immateriális javak) nyilvántartását, amortizációs tervének számítását és az év végi leltározást végzi a Számviteli törvény és a Társasági adó törvény (Tao tv.) előírásai szerint.

### Fő funkciók:
- **Eszközök aktiválása és egyedi azonosítása:** Eszközök bevételezése számla alapján, egyedi leltári szám (vonalkód) és gyári azonosító hozzárendelésével.
- **Kettős értékcsökkenési leírás (Számviteli vs. Adózási ÉCS):**
  - *Számviteli értékcsökkenés:* A várható hasznos élettartam és a maradványérték alapján kalkulált valós gazdasági elhasználódás (lineáris vagy teljesítményarányos leírás).
  - *Társasági adó szerinti leírás:* A Tao törvény szerinti leírási kulcsok alkalmazása az adóalap-csökkentő és növelő tételek levezetéséhez.
- **Kisértékű tárgyi eszközök:** Jogszabályi lehetőség az alacsony értékű eszközök üzembe helyezéskori 100%-os egyösszegű azonnali leírására.
- **Leltározási folyamat:** Éves fizikai leltár lefolytatása, leltári ív és selejtezési jegyzőkönyv előállítása.
- **Kivezetés és selejtezés:** Eszköz értékesítése, káresemény vagy fizikai elhasználódás miatti kivezetése a könyvekből a maradványérték elszámolásával.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Új Eszköz Felvétele és Aktiválása
- **Hogy hívják:** „Új eszköz aktiválása” gomb és bevételezési űrlap
- **Mire való:** Újonnan vásárolt beruházás, gép, gépjármű vagy informatikai eszköz felvétele a tárgyi eszköz állományba, számlához kapcsolása és leltári számmal való ellátása.
- **Hol található a felületen:** A fejléc jobb felső sarkában elhelyezkedő kék **„Új eszköz felvétele”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új eszköz felvétele”** gombra.
  2. Adja meg az eszköz megnevezését, kategóriáját (pl. *Informatikai eszköz*, *Gépjármű*, *Irodai bútor*), telephelyét és felelős személyét.
  3. Rendelje hozzá a beérkezett szállítói számlát (a rendszer automatikusan beemeli a bruttó bekerülési értéket).
  4. Adja meg a használatba vétel (aktiválás) napját és a választott leírási kulcsot (pl. évi 33% lineáris vagy 100% kisértékű azonnali leírás).
  5. Kattintson az **„Aktiválás és leltári szám generálása”** gombra.
  - **Eredmény:** Az eszköz megkapja egyedi azonosítóját, bekerül a nyilvántartásba, és automatikusan legenerálódik a többéves leírási terve.

### 3.2 Eszközlista Táblázat és Kategória Szűrők
- **Hogy hívják:** Tárgyi eszközök táblázata és állományszűrők
- **Mire való:** A cég meglévő eszközeinek áttekintése, keresés leltári szám vagy gyári azonosító alapján, bruttó és nettó könyv szerinti értékek követése.
- **Hol található a felületen:** A képernyő középső munkaterületén lévő interaktív táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Használja a felső kategória gombokat (*Összes*, *Gépek*, *Járművek*, *IT*, *Ingatlanok*).
  2. A keresőmezőbe írja be az eszköz nevét vagy a matricán lévő leltári számot.
  3. Tekintse át az oszlopokat: Bekerülési érték, Halmozott amortizáció, Záró nettó érték, Státusz.
  - **Eredmény:** Azonnali visszajelzés a cég vagyonáról és az eszközök elhasználtsági fokáról.

### 3.3 Kettős ÉCS Kalkulátor (Számviteli és Adózási Amortizáció)
- **Hogy hívják:** „Értékcsökkenési terv és Tao kalkulátor” lapfül
- **Mire való:** Az Sztv. szerinti számviteli értékcsökkenés (valós elhasználódás) és a Tao tv. szerinti adóalap-módosító leírás párhuzamos kiszámítása.
- **Hol található a felületen:** Az eszköz adatlapjának alsó részén elhelyezkedő amortizációs táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az eszköz sorára a részletes adatlap megnyitásához.
  2. Tekintse át az évenkénti ÉCS táblázatot.
  3. Szükség esetén állítson be tervezett maradványértéket (az az összeg, amennyiért az eszköz az élettartam végén várhatóan értékesíthető lesz).
  4. Rendkívüli káresemény esetén rögzítsen *Terv felüli értékcsökkenést*.
  - **Eredmény:** A rendszer automatikusan kalkulálja a havi könyvelési vegyes feladásokat és a társasági adóbevallás leírási sorait.

### 3.4 Fizikai Leltárellenőrzés és Jegyzőkönyv
- **Hogy hívják:** „Leltárellenőrzés” gomb és leltározó modul
- **Mire való:** Az éves kötelező fizikai leltár lefolytatása, az eszközök meglétének és műszaki állapotának ellenőrzése.
- **Hol található a felületen:** A fejlécben a statisztikai kártyák mellett lévő **„Leltár indítása”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Leltár indítása”** gombra.
  2. Válassza ki a vizsgált telephelyet vagy irodát.
  3. Járja végig a helyiséget, és a felületen jelölje be a megtalált eszközöket (*Fellelve: Ép / Sérült / Hiányzik*).
  4. A leltár végén kattintson a **„Leltárzárás és jegyzőkönyv készítése”** gombra.
  - **Eredmény:** Létrejön a hivatalos leltári ív és a leltárkülönbözeti jegyzőkönyv a könyvvizsgáló számára.

### 3.5 Eszköz Selejtezése és Kivezetése
- **Hogy hívják:** „Selejtezés / Kivezetés” funkció
- **Mire való:** Használhatatlanná vált, összetört, ellopott vagy értékesített eszköz törvényes kivezetése a könyvekből a maradványérték elszámolásával.
- **Hol található a felületen:** Az eszköz adatlapján a **„Kivezetés”** gomb; a jóváhagyó az **„Kivezetés elbírálása”** gombot látja, amíg a kérelem „Kivezetés jóváhagyásra vár” állapotban van.
- **Hogyan használhatja a felhasználó (kétlépéses, jóváhagyás-alapú):**
  1. Nyissa meg az érintett eszköz adatlapját, kattintson a **„Kivezetés”** gombra.
  2. Válassza ki a jogcímet: *Értékesítés*, *Selejtezés*, *Leltárhiány*, *Térítés nélküli átadás*; adja meg a dátumot és az indoklást (jogcím szerinti további mezőkkel).
  3. Küldje be a kérelmet – az eszköz „Kivezetés jóváhagyásra vár” jelvényt kap.
  4. A kijelölt könyvelő (vagy könyvelő nélküli cégnél a cégvezetés) megnyitja a jóváhagyó dialógust, ellenőrzi a könyvelési előnézetet (bruttó érték, halmozott ÉCS, nettó érték), letöltheti a **Jegyzőkönyv PDF**-et, majd **jóváhagyja** vagy **elutasítja** a kérelmet.
  - **Eredmény:** Jóváhagyáskor a rendszer egy tranzakcióban könyveli a kivezetést (pótlólagos ÉCS a kivezetés napjáig, halmozott ÉCS és bruttó érték kivezetése, a nettó érték a 861 vagy 869 számlára), és az eszköz „kivezetett” lesz. Ha az eszköz bruttó értéke még nincs a főkönyvben, a jóváhagyás nem lehetséges – előbb a **Rekonciliáció & Főkönyv** fülön kell az eszközt könyvelni.
  - **Fontos:** a jogosultság nélküli felhasználó csak megtekintheti a kérelmet. Értékesítésnél az ÁFA nincs kezelve (nettó ár); a kimenő számlát külön kell könyvelni.

### 3.5.1 Rekonciliáció & Főkönyv fül
- **Mire való:** a TENY analitika és a főkönyv (1x, 1x9, 161) eszközönkénti egyezőségét mutatja KPI kártyákkal és eltérés-okokkal; a **„Hiányzó tételek pótlása”** gombbal a még nem könyvelt eszközök kötegelten könyvelhetők.
- **Hol található:** Tárgyi eszközök oldal → **Rekonciliáció & Főkönyv** fül (`/teny?tab=reconciliation`), valamint a Főkönyv rekonciliációs nézet Tárgyi eszközök kártyájáról.

### 3.5.2 Fejlesztési tartalék riasztások
- A **Fejlesztési Tartalékok** fülön piros/sárga sáv jelzi a 3.–4. adóévben lejáró és a lejárt, fel nem használt tartalékokat becsült visszafizetéssel (9% társasági adó + késedelmi pótlék). **Tájékoztató becslés**, a tényleges kötelezettséget a bevallás határozza meg. Kivezetéskor elidegenítési tilalom figyelmeztetés jelenik meg a tartalékhoz kötött eszközöknél.

### 3.6 Hivatalos Eszközkarton és Havi ÉCS Feladás Letöltése
- **Hogy hívják:** „Eszközkarton letöltése” és „Havi ÉCS feladás export”
- **Mire való:** Egyedi tárgyi eszköz analitikai nyilvántartó lap (karton) nyomtatása és a havi főkönyvi értékcsökkenési feladás átadása a könyvelésnek.
- **Hol található a felületen:** Az eszköz adatlapjának műveleti menüjében, illetve a listaoldal export gombjai között.
- **Hogyan használhatja a felhasználó:**
  1. Egyedi kartonhoz kattintson az eszköz lapján a **„Karton (PDF)”** gombra.
  2. Havi könyvelési záráshoz kattintson a listaoldalon az **„ÉCS feladás exportálása”** gombra.
  - **Eredmény:** Nyomtatható hivatalos eszközkarton és a főkönyvi vegyes könyvelésbe közvetlenül beolvasható amortizációs feladás.

### 3.7 Tárolóhelyek, Felelősök, Kétnyelvű Átadás-Átvételi Nyilatkozat és Címkenyomtatás
- **Hogy hívják:** „Áthelyezés”, „Átadás-átvételi jegyzőkönyv (PDF)”, „Címkenyomtatás (Vonalkód & QR)”
- **Mire való:** Telephelyen belüli fizikai elhelyezés (épület/emelet/szoba), személyi felelős és költséghely kezelése az Mt. 179. § szerinti anyagi felelősségvállalási nyilatkozattal és ipari címkézéssel.
- **Hol található:** Az eszközkarton fejlécében és műveleti sávjában.
- **Hogyan használhatja:**
  1. **Áthelyezés:** Kattintson az **„Áthelyezés”** gombra, válassza ki az új tárolóhelyet (fa struktúra), felelőst és költséghelyet.
  2. **Átadás-átvételi jegyzőkönyv:** Mentés után a Timeline-on megjelenő eseményről tölthető le a kétnyelvű (magyar/angol) jogi nyilatkozat.
  3. **Címkenyomtatás:** A **„Címkenyomtatás”** gombra kattintva válasszon méretet (50×30 mm, 70×36 mm vagy A4 ív), és küldje közvetlenül nyomtatóra vagy töltse le SVG formátumban.

### 3.8 Mobilbarát Leltározó és Fordulónapi Leltárív (Sztv. 69. §)
- **Hogy hívják:** „Leltárellenőrzés” és „Leltárív exportálása”
- **Mire való:** Raktári vagy irodai fizikai leltározás okostelefon kamerával, azonnali fizikai állapot rögzítés (ép, sérült, selejt), és hivatalos 3 fős bizottsági leltárív generálás.
- **Hol található:** Tárgyi eszközök oldal → Leltározás fül / eszközkarton.
- **Hogyan használhatja:**
  1. Okostelefonon vagy táblagépen nyissa meg a leltározó dialógust és olvassa be a címkét a kamerával.
  2. Rögzítse az eszköz fizikai állapotát és az esetleges eltérést.
  3. A leltározási időszak végén kattintson a **„Leltárív letöltése”** gombra az analitikus Excel vagy aláírható PDF letöltéséhez.

### 3.9 Pályázati Projektek, Többforrásos Komponensek és ÉCS-arányos PIE Feloldás
- **Hogy hívják:** „Pályázatok” fül és „Komponensek” karton-nézet
- **Mire való:** Vissza nem térítendő támogatásból megvalósult eszközök és többforrásos alkatrészek nyilvántartása, a fenntartási időszak nyomon követése, és az Sztv. szerinti időszaki támogatási passzív időbeli elhatárolás (PIE) automatikus feladása a főkönyvbe (**T 483 → K 964**).
- **Hol található:** Tárgyi eszközök oldal → **Pályázatok** fül (`/teny?tab=grant_projects`), illetve az eszközkarton **Komponensek** füle.
- **Hogyan használhatja:**
  1. **Négyoldalú egyezőség:** A Pályázatok fül tetején lévő Zero-Error banner azonnal igazolja a Pályázati keret ↔ TÉNY analitika ↔ Főkönyv 964 ↔ Elhatárolás 483 közötti tökéletes egyensúlyt.
  2. **PIE Feloldás könyvelése és alszámla választás:** Kattintson a **„PIE Feloldás könyvelése”** gombra. A megjelenő párbeszédablakban a rendszer automatikusan felkínálja a cég számlatükrében szereplő 483-as (Tartozik) és 964-es (Követel) alszámlákat (pl. 4831 és 9641). Amennyiben egy alszámla hiányzik, sárga figyelmeztetés és közvetlen navigációs javaslat segíti a számlatükör kiegészítését. A gomb dupla kattintás elleni védelemmel (`in-flight mutex`) rendelkezik, megelőzve a párhuzamos könyvelést.
  3. **Többéves göngyölítés és kerekítési garancia:** A feloldott összeg soha nem haladhatja meg a projekt fennmaradó elhatárolását, és az utolsó leírási időszakban a rendszer automatikusan kivezeti a kerekítési forintmaradványokat is.
  4. **Pályázati projektek törlési védelme:** Pályázati projektet nem lehet véletlenül törölni, amennyiben ahhoz tárgyi eszköz vagy részegység (komponens) kapcsolódik, vagy korábban már született rá főkönyvi PIE bizonylat. A megerősítő ablakban a Törlés gomb zárolt, és tájékoztató sáv jelzi az összefüggő tételeket.
  5. **Kivezetett eszközök részegység-zárolása:** Ha az eszköz kivezetett (selejtezett, eladott, hiányzó) állapotba kerül, a Komponensek fül zárolt módba vált: új részegység felvétele nem lehetséges, a meglévő komponensek nem szerkeszthetők és nem törölhetők („Zárolva” állapot), megőrizve a kivezetéskori audit állapotot.
