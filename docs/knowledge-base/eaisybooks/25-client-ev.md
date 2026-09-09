# 🪙 Egyéni Vállalkozás és Pénztárkönyv Modul (Client EV Module)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Adózás  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő), aki jogosult a vállalkozó kezelésére  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Egyéni vállalkozó kiválasztása után az eaisyBooks bal oldali menüjében: **Egyéni Vállalkozás** menüpont (`/eaisybooks/:companyId/:dateRange/ev`).
- **Ikon:** Érmék / Malacpersely (`PiggyBank` / `Coins`) ikon
- **Elérési útvonal:** Portfólió → Ügyfél kiválasztása → Egyéni Vállalkozás
- **Gyorsműveletek:** Adóév váltása, átalányadó és AAM keretfigyelő ellenőrzése, pénztárkönyv megnyitása, NAV számlák importálása a pénztárkönyvbe, 58-as havi járulékbevallás generálása

---

## 2. A menü funkciója és célja

Az **Egyéni Vállalkozás (EV)** modul a hazai egyéni vállalkozók, szabadfoglalkozásúak és egyszerűsített szervezetek (pl. társasházak, alapítványok) egyszeres könyvvitelének, pénztárkönyvének és adózásának (Átalányadó, KATA, Vállalkozói SZJA) professzionális könyvelési központja.

### Fő feladatai és adózási funkciói:
1. **Átalányadó automatizmusok:** 40%, 80% vagy 90%-os költséghányad alkalmazása, az éves törvényi adómentes keret (minimálbér felének megfelelő jövedelem) göngyölése és a havi járulékok kalkulálása.
2. **KATA keretfigyelő és partnerlimitek:** A 18 millió Ft-os éves keret és az egy kifizetőtől származó 3 millió Ft feletti 40%-os különadó-veszély valós idejű monitorozása.
3. **Pénzforgalmi szemléletű digitális Pénztárkönyv:** Bevételek és kiadások tételeinek vezetése, a kiegyenlített NAV Online Számlák egykattintásos beemelése a pénztárkönyvi rovatokba.
4. **Havi és éves adóbevallások:** 2658-as (vagy 2608-as) havi járulékbevallás, HIPA adóbevallás és éves 26SZJA bevallás automatikus előkészítése.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Cégfejléc és Adózási Jogállás Jelvények
- **Hogy hívják:** Fejléc cégadatok, Adózási forma jelvény (Átalányadó / VSZJA / KATA), Jogviszony jelvény (Főállású / Mellékállású / Nyugdíjas), ÁFA jelvény és Adóév választó
- **Mire való:** A vállalkozó adózási formájának, járulékfizetési státuszának azonnali leolvasása és az elszámolási adóév kiválasztása.
- **Hol található a felületen:** A képernyő legfelső fejlécében.
- **Hogyan használhatja a felhasználó:**
  1. Ellenőrizze a lila jelvényt (pl. *Átalányadó*), a kék jelvényt (pl. *Főfoglalkozású*) és az ÁFA státuszt (pl. *Alanyi mentes*).
  2. Az évválasztó gombokkal váltson az adóévek között (pl. 2026, 2025).
  - **Eredmény:** Az egész felület adatai, mérőműszerei és kalkulációi átváltanak a kijelölt adóévre.

### 3.2 Pénzügyi Összegző és Keretfigyelő Kártyák
- **Hogy hívják:** Éves bevétel (YTD), Éves kiadás, Pénzforgalmi egyenleg kártyák és Limitmérő sávok
- **Mire való:** A vállalkozás bevételeinek és kiadásainak összevetése, valamint a törvényi értékhatárok (AAM 12M Ft, Átalányadó 18M Ft / adómentes sáv, KATA 18M Ft) telítettségének vizuális követése.
- **Hol található a felületen:** A fejléc alatt sorakozó nagy számlálókártyák és színes folyamatcsíkok.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg az **Éves bevétel** forintösszegét.
  2. Nézze meg az **Átalányadó mentes keret** csíkját: zöld állapotban még van adómentes jövedelem, narancssárga állapotban a vállalkozó belépett a 15% SZJA fizetési sávba.
  3. Kövesse az **Alanyi áfamentes (AAM)** mutatót: ha eléri a 10-11 millió Ft-ot, figyelmeztesse az ügyfelet a 12 milliós ÁFA-határ átlépésére.
  - **Eredmény:** Megelőzhetők a súlyos bírságok és a váratlan adófizetési kötelezettségek.

### 3.3 1. Blokk — Törzsadatok és Beállítás Varázsló
- **Hogy hívják:** „Törzsadatok & életciklus” kártya, „Törzsadatok”, „Életciklus” és „Beállítás varázsló” gombok
- **Mire való:** A vállalkozó ÖVTJ tevékenységi köreinek, költséghányadának (40/80/90%), szüneteltetési időszakainak karbantartása.
- **Hol található a felületen:** Az alsó 5 oszlopos funkcióblokk első oszlopa.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Beállítás varázsló”** gombra az adózási mód év eleji átállításához.
  2. Kattintson az **„Életciklus”** gombra a vállalkozás indítási, szüneteltetési és újraindítási dátumainak rögzítéséhez.
  - **Eredmény:** A rendszer az aktív napok arányában kalkulálja a havi járulékokat és a tört évi adókereteket.

### 3.4 2. Blokk — Adózási Formák és Kalkulátorok
- **Hogy hívják:** „Átalányadó kalkulátor”, „Vállalkozói SZJA”, „KATA kisadózó”, „Formák összehasonlítása” gombok
- **Mire való:** Részletes adóalap- és adószámítások végzése, valamint összehasonlító szimuláció futtatása az optimális adózási forma kiválasztásához.
- **Hol található a felületen:** A második funkcióoszlop.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Átalányadó kalkulátor”** gombra a göngyölt jövedelem és adóterhek vizsgálatához.
  2. Kattintson az **„Adózási formák összehasonlítása”** gombra: a rendszer egy összehasonlító táblázatban kimutatja, hogy a vállalkozó adott bevételei mellett mennyi adót fizetne KATA, Átalányadó vagy Kft. cégformában.
  - **Eredmény:** Értékes adótanácsadási anyagot kap az ügyfél számára.

### 3.5 3. Blokk — Digitális Pénztárkönyv és NAV Számla Import
- **Hogy hívják:** „Pénztárkönyv főoldal”, „NAV számla import pénztárkönyvbe” és „Pénztárkönyv zárási varázsló” gombok
- **Mire való:** A törvényi egyszeres könyvviteli pénztárkönyv vezetése és a számlák beemelése.
- **Hol található a felületen:** A harmadik funkcióoszlop.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„NAV számla import pénztárkönyvbe”** gombra.
  2. A rendszer automatikusan felajánlja a tárgyidőszaki kibocsátott és befogadott számlákat, amelyeket egy kattintással beilleszthet a pénztárkönyv bevételei és kiadásai közé.
  3. A hónap végén kattintson a **„Pénztárkönyv zárási varázsló”** gombra a záró pénzkészlet egyeztetéséhez.
  - **Eredmény:** Hivatalos, auditálható pénztárkönyvi analitika jön létre.

### 3.6 4. Blokk — Járulékszámítás és Havi Bevallások
- **Hogy hívják:** „Havi járulékszámítás”, „58-as bevallás generálása”, „HIPA kalkuláció” gombok
- **Mire való:** A havonta benyújtandó Tbj. és Szocho bevallások elkészítése, ÁNYK exportfájlok generálása.
- **Hol található a felületen:** A negyedik funkcióoszlop.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a **„Havi járulékszámítás”** gombot.
  2. A rendszer a jogállás (főállású esetén a minimálbér 112,5%-os szocho alapja és a minimálbér TB alapja) szerint kiszámolja a fizetendő összegeket.
  3. Kattintson az **„58-as bevallás”** gombra a hivatalos NAV beküldő XML fájl letöltéséhez.
  - **Eredmény:** A bevallás másodpercek alatt benyújthatóvá válik az ÁNYK-ban vagy Cégkapun.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Havi átalányadós bevallás készítése főállású EV-nél
1. A könyvelő belép az ügyfél **Egyéni Vállalkozás** felületére.
2. Megnyitja a **Pénztárkönyvet**, beimportálja a hónapban kifizetett számlákat.
3. Ellenőrzi a keretfigyelőt: a vállalkozó még az adómentes jövedelemsávban van, így SZJA-t nem fizet.
4. Rákattint a **Havi járulékszámítás** menüpontra, amely automatikusan kiszámolja a törvényi minimum Szocho (13%) és TB járulék (18,5%) összegeket.
5. Legenerálja a havi 58-as bevallást, és elküldi az adófizetési értesítőt az ügyfélnek.

### 4.2 Évközi KATA limitfigyelés
1. A könyvelő a havi számlák rögzítésekor megnyitja a KATA modult.
2. Látja, hogy egy adott céges vevő felé kiállított számlák összege elérte a 2 800 000 Ft-ot.
3. Azonnal figyelmezteti a vállalkozót, hogy a 3 millió Ft feletti részre a kifizetőnek 40%-os különadót kellene fizetnie, megelőzve a hátrányos adóztatást.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **1995. évi CXVII. törvény a személyi jövedelemadóról (Szja tv.):** Átalányadózás szabályai, költséghányadok (53. §), adómentes keret, vállalkozói SZJA.
- **2022. évi XIII. törvény a kisadózó vállalkozók tételes adójáról (új KATA):** 18 milliós keret, 50 000 Ft tételes adó, magánszemély vevői korlátozás.
- **2019. évi CXXII. törvény a társadalombiztosítás ellátásaira jogosultakról (Tbj.):** Egyéni vállalkozók kötelező járulékfizetési alsó határai.
- **2018. évi LII. törvény a szociális hozzájárulási adóról (Szocho tv.):** Minimális adóalap számítása (minimálbér 112,5%-a).
