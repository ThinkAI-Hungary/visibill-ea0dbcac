# 💼 Jogviszonykódok és FEOR Törzs (Job Codes & FEOR)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Szakmai Törzsadatok & Adminisztráció  
> **Szükséges szerepkör:** Irodavezető adminisztrátor (`iroda_admin`), Bérszámfejtő, Szenior könyvelő  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Törzsadatok & Rendszer** csoportban: **Jogviszonykódok** menüpont (`/eaisybooks/admin/job-codes`).
- **Ikon:** Nyitott könyv (`BookOpen`) ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → Jogviszonykódok
- **Gyorsműveletek:** Keresés jogviszonykódra és FEOR-ra, új foglalkoztatási kód felvétele, biztosítási és minimális járulékalap szabályok szerkesztése, NAV referencia megtekintése

---

## 2. A menü funkciója és célja

A **Jogviszonykódok és FEOR Törzs** a magyar társadalombiztosítási és adójogszabályok szerinti foglalkoztatási formák (T1041 és havi 08-as bevallás jogviszonykódjai) hivatalos törzsadatbázisa. Biztosítja, hogy a dolgozók bejelentése és havi bérszámfejtése a hatályos törvényi besorolások szerint, hibátlan adó- és járulékszámítással történjen.

### Fő feladatai és jogi támogatása:
1. **NAV Jogviszonykód Master Adatbázis:** A Nemzeti Adó- és Vámhivatal által előírt 4 jegyű jogviszonykódok (pl. 1101 - Munkaviszony, 1210 - Megbízás, 1311 - Társas vállalkozó, 1420 - EFO alkalmi munka) központi karbantartása.
2. **Biztosítási kötelezettség és minimális járulékalap:** Rögzíti, hogy az adott jogviszony kötelezően biztosított-e, illetve vonatkozik-e rá a minimálbér 30%-os járulékfizetési alsó határa.
3. **Érvényességi idősávok kezelése:** Jogszabályváltozások esetén határidőhöz köti a kódok hatályosságát (`valid_from` és `valid_to`), megelőzve az elavult kódok használatát.
4. **Hivatalos NAV jogszabályi referenciák:** Közvetlen linkeket és szakmai instrukciókat biztosít a bérszámfejtők számára az egyes speciális jogviszonyok helyes alkalmazásához.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Szabadszavas Kereső és Állapotszűrő Gombok
- **Hogy hívják:** „Keresés kód vagy megnevezés...” beviteli mező és Állapotszűrő fülek (Mind, Aktív, Inaktív)
- **Mire való:** A kódok gyors felkutatása számkód (pl. „1101”) vagy szövegrészlet (pl. „munkaviszony”, „megbízás”) alapján, valamint a hatályon kívüli tételek szűrése.
- **Hol található a felületen:** A táblázat feletti szűrősáv bal és jobb oldalán.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a keresett 4 jegyű számot vagy szót a keresőmezőbe.
  2. Kattintson az **„Aktív”** gombra, ha csak a jelenleg érvényes jogviszonyokat kívánja látni.
  3. Kattintson az **„Inaktív”** gombra a korábbi években kivezetett jogviszonykódok ellenőrzéséhez.
  - **Eredmény:** A táblázat azonnal frissül a szűrési feltételeknek megfelelően.

### 3.2 „Új kód” Felvétele Gomb
- **Hogy hívják:** „Új kód” gomb (`Plus` ikon)
- **Mire való:** Új hatósági jogviszonykód vagy speciális belső foglalkoztatási típus rögzítése a törzsben.
- **Hol található a felületen:** A fejléc jobb felső sarkában, a címsor mellett.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új kód”** gombra.
  - **Eredmény:** Megnyílik az üres jogviszonykód adatlap párbeszédablaka.

### 3.3 Jogviszonykód Szerkesztő és Létrehozó Dialógus
- **Hogy hívják:** Jogviszonykód szerkesztő űrlap, kapcsolók és „Mentés” gomb
- **Mire való:** A kód azonosítójának, hivatalos megnevezésének, biztosítotti státuszának és járulékszabályainak pontos paraméterezése.
- **Hol található a felületen:** A felugró ablak közepén.
- **Hogyan használhatja a felhasználó:**
  1. Adja meg a 4 jegyű számot a **„Kód”** mezőben (pl. `1101`).
  2. Írja be a hivatalos megnevezést a **„Megnevezés”** mezőbe (pl. *Munkaviszonyban álló, heti 40 órás teljes munkaidő*).
  3. Állítsa be a **„Biztosítás”** kapcsolót (zöld, ha a jogviszony TB biztosítási kötelezettséget keletkeztet).
  4. Rögzítse a **„Minimális járulékalap szabály”** leírását (pl. *Minimálbér 30%-a*).
  5. Adja meg az érvényesség kezdetét és végét a dátumválasztókkal.
  6. Szükség esetén illessze be a NAV tájékoztató linkjét a **„NAV referencia URL”** mezőbe.
  7. Írjon belső szakmai instrukciót a **„Megjegyzések”** szövegdobozba.
  8. Kattintson a kék **„Mentés”** gombra.
  - **Eredmény:** A jogviszonykód elmentődik és azonnal kiválaszthatóvá válik az új munkavállalók felvételekor és a bérszámfejtésben.

### 3.4 Kód Módosítása és NAV Referencia Megnyitása
- **Hogy hívják:** „Szerkesztés” ceruza gomb (`Edit3`) és „NAV link” külső hivatkozás ikon (`ExternalLink`)
- **Mire való:** Egy meglévő tétel adatainak frissítése, illetve a hivatalos NAV jogszabályi állásfoglalás közvetlen megnyitása új böngészőlapon.
- **Hol található a felületen:** A táblázat minden egyes sorának jobb szélén lévő akciógombok.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a ceruza ikonra a jogviszonykód adatainak módosításához.
  2. Kattintson a kis nyíl ikonra (`ExternalLink`), ha át kívánja tekinteni a NAV hivatalos módszertani útmutatóját az adott kód alkalmazásáról.
  - **Eredmény:** Pontos szakmai háttér-információhoz jut másodpercek alatt.

### 3.5 Táblázatos Lapozó és Tételszám
- **Hogy hívják:** Lapozó vezérlősáv (`UnifiedPagination`)
- **Mire való:** Navigálás a több tucatnyi kód között (50 tétel / oldal).
- **Hol található a felületen:** A táblázat alatt, a képernyő alsó részén.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a következő oldalra ugró nyílra vagy a konkrét oldalszámra.
  - **Eredmény:** A rendszer betölti a következő 50 jogviszonykódot.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Új munkavállaló jogviszonyának ellenőrzése a T1041 előtt
1. A bérszámfejtő egy új megbízási szerződést kap az ügyféltől.
2. Megnyitja a **Jogosultságkódok** menüt, beírja a keresőbe: *„1210”*.
3. Ellenőrzi a minimális járulékalap szabályt és a biztosítotti státusz feltételét (a havi díjazás eléri-e a minimálbér 30%-át).
4. Ennek ismeretében készíti el a T1041-es bejelentőt és állítja be a dolgozó kartonját.

### 4.2 Év eleji jogszabályváltozás átvezetése
1. Január 1-jével a jogalkotó új jogviszonykódot vezet be a speciális foglalkoztatásra.
2. Az irodavezető az **„Új kód”** gombra kattint.
3. Rögzíti a hatósági kódszámot, bekapcsolja a biztosítotti státuszt, és beállítja az érvényesség kezdetét `2026-01-01` dátumra.
4. Mentés után a bérszámfejtő kollégák azonnal használhatják a friss kódot.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2019. évi CXXII. törvény a társadalombiztosítás ellátásaira jogosultakról (Tbj.):** A biztosítási kötelezettség elbírálása, a minimális járulékalap szabályai.
- **2017. évi CL. törvény az adózás rendjéről (Art.):** Munkaviszony és egyéb jogviszonyok bejelentése a T1041-es nyomtatványon a foglalkoztatás megkezdése előtt.
- **KSH FEOR-08:** Foglalkozások Egységes Osztályozási Rendszere a szakképzettségi szintek megállapításához.
