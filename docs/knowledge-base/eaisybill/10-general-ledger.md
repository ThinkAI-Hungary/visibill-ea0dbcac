# Főkönyv (Főkönyvi Kivonat és Kartonok)

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Könyvelés** csoportban található: **Főkönyv**.
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/general-ledger`
- **Fő nézetek (Fülek a képernyő tetején):**
  - **Főkönyvi kivonat:** Hierarchikus számlatükör Tartozik/Követel forgalommal és egyenlegekkel.
  - **Főkönyvi karton:** Egy adott számlaszámhoz tartozó bizonylatok és naplótételek időrendi listája.
  - **Időszaki összehasonlítás:** Tárgyidőszak és bázisidőszak számlaszintű összevetése.
- **Jogosultság:** Cégtulajdonos, adminisztrátor és könyvelő.

---

## 2. A menü funkciója és célja
A **Főkönyv** modul a kettős könyvvitelt vezető gazdasági társaságok legfontosabb számviteli munkafelülete, amely a Számviteli törvény (Sztv.) előírásai szerint biztosítja a gazdasági események szigorúan zárt, ellenőrzött főkönyvi számlák szerinti kimutatását.

### Fő feladatai:
- **Magyar számlatükör (1–9 számlaosztályok):** Eszközök (1–3), Források (4), Költségnemek (5), Ráfordítások (8) és Árbevételek (9) szintetikus és analitikus struktúrája.
- **Számlalap és karton kereső:** Bármely 3, 4 vagy 6 jegyű főkönyvi szám egyenlegének, nyitó tételeinek, időszaki Tartozik (T) és Követel (K) forgalmának azonnali lekérdezése.
- **Audit XML (SAF-T) import:** Külső könyvelőszoftverekből (pl. RLB60, Novitax, Kulcs-Soft, TenSoft, Nagy Machinátor) exportált AuditXML állományok beolvasása, előzményévek adatainak visszatöltése.
- **Mesterséges intelligencia által vezérelt automatikus kontírozás:** A számlák és banki tranzakciók gépi főkönyvi osztályozása.
- **Dátum-bázis választás:** Számviteli teljesítés dátuma vagy bizonylat kibocsátási kelte szerinti forgalmi lekérdezés.
- **Könyvelési státusz szűrés:** Minden tétel vagy kizárólag a véglegesen jóváhagyott könyvelési tételek bevonása.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Főkönyvi Kivonat Fa-struktúra és Számlaosztály Szűrők
- **Hogy hívják:** Főkönyvi számlatükör fastruktúra és szintetikus/analitikus váltó
- **Mire való:** A számlaosztályok (1–9) hierarchikus áttekintése, Tartozik és Követel egyenlegek, valamint a mérlegegyezőség ellenőrzése.
- **Hol található a felületen:** A **„Kivonat”** lapfülön, a képernyő középső nagy táblázatában.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a vizsgált időszakot a fejlécben.
  2. Válasszon a **„Szintetikus (3 jegyű)”** és az **„Analitikus (4–6 jegyű)”** nézet között a táblázat feletti kapcsolóval.
  3. Kattintson bármely főcsoport melletti nyílra a számlaszámok kibontásához (pl. 5. Költségnemek kibontása).
  4. Tekintse át a Tartozik és Követel forgalmakat, valamint a záróegyenlegeket.
  - **Eredmény:** Azonnal láthatóvá válnak az időszaki vagyon- és eredménymozgások, a táblázat alján pedig a rendszer igazolja a Tartozik = Követel egyezőséget.

### 3.2 Főkönyvi Karton Megnyitása és Bizonylatszintű Mélyfúrás
- **Hogy hívják:** „Karton megnyitása” funkció és Karton nézet fül
- **Mire való:** Egyetlen kiválasztott főkönyvi számla (pl. 381 Pénztár vagy 454 Szállítók) teljes időrendi történetének, nyitó egyenlegének, valamint valamennyi könyvelt tételének megtekintése az ellenszámlákkal.
- **Hol található a felületen:** A kivonat táblázatának bármely számlasorára kattintva, vagy a felső **„Karton nézet”** lapfülön.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a főkönyvi kivonat táblázatában a vizsgálni kívánt számlaszámra (vagy váltson a Karton fülre és írja be a számlaszámot a keresőbe).
  2. A képernyő átvált a karton nézetre, ahol időrendi sorrendben megjelenik a nyitó egyenleg és az összes tétel.
  3. Vizsgálja meg a könyvelési dátumot, az ellenszámlát, a bizonylatszámot és a megjegyzést.
  4. Kattintson bármely bizonylatszámra a kapcsolódó számla vagy banki tranzakció eredeti képének megnyitásához.
  - **Eredmény:** Teljeskörű ellenőrizhetőség és auditálhatóság a bizonylattól a főkönyvig.

### 3.3 Audit XML (SAF-T) Feltöltése és Adatimport
- **Hogy hívják:** „Audit XML feltöltése” gomb és varázsló ablak
- **Mire való:** Korábbi évekből vagy más könyvelőszoftverekből (RLB, Novitax, Kulcs-Soft stb.) exportált hatósági szabványos könyvelési XML betöltése, a korábbi könyvelési előzmények azonnali átemelése.
- **Hol található a felületen:** A fejléc jobb szélén található zöld **„Audit XML feltöltése”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Audit XML feltöltése”** gombra.
  2. Húzza be vagy tallózza be az előző szoftverből kimentett Audit XML fájlt.
  3. A rendszer ellenőrzi a séma érvényességét, és megjeleníti az importálandó számlatükröt és könyvelési tételeket.
  4. Kattintson az **„Importálás jóváhagyása”** gombra.
  - **Eredmény:** A korábbi évek könyvelése és számlatükre bekerül az adatbázisba, biztosítva a folytonos bázisidőszaki összehasonlítást.

### 3.4 Új Vegyes Könyvelési Tétel Rögzítése
- **Hogy hívják:** „Új vegyes tétel” gomb és kontírozó ablak
- **Mire való:** Nem számlához és nem közvetlen banki tételhez kapcsolódó könyvelési tételek felvitele (pl. bérfeladások, havi értékcsökkenés, időbeli elhatárolások, év végi zárás/nyitás).
- **Hol található a felületen:** A fejléc jobb oldalán lévő **„+ Új vegyes tétel”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„+ Új vegyes tétel”** gombra.
  2. Adja meg a könyvelési dátumot és a bizonylat szöveges leírását (pl. *2026. márciusi bérfeladás*).
  3. Adja meg a Tartozik számlaszámot (pl. 541 Bérköltség) és a Követel számlaszámot (pl. 471 Jövedelemelszámolási számla).
  4. Írja be az összeget.
  5. Szükség esetén kattintson a *„További sor hozzáadása”* gombra összetett könyvelési tételeknél.
  6. Kattintson a **„Könyvelés mentése”** gombra.
  - **Eredmény:** A vegyes tétel azonnal beépül a főkönyvbe és a kartonokra.

### 3.5 Mesterséges Intelligencia Kontírozási Asszisztens Futtatása
- **Hogy hívják:** „AI Kontírozás futtatása” gomb
- **Mire való:** A számlatükörben még be nem sorolt vagy félkönyvelt számlák gépi tanuláson alapuló automatikus főkönyvi osztályozása.
- **Hol található a felületen:** A fejléc műveleti sávjában található csillag/robot ikonnal jelölt **„AI Kontírozás”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„AI Kontírozás”** gombra.
  2. A felugró ablakban válassza ki a feldolgozandó időszakot.
  3. Tekintse át a javasolt főkönyvi számlákat és a hozzájuk rendelt megbízhatósági pontszámot (pl. 98%-os biztonsággal irodaszer 512).
  4. Kattintson a **„Javaslatok elfogadása”** gombra.
  - **Eredmény:** A rendszer kötegelten lekönyveli a számlákat a megfelelő 5-ös, 8-as vagy 9-es számlaosztályokba.

### 3.6 Hivatalos Főkönyvi Kivonat Exportálása
- **Hogy hívják:** „Export (PDF / Excel)” gombok
- **Mire való:** Hivatalos, pecsételhető főkönyvi kivonat generálása banki hiteligényléshez, könyvvizsgálathoz vagy NAV adóellenőrzéshez.
- **Hol található a felületen:** A táblázat jobb felső szélén elhelyezkedő export gombok.
- **Hogyan használhatja a felhasználó:**
  1. Állítsa be a dátumszűrőt a kívánt fordulónapra (pl. Q1 zárás vagy éves forduló).
  2. Kattintson az **„Excel export”** gombra a további táblázatos elemzésekhez, vagy a **„PDF letöltés”** gombra a hivatalos nyomtatványhoz.
  - **Eredmény:** Letöltődik a céges adatokkal, fordulónappal és könyvelői záradékkal ellátott dokumentum.
