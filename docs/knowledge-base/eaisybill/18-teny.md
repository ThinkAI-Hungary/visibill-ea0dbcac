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
- **Hol található a felületen:** Az eszköz adatlapjának jobb felső szélén lévő piros **„Kivezetés”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Nyissa meg az érintett eszköz adatlapját.
  2. Kattintson a **„Kivezetés / Selejtezés”** gombra.
  3. Válassza ki a kivezetés jogcímét: *Értékesítés*, *Selejtezés (tönkrement)*, *Káresemény / Lopás*, *Térítés nélküli átadás*.
  4. Adja meg a selejtezési bizottság tagjainak nevét és a kivezetés dátumát.
  5. Kattintson a **„Selejtezési jegyzőkönyv jóváhagyása”** gombra.
  - **Eredmény:** A rendszer legenerálja a selejtezési jegyzőkönyvet, és automatikusan lekönyveli a kivezetést a vegyes naplóban (86-os egyéb ráfordítás / 1-es eszközszámla).

### 3.6 Hivatalos Eszközkarton és Havi ÉCS Feladás Letöltése
- **Hogy hívják:** „Eszközkarton letöltése” és „Havi ÉCS feladás export”
- **Mire való:** Egyedi tárgyi eszköz analitikai nyilvántartó lap (karton) nyomtatása és a havi főkönyvi értékcsökkenési feladás átadása a könyvelésnek.
- **Hol található a felületen:** Az eszköz adatlapjának műveleti menüjében, illetve a listaoldal export gombjai között.
- **Hogyan használhatja a felhasználó:**
  1. Egyedi kartonhoz kattintson az eszköz lapján a **„Karton (PDF)”** gombra.
  2. Havi könyvelési záráshoz kattintson a listaoldalon az **„ÉCS feladás exportálása”** gombra.
  - **Eredmény:** Nyomtatható hivatalos eszközkarton és a főkönyvi vegyes könyvelésbe közvetlenül beolvasható amortizációs feladás.
