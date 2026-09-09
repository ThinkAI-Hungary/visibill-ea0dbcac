# 📤 Bizonylat Feltöltés és Dokumentumközpont (Manual Upload)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Fő navigáció / Műveletek  
> **Szükséges szerepkör:** Tulajdonos, Adminisztrátor, Könyvelő, Pénzügyi munkatárs (Feltöltési és feldolgozási joggal); Megtekintő szerepkör esetén a fájlelőzmények érhetők el  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** A **Műveletek** blokk kiemelt menüpontja.
- **Ikon:** Felhő / Feltöltés ikon
- **Elérési útvonal:** Feltöltés menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** Dokumentumok behúzása azonnali feldolgozásra, korábban feltöltött fájlok listája

---

## 2. A menü funkciója és célja

A **Feltöltés** modul a vállalkozás digitális iratbetekintő és feldolgozó kapuja, ahol a külső forrásból származó bizonylatok, szkennelt számlák, bankkivonatok, bérjegyzékek és egyéb számviteli dokumentumok bekerülnek az eaisyBill feldolgozási folyamatába.

### Fő feladatai és technológiai képességei:
1. **Többcsatornás feldolgozás (5 specializált csatorna):** A modul dedikált munkafolyamatokat biztosít a különböző dokumentumtípusoknak, egyedi optikai szövegfelismerési (OCR) és értelmezési szabályokkal.
2. **Mesterséges intelligencia alapú szövegfelismerés és adatkinyerés:** A feltöltött képek (JPG, PNG) és PDF fájlok automatikus optikai karakterfelismerésen és nyelvi modell általi intelligens adatkinyerésen mennek keresztül.
3. **Többoldalas PDF dokumentumok intelligens szétbontása:** Kötegelt szkennelés esetén a rendszer képes a több különálló számlát egyetlen PDF fájlban tartalmazó dokumentumokat automatikusan számlánként szétválasztani.
4. **Biztonságos felhőtárhely és aszinkron feldolgozás:** A dokumentumok titkosított felhőtárhelyre kerülnek, a feldolgozás pedig a háttérben, a felhasználó munkájának megakasztása nélkül történik.
5. **Kettős könyvviteli szinkronizáció:** A felismert adatokból közvetlenül létrejön a számla- vagy bizonylatrekord, amely azonnal bekerül az automatikus könyvelési folyamatba.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Csatornaválasztó Lapfülek (5 Specializált Csatorna)
- **Hogy hívják:** Feltöltési csatornafülek (*Számlák*, *Egyéb bizonylatok*, *Banki tranzakciók*, *Bérszámfejtés*, *Jelentések / Audit*)
- **Mire való:** A bizonylat jellegének megfelelő optimális optikai karakterfelismerő (OCR) és mesterséges intelligencia modell kiválasztása.
- **Hol található a felületen:** A feltöltési képernyő legtetején lévő vízszintes lapfülsor.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a feltölteni kívánt bizonylattípus fülére (pl. számláknál a **„Számlák”**, bérlapoknál a **„Bérszámfejtés”**, kivonatoknál a **„Banki tranzakciók”** fülre).
  2. A felület automatikusan átállítja az elvárt fájlformátumokat és a feldolgozó motort.
  - **Eredmény:** Célzott és lényegesen pontosabb automatikus adatfelismerés.

### 3.2 Drag & Drop Feltöltési Zóna és Fájlböngésző
- **Hogy hívják:** „Húzd-ide feltöltő doboz” és fájltallózó gomb
- **Mire való:** PDF dokumentumok, szkennelt képek (JPG, PNG, TIFF) vagy táblázatok kényelmes beemelése egyedi vagy tömeges kötegben.
- **Hol található a felületen:** A képernyő közepén található nagy, szaggatott vonallal határolt feltöltési terület.
- **Hogyan használhatja a felhasználó:**
  1. Húzza be a fájlokat közvetlenül a számítógép mappájából a böngésző ablakba.
  2. Vagy kattintson a doboz belsejébe, és jelölje ki a feltöltendő fájlokat a megnyíló ablakban.
  - **Eredmény:** A kiválasztott fájlok azonnal megjelennek az előkészítő listában.

### 3.3 Feltöltés Előtti Ellenőrző Lista és Előnézet
- **Hogy hívják:** Előkészített fájlok listája és kuka gombok
- **Mire való:** A feltöltésre váró állományok nevének, méretének ellenőrzése és a véletlenül kiválasztott fájlok eltávolítása még az adatátvitel indítása előtt.
- **Hol található a felületen:** Közvetlenül a feltöltő zóna alatt megjelenő lista.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a listában lévő fájlokat és méretüket.
  2. Ha téves dokumentum került be, kattintson a sor végén lévő piros kuka ikonra.
  - **Eredmény:** Kizárólag a releváns számviteli dokumentumok kerülnek feldolgozásra.

### 3.4 Feldolgozás Indítása és Állapotjelző Sáv
- **Hogy hívják:** „Feldolgozás indítása” gomb és folyamatjelző sáv
- **Mire való:** A fájlok titkosított felhőtárhelyre történő feltöltésének, az optikai szövegfelismerésnek (OCR) és a számlaszétbontásnak az elindítása.
- **Hol található a felületen:** A fájllista alatt lévő nagyméretű kék akciógomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Feldolgozás indítása”** gombra.
  2. Kövesse a valós idejű feltöltési és feldolgozási folyamatjelzőt.
  - **Eredmény:** A bizonylatok bekerülnek a feldolgozási sorba, a felhasználó közben zavartalanul folytathatja a munkáját más menüpontokban.

### 3.5 Feltöltési Előzmények és Feldolgozási Státuszkövető
- **Hogy hívják:** „Feltöltött fájlok naplója” panel
- **Mire való:** A korábbi feltöltések állapotának (Sorban áll, Feldolgozás alatt, Kész, Hibás) ellenőrzése.
- **Hol található a felületen:** A fejléc jobb oldalán lévő **„Feltöltött fájlok”** gombra kattintva, vagy az oldal alsó szakaszában.
- **Hogyan használhatja a felhasználó:**
  1. Nyissa meg a naplót.
  2. Tekintse át a feltöltött állományokat: a zöld pipa jelzi a sikeresen létrejött számlákat, míg a piros felkiáltójel az esetlegesen olvashatatlan (pl. homályos vagy jelszavas) fájlokat.
  3. Hibás tétel esetén kattintson az **„Újrapróbálkozás”** gombra.
  - **Eredmény:** 100%-os kontroll és átláthatóság a digitális iratanyag feldolgozásáról.

### 3.6 Eredeti Bizonylat Visszatöltése
- **Hogy hívják:** „Eredeti letöltése” gomb
- **Mire való:** A feltöltött eredeti, hiteles PDF vagy fotóállomány azonnali visszatöltése a felhőből belső vagy hatósági ellenőrzés céljából.
- **Hol található a felületen:** A fájlelőzmények táblázatának minden sora mellett a letöltés ikonra kattintva.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a bizonylatot az előzményekben.
  2. Kattintson a letöltés ikonra.
  - **Eredmény:** A rendszer azonnal letölti az eredeti fájlt érintetlen, hiteles formátumban.
