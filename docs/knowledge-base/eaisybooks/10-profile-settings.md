# 👤 Könyvelői Profilbeállítások (Profile Settings)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Iroda & Beállítások  
> **Szükséges szerepkör:** Minden könyvelői fiókkal rendelkező felhasználó (Iroda Admin, Szenior Könyvelő, Könyvelő, Asszisztens)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali sávjának alján, a saját profilnévre vagy az **Iroda & Beállítások** csoportban lévő **Profilbeállítások** menüpontra kattintva (`/eaisybooks/profile/settings`).
- **Ikon:** Felhasználó (`User`) ikon
- **Elérési útvonal:** Oldalsáv alja → Profilbeállítások
- **Gyorsműveletek:** Személyes adatok mentése, jelszócsere párbeszédablak indítása, csatlakozási meghívókód generálása, téma- és értesítésváltás

---

## 2. A menü funkciója és célja

A **Profilbeállítások** a könyvelőiroda munkatársának személyes vezérlőközpontja, ahol a felhasználó karbantarthatja saját azonosító adatait, beosztását, értesítési és felületi preferenciáit, valamint kezelheti a fiókbiztonságot és a cégkapcsolati tokeneket.

### Fő feladatai és szerepe:
1. **Szakmai profil és jogosultságkezelés:** Saját név, pozíció és irodai beosztás (Iroda Admin, Senior Könyvelő, Könyvelő, Asszisztens) nyilvántartása, amely az összes audit bejegyzésben és jóváhagyásban megjelenik.
2. **Cégkapcsolati meghívókódok generálása:** 10 percig érvényes, egyedi 6 jegyű csatlakozási kódok készítése az ügyfelek számára az eaisyBill számlázó összekötéséhez.
3. **Személyre szabott értesítések:** E-mail és felületi figyelmeztetések testreszabása az új bizonylatokról, határidőkről és jóváhagyási kérésekről.
4. **Fiókbiztonság és Jelszókezelés:** Jelszóváltoztatás kezdeményezése, biztonsági figyelmeztetések és el nem mentett módosítások védelme (Unsaved Changes Dialog).

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 1. Fül — Személyes Profil és Beosztás
- **Hogy hívják:** „Profil” lapfül, „Név”, „Beosztás” mezők és „Profil mentése” gomb
- **Mire való:** A könyvelő teljes nevének, beosztásának és irodai szerepkörének beállítása.
- **Hol található a felületen:** A lapfülek első eleme (`User` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Profil”** fülre.
  2. Módosítsa a **„Név”** és **„Beosztás”** (pl. Mérlegképes könyvelő) mezőket.
  3. Tekintse meg a kártya jobb oldalán az aktuális irodai szerepkört jelző jelvényt (pl. *Iroda Admin* vagy *Senior Könyvelő*).
  4. Kattintson a kék **„Profil mentése”** gombra.
  - **Eredmény:** A profiladatok frissülnek, és az új név azonnal megjelenik az oldalsávban és az audit naplókban.

### 3.2 2. Fül — Vállalkozási Adatok és Csatlakozási Kód (Ügyfélkapcsolat)
- **Hogy hívják:** „Vállalkozás” lapfül, „Új kód generálása” és „Kód másolása” gombok
- **Mire való:** A kiválasztott könyvelőiroda vagy ügyfélcég adatainak kezelése, valamint időkorlátos meghívókód generálása az ügyfél eaisyBill számlázójához.
- **Hol található a felületen:** A lapfülek második eleme (`Building2` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Vállalkozás”** fülre.
  2. A cégkapcsolati kártyán kattintson az **„Új kód generálása”** gombra.
  3. A rendszer létrehoz egy 6 karakterből álló kódot (pl. `K7X9W2`), amely pontosan 10 percig érvényes (egy visszaszámláló óra mutatja a hátralévő időt).
  4. Kattintson a kód melletti **„Másolás”** ikonra a vágólapra helyezéshez.
  5. Küldje el a kódot az ügyfélnek, aki azt az eaisyBill felületén beírva azonnal összeköti fiókját a könyvelővel.
  - **Eredmény:** Létrejön a közvetlen, valós idejű adatkapcsolat a számlázó és a könyvelőprogram között.

### 3.3 3. Fül — Értesítési Beállítások
- **Hogy hívják:** „Értesítések” lapfül és eseménykapcsolók
- **Mire való:** Az automatikus rendszerüzenetek, bizonylatbekérők és határidő-riasztások csatornáinak személyre szabása.
- **Hol található a felületen:** A lapfülek harmadik eleme (`Bell` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Értesítések”** fülre.
  2. Kapcsolja be vagy ki az egyes értesítési kategóriákat:
     - Jóváhagyási kérések (bevallások, bérszámfejtések jóváhagyása).
     - Hiányzó számla pótlásának ügyféli visszaigazolása.
     - NAV és Cégkapu technikai hibaüzenetek.
  3. A módosítások automatikusan mentésre kerülnek.
  - **Eredmény:** Csak a releváns szakmai eseményekről érkezik értesítés, elkerülve a felesleges e-mail túlterhelést.

### 3.4 4. Fül — Rendszer és Megjelenési Preferenciák
- **Hogy hívják:** „Rendszer” lapfül, Témaválasztó és Formátum beállítók
- **Mire való:** A kezelőfelület vizuális megjelenésének, nyelvének, dátum- és számformátumának testreszabása.
- **Hol található a felületen:** A lapfülek negyedik eleme (`Palette` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Rendszer”** fülre.
  2. Válasszon a megjelenési témák közül: **Világos**, **Sötét** vagy Rendszer szerinti automatikus mód.
  3. Állítsa be az alapértelmezett dátumformátumot (pl. `ÉÉÉÉ.HH.NN` vagy `DD/MM/YYYY`) és az ezres tagolás számformátumát (`1 234 567,89 Ft`).
  - **Eredmény:** A felület azonnal átvált a kiválasztott színvilágra és formátumra, kímélve a szemet a hosszú könyvelési munkaórák során.

### 3.5 5. Fül — Fiókbiztonság és Jelszócsere
- **Hogy hívják:** „Biztonság” lapfül és „Jelszó módosítása” gomb
- **Mire való:** A felhasználói hozzáférési jelszó biztonságos megváltoztatása és a bejelentkezési adatok védelme.
- **Hol található a felületen:** A lapfülek ötödik eleme (`Shield` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Biztonság”** fülre.
  2. Kattintson a **„Jelszó módosítása”** gombra.
  3. A felugró párbeszédablakban írja be a jelenlegi jelszavát, majd kétszer az új, erős jelszót (kis- és nagybetűk, számok, speciális karakterek).
  4. Kattintson a mentésre.
  - **Eredmény:** A rendszer megerősíti a jelszócserét, megvédve a könyvelői fiókot az illetéktelen hozzáféréstől.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Új ügyfél gyors bekötése csatlakozási kóddal
1. A könyvelő telefonon egyeztet az új ügyféllel, aki regisztrált az eaisyBill számlázóba.
2. A könyvelő megnyitja a **Profilbeállítások** → **Vállalkozás** fület.
3. Rákattint az **„Új kód generálása”** gombra, majd a megjelenő 6 karakteres kódot beolvassa vagy átküldi chaten az ügyfélnek.
4. Az ügyfél beüti a kódot a számlázójában, és a cég azonnal megjelenik a könyvelő portfóliójában.

### 4.2 Személyes értesítések beállítása bevallási időszakra
1. A havi 20-i zárás közeledtével a könyvelő áttekinti az **Értesítések** fület.
2. Bekapcsolja a sürgősségi NAV riasztásokat és a jóváhagyási kérelmek azonnali értesítőjét, hogy a kollégái által ellenőrzésre küldött 08-as és 65-ös bevallásokról azonnal tudomást szerezzen.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **GDPR (2016/679/EU rendelet):** Személyes adatok védelme, hozzáférési jogosultságok minimalizálása és jelszóbiztonság (32. cikk).
- **2000. évi C. törvény a számvitelről (Sztv.):** A könyvviteli nyilvántartások hitelessége és a személyes felelősség biztosítása az auditált műveletek során.
