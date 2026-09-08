# 📑 Számlák (Bejövő és Kimenő Bizonylatok)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Pénzügyek  
> **Szükséges szerepkör:** Tulajdonos, Adminisztrátor, Könyvelő, Pénzügyi munkatárs  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Pénzügyek** (vagy **Számlák**) blokkban: **Számlák** menüpont.
- **Ikon:** Számla / Bizonylat mappa ikon
- **Elérési útvonal:** Kattintson a bal oldali menüben a **Számlák** menüpontra.
- **Fő nézetek (Lapfülek a táblázat felett):**
  - **Összes bizonylat:** Minden kimenő és bejövő számla egyetlen közös listában.
  - **Bejövő számlák:** Beszállítói és alvállalkozói költségszámlák.
  - **Kimenő számlák:** A cég által kiállított vevői értékesítési számlák.
  - **Sztornó számlák:** Érvénytelenítő és helyesbítő számlapárok.

---

## 2. A menü funkciója és célja

A **Számlák** menüpont a vállalkozás számlázási és bizonylatkezelési központja, amely egyetlen konszolidált felületre gyűjti össze a NAV Online Számla rendszerből automatikusan letöltött és a manuálisan feltöltött bizonylatokat.

### Fő feladatai:
- **Kétoldalú számla-aggregáció:** A NAV Online Számla rendszeréből érkező adatok és a feltöltött eredeti PDF vagy képi bizonylatok automatikus összerendelése.
- **Többdimenziós szűrés és keresés:** Szűrés összegre, dátumra, devizára, fizetettségre, partnerre, projektre és kategóriára.
- **Számlatétel szintű főkönyvi kontírozás:** A számla tételeinek egyedi főkönyvi számhoz rendelése, a testvérbizonylatok közötti automatikus szinkronizációval.
- **Fizetettségi életciklus követése:** Teljesen fizetett, részben kiegyenlített, nyitott és lejárt számlák pontos nyilvántartása.
- **Sztornózási folyamatkezelés:** Módosító és érvénytelenítő számlák automatikus összerendelése és lezárása.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Számlatípus Lapfülek
- **Hogy hívják:** Lapfül-választó (*Összes*, *Bejövő*, *Kimenő*, *Sztornó*)
- **Mire való:** A számlaállomány szétválasztása forgalmi irány és jelleg szerint, az egyes kategóriák darabszámának azonnali kijelzésével.
- **Hol található a felületen:** A táblázat és a keresősáv felett vízszintesen elhelyezkedő gombsor.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kívánt fülre (pl. **„Bejövő számlák”** a költségek áttekintéséhez).
  2. **Eredmény:** A táblázat azonnal leszűkül a kiválasztott típusra, és a felső KPI kártyák a szűrt állomány összegeit mutatják.

### 3.2 Részletes Kereső és Szűrősáv
- **Hogy hívják:** Számla Kereső és Szűrőpanel
- **Mire való:** Bármely bizonylat másodpercek alatti megtalálása partnernév, számlaszám, összegtartomány, fizetettségi állapot vagy teljesítési dátum alapján.
- **Hol található a felületen:** A lapfülek alatt közvetlenül elhelyezkedő keresőmező és szűrőgombok.
- **Hogyan használhatja a felhasználó:**
  1. A szabadszavas keresőbe írja be a partner nevét vagy a számlaszám bármely részletét.
  2. A lenyíló szűrőkkel szűkíthet fizetettségi állapotra (*Kiegyenlített*, *Fizetésre vár*, *Késedelmes*), vagy adókulcsra (pl. *27%*).
  3. **Eredmény:** A táblázat gépelés közben, valós időben frissül.

### 3.3 Számlakép Megtekintése és Letöltése
- **Hogy hívják:** Számlakép Megtekintő (Nagyító / PDF ikon)
- **Mire való:** Az eredetileg kiállított vagy szkennelt számla hiteles vizuális előnézetének megjelenítése nagyítási és letöltési lehetőséggel.
- **Hol található a felületen:** A számlatáblázat minden soránál a bizonylatszám mellett vagy a sor végi műveleti gombok között.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a számla sorában a PDF ikonra vagy a számlaszámra.
  2. A felugró ablakban megjelenik a számla teljes képe.
  3. Használhatja a nagyítás / kicsinyítés gombokat, vagy a „Letöltés” gombbal lementheti a PDF állományt a saját gépére.

### 3.4 Tételek és Főkönyvi Kontírozás Munkalap
- **Hogy hívják:** Számla Részletező és Kontírozó Ablak
- **Mire való:** A számla tételsorainak áttekintése, mennyiségek, egységárak, ÁFA kulcsok vizsgálata és a főkönyvi számlaszámok rögzítése.
- **Hol található a felületen:** A számla sorára duplán kattintva, vagy a sor végi ceruza / szerkesztés gombbal nyitható meg.
- **Hogyan használhatja a felhasználó:**
  1. Nyissa meg a számla adatlapját.
  2. A „Tételek” fülön soronként ellenőrizze a tételeket.
  3. A főkönyvi mezőre kattintva a legördülő számlatükörből válassza ki a megfelelő számlaszámot (pl. *511 Anyagköltség*, *529 Szolgáltatás*).
  4. Kattintson a „Mentés” gombra.
  5. **Eredmény:** A tétel kontírozása elmentődik, és azonnal megjelenik a főkönyvi kivonatokban.

### 3.5 Fizetettség Kézi Rögzítése
- **Hogy hívják:** „Kifizetés rögzítése” funkció
- **Mire való:** Ha egy számla nem automatikus banki párosítással, hanem készpénzzel, magánszámláról vagy beszámítással lett kiegyenlítve, itt adható meg a manuális rendezés.
- **Hol található a felületen:** A számla részletező adatlapján a „Fizetettség” szekcióban, vagy a sor végi bankjegy ikonra kattintva.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a „Kifizetés rögzítése” gombra.
  2. Válassza ki a fizetési módot (*Készpénz*, *Banki átutalás*, *Bankkártya*, *Kompenzáció*).
  3. Adja meg a kifizetés dátumát és az összeget (részfizetés is rögzíthető).
  4. Kattintson a „Rögzítés” gombra.
  5. **Eredmény:** A számla állapota zöld „Kiegyenlített” jelzésre vált.

### 3.6 Lebegő Kötegelt Műveleti Sáv
- **Hogy hívják:** Tömeges Műveleti Sáv
- **Mire való:** Több számla egyidejű kijelölése és csoportos kezelése (tömeges kategóriaváltás, tömeges fizetettnek jelölés, tömeges Excel/PDF export).
- **Hol található a felületen:** Amikor a táblázat bal szélén lévő jelölőnégyzetekkel legalább egy számlát bepipálunk, a képernyő alján lebegő fekete sávként jelenik meg.
- **Hogyan használhatja a felhasználó:**
  1. Pipálja be a módosítani vagy exportálni kívánt számlákat a sor eleji négyzetekkel (vagy a fejléc négyzetével jelölje ki az összeset).
  2. Az alsó lebegő sávban kattintson a kívánt műveletre:
     - **„Kategória módosítása”**: Egységes költségkategória beállítása az összes kijelölt számlára.
     - **„Fizetettnek jelölés”**: Csoportos kiegyenlítés beállítása.
     - **„Exportálás”**: Kijelölt számlák letöltése Excel táblázatként vagy egybefűzött PDF csomagként.
