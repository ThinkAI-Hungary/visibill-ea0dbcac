# 📄 Szakmai Sablonok és Iratminták (Templates)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Szakmai Törzsadatok & Adminisztráció  
> **Szükséges szerepkör:** Irodavezető adminisztrátor (`iroda_admin`), Szenior könyvelő  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Törzsadatok & Rendszer** csoportban: **Sablonok** menüpont (`/eaisybooks/admin/templates`).
- **Ikon:** Dokumentum (`FileText`) ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → Sablonok
- **Gyorsműveletek:** Új üzenetsablon létrehozása, meglévő sablon módosítása, dinamikus változók beszúrása, verziótörténet megtekintése

---

## 2. A menü funkciója és célja

A **Sablonok** felület a könyvelőiroda kommunikációs, bizonylatbekérési és bérszámfejtési e-mail sablonjainak központi szerkesztője. Lehetővé teszi, hogy az iroda szabványosított, professzionális szövegekkel kommunikáljon az ügyfelekkel, minimalizálva a manuális gépelést és elkerülve a formai hibákat.

### Fő feladatai és szerepe a könyvelői kommunikációban:
1. **Szabványosított üzenetkategóriák:** Külön csoportokba rendezi a havi adatbekérőket, hiánypótlási felszólítókat, bérjegyzék-kísérőleveleket és az éves M30-as adóigazolások kiküldését.
2. **Dinamikus változókezelés:** Helyőrző mezőkkel (pl. `[Cég]`, `[Hónap]`, `[Hiányzó dokumentumok]`, `[Határidő]`) automatikusan beilleszti az adott ügyfél valós adatait a kiküldés pillanatában.
3. **Markdown szövegformázás:** Lehetővé teszi a félkövér kiemeléseket, listákat és linkeket tartalmazó, esztétikus e-mailek összeállítását.
4. **Verziótörténet és audit:** Minden sablonmódosítás visszakövethető, megőrizve a korábbi szövegváltozatokat.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Kategória Választó Fülsor
- **Hogy hívják:** Kategória fülek (Adatbekérő, Hiánypótlás, Bérjegyzék, Havi dokumentumok, M30 küldés, Egyéb)
- **Mire való:** A sablonok témakör szerinti szűrése és áttekintése.
- **Hol található a felületen:** A fejléc alatt elhelyezkedő horizontális gombsor.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kívánt témakör gombjára:
     - **Adatbekérő:** Hó eleji bizonylat- és bankkivonat-bekérők.
     - **Hiánypótlás:** Fizetési és számlapótlási sürgetők.
     - **Bérjegyzék:** A havi bérszámfejtés lezárásakor küldött értesítők.
     - **Havi dokumentumok:** Zárási kimutatások kísérőlevelei.
     - **M30 küldés:** Éves személyi jövedelemadó igazolások sablonjai.
     - **Egyéb:** Egyedi ügyféli tájékoztatók.
  - **Eredmény:** A képernyőn csak az adott kategóriához tartozó sablonkártyák jelennek meg.

### 3.2 „Új sablon” Létrehozása Gomb
- **Hogy hívják:** „Új sablon” gomb (`Plus` ikon)
- **Mire való:** Új e-mail sablon összeállítását kezdeményező űrlap megnyitása az aktív kategóriában.
- **Hol található a felületen:** A felső fejléc jobb szélén, a címsor mellett.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a kategóriát.
  2. Kattintson az **„Új sablon”** gombra.
  - **Eredmény:** Megnyílik a sablonszerkesztő párbeszédablak.

### 3.3 Sablonszerkesztő Párbeszédablak és Változóbeillesztés
- **Hogy hívják:** Sablonszerkesztő modal, Változó gombok és „Mentés” gomb
- **Mire való:** A sablon nevének, e-mail tárgyának és törzsszövegének megírása dinamikus adathelyettesítőkkel.
- **Hol található a felületen:** A felugró ablak közepén elhelyezkedő szerkesztőfelület.
- **Hogyan használhatja a felhasználó:**
  1. Töltse ki a **„Sablon neve”** mezőt (pl. *Sürgős hiánypótlási felszólító*).
  2. Írja be az **„E-mail tárgya”** mezőt (pl. *Fontos: Hiányzó könyvelési bizonylatok - [Cég] - [Hónap]*).
  3. A szövegtörzs szerkesztése közben kattintson a szerkesztő feletti kék változó gombokra:
     - `[Cég]`: Beilleszti a cég nevét.
     - `[Hónap]`, `[Év]`: Az elszámolási időszak dátuma.
     - `[Hiányzó dokumentumok]`: A hiánylistában lévő tételek tételes felsorolása.
     - `[Foglalkoztatott neve]`: Bérjegyzék esetén a dolgozó neve.
     - `[Határidő]`: A válaszadási jogvesztő határidő.
     - `[Link]`: Közvetlen kattintható link az eaisyBill ügyfélkapuhoz.
  4. Kattintson a jobb alsó **„Mentés”** gombra.
  - **Eredmény:** A sablon azonnal elmentődik, és elérhetővé válik a bizonylatbekérő és értesítő modulokban.

### 3.4 Meglévő Sablon Módosítása
- **Hogy hívják:** „Szerkesztés” gomb (`Edit3` ceruza ikon)
- **Mire való:** Egy már létező sablon szövegének vagy tárgyának frissítése.
- **Hol található a felületen:** Minden sablonkártya jobb felső sarkában.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a frissítendő sablon kártyáját.
  2. Kattintson a ceruza ikonra.
  3. Módosítsa a kívánt szövegrészeket.
  4. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** A sablon új verzióként elmentődik, megőrizve a korábbi változatokat.

### 3.5 Sablon Verziótörténet Megtekintése
- **Hogy hívják:** „Verziótörténet” gomb (`History` óra ikon)
- **Mire való:** A sablonon korábban végrehajtott módosítások, időbélyegek és előző szövegváltozatok visszanézése.
- **Hol található a felületen:** A sablonkártya jobb felső sarkában, a ceruza ikon mellett.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **History (Óra)** ikonra.
  2. A felugró ablakban tekintse át az időrendbe szedett korábbi módosításokat.
  - **Eredmény:** Pontosan nyomon követhető, mikor és hogyan változott a sablon hivatalos szövege.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Hó eleji bizonylatbekérő levél testreszabása
1. Az irodavezető a tárgyhó elején belép a **Sablonok** menübe.
2. Kiválasztja az **Adatbekérő** kategóriát, majd a meglévő sablonon a ceruza ikonra kattint.
3. Frissíti a határidőre vonatkozó felhívást, beilleszti a `[Határidő]` és `[Link]` változókat.
4. Mentés után a Hiányzó Számlák Hub-ból kiküldött összes bizonylatbekérő e-mail már ezzel a frissített szöveggel indul el.

### 4.2 Személyre szabott bérjegyzék-kísérőlevél kialakítása
1. A bérszámfejtő a **Bérjegyzék** fülre navigál.
2. Létrehoz egy új sablont a prémium ügyfelek számára, beillesztve a `[Foglalkoztatott neve]` és `[Hónap]` változókat.
3. A bérszámfejtési modulból a bérlapok kötegelt e-mailes kiküldésekor ezt a sablont választja ki.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2000. évi C. törvény a számvitelről (Sztv.):** Bizonylati fegyelem és a gazdasági eseményeket alátámasztó bizonylatok határidőben történő beszerzése.
- **2017. évi CL. törvény az adózás rendjéről (Art.):** Törvényi bevallási és adatszolgáltatási határidők tiszteletben tartására történő ügyféli figyelmeztetés.
