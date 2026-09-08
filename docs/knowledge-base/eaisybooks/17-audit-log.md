# 🛡️ Audit Napló és Biztonsági Naplózás (Audit Log)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Biztonság & Adminisztráció  
> **Szükséges szerepkör:** Irodavezető adminisztrátor (`iroda_admin`)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Biztonság & Rendszer** csoportban: **Audit napló** menüpont (`/eaisybooks/admin/audit`).
- **Ikon:** Biztonsági pajzs (`Shield`) ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → Audit napló
- **Gyorsműveletek:** Rendszerműveletek időrendi szűrése eseménytípus szerint, felhasználó és entitás keresése, audit napló exportálása CSV fájlba

---

## 2. A menü funkciója és célja

Az **Audit Napló** az eaisyBooks teljes platformjának központi, nem manipulálható digitális biztonsági és műveleti naplója. Rögzít minden bejelentkezést, adatrögzítést, számlamódosítást, bérszámfejtési jóváhagyást, hatósági beküldést és adatletöltést a felelősségre vonhatóság és a törvényi megfelelőség biztosítására.

### Fő feladatai és jogi megfelelősége:
1. **Számviteli bizonylati fegyelem és visszakövethetőség:** A Számviteli törvény (Sztv.) 169. §-a szerint garantálja, hogy a könyvelési tételek minden módosítása (ki, mikor, milyen entitáson végezte) másodperc pontossággal auditálható legyen.
2. **GDPR adatbetekintési és incidensnapló:** Bizonyítja a személyes és jövedelmi adatokhoz való hozzáférést, megvédve az irodát az adatvédelmi vitákban.
3. **Művelettípus szerinti csoportosítás:** Színkódolt címkékkel különíti el a belépéseket (kék), létrehozásokat (zöld), módosításokat (borostyánsárga), törléseket (piros), hatósági beküldéseket (lila) és exportokat (kékeszöld).
4. **Hitelesített exportálás:** A szűrt naplóállomány közvetlenül kinyerhető és átadható hatósági vagy kamarai ellenőrzések során.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Szabadszavas Keresőmező
- **Hogy hívják:** „Keresés email, entitás...” beviteli mező
- **Mire való:** Gyors szöveges szűrés a felhasználó e-mail címe, az érintett entitás típusa (pl. `invoices`, `employees`, `settings`) vagy belső azonosítója alapján.
- **Hol található a felületen:** A fejléc alatti szűrősáv bal oldalán elhelyezkedő keresődoboz nagyító ikonnal.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a keresett kolléga e-mail címét vagy a vizsgált entitás nevét.
  2. A táblázat azonnal leszűkül a találatokra.
  - **Eredmény:** Másodpercek alatt megtalálhatók az egy adott felhasználóhoz vagy bizonylathoz kapcsolódó naplóbejegyzések.

### 3.2 Eseménytípus Szűrő Legördülő Menü
- **Hogy hívják:** Eseménytípus választó (`Filter` tölcsér ikon mellett)
- **Mire való:** A műveletek jelleg szerinti szűkítése (pl. csak a törlések vagy csak az adatexportok megjelenítése).
- **Hol található a felületen:** A keresőmező mellett jobbra elhelyezkedő választólista.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a legördülő menüre.
  2. Válassza ki a kívánt kategóriát:
     - **Minden esemény:** A teljes forgalom.
     - **Bejelentkezés:** Felhasználói belépések és munkamenetek.
     - **Létrehozás:** Új tételek rögzítése.
     - **Módosítás:** Meglévő adatok átírása.
     - **Törlés:** Törölt számlák, partnerek vagy hozzárendelések.
     - **Beküldés:** NAV felé továbbított állományok.
     - **Exportálás:** Letöltött kimutatások és bérlisták.
     - **Email küldés:** Ügyfeleknek kiküldött sablonlevelek.
  - **Eredmény:** A lista azonnal a kiválasztott műveleti körre fókuszál.

### 3.3 Audit Események Táblázata
- **Hogy hívják:** Eseménynapló táblázat oszlopai és színkódolt címkék
- **Mire való:** A naplózott események részletes adatainak (Dátum, Felhasználó, Esemény, Entitás, Entitás ID, IP cím) áttekintése.
- **Hol található a felületen:** A képernyő középső részét kitöltő fő táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a **Dátum** oszlopban a művelet pontos időpontját (pl. `2026. 09. 08. 14:22:15`).
  2. Tekintse meg a **Felhasználó** oszlopban a műveletet végző kolléga e-mail címét.
  3. Ellenőrizze a színkódolt **Esemény** jelvényt (pl. piros *Törlés*, zöld *Létrehozás*).
  4. Az **Entitás** és **Entitás ID** oszlopokból beazonosíthatja a módosított adatbázis-rekordot.
  5. Az **IP** oszlopban ellenőrizheti a kliens hálózati címét.
  - **Eredmény:** Teljes bizonyossággal rekonstruálható a gazdasági adat életútja.

### 3.4 Exportálás CSV Fájlba
- **Hogy hívják:** „Exportálás” gomb (`Download` letöltés ikon)
- **Mire való:** A szűrt audit bejegyzések letöltése hivatalos táblázatos CSV formátumban.
- **Hol található a felületen:** A fejléc jobb felső sarkában, a címsor mellett.
- **Hogyan használhatja a felhasználó:**
  1. Állítsa be a kívánt szűrőket (pl. egy adott felhasználó törlési eseményei).
  2. Kattintson az **„Exportálás”** gombra.
  3. A böngésző azonnal elmenti az `audit_log_ÉÉÉÉ-HH-NN.csv` fájlt.
  - **Eredmény:** Formázott, archiválható és külső hatóságnak átadható biztonsági naplófájlt kap.

### 3.5 Lapozó Sáv
- **Hogy hívják:** Lapozó vezérlő (`UnifiedPagination`)
- **Mire való:** Navigálás az időrendi oldalak között (50 esemény oldalanként).
- **Hol található a felületen:** A táblázat alatt, a képernyő alsó sávjában.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a jobbra / balra nyilakra vagy a számozott gombokra a régebbi események betöltéséhez.
  - **Eredmény:** A rendszer betölti a következő 50 audit tételt.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Vitás számlatörlés kivizsgálása
1. Egy ügyfél jelzi, hogy egy rögzített szállítói számla eltűnt a rendszerből.
2. Az irodavezető megnyitja az **Audit napló** oldalt.
3. Az esemény szűrőben kiválasztja a **„Törlés”** típust, a keresőbe beírja a cég azonosítóját.
4. A lista megmutatja a pontos másodpercet, a törölt számla azonosítóját és a törlést végző munkatárs e-mail címét, tisztázva a helyzetet.

### 4.2 Éves GDPR és IT-biztonsági audit
1. A könyvelőiroda adatvédelmi tisztviselője bekéri a személyes adatokhoz és bérlistákhoz történt hozzáférések listáját.
2. Az adminisztrátor az esemény típusnál kiválasztja az **„Exportálás”** típust.
3. Az **„Exportálás”** gombra kattintva letölti az éves audit naplót CSV formátumban és csatolja az audit jegyzőkönyvhöz.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2000. évi C. törvény a számvitelről (Sztv.) 169. §:** Számviteli bizonylatok megőrzése és a könyvelési bejegyzések utólagos módosítási tilalma az eredeti állapot megőrzése nélkül.
- **GDPR (2016/679/EU rendelet) 33. cikk:** Adatvédelmi incidensek naplózása és bizonyítási kötelezettsége.
- **2013. évi V. törvény a Polgári Törvénykönyvről (Ptk.):** Szakmai kártérítési felelősség bizonyítása.
