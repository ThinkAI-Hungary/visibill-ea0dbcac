# ⚠️ Ügyfél Hiányzó Számlák Kezelése (Client Missing Invoices)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Bizonylatok  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő), aki jogosult a cég kezelésére  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a kijelölt cég bal oldali menüjében a **Bizonylatok** csoportban: **Hiányzó számlák** menüpont (`/eaisybooks/:companyId/:dateRange/missing-invoices`).
- **Ikon:** Figyelmeztető bizonylat (`FileWarning`) ikon
- **Elérési útvonal:** Portfólió → Ügyfél kiválasztása → Hiányzó számlák
- **Gyorsműveletek:** Bizonylatbekérő e-mail összeállítása portál linkkel, tömeges jóváhagyó sorba küldés, kézi hiányzó tétel felvétele, számla megoldottnak jelölése vagy figyelmen kívül hagyása

---

## 2. A menü funkciója és célja

Az **Ügyfél Hiányzó Számlák Kezelése** oldal az adott cég könyvelési zárását gátló, bizonylat nélküli banki és pénztári kiadásainak operatív felszámoló felülete. Segítségével a könyvelő közvetlenül kapcsolatba léphet az ügyféllel, biztosítva a számviteli törvény és az Áfa törvény szerinti bizonylati fegyelmet.

### Fő feladatai és szerepe a könyvelési zárásban:
1. **Bizonylathiányok tételes listája:** Azonosítja azokat a banki tételeket és tranzakciókat, amelyekhez a partner nem adott számlát, vagy az ügyvezető nem juttatta el a könyvelőhöz.
2. **Automatikus biztonságos portál link generálás:** A rendszer egyedi, biztonságos feltöltési hivatkozást készít az ügyfélnek, ahol az ügyvezető jelszó nélkül, közvetlenül a telefonjáról fotózva is feltöltheti a számlát.
3. **Jóváhagyó rendszerbe küldés:** Lehetővé teszi, hogy a kiküldendő bekérő levél átmenjen az irodai szenior ellenőrzésen a kiküldés előtt.
4. **Tranzakció feloldása és mellőzése:** Ha a tétel nem számlaköteles (pl. banki díj vagy NAV adóbefizetés), egyetlen gombnyomással feloldható vagy mellőzhető a listából.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Fejléc és Gyorsakció Gombok
- **Hogy hívják:** „Vissza” nyíl (`ChevronLeft`), Cég neve, „Előzmények” gomb (`History`) és „Új hiányzó számla” gomb (`Plus`)
- **Mire való:** Visszalépés a cég áttekintőjébe, a korábbi bizonylatbekérők történetének megtekintése, valamint új hiányzó tétel kézi rögzítése.
- **Hol található a felületen:** A képernyő legfelső fejlécében.
- **Hogyan használhatja a felhasználó:**
  1. A korábbi ügyféli e-mailek ellenőrzéséhez kattintson az **„Előzmények”** gombra.
  2. Új tétel manuális rögzítéséhez kattintson az **„Új hiányzó számla”** gombra.
  - **Eredmény:** Megnyílik a kérelmi előzmények panel vagy az új tétel felugró ablaka.

### 3.2 Hiányzó Bizonylat KPI Kártyák
- **Hogy hívják:** Hiánystatisztika kártyák (Összes hiányzó, Bejövő számlák, Kimenő számlák, Bankkivonatok, Becsült ÁFA kockázat)
- **Mire való:** A bizonylathiány számszaki mértékének és a levonatlan ÁFA kockázatának azonnali felmérése.
- **Hol található a felületen:** A fejléc alatt sorakozó színes kártyasor.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg az **Összes hiányzó** darabszámát.
  2. Olvassa le a **Becsült ÁFA kockázat** piros/borostyánsárga összegét: ez mutatja, mekkora ÁFA összeg nem vonható le a számlák hiánya miatt.
  - **Eredmény:** Pontos számszaki érvet kap az ügyfél felé a bizonylatok sürgős pótlására.

### 3.3 Szűrősáv és Keresőmező
- **Hogy hívják:** „Keresés leírás, partner...” mező, Kategória és Dátum szűrők
- **Mire való:** A hiányzó tételek szűrése partnernév, banki közlemény vagy összeg szerint.
- **Hol található a felületen:** A KPI kártyák alatt elhelyezkedő szűrősáv.
- **Hogyan használhatja a felhasználó:**
  1. Gépelje be a partner nevét a keresőbe (pl. „MOL”, „Google”).
  2. A kategória szűrővel válassza ki a vizsgált bizonylattípust.
  - **Eredmény:** A táblázat csak a keresési feltételnek megfelelő tételeket mutatja.

### 3.4 Hiánylista Táblázat és Eseti Műveletek
- **Hogy hívják:** Hiánylista táblázat sorai, „Megoldva” (zöld pipa) és „Mellőzés” (szem) ikonok
- **Mire való:** A hiányzó banki kiadások áttekintése és státuszuk azonnali módosítása.
- **Hol található a felületen:** A képernyő középső részén lévő táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a banki kiadás dátumát, partnerét, közleményét és bruttó forintösszegét.
  2. Kattintson a sorra az **Adatlap (`InvoiceDetailModal`)** megnyitásához, ahol közvetlenül feltöltheti a számla PDF-jét.
  3. Ha az ügyfél pótolta a számlát, kattintson a **Megoldva** zöld pipára.
  4. Ha a tétel nem számlaköteles tranzakció, kattintson a **Mellőzés** ikonra.
  - **Eredmény:** A tétel kikerül a nyitott hiánylistából.

### 3.5 Tömeges Kijelölés és „Bizonylatbekérő Jóváhagyásra Küldése”
- **Hogy hívják:** Sor eleji jelölőnégyzetek, Tömeges műveleti sáv (`MissingInvoicesBulkBar`) és „Bekérés jóváhagyásra küldése” gomb (`MailCheck`)
- **Mire való:** Több hiányzó tétel egyidejű kijelölése és hivatalos bekérő levél generálása.
- **Hol található a felületen:** A táblázat felett/alatt megjelenő lebegő műveleti sávban.
- **Hogyan használhatja a felhasználó:**
  1. Jelölje be a bekérni kívánt számlák jelölőnégyzetét (vagy a fejlécben jelölje ki az összeset).
  2. Kattintson a zöld **„Bekérés jóváhagyásra küldése”** gombra.
  3. A rendszer egyedi tokennel ellátott ügyfélkapu linket generál, összeállítja az e-mail piszkozatot, és átadja az iroda Jóváhagyó rendszerének (`Approval Queue`).
  - **Eredmény:** A levél a szenior könyvelő jóváhagyása után automatikusan elindul az ügyfélhez.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Hóvégi bizonylatbekérő kampány indítása
1. A könyvelő belép az ügyfél **Hiányzó számlák** oldalára.
2. A táblázat fejlécében bejelöli az összes hiányzó tételt.
3. Kattint a **„Bekérés jóváhagyásra küldése”** gombra.
4. A rendszer elkészíti a bizonylatbekérő e-mailt a generált portál linkkel, ahol az ügyvezető egyetlen kattintással pótolhatja a számlákat.

### 4.2 Nem számlaköteles banki díj kivezetése
1. A könyvelő a listában talál egy 4 200 Ft-os tételt „Banki számlavezetési díj” közleménnyel.
2. A sor végén rákattint a **Mellőzés** gombra.
3. A rendszer kiveszi a hiánylistából és átvezeti a banki költség főkönyvi számlára.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2007. évi CXXVII. törvény az általános forgalmi adóról (Áfa tv.) 120. §:** Az adólevonási jog tárgyi feltétele a hiteles számla birtoklása.
- **1996. évi LXXXI. törvény a társasági adóról (Tao tv.):** Nem a vállalkozási tevékenység érdekében felmerült költségek adóalap-növelő hatása bizonylat hiányában.
- **2000. évi C. törvény a számvitelről (Sztv.):** Bizonylati fegyelem elve.
