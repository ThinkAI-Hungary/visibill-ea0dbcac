# Házipénztár és Készpénzforgalom

## 1. Hol található? (Elhelyezkedés és Navigáció)
- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Pénzügyek** csoportban található: **Házipénztár**.
- **Elérési útvonal:**
  - A cég kiválasztása után a menüből közvetlenül megnyitható.
  - Webcím: `/:companyId/:dateRange/petty-cash`
- **Jogosultság:** Cégtulajdonos, adminisztrátor, pénztáros és könyvelő.

---

## 2. A menü funkciója és célja
A **Házipénztár** modul a vállalkozás készpénzes pénzmozgásainak, készpénzes számláinak, valamint a hivatalos bevételi és kiadási pénztárbizonylatoknak a szigorú számadású nyilvántartása a Számviteli törvény és a Pénzkezelési szabályzat előírásainak megfelelően.

### Fő feladatai:
- **Több fizikai és deviza pénztár kezelése:** Alapértelmezett forint pénztár, valuta pénztárak (EUR, USD), valamint telephelyi pénztárak párhuzamos nyilvántartása.
- **Készpénzes számlák automatikus átvezetése:** A számlák közül a készpénzes fizetési módú bizonylatok automatikus pénztárba sorolása.
- **Szigorú számadású pénztárbizonylatok:** Sorszámozott Bevételi Pénztárbizonylat (BPB) és Kiadási Pénztárbizonylat (KPB) generálása dolgozói előlegekhez, tagi kölcsönökhöz vagy készpénzes betétekhez.
- **Törvényi készpénzfizetési limit ellenőrzése:** Figyelmeztetés a magyar jogszabályok szerinti készpénzfizetési korlát átlépésére, egyedileg beállítható küszöbértékkel.
- **Címletjegyzék kalkulátor:** Fizikai készpénzállomány címletenkénti (20 000, 10 000, 5 000, 2 000, 1 000, 500 Ft-os bankjegyek és érmék) felmérése és összevetése a könyv szerinti egyenleggel.
- **Negatív egyenleg riasztás:** Azonnali tiltás és figyelmeztetés olyan kiadás rögzítésekor, amely a pénztárat negatív egyenlegbe vinné át (számviteli anomália kizárása).

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Új Pénztárbizonylat Kiállítása
- **Hogy hívják:** „Új bizonylat” gomb és kiállító ablak (Bevételi / Kiadási pénztárbizonylat)
- **Mire való:** Szigorú számadású készpénzes kifizetés vagy befizetés rögzítése, jogcím hozzárendelése és bizonylatszám kiosztása.
- **Hol található a felületen:** A fejléc jobb felső sarkában elhelyezkedő kék **„Új bizonylat”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új bizonylat”** gombra.
  2. Válassza ki a bizonylat irányát: **„Bevétel (BPB)”** vagy **„Kiadás (KPB)”**.
  3. Válassza ki az érintett pénztárat (pl. *Központi HUF Pénztár* vagy *EUR Valutapénztár*).
  4. Adja meg a partnert vagy munkavállalót, a fizetett összeget, valamint a jogcímet (pl. *Dolgozói előleg*, *Tagi kölcsön*, *Készpénzes vásárlás*).
  5. Számlakiegyenlítés esetén jelölje be a kapcsolódó számlát.
  6. Kattintson a **„Bizonylat kiállítása”** gombra.
  - **Eredmény:** A rendszer kiosztja a következő szigorú számadású sorszámot, frissíti a pénztár egyenlegét, és felajánlja a bizonylat azonnali PDF nyomtatását.

### 3.2 Címletjegyzék Kalkulátor és Kasszaellenőrzés
- **Hogy hívják:** „Címletjegyzék” gomb és számláló kalkulátor
- **Mire való:** A fizikai kasszában lévő készpénz (bankjegyek és érmék) leltározása, valamint a könyv szerinti egyenleg és a fizikai valóság összevetése (leltárhiány vagy többlet kimutatása).
- **Hol található a felületen:** A pénztárkártyák jobb szélén lévő számológép ikon, vagy a bizonylatlista feletti **„Címletjegyzék”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Címletjegyzék”** gombra.
  2. A megjelenő táblázatban írja be a fizikailag megszámolt darabszámokat a megfelelő címletek mellé (20 000, 10 000, 5 000, 2 000, 1 000, 500 Ft-os bankjegyek, valamint 200, 100, 50, 20, 10, 5 Ft-os érmék).
  3. A rendszer automatikusan számolja az összesített fizikai összeget, és összehasonlítja a programban lévő pénztáregyenleggel.
  4. Ellenőrizze a számított differenciát (Egyező / Többlet / Hiány).
  5. Kattintson a **„Címletjegyzék mentése / Nyomtatás”** gombra.
  - **Eredmény:** A leltárív elmentődik az audit naplóba, és nyomtatható bizonylatként csatolható a napi záráshoz.

### 3.3 Hivatalos Időszaki Pénztárjelentés Generálása
- **Hogy hívják:** „Pénztárjelentés letöltése” gomb
- **Mire való:** A Számviteli törvény által megkövetelt hivatalos időszaki idősoros pénztárjelentés összeállítása nyitó egyenleggel, forgalommal, záró egyenleggel és aláírási rovatokkal.
- **Hol található a felületen:** A fejléc export műveleti sávjában, a **„Jelentés (PDF)”** gombra kattintva.
- **Hogyan használhatja a felhasználó:**
  1. Állítsa be a kívánt időszakot az időszakválasztóban (pl. adott naptári hónap vagy hét).
  2. Kattintson a **„Jelentés (PDF)”** gombra.
  3. Tekintse át a generált bizonylatfejet: cégadatok, pénztáros neve, nyitó- és záróegyenleg, időrendi tételek és sorszámok.
  4. Kattintson a **„Letöltés”** vagy **„Nyomtatás”** gombra.
  - **Eredmény:** Letöltődik a kétpéldányos, aláírásra alkalmas hivatalos pénztárjelentés PDF dokumentum.

### 3.4 Pénztár Létrehozása és Alapadatok Kezelése
- **Hogy hívják:** „Új pénztár hozzáadása” gomb
- **Mire való:** Új telephelyi pénztár, üzletkassza vagy deviza (EUR, USD) pénztár megnyitása a rendszerben.
- **Hol található a felületen:** A **„Pénztárak”** fül alatt, a pénztárkártyák utáni **„+ Új pénztár”** kártyára kattintva.
- **Hogyan használhatja a felhasználó:**
  1. Váltson a **„Pénztárak”** lapfülre.
  2. Kattintson a **„+ Új pénztár”** gombra.
  3. Adja meg a pénztár megnevezését (pl. *Győri fiók pénztár*), devizanemét (HUF, EUR stb.) és a felelős pénztáros nevét.
  4. Adja meg a kapcsolódó főkönyvi számlaszámot (pl. 3811, 3812).
  5. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** Létrejön az új független pénztár saját számlálóval és egyenleggel.

### 3.5 Törvényi és Belső Készpénzlimit Beállítása
- **Hogy hívják:** „Készpénzlimit konfiguráció” panel
- **Mire való:** A törvényi készpénzfizetési korlátok (havi 1,5 millió Ft ügyletenkénti limit) és a belső pénzkezelési szabályzat szerinti napi zárólimit felügyelete.
- **Hol található a felületen:** A fejléc jobb oldalán található pajzs/beállítás ikonra kattintva.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Limit beállítások”** gombra.
  2. Állítsa be a maximálisan engedélyezett készpénzállomány értékét és az egy tranzakcióra vonatkozó figyelmeztetési küszöböt.
  3. Kapcsolja be a riasztást a túllépés esetére.
  4. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** Ha egy tétel rögzítésekor az egyenleg vagy a kifizetés túllépi a megadott korlátot, a rendszer azonnal piros figyelmeztető sávot jelenít meg, megelőzve az adóbírságot.
