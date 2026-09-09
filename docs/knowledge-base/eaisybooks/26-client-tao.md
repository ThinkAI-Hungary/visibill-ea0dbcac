# 🏛️ Társasági Adó, KIVA és Zárás Modul (Client TAO/KIVA Module)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Adózás  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő), aki jogosult a cég kezelésére  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Kettős könyvvitelt vezető gazdasági társaság kiválasztása után az eaisyBooks bal oldali menüjében: **Társasági Adó** menüpont (`/eaisybooks/:companyId/:dateRange/tao`).
- **Ikon:** Oszlopos épület (`Landmark`) ikon
- **Elérési útvonal:** Portfólió → Ügyfél kiválasztása → Társasági Adó
- **Gyorsműveletek:** Adóalap-korrekciók számítása, 11 lépéses év végi zárási varázsló indítása, TAO vs. KIVA kalkuláció, ÁNYK 2629 / 2671 bevallási export

---

## 2. A menü funkciója és célja

A **Társasági Adó és KIVA (TAO)** modul a kettős könyvvitelt vezető társas vállalkozások (Kft., Bt., Zrt.) vállalati jövedelemadózásának, adóalap-módosító tételeinek, KIVA kötelezettségének és a hivatalos éves mérlegzárásnak a szakmai vezérlőközpontja.

### Fő feladatai és jogi felépítése:
1. **Adózás előtti eredményből kiinduló adóalap-levezetés:** A Tao. törvény 7. és 8. §-a szerinti törvényes növelő (pl. számviteli ÉCS, bírságok, nem vállalkozási célú költségek) és csökkentő tételek (pl. adótörvény szerinti ÉCS, elhatárolt veszteség, K+F kedvezmény) automatizált számítása.
2. **11 lépéses Éves Zárási Varázsló:** Vezérelt folyamat, amely lépésről-lépésre végigvezeti a könyvelőt a beszámoló adataitól a minimumadó vizsgálaton és adókedvezményeken át az elektronikus bevallásig.
3. **KIVA kalkulátor és adóalanyiság kezelése:** Kisvállalati adózást választó cégeknél a személyi jellegű kifizetések és jóváhagyott osztalék alapján számolja a 10%-os KIVA adót.
4. **Adóelőlegek és feltöltési egyenlegek:** Nyomon követi a negyedéves és havi előlegfizetéseket, megelőzve az adóbírságot.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Cégfejléc és TAO Lapfülek
- **Hogy hívják:** Fejléc cégadatok, GFO jelvény (Belföldi Kft. GFO 113), KIVA/TAO jelvény és 5 darab navigációs lapfül
- **Mire való:** A cég adózási jogállásának azonosítása és navigálás a TAO szakterületek között.
- **Hol található a felületen:** A képernyő legfelső részén.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a cég nevét és a zöld cégforma jelvényt.
  2. Kattintson a kívánt témakör fülre:
     - **Áttekintés (`overview`):** A fő műszerfal és az éves zárás állapota.
     - **Adóalany (`status`):** TAO vagy KIVA jogállás beállítása.
     - **Törzsadatok (`master`):** Számviteli politika és adóévek.
     - **Éves zárás (`year-end`):** A 11 lépéses zárási varázsló.
     - **Életciklus (`lifecycle`):** Átalakulások és speciális időszakok.
  - **Eredmény:** A felület a kiválasztott adózási részletre vált.

### 3.2 TAO Pénzügyi KPI Összegző Kártyák
- **Hogy hívják:** Adózás előtti eredmény (AEE), Társasági adóalap, Számított adó (9%), Adókedvezmények, Fizetendő adó kártyák
- **Mire való:** A társasági adó fő számszaki sarokpontjainak azonnali vizuális leolvasása.
- **Hol található a felületen:** A fejléc alatti kártyasor.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le az **Adózás előtti eredményt (AEE)** a könyvelt főkönyvi adatok alapján.
  2. Tekintse meg a korrekciókkal módosított **Társasági adóalap** összegét.
  3. Ellenőrizze a 9%-os **Számított adót**, a levont **Adókedvezményeket** és a végső **Fizetendő adó** összegét.
  - **Eredmény:** Pontos képet kap a cég adókötelezettségéről az év bármely szakában.

### 3.3 11 Lépéses Éves Zárási Varázsló
- **Hogy hívják:** Varázsló lépéssor (1–11 sorszámozott gombok) és „Tovább a következő lépésre” gomb
- **Mire való:** A hivatalos éves társasági adóbevallás és beszámoló ellenőrzött, hibamentes elkészítése.
- **Hol található a felületen:** Az Áttekintés oldal közepén lévő horizontális folyamatsáv.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a folyamatban lévő lépésre vagy az 1. lépésre:
     - **1. Beszámoló:** Mérleg és eredménykimutatás záró számainak egyeztetése.
     - **2. AEE:** Adózás előtti eredmény levezetése.
     - **3. 7. § csökkentők:** ÉCS különbözet, elhatárolt veszteség, K+F kedvezmény érvényesítése.
     - **4. 8. § növelők:** Számviteli ÉCS, bírságok, nem vállalkozási költségek hozzáadása.
     - **5. Kamatkorlát:** Nettó finanszírozási költségek vizsgálata (EBITDA 30% korlát).
     - **6. CFC:** Ellenőrzött külföldi társaságok vizsgálata.
     - **7. Adóalap:** Jövedelem-(nyereség-)minimum szabály ellenőrzése (2%-os minimumadó).
     - **8. Kedvezmények:** Fejlesztési és sporttámogatási adókedvezmények érvényesítése.
     - **9. Felajánlás:** Rendelkező nyilatkozat látvány-csapatsport vagy filmalkotás támogatására.
     - **10. Fizetendő:** Adóelőlegek levonása, fizetendő vagy visszaigényelhető adó megállapítása.
     - **11. Beküldés:** Hivatalos NAV ÁNYK XML fájl generálása és letöltése.
  2. Minden lépésben ellenőrizze az adatokat, majd kattintson a **„Következő lépés”** gombra.
  - **Eredmény:** Teljes körűen kitöltött, törvényes társasági adóbevallást kap.

### 3.4 KIVA Kalkulátor és TAO–KIVA Összehasonlítás
- **Hogy hívják:** „KIVA kalkulátor” munkalap és „TAO vs. KIVA összehasonlító elemzés”
- **Mire való:** Kisvállalati adózás esetén a személyi jellegű kifizetések 10%-os adójának számítása, illetve döntéstámogatás a kedvezőbb adónem kiválasztására.
- **Hol található a felületen:** Az Adóalany lapfül alatti kalkulátor felületeken.
- **Hogyan használhatja a felhasználó:**
  1. Nyissa meg a KIVA kalkulátort.
  2. Tekintse át a havi bérköltségeket és a jóváhagyott osztalékelőlegeket.
  3. Futtassa le az összehasonlító szimulációt: a rendszer diagramon kimutatja a TAO+SZOCHO és a KIVA közötti adókülönbözetet.
  - **Eredmény:** Megbízható szakmai számítással segítheti az ügyvezető adózási döntését.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Májusi TAO bevallás elkészítése a zárási varázslóval
1. A könyvelő a könyvviteli zárlat után belép az ügyfél **Társasági Adó** moduljába.
2. Elindítja a **Zárási Varázslót**, áttekinti az AEE-t és a 7-8. § korrekciókat (ÉCS, veszteségelhatárolás).
3. A 7. lépésben leellenőrzi a jövedelem-minimumot, majd a 10. lépésben levonja a megfizetett TAO előlegeket.
4. A 11. lépésben letölti az ÁNYK formátumú 2629-es bevallást és beküldi a NAV-hoz.

### 4.2 KIVA áttérés vizsgálata év végén
1. Az ügyvezető megkérdezi a könyvelőt, érdemes-e KIVA-ra váltani a következő évtől.
2. A könyvelő megnyitja a **TAO vs. KIVA összehasonlító kalkulátort**.
3. A rendszer a cég magas bérköltségei és alacsony nyeresége alapján kimutatja, hogy a KIVA 10%-os kulcsa (a 13%-os Szocho kiváltásával) évi 1,8 millió Ft megtakarítást eredményez.
4. A könyvelő a generált vezetői összefoglaló alapján javasolja a bejelentkezést.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **1996. évi LXXXI. törvény a társasági adóról és az osztalékadóról (Tao tv.):** 9%-os adókulcs, adóalap növelő és csökkentő tételek (7–8. §), minimumadó.
- **2012. évi CXLVII. törvény a kisadózó vállalkozások tételes adójáról és a kisvállalati adóról (Katv.):** 10%-os KIVA adókulcs, adóalap-levezetés.
- **2000. évi C. törvény a számvitelről (Sztv.):** Éves beszámoló készítése, időbeli elhatárolások, év végi értékelés.
