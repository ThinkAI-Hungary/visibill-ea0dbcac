# 🏛️ Cégkapu és KÜNY-tárhely Beállítások (Client Cégkapu Settings)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Beállítások  
> **Szükséges szerepkör:** Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő (adott céghez rendelt jogosultsággal)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a bal oldali menüben az aktív ügyfél-munkamenet alatt: **Beállítások / Cégkapu** menüpont.
- **Ikon:** Hivatal / Kormányzati kapu ikon (`Building2` / `Shield`)
- **Elérési útvonal:** eaisyBooks munkamenet -> Beállítások -> Cégkapu
- **Gyorsműveletek:** Állami tárhelykapcsolat ellenőrzése, KAÜ aláíró személy azonosítása és tesztelése, szinkronizációs gyakoriság konfigurálása, automatikus hatósági nyugta-kezelés aktiválása

---

## 2. A menü funkciója és célja

A **Cégkapu és KÜNY-tárhely Beállítások** modul a magyar hivatalos elektronikus ügyintézési rendszer (Cégkapu gazdasági társaságoknak, illetve Központi Ügyfél-regisztrációs Nyilvántartás / KÜNY-tárhely egyéni vállalkozóknak) hitelesített kapcsolatának és automatikus üzenetkezelésének adminisztrációs központja.

### Fő feladatai és jogszabályi háttere:
1. **Törvényi elektronikus kapcsolattartás (Eüsztv.):** Az elektronikus ügyintézésről szóló 2015. évi CCXXII. törvény alapján minden gazdálkodó szervezet és egyéni vállalkozó köteles hivatalos elérhetőséggel rendelkezni, és a hatóságok (NAV, KSH, bíróságok, önkormányzatok) ezen keresztül közlik határozataikat és folyószámla-értesítőiket.
2. **Központi Azonosítási Ügynök (KAÜ) integráció:** Támogatja az Ügyfélkapu+, a Digitális Állampolgárság Program (DÁP) és az elektronikus személyazonosító igazolvány (e-SZIG) hitelesítésű aláíró személyek hozzárendelését.
3. **Kézbesítési fikció megelőzése:** A Cégkapura érkező hatósági iratok átvételének elmulasztása jogvesztő hatású. A beállított automatikus szinkronizációval és riasztási gyakorisággal garantálható, hogy a könyvelőiroda határidőben értesüljön a hivatalos megkeresésekről.
4. **Tárhely-kapacitás folyamatos felügyelete:** Megelőzi a tárhely betelése miatti üzenet-visszapattanásokat.

---

## 3. Mit lehet benne a felhasználónak csinálni? (Funkciók részletes leírása)

### 3.1 Navigációs fejléc és „Vissza” gomb
- **Hogy hívják:** Vissza gomb (Balra nyíl ikon)
- **Mire való:** Lehetővé teszi az azonnali visszalépést az előző képernyőre vagy az adott ügyfél központi áttekintő műszerfalára.
- **Hol található a felületen:** A fejléc bal szélén, az ügyfél neve és az oldal címe előtt elhelyezkedő négyzet alakú gomb (`ChevronLeft`).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a fejléc bal szélén lévő **Vissza** nyíl gombra.
  - **Eredmény:** A rendszer visszairányítja a felhasználót a közvetlen előzmény oldalra vagy az ügyfél áttekintő oldalára.

---

### 3.2 Tárhely fül — Tárhely típusa választó kártyák
- **Hogy hívják:** Tárhely típusa (Cégkapu / KÜNY-tárhely opcióválasztó)
- **Mire való:** Meghatározza a jogi entitásnak megfelelő hivatalos tárhely formáját: gazdasági társaságok esetén Cégkapu, egyéni vállalkozók vagy magánszemélyek esetén KÜNY-tárhely alkalmazandó.
- **Hol található a felületen:** A **Tárhely** fül legfelső blokkjában, két nagy méretű interaktív kártya formájában.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **Tárhely** fülre.
  2. Válassza ki a cégformának megfelelő opciót:
     - **Cégkapu:** Kft., Zrt., Bt., Kkt. és egyéb társas vállalkozások esetén.
     - **KÜNY-tárhely:** Egyéni vállalkozók (EV) vagy egyéni cégek esetén.
  - **Eredmény:** A kiválasztott kártya kék keretet és kék hátteret kap, jelezve az aktív beállítást.

---

### 3.3 Tárhely fül — Tárhely-azonosító beviteli mező
- **Hogy hívják:** Tárhely-azonosító (10 jegyű numerikus azonosító)
- **Mire való:** A hivatalos állami regisztráció során kiosztott egyedi 10 jegyű tárhely azonosító rögzítése, amely alapján az API kapcsolat felépül.
- **Hol található a felületen:** A **Tárhely** fül második blokkjának bal felső beviteli mezője.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a tárhely pontos 10 számjegyű azonosítóját a mezőbe.
  2. A mező automatikusan kiszűri a nem numerikus karaktereket. Amennyiben a megadott kód hossza nem éri el a 10 számjegyet, piros figyelmeztetés jelenik meg: *„Pontosan 10 számjegyű azonosító szükséges”*.
  - **Eredmény:** Az érvényes 10 számjegyű kód rögzítésre kerül az űrlap állapotában.

---

### 3.4 Tárhely fül — Státusz legördülő menü
- **Hogy hívják:** Státusz választó
- **Mire való:** Rögzíti és jelzi a hivatalos tárhelykapcsolat jelenlegi állapotát a rendszerben.
- **Hol található a felületen:** A **Tárhely** fülön, a tárhely-azonosító mező mellett jobb oldalon.
- **Választható opciók:**
  - *Nem ellenőrzött:* Az azonosító rögzítve van, de még nem történt sikeres kapcsolatvizsgálat.
  - *Aktív:* A tárhely él, érvényes és kommunikációra kész.
  - *Hiba:* Sikertelen kapcsolódás, lejárt hozzáférés vagy hibás azonosító.
- **Hogyan használhatja a felhasználó:**
  1. Nyissa le a legördülő menüt, és válassza ki a kívánt állapotot az adminisztratív nyilvántartáshoz.
  - **Eredmény:** A tárhely státusza frissül, és mentés után az áttekintő nézeteken is megjelenik.

---

### 3.5 Tárhely fül — Cég neve a tárhelyen mező és Kapacitás mérő
- **Hogy hívják:** Cég neve a tárhelyen és Tárhely-kapacitás vizuális kijelző
- **Mire való:** Rögzíti a tárhely-regisztrációban hivatalosan szereplő céges elnevezést, valamint grafikusan mutatja a foglalt és szabad tárhely arányát megabájtban és százalékban kifejezve.
- **Hol található a felületen:** A **Tárhely** fül alsó részén.
- **Hogyan használhatja a felhasználó:**
  1. A **Cég neve a tárhelyen** mezőbe írja be a pontos hivatalos cégnevet.
  2. A kapacitássávon ellenőrizze a kihasználtságot:
     - 50% alatt: Zöld sáv (elegendő szabad hely).
     - 50–80% között: Sárga sáv (figyelmeztetés növekvő terhelésre).
     - 80% felett: Piros riasztási sáv (a tárhely hamarosan betelik, archiválás szükséges).
  - **Eredmény:** Megelőzhető a hivatalos iratok tárhelytelítettség miatti visszapattanása.

---

### 3.6 Aláíró (KAÜ) fül — Aláíró adatai és KAÜ-azonosító típusa
- **Hogy hívják:** Aláíró személy adatai és KAÜ-azonosító típusa választó
- **Mire való:** A cég nevében hivatalos elektronikus aláírásra és beküldésre jogosult természetes személy (ügyvezető vagy meghatalmazott könyvelő) rögzítése, valamint az állami azonosítási mód meghatározása.
- **Hol található a felületen:** Az **Aláíró (KAÜ)** fülön található beviteli űrlap.
- **Választható azonosítási típusok:**
  - *Ügyfélkapu+:* Kétlépcsős hitelesítéssel védett korszerű ügyfélkapu.
  - *DÁP (Digitális Állampolgárság Program):* Mobilalkalmazás alapú új nemzeti azonosítás.
  - *e-SZIG:* Elektronikus chipes személyi igazolvánnyal történő aláírás.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **Aláíró (KAÜ)** fülre.
  2. Töltse ki az **Aláíró neve** mezőt (pl. *Kovács Péter*).
  3. A **KAÜ-azonosító típusa** legördülő menüből válassza ki a megfelelő hitelesítési módot.
  4. A **KAÜ azonosító** mezőbe írja be az aláíró hivatalos kódját.
  - **Eredmény:** A rendszer rögzíti az elektronikus ügyintézéshez rendelt felelős aláíró adatait.

---

### 3.7 Aláíró (KAÜ) fül — „Aláíró tesztelése” gomb
- **Hogy hívják:** Aláíró tesztelése (Lombik ikon)
- **Mire való:** Ellenőrzi, hogy a megadott aláíró adatok és az azonosító megfelelnek-e a formai és kapcsolati követelményeknek.
- **Hol található a felületen:** Az **Aláíró (KAÜ)** fül jobb alsó sarkában elhelyezkedő tesztgomb (`TestTube`).
- **Hogyan használhatja a felhasználó:**
  1. Győződjön meg arról, hogy az aláíró neve ki van töltve.
  2. Kattintson az **„Aláíró tesztelése”** gombra.
  3. A gomb pörgő töltési animációt jelenít meg (*„Tesztelés...”*).
  - **Eredmény:** Sikeres ellenőrzés után zöld pipa és felirat jelenik meg mellette: **„Sikeres”**, valamint felugró értesítés nyugtázza a folyamatot: *„Teszt sikeres — Az aláíró személye ellenőrizve.”*

---

### 3.8 Szinkronizáció fül — Polling gyakoriság választó
- **Hogy hívják:** Polling gyakoriság (Lekérdezési időközök)
- **Mire való:** Beállítja, hogy a háttérrendszer milyen időközönként kérdezze le a Cégkapu tárhelyet új beérkező hivatalos határozatok, levelek és adószámla-értesítők után kutatva.
- **Hol található a felületen:** A **Szinkronizáció** fül felső részén található gombcsoport.
- **Választható időközök:**
  - **15 perc:** Kiemelt adózók és nagy forgalmú cégek esetén, azonnali határidős reakcióhoz.
  - **30 perc:** Általános könyvelési ajánlott beállítás.
  - **1 óra:** Kis forgalmú, alacsony bizonylatszámú társaságok esetén.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **Szinkronizáció** fülre.
  2. Válassza ki a kívánt intervallumot (15 perc / 30 perc / 1 óra).
  - **Eredmény:** A kiválasztott időtartam gombja kék kiemelést kap, és a szerver automatikusan ennek megfelelő ütemezéssel futtatja a háttérszinkront.

---

### 3.9 Szinkronizáció fül — „Automatikus nyugta-feldolgozás” kapcsoló és Időbélyeg
- **Hogy hívják:** Automatikus nyugta-feldolgozás kapcsoló és Utolsó szinkronizáció állapotjelző
- **Mire való:** Engedélyezi, hogy a rendszer a hatósági iratok letöltésekor automatikusan kiállítsa és visszaküldje a hivatalos tértivevény/átvételi igazolást, valamint kijelzi a legutóbbi sikeres lekérdezés pontos idejét.
- **Hol található a felületen:** A **Szinkronizáció** fül jobb oldalán lévő csúszókapcsoló, valamint az alatta megjelenő szürke időbélyeg sor.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **Automatikus nyugta-feldolgozás** kapcsolóra (zöld: bekapcsolva, szürke: kikapcsolva).
  2. Ellenőrizze az **Utolsó szinkronizáció** sorban látható pontos dátumot és időt.
  - **Eredmény:** Bekapcsolt állapotban az iratok átvétele és iktatása zökkenőmentesen, emberi beavatkozás nélkül megtörténik.

---

### 3.10 Alsó műveleti sáv — „Mégse” és „Mentés” gombok
- **Hogy hívják:** Mégse és Mentés gombok
- **Mire való:** A módosított beállítások jóváhagyása és végleges elmentése az adatbázisba, vagy a módosítások elvetése és visszalépés.
- **Hol található a felületen:** A képernyő jobb alsó sarkában elhelyezkedő műveleti gombsáv.
- **Hogyan használhatja a felhasználó:**
  1. Az adatok módosítása után a **Mentés** gomb kék színre vált, jelezve a mentetlen változtatásokat.
  2. Kattintson a **„Mentés”** gombra.
  3. A rendszer a mentés ideje alatt töltési állapotot mutat (*„Mentés...”*), majd zöld felugró értesítést ad: *„Mentve — Cégkapu beállítások sikeresen mentve.”*
  4. Ha vissza kíván lépni mentés nélkül, kattintson a **„Mégse”** gombra.
  - **Eredmény:** Az új konfiguráció érvénybe lép a teljes könyvelőirodai munkamenetben.

---

## 4. Jogosultságok és Szerepkörök

| Szerepkör | Megtekintés | Tárhely módosítás | Aláíró tesztelése | Szinkronizáció állítása |
| :--- | :---: | :---: | :---: | :---: |
| **Irodavezető adminisztrátor** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Szenior könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő asszisztens** |  Teljes | ❌ Nem módosíthat |  Engedélyezett | ❌ Nincs |
| **Ügyfél (Cégvezető)** |  Megtekintés | ❌ Nincs | ❌ Nincs | ❌ Nincs |

---

## 5. Kapcsolódó jogszabályi és szakmai hivatkozások

- **2015. évi CCXXII. törvény az elektronikus ügyintézés és a bizalmi szolgáltatások általános szabályairól (Eüsztv.):**
  - **14. § (1):** A gazdálkodó szervezet köteles hivatalos elérhetőséggel (Cégkapu tárhellyel) rendelkezni.
  - **15. § (2):** A kézbesítési fikció szabályai: a hatósági dokumentum kézbesítettnek minősül a második értesítést követő ötödik munkanapon, még akkor is, ha a címzett nem nyitotta meg.
- **451/2016. (XII. 19.) Korm. rendelet az elektronikus ügyintézés részletszabályairól:**
  - A Központi Azonosítási Ügynök (KAÜ) használatának és a biztonságos kézbesítési szolgáltatásnak a technikai követelményei.
