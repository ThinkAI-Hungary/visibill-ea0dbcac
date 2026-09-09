# 📥 Fuvar Excel Import (Tömeges Fuvarlevél Import)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Szállítmányozás  
> **Szükséges szerepkör:** Tulajdonos (Owner), Adminisztrátor, Pénzügyi munkatárs (Member)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** A **Szállítmányozás** csoport 2. menüpontja.
- **Ikon:** Táblázat / Excel ikon
- **Elérési útvonal:** Fuvar Excel Import menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** Fájl behúzása feltöltéshez, korábbi import kötegek törlése

---

## 2. A menü funkciója és célja

Az **Excel Import** felület biztosítja a logisztikai és szállítmányozási cégek számára a külső fuvarszervező szoftverekből, ERP rendszerekből vagy táblázatokból exportált több száz vagy több ezer fuvarmegbízás egyidejű, másodpercek alatti betöltését és automatikus számlapárosítását.

### Fő funkciók:
- **Többformátumú adatbeolvasás:** Excel (.xlsx, .xls) és CSV fájlok közvetlen feldolgozása a böngészőben.
- **Intelligens oszlopfelismerés:**
  - *Pozíciószám:* A megbízás egyedi azonosítója (pl. POZ-1024/26).
  - *Felrakás és lerakás dátumai:* Érvényes naptári dátumok automatikus azonosítása.
  - *Fuvarozó / Partner neve:* A megbízást teljesítő alvállalkozó neve.
  - *Kalkulált fuvardíj:* Megállapodott fuvardíj forint vagy euró devizában.
- **Import előnézeti validáció:** Mielőtt az adatok véglegesen bekerülnének a nyilvántartásba, a rendszer táblázatban jeleníti meg az értelmezett sorokat, és megkülönböztető jelöléssel mutatja a hibás vagy hiányos mezőket.
- **Visszamenőleges számlapárosítás:** Az import befejezése után a háttérfolyamat azonnal végigfut a korábban beérkezett számlákon, és automatikusan összeköti az újonnan importált fuvarokat a megfelelő számlákkal.
- **Import kötegek naplója és visszavonása:** Minden feltöltés önálló kötegként tárolódik. Ha téves fájl került feltöltésre, a teljes köteg egyetlen kattintással visszavonható és törölhető.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Feltöltési Zóna és Mintasablon Letöltése
- **Hogy hívják:** „Excel / CSV feltöltő zóna” és „Mintasablon letöltése” gomb
- **Mire való:** Külső fuvarszervezőkből (SpedSoft, TimoCom, saját ERP) kimentett fuvartáblázatok behúzása, vagy a kompatibilis Excel minta letöltése az első feltöltés előtt.
- **Hol található a felületen:** A képernyő felső részén lévő szaggatott vonallal határolt nagy doboz.
- **Hogyan használhatja a felhasználó:**
  1. Új integráció esetén kattintson a **„Mintasablon letöltése”** linkre az elvárt oszlopok megtekintéséhez.
  2. Húzza be a számítógépről a kész `.xlsx` vagy `.csv` fájlt a feltöltő területre, vagy kattintson a doboz belsejébe a tallózáshoz.
  - **Eredmény:** A rendszer azonnal beolvassa a táblázatot és megnyitja az előnézeti képernyőt.

### 3.2 Oszlop-hozzárendelő és Validációs Előnézet
- **Hogy hívják:** „Import előnézeti táblázat” és oszlopvalidátor
- **Mire való:** A beolvasott táblázat oszlopainak (Pozíciószám, Felrakás, Lerakás, Fuvarozó, Fuvardíj, Devizanem) ellenőrzése, és az esetleges dátum- vagy összegformátum-hibák azonosítása a végleges mentés előtt.
- **Hol található a felületen:** A feltöltési doboz alatt megjelenő táblázatos felület.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a táblázat fejlécét: győződjön meg róla, hogy a rendszer helyesen ismerte fel az oszlopokat (pl. az összeg mező tényleg a fuvardíjhoz került).
  2. Szükség esetén a legördülő menükkel kézzel korrigálja az oszlopok megfeleltetését.
  3. Ellenőrizze a sorok bal szélén lévő állapotjelzőket (Zöld pipa: érvényes, Piros felkiáltójel: hiányzó pozíciószám vagy érvénytelen dátum).
  - **Eredmény:** Kizárható a hibás vagy inkonzisztens adatok bekerülése a rendszerbe.

### 3.3 Importálás Indítása és Automatikus Számlapárosítás
- **Hogy hívják:** „Importálás indítása” gomb és folyamatjelző sáv
- **Mire való:** A jóváhagyott sorok beírása az adatbázisba, és az automatikus számlapárosítási algoritmus azonnali lefutása a korábban már beérkezett számlákra.
- **Hol található a felületen:** Az előnézeti táblázat jobb alsó sarkában lévő kék akciógomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Importálás indítása”** gombra.
  2. Kövesse a folyamatjelző sávot, amely mutatja a rekordok mentését és a háttérben futó számlakeresést.
  3. A folyamat végeztével a rendszer kiírja a sikeresen importált tételek és az azonnal párosított számlák számát.
  - **Eredmény:** Az importált fuvarok bekerülnek a nyilvántartásba, az egyező számlák azonnal zöldre váltanak.

### 3.4 Korábbi Import Kötegek Története
- **Hogy hívják:** „Import előzmények” táblázat
- **Mire való:** A korábban feltöltött fájlok archívuma: feltöltés dátuma, feltöltő személy, fájlnév, sikeresen betöltött és hibásan elutasított sorok száma.
- **Hol található a felületen:** A képernyő alsó részén elhelyezkedő naplópanel.
- **Hogyan használhatja a felhasználó:**
  1. Görgessen le az **„Import előzmények”** szakaszhoz.
  2. Tekintse át a korábbi kötegek adatait és időpontjait.
  - **Eredmény:** Teljes visszakövethetőség az adatimportokról.

### 3.5 Téves Import Köteg Visszavonása és Törlése
- **Hogy hívják:** „Köteg visszavonása és törlése” kuka ikon
- **Mire való:** Téves vagy rossz hónaphoz tartozó Excel feltöltése esetén a kötegben lévő összes fuvar egyetlen kattintással történő visszavonása anélkül, hogy egyesével kellene törölgetni a sorokat.
- **Hol található a felületen:** Az import előzmények táblázatának minden sora végén található piros kuka gomb.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a visszavonandó feltöltési sort a listában.
  2. Kattintson a piros törlés ikonra.
  3. A megerősítő ablakban kattintson a **„Köteg visszavonása”** gombra.
  - **Eredmény:** A rendszer azonnal eltávolítja a feltöltött fuvarokat a nyilvántartásból, és feloldja a hozzájuk kapcsolt számlákat.
