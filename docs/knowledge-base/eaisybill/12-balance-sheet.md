# Mérleg (Mérlegkimutatás - Eszközök és Források)

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Könyvelés** csoportban található: **Mérleg**.
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/balance-sheet`
- **Jogosultság:** Cégtulajdonos, adminisztrátor, pénzügyi vezető és könyvelő.

---

## 2. A menü funkciója és célja
A **Mérleg** modul a vállalkozás vagyoni helyzetének adott fordulónapra (pl. december 31., negyedév vége vagy hó vége) vonatkozó hivatalos számviteli kimutatása a magyar Számviteli törvény (Sztv.) előírásai szerint.

### Fő feladatai:
- **Kétoldalú vagyoni egyensúly (Mérlegegyezőség elve):**
  - **Eszközök (Aktívák):** A vállalkozás vagyontárgyainak összessége rendeltetésük és forgási sebességük szerint.
  - **Források (Passzívák):** A vagyontárgyak eredete és finanszírozási háttere (saját tőke, kötelezettségek).
  - Folyamatos egyezőség-ellenőrzés: `Eszközök összesen = Források összesen` (esetleges mérlegkülönbözet azonnali detektálása).
- **Számviteli struktúra hierarchiája:**
  - **Eszközök:**
    - *A. Befektetett eszközök:* Immateriális javak, tárgyi eszközök (ingatlanok, gépek, járművek), befektetett pénzügyi eszközök (részesedések, tartós kölcsönök).
    - *B. Forgóeszközök:* Készletek (anyagok, áruk), követelések (vevők, egyéb követelések), értékpapírok, pénzeszközök (pénztárak, bankbetétek).
    - *C. Aktív időbeli elhatárolások.*
  - **Források:**
    - *D. Saját tőke:* Jegyzett tőke, tőketartalék, eredménytartalék, lekötött tartalék, értékelési tartalék, tárgyévi adózott eredmény.
    - *E. Céltartalékok.*
    - *F. Kötelezettségek:* Hosszú lejáratú kötelezettségek (beruházási hitelek) és rövid lejáratú kötelezettségek (szállítók, NAV tartozások, munkabér tartozások).
    - *G. Passzív időbeli elhatárolások.*
- **Pénzügyi mutatószámok:** Tőkeellátottság, likviditási gyorsráta, eladósodottsági fok és forgóeszköz-fedezettség azonnali kalkulációja.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Mérlegegyezőségi Kártya és Differencia Figyelmeztető
- **Hogy hívják:** Mérlegegyezőségi állapotjelző és ellenőrző kártya
- **Mire való:** A kettős könyvvitel alaptörvényének ellenőrzése: azonnal jelzi, hogy az Eszközök és Források összege forintra pontosan egyezik-e, vagy könyvelési anomália/differencia áll fenn.
- **Hol található a felületen:** A fejléc közepén lévő kiemelt státuszkártya (zöld pipa vagy piros felkiáltójel).
- **Hogyan használhatja a felhasználó:**
  1. Ellenőrizze a fejléc kártyáját a kívánt fordulónapon.
  2. Ha a kártya zöld (**„Mérleg egyezik: 0 Ft differencia”**), a mérleg formailag és számvitelileg hibátlan.
  3. Ha piros figyelmeztetés jelenik meg (pl. *„Mérlegeltérés: -125 000 Ft”*), kattintson a kártyára.
  4. A rendszer megnyit egy diagnosztikai panelt, amely megmutatja az egyoldalú vagy függő könyvelési tételeket.
  - **Eredmény:** Azonnali visszajelzés a könyvelési zárlat helyességéről még a hivatalos leadás előtt.

### 3.2 Eszközök és Források Nézetváltó Kapcsoló
- **Hogy hívják:** Nézetváltó fülcsoport (**„Eszközök”**, **„Források”**, **„Kétoszlopos osztott mérleg”**)
- **Mire való:** A vagyoni eszközök és a források kényelmes vizsgálata, külön-külön vagy egymás mellett elhelyezve a klasszikus mérlegséma szerint.
- **Hol található a felületen:** A mérlegtáblázat feletti lapfülek.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Eszközök”** fülre a gépek, készletek, vevőkövetelések és bankegyenlegek vizsgálatához.
  2. Kattintson a **„Források”** fülre a tőke, hitelek és szállítói tartozások ellenőrzéséhez.
  3. Nagy monitoron válassza a **„Kétoszlopos osztott mérleg”** nézetet a két oldal párhuzamos összehasonlításához.
  - **Eredmény:** Testreszabott elrendezés az átlátható vagyonelemzéshez.

### 3.3 Mérlegtételek Kibontása és Számlaszintű Mélyfúrás
- **Hogy hívják:** Mérlegsor lenyitó nyíl és kapcsolódó főkönyvi számlák
- **Mire való:** Az A–G mérlegfőcsoportok és római számmal jelölt alcsoportok lebontása konkrét főkönyvi számlákra (1-es, 2-es, 3-as, 4-es számlaosztályok).
- **Hol található a felületen:** A mérlegtáblázat minden sora előtt található lenyitó nyíl.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a vizsgálni kívánt tételt (pl. *B.II. Követelések* -> *1. Követelések áruszállításból és szolgáltatásból (vevők)*).
  2. Kattintson a sor elején lévő nyílra.
  3. Tekintse át a mögötte álló számlákat (pl. 311 Belföldi vevők, 316 Kétes vevők).
  4. Kattintson a főkönyvi számra a tételes partnerlista és a számlák megnyitásához.
  - **Eredmény:** A mérlegsor pillanatok alatt visszakövethető az eredeti bejövő és kimenő számlákig.

### 3.4 Pénzügyi Mutatószámok Analitikai Kártyái
- **Hogy hívják:** Vagyoni és likviditási mutatószámok kártyasora
- **Mire való:** A cég pénzügyi stabilitásának azonnali értékelése (Saját tőke arány, Likviditási gyorsráta, Eladósodottsági fok, Tőkeáttétel).
- **Hol található a felületen:** A mérlegtáblázat alatti összegző sávban, vagy a fejléc jobb oldalán.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a számított mutatókat és a mellettük lévő színkódokat (Zöld: stabil, Sárga: figyelendő, Piros: tőkevesztési veszély).
  2. Vigye az egeret bármelyik mutató fölé a számítási képlet (pl. *Forgóeszközök / Rövid lejáratú kötelezettségek*) megtekintéséhez.
  - **Eredmény:** Vezetői és banki kockázatelemzés azonnal, kézi számolgatás nélkül.

### 3.5 Hivatalos Mérleg Exportálása (PDF / Excel)
- **Hogy hívják:** „Mérleg letöltése” gombok
- **Mire való:** Hivatalos, pecsételhető és aláírásra alkalmas éves vagy időközi mérlegdokumentum generálása ezer forintos kerekítéssel.
- **Hol található a felületen:** A fejléc jobb felső sarkában lévő **„Export (PDF)”** és **„Export (Excel)”** gombok.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a pontos fordulónapot (pl. 2026. december 31.).
  2. Kapcsolja be az **„eFt”** kapcsolót, ha hivatalos beszámolós formátumot szeretne.
  3. Kattintson a kívánt letöltési gombra.
  - **Eredmény:** Letöltődik a céges adatokkal, hivatalos rovatszámokkal és könyvelői záradékkal ellátott mérlegdokumentum.
