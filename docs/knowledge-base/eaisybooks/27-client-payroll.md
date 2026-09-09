# 🧮 Ügyfél Bérszámfejtési Központ (Client Payroll Hub)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Bérszámfejtés  
> **Szükséges szerepkör:** Minden könyvelői és bérszámfejtői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Bérszámfejtő), aki jogosult a cég kezelésére  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a kijelölt cég bal oldali menüjében a **Bérszámfejtés** csoportban: **Bérszámfejtés műszerfal** menüpont (`/eaisybooks/:companyId/:dateRange/payroll`).
- **Ikon:** Számológép / Bérkalkuláció (`Calculator` / `Banknote`) ikon
- **Elérési útvonal:** Portfólió → Ügyfél kiválasztása → Bérszámfejtés
- **Gyorsműveletek:** Új havi bérszámfejtési ciklus indítása, új munkavállaló felvétele varázslóval, Excel dolgozói import, bérjegyzékek generálása, banki átutalási fájl letöltése

---

## 2. A menü funkciója és célja

A **Bérszámfejtési Központ** az adott vállalat munkavállalóinak, megbízottjainak és vezető tisztségviselőinek komplex munkaügyi, jelenléti és bérszámfejtési operatív központja.

### Fő feladatai és jogi garanciái:
1. **Munkavállalói állomány kezelése:** A dolgozók személyes, adózási és munkaügyi törzsadatai (alapbér, pótlékok, heti óraszám, FEOR kód, adókedvezmények).
2. **Ciklikus havi bérszámfejtés:** Tárgyhavi jelenléti adatok (munkanapok, túlórák, fizetett szabadság, betegszabadság, táppénz) rögzítése és a bruttó-nettó bérkalkuláció automatikus lefutása.
3. **Munkáltatói és munkavállalói közterhek levezetése:** Levont SZJA (15%), TB járulék (18,5%), fizetendő Szocho (13%) vagy KIVA (10%) fillérre pontos kiszámítása valamennyi törvényi adókedvezmény (25 év alattiak, családi, személyi) érvényesítésével.
4. **Hivatalos bérdokumentumok és banki utalás:** Egykattintásos GIRO átutalási csomag generálása a nettó munkabérek kifizetéséhez és elektronikus PDF bérfizetési jegyzékek előállítása.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Cégfejléc és Akciógombok
- **Hogy hívják:** Fejléc cégadatok, „Új ciklus” gomb (`Calculator` plusz jellel), „Új munkavállaló” gomb (`UserPlus`) és „Dolgozók importálása” gomb (`Upload`)
- **Mire való:** Új havi számfejtés elindítása, új dolgozó beléptetése varázslóval, vagy külső Excel névsor kötegelt betöltése.
- **Hol található a felületen:** A fejléc jobb felső sarkában lévő gombsor.
- **Hogyan használhatja a felhasználó:**
  1. Új munkatárs érkezésekor kattintson az **„Új munkavállaló”** gombra a beléptető űrlap megnyitásához.
  2. Ha sok dolgozót kell egyszerre felvenni, kattintson a **„Dolgozók importálása”** gombra az Excel fájl behúzásához.
  3. A tárgyhónap számfejtésének megkezdéséhez kattintson az **„Új ciklus”** gombra.
  - **Eredmény:** Létrejön az új havi bérszámfejtési munkamenet.

### 3.2 Bérszámfejtési KPI Összegző Kártyák
- **Hogy hívják:** Aktív dolgozók, Bruttó bérköltség, Kifizetendő nettó, Munkáltatói közterhek (SZOCHO/KIVA), Közelgő bevallási határidő kártyák
- **Mire való:** A vállalkozás bérköltségeinek és likviditási kötelezettségeinek azonnali, animált leolvasása.
- **Hol található a felületen:** A fejléc alatt sorakozó nagy statisztikai kártyasor.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a létszámot az **Aktív dolgozók** kártyán.
  2. Tekintse meg a **Kifizetendő nettó bér** összegét: ez mutatja, mekkora likvid fedezet szükséges a fizetésnapon.
  3. Ellenőrizze a **Munkáltatói közterhek** dobozt a 12-én esedékes NAV adófizetéshez.
  - **Eredmény:** Pontos pénzügyi összefoglalót kap a cégvezető tájékoztatásához.

### 3.3 Havi Bérszámfejtési Ciklusok Táblázata
- **Hogy hívják:** Cikluslista sorai, Státusz jelvény és Megnyitás gomb (`ChevronRight`)
- **Mire való:** Az egyes hónapok bérszámfejtési állapotának követése és a havi munkalap megnyitása.
- **Hol található a felületen:** A képernyő középső részén lévő táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a tárgyhónapot (pl. *2026. Március*).
  2. Tekintse meg a ciklus státuszát:
     - ⚪ **Tervezet:** Előkészítés alatt.
     - 🔵 **Adatbekérés:** Jelenléti ívek és táppénzes papírok gyűjtése.
     - 🟡 **Ellenőrzés:** Bérszámfejtő általi felülvizsgálat.
     - 🟢 **Számfejtve:** Számítások készen vannak.
     - 🟣 **Jóváhagyva:** Szenior által jóváhagyva kifizetésre.
     - 🟢 **Beküldve:** NAV 08-as bevallás elküldve.
  3. Kattintson a sor jobb szélén lévő **Megnyitás** nyílra a részletes számfejtő munkalaphoz.
  - **Eredmény:** Belép a havi dolgozói bérbontás és jelenléti ív szerkesztőjébe.

### 3.4 Új Munkavállaló Beléptető Varázsló
- **Hogy hívják:** „Új munkavállaló” több lépéses űrlap és „Mentés” gomb
- **Mire való:** Új alkalmazott törvényes beléptetése és a T1041 NAV bejelentő előkészítése.
- **Hol található a felületen:** Az „Új munkavállaló” gombra kattintva megnyíló teljes képernyős varázsló.
- **Hogyan használhatja a felhasználó:**
  1. **1. lépés — Személyes adatok:** Név, születési adatok, lakcím, TAJ szám, adóazonosító jel.
  2. **2. lépés — Munkaviszony és FEOR:** Jogviszonykód kiválasztása, 4 jegyű FEOR-08 kód és heti óraszám megadása.
  3. **3. lépés — Béradatok:** Havi bruttó bér vagy órabér, pótlékok beállítása.
  4. **4. lépés — Adókedvezmények:** Családi kedvezmény gyermekszámmal, 25 év alattiak SZJA mentessége jelölőnégyzettel.
  5. Kattintson a **„Munkavállaló mentése”** gombra.
  - **Eredmény:** A dolgozó azonnal bekerül a cég állományába, és a rendszer legenerálja a NAV T1041 bejelentő fájlt.

### 3.5 Bérjegyzékek és Banki Átutalási Fájl Generálása
- **Hogy hívják:** „Bérjegyzékek letöltése” és „Banki utalási csomag (GIRO)” export gombok
- **Mire való:** A munkavállalói fizetési papírok előállítása és a banki csoportos utalási állomány letöltése.
- **Hol található a felületen:** A lezárt számfejtési ciklus fejlécében lévő export gombsor.
- **Hogyan használhatja a felhasználó:**
  1. A számfejtés lezárása után kattintson a **„Bérjegyzékek letöltése”** gombra az egyedi titkosított PDF-ek generálásához.
  2. Kattintson a **„Banki utalási csomag”** gombra a szabványos fájl letöltéséhez.
  3. Töltse be a fájlt az ügyfél netbankjába a fizetések azonnali elindításához.
  - **Eredmény:** Kiküszöböli a manuális banki utalás rögzítést, garantálva a hibamentes bérkifizetést.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Hó eleji bérszámfejtés lefuttatása
1. A bérszámfejtő a hónap 2. napján belép a cég **Bérszámfejtés** menüpontjába.
2. Megnyitja a tárgyhavi ciklust, rögzíti a kapott jelenléti íveket (pl. 2 nap szabadság, 1 nap táppénz).
3. A rendszer azonnal újraszámolja a nettó béreket és a közterheket.
4. A bérszámfejtő a **„Bérjegyzékek letöltése”** gombbal legenerálja a bérlapokat és elküldi a dolgozóknak.
5. Letölti a banki GIRO fájlt és átadja az ügyvezetőnek utalásra.

### 4.2 Új belépő kollégánál T1041 bejelentés készítése
1. Új munkaszerződés érkezik a céghez.
2. A könyvelő az **„Új munkavállaló”** gombra kattintva kitölti a törzsadatokat, a FEOR kódot és a bruttó bért.
3. Mentés után a rendszer felajánlja a T1041-es bejelentő nyomtatvány exportját, amelyet a könyvelő még a munkába állás napja előtt beküld a NAV Cégkapun keresztül.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2012. évi I. törvény a Munka Törvénykönyvéről (Mt.):** Munkabér, bérpótlékok, rendes és betegszabadság elszámolási szabályai.
- **1995. évi CXVII. törvény a személyi jövedelemadóról (Szja tv.):** Adókedvezmények érvényesítése a havi adóelőlegnél.
- **2019. évi CXXII. törvény a társadalombiztosítás ellátásaira jogosultakról (Tbj.):** TB járulék levonása és bevallása.
- **2017. évi CL. törvény az adózás rendjéről (Art.):** T1041 munkaviszony-bejelentési kötelezettség a foglalkoztatás megkezdése előtt.
