# Napló (Kettős Könyvviteli Zárt Naplók)

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Könyvelés** csoportban található: **Naplók** (vagy **Könyvviteli napló**).
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/journals`
- **Jogosultság:** Cégtulajdonos, adminisztrátor és könyvelő.

---

## 2. A menü funkciója és célja
A **Napló** modul a kettős könyvvitel időrendi elszámolását végzi a Számviteli törvény előírásai szerint szigorúan zárt, sorszámozott naplókban. Minden gazdasági esemény itt jelenik meg könyvelési tételként Tartozik és Követel számlákkal, összegekkel és bizonylati hivatkozásokkal.

### Fő feladatai:
- **Zárt naplók kezelése:**
  - *Vevő napló:* Kimenő értékesítési számlák könyvelési tételei (Vevők Tartozik / Árbevétel Követel + Fizetendő ÁFA Követel).
  - *Szállító napló:* Bejövő beszerzési számlák könyvelése (Költségnemek Tartozik + Levonható ÁFA Tartozik / Szállítók Követel).
  - *Bank napló:* Pénzintézeti jóváírások és terhelések átvezetése.
  - *Pénztár napló:* Készpénzes bevételek és kiadások tételei.
  - *Vegyes napló:* Értékcsökkenési leírások, bérfeladások, időbeli elhatárolások és technikai rendezések.
  - *Nyitó napló:* Előző évi mérlegzárás átvétele és nyitó egyenlegek rögzítése.
  - *Záró napló:* Év végi mérleg- és eredmény-zárási műveletek.
- **Könyvelési tételek életciklusa és státuszai:**
  - *Rendszer javaslat:* AI és szabályok által generált automatikus kontírozási tervezet.
  - *Piszkozat:* Kézzel összeállított, még nem élesített tétel.
  - *Jóváhagyásra vár:* Könyvelői ellenőrzést igénylő bejegyzés.
  - *Könyvelt:* Véglegesített, a főkönyvi kivonatba és mérlegbe beépült tétel.
  - *Sztornózott:* Érvénytelenített könyvelési tétel ellentétellel.
- **Időszaki zárolás:** Hónapok vagy üzleti évek lezárása, megakadályozva a lezárt időszakok utólagos módosítását.
- **Részletes könyvelési audit napló:** Minden könyvelési tétel módosításának, jóváhagyásának és törlésének időbélyegzett naplózása.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Naplótípus Választó Lapfülek és Státusz Szűrők
- **Hogy hívják:** Naplóválasztó fülcsoport (*Összes*, *Vevő*, *Szállító*, *Bank*, *Pénztár*, *Vegyes*, *Nyitó*)
- **Mire való:** A könyvelési tételek szűrése az Sztv. szerinti zárt alnaplók szerint, megelőzve a különböző típusú gazdasági események keveredését.
- **Hol található a felületen:** A fejléc alatti vízszintes fülsor.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kívánt napló fülére (pl. **„Vegyes napló”**).
  2. Szükség esetén használja a státusz szűrőt (pl. csak a *„Jóváhagyásra vár”* tételeket jelenítse meg).
  3. Tekintse át az adott napló szigorúan sorszámozott tételeit.
  - **Eredmény:** A táblázat azonnal leszűkül a kiválasztott zárt napló könyvelési bejegyzéseire.

### 3.2 Új Kézi Vegyes Könyvelési Tétel Rögzítése
- **Hogy hívják:** „Kézi könyvelési tétel” gomb és kontírozó ablak
- **Mire való:** Nem számlaalapú gazdasági események (pl. havi értékcsökkenés, bérfeladás, időbeli elhatárolás, kamatok) manuális kettős könyvvitel szerinti lekönyvelése.
- **Hol található a felületen:** A fejléc jobb felső sarkában lévő kék **„Új kézi tétel”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új kézi tétel”** gombra.
  2. Válassza ki a naplót (alapértelmezetten *Vegyes napló*), a könyvelési dátumot és a gazdasági esemény szöveges megnevezését.
  3. Írja be a Tartozik számlaszámot (pl. 571 Értékcsökkenési leírás) és a Követel számlaszámot (pl. 139 Műszaki berendezések terv szerinti ÉCS-je).
  4. Adja meg az összeget.
  5. Kattintson a **„Könyvelés véglegesítése”** gombra.
  - **Eredmény:** A rendszer kiadja az új sorszámot a naplóban, és a tétel azonnal megjelenik a főkönyvben és kartonokon.

### 3.3 Nyitó Napló Varázsló
- **Hogy hívják:** „Nyitó napló varázsló” gomb
- **Mire való:** Új cég indulásakor vagy évváltáskor az eszköz- és forrásszámlák nyitó egyenlegeinek rögzítése a Nyitómérleg számlával (491) szemben.
- **Hol található a felületen:** A **„Nyitó napló”** fül alatt lévő zöld **„Nyitó tételek felvitele”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Váltson a **„Nyitó napló”** fülre, majd kattintson a **„Nyitó tételek felvitele”** gombra.
  2. Töltse be az előző évi záró mérleg adatait kézzel vagy Excel táblázat beillesztésével.
  3. A rendszer automatikusan a 491-es Nyitómérleg számlával szemben kontírozza az eszközöket (T: 1-3 / K: 491) és a forrásokat (T: 491 / K: 4).
  4. Ellenőrizze, hogy a 491-es számla egyenlege pontosan 0 Ft-ra fut-e ki.
  5. Kattintson a **„Nyitás jóváhagyása”** gombra.
  - **Eredmény:** A tárgyév összes számlája megkapja a törvényes nyitó egyenlegét.

### 3.4 Tételek Ellenőrzése és Kötegelt Jóváhagyása
- **Hogy hívják:** Kijelölő négyzetek és „Kötegelt jóváhagyás” gomb
- **Mire való:** Az AI vagy szabályok által generált tervezeti tételek áttekintése és egyetlen kattintással történő véglegesítése.
- **Hol található a felületen:** A tételek táblázatának sorai mellett, és a táblázat feletti műveleti sávban.
- **Hogyan használhatja a felhasználó:**
  1. Szűrje le a táblázatot a **„Jóváhagyásra vár”** státuszra.
  2. Jelölje be a jóváhagyni kívánt tételeket (vagy az összeset a fejléc jelölőnégyzetével).
  3. Kattintson a zöld **„Könyvelés jóváhagyása”** gombra.
  - **Eredmény:** A tételek státusza azonnal átvált „Könyvelt”-re, és zárt státuszba kerülnek.

### 3.5 Hibás Könyvelési Tétel Sztornózása
- **Hogy hívják:** „Sztornó” gomb a műveleti menüben
- **Mire való:** A Számviteli törvény szerinti helyesbítés: a lekönyvelt tételt tilos fizikai törléssel eltüntetni, helyette a rendszer ellentétes előjelű stornó tételt generál az auditálhatóság megőrzésével.
- **Hol található a felületen:** A táblázat minden sorának végén lévő hárompontos műveleti menüben (**„Sztornózás”**).
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a hibás tételt a táblázatban.
  2. Kattintson a sor végén lévő hárompontos ikonra, és válassza a **„Sztornózás”** opciót.
  3. Adja meg a stornózás indokát (pl. *Téves összeg vagy rossz költséghely*).
  4. Kattintson a **„Sztornó megerősítése”** gombra.
  - **Eredmény:** Létrejön a pirossal jelölt ellentétel, amely nullázza a téves forgalmat, megőrizve a teljes könyvvizsgálati naplót.

### 3.6 Időszaki Zárolás (Könyvelési Lakat)
- **Hogy hívják:** „Időszak zárolása” gomb és lakat ikon
- **Mire való:** Lezárt adóidőszakok (pl. leadott ÁFA bevallású hónapok vagy lezárt üzleti év) zárolása, hogy senki ne tudjon véletlenül új számlát vagy módosítást rögzíteni a lezárt periódusba.
- **Hol található a felületen:** A fejléc jobb oldalán található lakat ikon.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Időszak zárolása”** gombra.
  2. Válassza ki a zárolás határdátumát (pl. a lezárt előző hónap utolsó napja).
  3. Kattintson a **„Zárolás élesítése”** gombra.
  - **Eredmény:** A határdátum előtti időszak zárolttá válik, a rendszer megakadályoz minden további könyvelési műveletet abban az intervallumban.
