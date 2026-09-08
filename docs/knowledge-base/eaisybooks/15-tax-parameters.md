# 🧮 Adómértékek és Jogszabályi Paraméterek (Tax Parameters)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Szakmai Törzsadatok & Adminisztráció  
> **Szükséges szerepkör:**  
> - *Megtekintés:* Minden könyvelő és bérszámfejtő  
> - *Módosítás és adminisztráció:* Irodavezető adminisztrátor (`iroda_admin`), Szenior bérszámfejtő  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Törzsadatok & Rendszer** csoportban: **Adómértékek** menüpont (`/eaisybooks/admin/tax-parameters`).
- **Ikon:** Számológép (`Calculator`) ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → Adómértékek
- **Gyorsműveletek:** Keresés paraméterkódra, adókulcsok ellenőrzése, minimálbér összegek áttekintése, törvényi értékek helyi módosítása

---

## 2. A menü funkciója és célja

Az **Adómértékek és Jogszabályi Paraméterek** az eaisyBooks teljes bérszámfejtési, adózási és számlázási motorjának törvényi referencia-adatbázisa. Itt vannak központilag definiálva a hatályos minimálbér összegek, a munkavállalói és munkáltatói járulékkulcsok, a családi és életkori adókedvezmények keretösszegei, valamint a speciális adónemek (KATA, KIVA, EFO) limitjei.

### Fő feladatai és szerepe a számítási pontosságban:
1. **Egységes törvényi kalkulációs motor:** Garantálja, hogy a rendszer valamennyi cégénél a bérszámfejtés, az adóelőleg-levonás és a járulékbevallás fillérre pontosan a hatályos törvényi számok szerint fusson le.
2. **Kiterjedt paraméterkategóriák:** 11 specializált csoportba rendezi a több mint 60 jogszabályi mutatót (Adókulcsok, Minimálbér, Családi kedvezmény, 25 év alattiak SZJA mentessége, SZOCHO kedvezmények, SZÉP kártya, EFO, Lakhatás, Munkajog, Rehabilitáció, Speciális adónemek).
3. **Inline szerkesztés és audit:** Jogszabályváltozás vagy évközi módosulás esetén az adminisztrátor közvetlenül a felületen frissítheti a kulcsokat, amely azonnal érvényesül az új bérszámfejtési ciklusokban.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Visszalépés Nyíl és Keresőmező
- **Hogy hívják:** „Vissza” nyíl gomb és „Keresés paraméterek között...” beviteli mező
- **Mire való:** Visszatérés a korábbi oldalra, valamint a törvényi kulcsok azonnali szűrése elnevezés vagy belső kulcsnév alapján.
- **Hol található a felületen:** A fejléc bal szélén a vissza nyíl, alatta a teljes szélességű keresőmező.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a keresett kifejezést a keresőbe (pl. „minimálbér”, „szocho”, „25 év”, „családi”, „efo”).
  2. A táblázat valós időben leszűkül a releváns paraméterekre.
  - **Eredmény:** Azonnal megtalálja a kívánt adómértéket anélkül, hogy végig kellene lapoznia a teljes törzset.

### 3.2 Kategória Választó Fülsor
- **Hogy hívják:** Kategória választó fülek (11 szakmai csoport)
- **Mire való:** A paraméterek rendszerezett áttekintése szakmai témakörök szerint.
- **Hol található a felületen:** A keresőmező alatt elhelyezkedő kártyasor / fülsor.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kívánt témakörre:
     - **Adókulcsok és járulékok:** SZJA (15%), TB járulék (18,5%), SZOCHO (13%).
     - **Minimálbér és bérminimum:** Havi, heti, napi és órabérek bruttó összege.
     - **Családi kedvezmény:** 1, 2, 3 vagy több gyermek adóalap-kedvezménye és nettó adómegtakarítása.
     - **Adókedvezmények és mentességek:** 25 év alattiak havi és éves plafonja, 30 év alatti anyák, személyi kedvezmény, első házasok kedvezménye, egészségügyi szolgáltatási járulék összege.
     - **SZOCHO kedvezmények:** Pályakezdők, kutatók, megváltozott munkaképességűek kedvezményei, osztalék SZOCHO felső határ.
     - **SZÉP kártya és cafeteria:** Rekreációs keret, alszámla limitek és béren kívüli juttatások adókulcsai.
     - **Lakhatás és ajándék:** Munkáltatói lakhatási támogatás és csekély értékű ajándék évi kerete.
     - **EFO:** Mezőgazdasági, turisztikai és alkalmi munka napi közterhei és mentesített napi bérösszegei.
     - **Munkajogi paraméterek:** Távmunka rezsiátalány, km-térítés, túlóra éves korlátok, betegszabadság mértéke.
     - **Rehabilitáció és biztosítás:** Rehabilitációs hozzájárulás kvótája és kötelezettségi szintjei.
     - **Speciális adónemek:** KATA havi adó (50 000 Ft), 18M keret, KIVA adókulcs (10%).
  - **Eredmény:** A táblázat az adott kategóriába tartozó összes törvényi mutatót megjeleníti.

### 3.3 Paraméter Táblázat és Adatlap
- **Hogy hívják:** Paraméter sorok, Érték mezők és Mértékegység címkék
- **Mire való:** A hatályos számértékek, hivatalos leírások és mértékegységek (Ft, %, nap, hó) megtekintése.
- **Hol található a felületen:** A fő képernyő középső részén lévő táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg a bal oszlopban a paraméter hivatalos nevét és belső kódját.
  2. A középső oszlopban olvassa le az aktuális értéket (pl. `15%`, `290 800 Ft`, `5 000 Ft/hó`).
  3. A jobb oszlopban tekintse át a jogszabályi hátteret és leírást.
  - **Eredmény:** Megbízható, törvényes forrásból ellenőrizheti a számítási alapokat.

### 3.4 Inline Értékmódosítás és Mentés
- **Hogy hívják:** „Szerkesztés” ceruza gomb (`Edit3`), „Mentés” pipa (`Check`) és „Mégse” (`X`) gomb
- **Mire való:** Egy törvényi mutató értékének felülírása és azonnali érvényesítése a rendszerben.
- **Hol található a felületen:** A táblázat adott paraméter sorának jobb szélén.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a módosítandó sorban a **Ceruza (Szerkesztés)** ikonra.
  2. Az érték beviteli mezővé alakul: írja be az új törvényi összeget vagy százalékot.
  3. Kattintson a zöld **Pipa (Mentés)** gombra a jóváhagyáshoz.
  4. Ha elveti a módosítást, kattintson a piros **X (Mégse)** gombra.
  - **Eredmény:** A rendszer elmenti az új értéket, felugró értesítést ad a sikeres frissítésről, és az összes jövőbeli bérszámfejtés már ezzel a paraméterrel kalkulál.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Éves minimálbér-emelés beállítása januárban
1. A kormányrendelet kihirdetése után az irodavezető belép az **Adómértékek** menüpontba.
2. Kiválasztja a **„Minimálbér és bérminimum”** kategóriát.
3. A minimálbér során a ceruza ikonra kattintva beírja az új bruttó összeget, majd elmenti.
4. Ugyanezt elvégzi a garantált bérminimumnál és az óradíjaknál.
5. Ezt követően a bérszámfejtési modul automatikusan az új kötelező bérekhez igazítja az adó- és járulékszámításokat.

### 4.2 Családi kedvezmény és 25 év alatti SZJA plafon ellenőrzése
1. A bérszámfejtő munkatárs bizonytalan abban, hogy a tárgyévben mekkora havi jövedelemig jár a 25 év alatti fiatalok adómentessége.
2. Megnyitja az **Adókedvezmények és mentességek** fület.
3. Leolvassa a `young_25_cap` mező pontos összegét és a hozzá tartozó törvényi leírást.
4. Tájékoztatja az ügyfelet a levonási szabályokról.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **1995. évi CXVII. törvény a személyi jövedelemadóról (Szja tv.):** 15%-os adókulcs, családi kedvezmény, 25 év alattiak kedvezménye, első házasok és személyi kedvezmény szabályai.
- **2019. évi CXXII. törvény a társadalombiztosítás ellátásaira jogosultakról (Tbj.):** 18,5%-os TB járulék mértéke és minimális járulékalap.
- **2018. évi LII. törvény a szociális hozzájárulási adóról (Szocho tv.):** 13%-os SZOCHO kulcs, kedvezmények és a tőkejövedelmek utáni adófizetési felső határ.
- **A Kormány hatályos rendelete a kötelező legkisebb munkabérről és a garantált bérminimumról.**
