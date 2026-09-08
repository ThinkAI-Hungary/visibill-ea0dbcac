# 📊 Pénzügyi Analitika és Kimutatások (Analytics)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Elemzések / Kimutatások  
> **Szükséges szerepkör:** Tulajdonos, Adminisztrátor, Vezetőség, Könyvelő  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az **Elemzések / Kimutatások** blokk egyik menüpontja.
- **Ikon:** Oszlopdiagram / Grafikon ikon
- **Elérési útvonal:** Analitika menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** Nettó/bruttó szemlélet váltása, rétegek be- és kikapcsolása, havi összehasonlítás

---

## 2. A menü funkciója és célja

Az **Analitika** oldal a vállalkozás pénzügyi és gazdálkodási adatainak vizuális összefoglalója és döntéstámogató műszerfala.

### Fő feladatai és üzleti értéke:
1. **Éves forgalmi és cash-flow trendek:** Valós idejű aggregáció a számlaforgalom (kimenő bevételek és bejövő költségek), valamint a tényleges pénzmozgások (kifizetett szállítói számlák és kifizetett munkabérek) havi idősoros alakulásáról.
2. **Nettó vs. Bruttó szemléletmód:** Rugalmas átváltás a gazdasági eredményességet tükröző nettó forgalom és a fizetőképességet és likviditást meghatározó bruttó pénzáramlás között.
3. **Időszakos összehasonlító elemzés:** Az aktuális hónap vagy negyedév teljesítményének automatikus összevetése az előző hónappal és az előző év azonos időszakával (bázisidőszaki indexek és százalékos növekedési mutatók).
4. **ÁFA struktúra és adóteher vizsgálat:** A forgalom ÁFA kulcsonkénti (27%, 18%, 5%, 0%, AAM, TAM, fordított adózás) eloszlásának grafikus kimutatása az adófizetési kötelezettségek előrejelzéséhez.
5. **Devizaautomatizmus:** A devizás számlák a számla kibocsátási napjának hivatalos MNB devizaárfolyamán kerülnek forintosításra az egységes pénzügyi elemzéshez.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Nettó / Bruttó Szemléletmód Váltókapcsoló
- **Hogy hívják:** Nettó / Bruttó kapcsoló
- **Mire való:** Átváltás a gazdasági eredményességet (számviteli fedezetet) tükröző ÁFA nélküli nettó kimutatás, és a tényleges pénzforgalmat (likviditási tőkét) meghatározó bruttó szemlélet között.
- **Hol található a felületen:** A grafikon jobb felső sarkában elhelyezkedő kapcsoló.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kapcsolóra a **„Nettó”** vagy **„Bruttó”** állapot kiválasztásához.
  2. Tekintse át a grafikonokat és kártyákat, amelyek azonnal átszámolódnak a kiválasztott adónem-szemlélet szerint.
  - **Eredmény:** Azonnali perspektívaváltás a számviteli eredmény és a pénztárca-egyenleg között.

### 3.2 Megjelenítendő Rétegkapcsolók (Árbevétel, Költség, Bér)
- **Hogy hívják:** Adatréteg kapcsolók (*Árbevétel*, *Kifizetett költségek*, *Kifizetett bérek*)
- **Mire való:** Az egyes pénzügyi komponensek tetszőleges ki- és bekapcsolása a grafikonon a tisztább, fókuszáltabb elemzés érdekében.
- **Hol található a felületen:** A trendgrafikon feletti jelmagyarázat interaktív gombjai.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kikapcsolni kívánt kategória gombjára (pl. kattintson a lila *„Kifizetett bérek”* gombra).
  2. A grafikonról eltűnik a kiválasztott görbe/sáv, így kizárólag a bevételek és az egyéb költségek maradnak láthatók.
  3. Kattintson újra a rétegre a visszakapcsoláshoz.
  - **Eredmény:** Testreszabott, vizuálisan letisztult grafikon a vezetői prezentációkhoz.

### 3.3 Havi Bontású Interaktív Trendgrafikon és Értékbuborék
- **Hogy hívják:** „Forgalmi és cash-flow trendgrafikon”
- **Mire való:** Az éves szezonalitás, a havi bevételek, kiadások és a megmaradó nettó pénzügyi fedezet idősoros nyomon követése januártól decemberig.
- **Hol található a felületen:** A képernyő középső nagy grafikonfelületén.
- **Hogyan használhatja a felhasználó:**
  1. Mozgassa az egeret bármelyik hónap oszlopa vagy adatpontja fölé.
  2. A megjelenő információs ablakban olvassa le a pontos összegeket:
     - Havi értékesítési árbevétel (Ft)
     - Szállítóknak kifizetett költségek (Ft)
     - Átutalt bérköltségek (Ft)
     - Havi tiszta egyenleg (Ft)
  - **Eredmény:** Azonnal azonosítható a cég legsikeresebb és legköltségesebb hónapja.

### 3.4 Havi Időszakos Összehasonlító Panel
- **Hogy hívják:** „Időszakos összehasonlító kártya” és hónapválasztó
- **Mire való:** Egy tetszőleges hónap teljesítményének automatikus összevetése az előző hónappal (havi dinamika) és az előző év azonos hónapjával (éves bázis index).
- **Hol található a felületen:** A trendgrafikon melletti vagy alatti analitikai blokkban.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a vizsgálni kívánt hónapot a legördülő naptárból.
  2. Tekintse át a százalékos mutatókat és a színkódos nyilakat:
     - *Növekedés az előző hónaphoz képest* (pl. +18,4% zöld nyíllal).
     - *Növekedés az előző év azonos hónapjához képest* (pl. +42% bázisindex).
  - **Eredmény:** Pontos mérőszámok a vállalkozás növekedési üteméről a szezonalitási tényezők kiszűrésével.

### 3.5 ÁFA Kulcsok Szerinti Analitikai Diagram
- **Hogy hívják:** „ÁFA szerkezet oszlopdiagram”
- **Mire való:** A számlaállomány felbontása adókulcsok szerint (27%, 18%, 5%, 0%, AAM alanyi adómentes, TAM tárgyi mentes, fordított adózás), és az ÁFA fizetési teher előrejelzése.
- **Hol található a felületen:** Az oldal alsó harmadában elhelyezkedő ÁFA analitikai kártya.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át az adókulcsok arányát és a hozzájuk tartozó adóalapokat.
  2. Olvassa le a fizetendő és levonható adó becsült egyenlegét.
  - **Eredmény:** Előre látható a hónap vagy negyedév végén várható ÁFA kötelezettség.

### 3.6 Pénzügyi Analitika Exportálása (PDF / Excel)
- **Hogy hívják:** „Analitika exportálása” gomb
- **Mire való:** A vizuális grafikonok, havi számok és ÁFA megoszlások kimentése nyomtatható vezetői PDF jelentésbe vagy táblázatkezelőbe.
- **Hol található a felületen:** A képernyő jobb felső sarkában elhelyezkedő export gombok.
- **Hogyan használhatja a felhasználó:**
  1. Állítsa be a kívánt dátumtartományt és a Nettó/Bruttó nézetet.
  2. Kattintson az **„Export (PDF)”** vagy **„Export (Excel)”** gombra.
  - **Eredmény:** Letöltődik a komplett vezetői pénzügyi prezentációs csomag.
