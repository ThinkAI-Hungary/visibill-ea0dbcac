# ÁFA Bevallás (NAV 2665 és ÁFA Analitika)

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Könyvelés** csoportban található: **ÁFA bevallás**.
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/vat-return`
- **Jogosultság:** Cégtulajdonos, adminisztrátor, pénzügyi vezető és könyvelő.

---

## 2. A menü funkciója és célja
Az **ÁFA Bevallás** modul a Nemzeti Adó- és Vámhivatal (NAV) felé benyújtandó havi, negyedéves vagy éves ÁFA bevallás (a mindenkori **65-ös nyomtatvány**, pl. 2665) analitikus előkészítését, törvényi korrekcióit és a közvetlenül benyújtható ÁNYK/ONYA XML állományok generálását végzi az Áfa törvény előírásainak megfelelően.

### Fő feladatai:
- **Fizetendő és levonható ÁFA analitika:** A lekönyvelt belföldi és külföldi számlák tételes összerendezése a NAV 65-ös bevallási soraival:
  - *Fizetendő adó:* 27%, 18%, 5% kulcsú értékesítés, fordított adózás (FAD), EU közösségi értékesítés.
  - *Levonható adó:* Belföldi beszerzések, termékimport, EU közösségi beszerzés ÁFA-ja.
- **Törvényi levonási korlátozások automatizálása:**
  - *Telefonköltség 70/30 szabály:* A céges telefon- és internetszámlák ÁFA tartalmának törvényileg előírt 30%-os magánhasználati levonási tiltása (vagy tételes forgalmi elszámolás).
  - *Személygépkocsi korlátozások:* Üzemanyag, parkolás, autópályadíj levonási tiltása, gépjármű bérleti díj 50%-os átalány-levonhatósága.
  - *Reprezentáció és üzleti ajándék ÁFA levonási tilalma.*
- **ÁFA Arányosítás (Pro Rata):** Vegyes tevékenység (adómentes és adóköteles) esetén az év közbeni és év végi végleges levonási hányados kiszámítása.
- **Hivatalos NAV ÁNYK és ONYA XML export:** A bevallási csomag előállítása a NAV Általános Nyomtatványkitöltő programjához vagy az Online Nyomtatványkitöltőhöz.
- **ÁFA Kód Beállító Törzs:** A vállalkozás saját számlázási ÁFA kódjainak és a NAV 65-ös sorainak rugalmas összerendelése.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Időszakválasztó és ÁFA Pozíció Kártyák
- **Hogy hívják:** Bevallási gyakoriság választó és ÁFA egyenleg kártyák
- **Mire való:** A havi, negyedéves vagy éves adóidőszak kijelölése, a fizetendő, levonható és nettó fizetendő / visszaigényelhető ÁFA azonnali számszerűsítése.
- **Hol található a felületen:** A fejléc bal és középső területén lévő kapcsolók és színes összegző kártyák.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a bevallási gyakoriságot (Havi / Negyedéves / Éves) és a vizsgált hónapot vagy negyedévet.
  2. Tekintse át a 3 fő kártyát:
     - **Fizetendő ÁFA:** Értékesítések után felszámított adó.
     - **Levonható ÁFA:** Beszerzések után levonásba helyezhető adó.
     - **Nettó ÁFA Pozíció:** Piros színnel kiemelt fizetendő adóteher vagy zölddel jelölt visszaigényelhető ÁFA összeg.
  - **Eredmény:** Azonnali áttekintés a NAV felé esedékes adókötelezettségről.

### 3.2 Hivatalos 65-ös NAV Űrlaptábla és Sorok Kibontása
- **Hogy hívják:** „NAV 65-ös nyomtatvány munkalap”
- **Mire való:** A számlák tételes összerendezése a hivatalos NAV nyomtatvány sorai szerint (pl. 01. sor: 27%-os fizetendő adó, 64. sor: belföldi termékbeszerzés levonható adója).
- **Hol található a felületen:** A képernyő középső nagy táblázatos felületén.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Fizetendő adó (01-es lap)”** vagy a **„Levonható adó (02-es lap)”** fülre.
  2. Tekintse át a hivatalos soronként megjelenített adóalap és ÁFA összegeket.
  3. Kattintson bármelyik sor végén lévő nagyító ikonra.
  4. A rendszer felugró ablakban kilistázza a sorba tartozó összes konkrét bejövő vagy kimenő számlát partnernévvel és számlaszámmal.
  - **Eredmény:** Teljes analitikus bizonyosság a bevallás minden egyes sorának számítási hátteréről.

### 3.3 Törvényi Levonási Korlátozások Beállítása
- **Hogy hívják:** „ÁFA Levonási szabályok és Korrekciók” panel
- **Mire való:** A céges telefonköltségek 70/30%-os magánhasználati megosztásának, a személygépkocsi bérlet 50%-os korlátjának és a reprezentációs költségek ÁFA levonási tilalmának automatikus érvényesítése.
- **Hol található a felületen:** A táblázat feletti **„Szabályok és korrekciók”** gomb megnyomásával.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Levonási szabályok”** gombra.
  2. Ellenőrizze az aktív szabályokat:
     - *Telefon/Internet 70% levonhatóság* bepipálva.
     - *Gépkocsi bérlet 50% átalány* bepipálva.
  3. Ha egyedi számlánál módosítani kell a levonási hányadot (pl. 100% céges telefon tételes kimutatással), kattintson a számla melletti ceruzára és módosítsa a százalékot.
  4. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** A rendszer automatikusan lecsökkenti a levonható adó összegét a törvényi előírásoknak megfelelően, a le nem vonható részt pedig költségként könyveli.

### 3.4 NAV M-lapos Belföldi Összesítő Jelentés Ellenőrzése
- **Hogy hívják:** „M-lap ellenőrző és Partnerösszesítő”
- **Mire való:** A számlánkénti kötelező NAV adatszolgáltatás ellenőrzése minden olyan belföldi adóalany felé kiállított vagy tőle befogadott számlánál, amely ÁFA-t tartalmaz.
- **Hol található a felületen:** A felső nézetváltó sávban lévő **„M-lapok (NAV adatszolgáltatás)”** lapfülön.
- **Hogyan használhatja a felhasználó:**
  1. Váltson az **„M-lapok”** fülre.
  2. Tekintse át a partnerek adószáma szerint csoportosított számlákat.
  3. Ellenőrizze a rendszer által jelzett esetleges formai hibákat (pl. hiányzó vagy érvénytelen adószám).
  - **Eredmény:** Kizárható a NAV általi nyomtatvány-elutasítás vagy formai hibás bevallás.

### 3.5 Hivatalos NAV ÁNYK és ONYA XML Export
- **Hogy hívják:** „ÁNYK XML export” és „ONYA csomag letöltése” gombok
- **Mire való:** A hibátlan, elektronikus adóbevallási XML állomány legenerálása, amely közvetlenül betölthető a NAV Általános Nyomtatványkitöltőjébe vagy az Online Nyomtatványkitöltő felületre.
- **Hol található a felületen:** A fejléc jobb felső sarkában elhelyezkedő zöld **„ÁNYK Export”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Miután minden tételt ellenőrzött, kattintson az **„ÁNYK Export”** gombra.
  2. A rendszer lefuttatja a belső formai ellenőrzést, majd letölti a `.xml` fájlt.
  3. Nyissa meg az ÁNYK programot (vagy lépjen be az ONYA felületére), válassza az *Adatok importálása* funkciót, és tallózza be a letöltött fájlt.
  - **Eredmény:** A bevallás azonnal benyújtható állapotba kerül, a NAV ellenőrzője nem jelez hibát.

### 3.6 Számlaszintű ÁFA Analitika Letöltése (PDF / Excel)
- **Hogy hívják:** „ÁFA Analitika letöltése” gomb
- **Mire való:** Részletes, tételes nyilvántartás kinyomtatása az összes befogadott és kibocsátott számla ÁFA tartalmáról az adóhatósági ellenőrzések dossziéjához.
- **Hol található a felületen:** A fejléc műveleti menüjében a letöltés ikon alatt.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Analitika letöltése”** gombra.
  2. Válassza az **„Excel (részletes)”** vagy a **„PDF (nyomtatható könyvelési ív)”** formátumot.
  - **Eredmény:** Letöltődik a számlánkénti adóalapokat, adókulcsokat, levonási tiltásokat és pénzügyi teljesítési dátumokat tartalmazó hivatalos nyilvántartás.
