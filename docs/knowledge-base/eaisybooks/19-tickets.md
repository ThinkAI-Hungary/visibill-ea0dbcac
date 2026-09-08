# 🎫 Könyvelői Hibajegyek és Ügyfélszolgálat (Tickets Console)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Támogatás & Kommunikáció  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő, Bérszámfejtő)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Támogatás** csoportban: **Hibajegyek** menüpont (`/eaisybooks/tickets`), a felirat mellett piros számláló jelvénnyel a még megválaszolatlan jegyekről.
- **Ikon:** Hibajegy (`TicketCheck`) ikon
- **Elérési útvonal:** Oldalsáv → Hibajegyek (vagy közvetlenül `/eaisybooks/tickets/:ticketId`)
- **Gyorsműveletek:** Saját/összes jegy közötti váltás, új jegy nyitása ügyfél felé, státusz és felelős módosítása, ügyfélválasz küldése és belső szakmai feljegyzés rögzítése

---

## 2. A menü funkciója és célja

A könyvelői **Hibajegyek** modul a könyvelőiroda és az ügyfélvállalkozások közötti hivatalos, strukturált ügyfélszolgálati és feladatkezelő konzolja. Biztosítja, hogy a számlázási kérdések, bizonylat-eltérések, bérszámfejtési adatbekérések és adózási észrevételek ne vesszenek el a privát e-mailekben vagy telefonhívásokban, hanem auditált, visszakövethető feladatláncon fussanak végig.

### Fő feladatai és előnyei az iroda számára:
1. **Központosított ügyféli megkeresések:** Az ügyfelek az eaisyBill számlázóból közvetlenül nyithatnak jegyet, amely automatikusan tartalmazza a hivatkozott számla vagy gazdasági esemény adatait.
2. **Kétirányú kommunikáció és belső jegyzetek:** Lehetővé teszi az ügyféllel folytatott nyilvános eszmecserét, valamint az ügyfél elől rejtett belső sárga szakmai megjegyzések rögzítését a könyvelőcsapaton belül.
3. **Felelős-kiosztás és eszkaláció:** A beérkező megkeresések hozzárendelhetők a kijelölt könyvelőhöz, bérszámfejtőhöz vagy irodavezetőhöz.
4. **SLA és határidő-garancia:** A prioritási és státusz-jelvények segítik a sürgős adóügyi elakadások azonnali kezelését.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Szűrősáv és Keresőmező
- **Hogy hívják:** „Keresés tárgy, leírás...” beviteli mező, Státusz és Prioritás szűrők, „Összes jegy mutatása” kapcsoló
- **Mire való:** A több tucatnyi jegy szűkítése kulcsszavak, státuszok, sürgősség és felelősség szerint.
- **Hol található a felületen:** A képernyő felső részén elhelyezkedő szűrősáv.
- **Hogyan használhatja a felhasználó:**
  1. Gépelje be az ügyfél nevét vagy a hibajegy témáját a keresőmezőbe.
  2. A **Státusz** legördülő menüben válassza ki a vizsgálandó állapotokat:
     - **Új:** Frissen érkezett, még megválaszolatlan ügyféli kérés.
     - **Folyamatban:** A könyvelő által már átvett és vizsgálat alatt lévő ügy.
     - **Függőben / Ügyfélre vár:** A könyvelő kérdést tett fel, az ügyfél válaszára vár a folyamat.
     - **Megoldva:** A szakmai válasz átadva, lezárásra vár.
     - **Lezárva:** Befejezett és archivált jegy.
  3. A **Prioritás** szűrővel szűkítsen a Sürgős vagy Magas prioritású ügyekre.
  4. Kapcsolja be az **„Összes jegy mutatása”** opciót, ha a teljes irodai állományt át kívánja tekinteni a kizárólag saját jegyek helyett.
  - **Eredmény:** A táblázat azonnal frissül a szűrési feltételek szerint.

### 3.2 „Új hibajegy” Nyitása Gomb
- **Hogy hívják:** „Új hibajegy” gomb (`Plus` / `TicketPlus` ikon)
- **Mire való:** Új jegy proaktív indítása az ügyfél vagy a belső irodai kollégák felé (pl. hiányzó zárási adatok bekérésére).
- **Hol található a felületen:** A fejléc jobb felső sarkában.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új hibajegy”** gombra.
  2. A felugró ablakban válassza ki az ügyfélcéget, írja be a tárgyat és a részletes leírást.
  3. Állítsa be a prioritást és csatoljon fájlokat.
  4. Kattintson a mentésre.
  - **Eredmény:** A jegy létrejön, és az ügyfél azonnal értesítést kap a számlázójában és e-mailben.

### 3.3 Hibajegy Lista és Részletező Megnyitása
- **Hogy hívják:** Hibajegylista táblázat sorai, Státusz jelvény és Prioritás jelvény
- **Mire való:** A nyitott kérések áttekintése és egy adott jegy teljes munkalapjának megnyitása.
- **Hol található a felületen:** A táblázat soraiban.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg a tárgyat, az ügyfél nevét, az utolsó frissítés idejét és a felelős könyvelő nevét.
  2. Kattintson a kívánt sorra a részletes adatlap és a beszélgetési szál megnyitásához.
  - **Eredmény:** A rendszer megnyitja a jegy részletező nézetét (`TicketDetailView`).

### 3.4 Válaszadás az Ügyfélnek
- **Hogy hívják:** Üzenetszerkesztő szövegdoboz, Fájlcsatolás gomb és „Válasz küldése” gomb
- **Mire való:** Hivatalos szakmai válasz, útmutatás vagy dokumentumcsatolmány visszaküldése az ügyfélnek.
- **Hol található a felületen:** A jegy részletező oldal alsó részén elhelyezkedő válaszíró felület.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a választ a formázható szövegmezőbe.
  2. Szükség esetén csatoljon PDF bérlapot, analitikát vagy képernyőképet a gemkapocs ikonnal.
  3. Kattintson a kék **„Válasz küldése”** gombra.
  - **Eredmény:** Az üzenet azonnal megjelenik a beszélgetési idővonalon, és a rendszer kiküldi az értesítést az ügyfélnek.

### 3.5 Belső Szakmai Feljegyzés Rögzítése (Csak Belső Személyzet)
- **Hogy hívják:** „Belső megjegyzés” kapcsoló / fül (sárga háttérrel)
- **Mire való:** Olyan belső konzultációs jegyzet rögzítése, amelyet a könyvelőcsapat munkatársai látnak, de az ügyfél számára láthatatlan marad.
- **Hol található a felületen:** A válaszíró szövegdoboz feletti „Belső megjegyzés” kapcsoló.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Belső megjegyzés”** fülre: a beviteli mező háttere figyelmeztető sárga színre vált.
  2. Írja be a belső feljegyzést (pl. *„Egyeztettem a NAV-val, az adószámot felfüggesztették, ne állítsunk ki számlát!”*).
  3. Kattintson a **„Belső megjegyzés mentése”** gombra.
  - **Eredmény:** A feljegyzés sárga háttérrel megjelenik az idővonalon, kizárólag a könyvelők számára.

### 3.6 Felelős és Státusz Módosítása
- **Hogy hívják:** „Felelős hozzárendelése” és „Státusz váltása” legördülő mezők
- **Mire való:** A jegy átadása másik kollégának (pl. bérszámfejtőnek) vagy lezárása a feladat elvégzésekor.
- **Hol található a felületen:** A jegy részletező lap jobb felső sarkában.
- **Hogyan használhatja a felhasználó:**
  1. A felelős mezőben válassza ki a kolléga nevét a portfólióból.
  2. A feladat végeztével állítsa a státuszt **„Megoldva”** vagy **„Lezárva”** állapotra.
  - **Eredmény:** A jegy lekerül az aktív sürgősségi listáról, és archiválásra kerül.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Számlakorrekciós ügyfélikérés megoldása
1. Az ügyfél hibajegyet nyit az eaisyBill-ből: *„Hibás áfa-kulccsal állítottam ki a vevőszámlát, hogyan javítsam?”*
2. A kijelölt könyvelő megnyitja a jegyet, átolvassa az ügyfél kérdését.
3. Rákattint a **Belső megjegyzés** fülre és konzultál a szenior kollégával: *„Érvénytelenítő számla és új számla kibocsátása javasolt a 2026. 03. teljesítési időre.”*
4. Átvált az **Ügyfél válasz** felületre, megfogalmazza a lépésről-lépésre követhető útmutatót és elküldi.
5. A státuszt átállítja **„Ügyfélre vár”** állapotra.

### 4.2 Hóvégi bizonylatpótlási felszólítás jegyben
1. A könyvelő a havi ÁFA záráskor hiányzó szállítói számlákat talál.
2. Az **„Új hibajegy”** gombbal indít egy megkeresést az ügyvezetőnek, csatolva a hiánylistát.
3. A prioritást **„Sürgős”** szintre állítja. Az ügyfél közvetlenül a jegy alá feltölti a szkennelt bizonylatokat.
4. A könyvelő letölti és lekönyveli a számlákat, majd a jegyet **„Lezárva”** állapotba helyezi.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2000. évi C. törvény a számvitelről (Sztv.):** Bizonylati elv és bizonylati fegyelem megkövetelése.
- **2017. évi CL. törvény az adózás rendjéről (Art.):** Hivatalos kapcsolattartás és adatszolgáltatási kötelezettség a megbízó és a meghatalmazott között.
