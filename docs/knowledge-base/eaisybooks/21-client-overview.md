# 🏢 Ügyfél Áttekintés és Műszerfal (Client Overview)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Főmenü  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő, Bérszámfejtő), aki jogosult a cég kezelésére  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** A Portfólióból egy cég nevére kattintva a bal oldali menü legfelső eleme: **Áttekintés** menüpont (`/eaisybooks/:companyId/:dateRange/overview`).
- **Ikon:** Aktatáska / Műszerfal (`Briefcase`) ikon
- **Elérési útvonal:** Portfólió → Ügyfél kiválasztása → Áttekintés
- **Gyorsműveletek:** NAV Online Számla azonnali kétirányú szinkronizációja, hiányzó számlák bekérése az ügyféltől, zárási blokkoló tételek kezelése, határidők teljesítése

---

## 2. A menü funkciója és célja

Az **Ügyfél Áttekintés** az adott vállalkozás dedikált könyvelési operatív műszerfala. Itt futnak össze az ügyfél valós idejű NAV számlaadatai, banki egyenlegei, nyitott határidei és a havi zárást akadályozó blokkoló tételei.

### Fő feladatai és szerepe a könyvelési folyamatban:
1. **Valós idejű NAV kapcsolat:** Egyetlen gombnyomással lekéri a NAV szervereiről a bejövő (szállítói) és kimenő (vevői) számlákat a tárgyidőszakra.
2. **Zárási blokkoló tételek (Blocking Items) felderítése:** Automatikusan csoportosítja a hiányzó bizonylatokat (fedezetlen banki kiadások, hiányzó szállítói számlák, lezáratlan bérszámfejtés).
3. **Automatikus bizonylatbekérő e-mail indítás:** A hiánylistából egy kattintással professzionális bekérő levelet állít össze és küld a Jóváhagyó rendszerbe vagy közvetlenül az ügyfélnek.
4. **Határidő- és feladatkövetés:** Nyomon követi a cég adó- és bevallási határidőit, amelyek pipálással azonnal teljesítetté tehetők.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Céginformációs Fejléc és „Vissza a portfólióhoz” Gomb
- **Hogy hívják:** „Vissza a portfólióhoz” gomb (`ArrowLeft`), Cégfejléc és Adószám jelvény
- **Mire való:** Kilépés a cég kontextusából vissza a könyvelőirodai összesítőbe, valamint a cég alapvető azonosítóinak leolvasása.
- **Hol található a felületen:** A képernyő legfelső sávjában balra.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg a cég hivatalos nevét és 8 jegyű adószámát.
  2. Ha másik céggel kíván dolgozni, kattintson a bal oldali **„Vissza a portfólióhoz”** nyíl gombra.
  - **Eredmény:** A rendszer visszatér a Portfólió céglistájához.

### 3.2 „NAV Szinkronizáció most” Gomb
- **Hogy hívják:** „NAV Szinkronizáció” gomb (`RefreshCcw` forgó ikonnal)
- **Mire való:** A Nemzeti Adó- és Vámhivatal Online Számla rendszeréből az összes bejövő (szállítói) és kimenő (vevői) számla azonnali, valós idejű letöltése a tárgyhónapra.
- **Hol található a felületen:** A fejléc jobb oldalán elhelyezkedő kék akciógomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„NAV Szinkronizáció”** gombra.
  2. A gomb pörgő animációra vált a kapcsolat felépülése alatt.
  3. A rendszer lekéri a számlákat, lefrissíti a számlalistát és zöld megerősítő üzenetet küld: *„Sikeres NAV szinkronizáció! Az inbound és outbound számlák frissítése befejeződött.”*
  - **Eredmény:** A legfrissebb NAV számlák azonnal megjelennek a könyvelési listában.

### 3.3 Zárási Blokkoló Tételek (Blocking Items) Blokk
- **Hogy hívják:** Zárási akadályok kártyasor, Kategória jelvények és „Kihagyás” (Szem ikon) gomb
- **Mire való:** A havi könyvviteli és ÁFA zárást gátló problémák (hiányzó szállítói számla, igazolatlan pénzmozgás) tételes áttekintése és elhárítása.
- **Hol található a felületen:** A képernyő középső részén, a kiemelt figyelmeztető dobozban.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa át a blokkoló tételeket kategóriánként:
     - **Bejövő számlák:** Bankból kifizetett, de számlával nem fedezett tételek.
     - **Kimenő számlák:** NAV-ból még be nem érkezett vagy hibás számlák.
     - **Bankkivonatok:** Hiányzó havi bankszámlakivonat állományok.
     - **Bérszámfejtés:** Függőben lévő munkaidő-nyilvántartások.
  2. Kattintson az adott tétel sorára a részletek lenyitásához.
  3. Ha egy tétel indokoltan nem igényel számlát (pl. banki díj vagy adófizetés), kattintson a **Kihagyás** (áthúzott szem) ikonra.
  - **Eredmény:** A tétel kikerül a blokkoló listából, növelve a zárási készültséget.

### 3.4 Bizonylatbekérő E-mail Indítása az Ügyfélnek
- **Hogy hívják:** „Bizonylatbekérő küldése” gomb (`Mail` ikon)
- **Mire való:** A nyitott hiányzó tételekről azonnali, előre kitöltött e-mail összeállítása az ügyvezetőnek.
- **Hol található a felületen:** A blokkoló tételek dobozának jobb alsó sarkában.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Bizonylatbekérő küldése”** gombra.
  2. A rendszer összeállítja a hiányzó tételek táblázatát az ügyfél hivatalos kapcsolattartójának címezve.
  3. A jóváhagyási beállítástól függően a levél bekerül a Jóváhagyó rendszerbe, vagy azonnal elküldésre kerül.
  - **Eredmény:** Az ügyfél pontos listát kap a hiányzó bizonylatokról a feltöltési linkkel együtt.

### 3.5 Határidők és Teendők Kártya
- **Hogy hívják:** „Közelgő határidők” lista és Teljesítés gomb (zöld pipa)
- **Mire való:** A cég adózási és bérszámfejtési határidőinek (ÁFA bevallás, 08-as járulékbevallás, HIPA előleg) ellenőrzése és pipálása.
- **Hol található a felületen:** A jobb oldalsávban elhelyezkedő határidő-panel.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg a napokban esedékes határidőket és a hátralévő napok számát.
  2. A feladat elvégzése (pl. bevallás benyújtása) után kattintson a sor melletti **zöld Pipa gombra**.
  - **Eredmény:** A határidő teljesítettként archiválódik, és a rendszer zöld pipával nyugtázza a teendőt.

### 3.6 Manuális Hiányzó Tétel Rögzítése
- **Hogy hívják:** „+ Új tétel rögzítése” gomb és űrlap
- **Mire való:** Olyan egyedi hiányosság vagy kérés feljegyzése a céghez, amelyet a könyvelő vett észre.
- **Hol található a felületen:** A blokkoló tételek lista fejlécében lévő plusz jeles gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„+ Új tétel rögzítése”** gombra.
  2. Válassza ki a kategóriát, írja be a megnevezést és a prioritást (Alacsony, Közepes, Magas).
  3. Kattintson a mentésre.
  - **Eredmény:** A tétel megjelenik az ellenőrző listában és bekerül a következő bizonylatbekérő levélbe is.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Napi számla- és bankfrissítés egy adott ügyfélnél
1. A könyvelő belép a rábízott cég **Áttekintés** felületére.
2. Kattint a **„NAV Szinkronizáció”** gombra a tegnapi kimenő és bejövő számlák letöltéséhez.
3. Átnézi a blokkoló tételeket: látja, hogy a cégvezető 2 olyan kártyás vásárlást hajtott végre, amelyhez nem tartozik számla.
4. Rákattint a **„Bizonylatbekérő küldése”** gombra, így az ügyvezető azonnal megkapja az értesítést.

### 4.2 Hóvégi ÁFA zárás előtti ellenőrzés
1. A könyvelő kiválasztja a lezárandó hónapot.
2. Megvizsgálja a határidők kártyát (ÁFA bevallás esedékessége: 20-a).
3. Végigmegy a blokkoló tételeken, elvégzi az utolsó párosításokat, majd a feladat mellett a zöld pipára kattintva lezárja a havi ÁFA teendőt.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2007. évi CXXVII. törvény az általános forgalmi adóról (Áfa tv.):** Számlabefogadás, adólevonási jog érvényesítése kizárólag hiteles számla birtokában.
- **2017. évi CL. törvény az adózás rendjéről (Art.):** NAV Online Számla adatszolgáltatási kötelezettség és a bevallási határidők betartása.
- **2000. évi C. törvény a számvitelről (Sztv.):** Időszaki zárási kötelezettség, analitika és főkönyv egyeztetése.
