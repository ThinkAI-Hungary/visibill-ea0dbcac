# 🗄️ Iratkezelés és GDPR Megőrzés (Client Data Retention & Compliance)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Rendszer  
> **Szükséges szerepkör:** Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő (adott céghez rendelt hozzáféréssel)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a bal oldali menüben az aktív ügyfél-munkamenet alatt: **Adatmegőrzés** (vagy Iratkezelés és GDPR) menüpont.
- **Ikon:** Archívum / Időbélyeg / Biztonsági pajzs ikon (`Clock` / `Shield`)
- **Elérési útvonal:** eaisyBooks munkamenet -> Iratkezelés és GDPR
- **Gyorsműveletek:** Magyar számviteli törvény szerinti alapértelmezett megőrzési idők betöltése, új bizonylattípus felvétele, adatfeldolgozói szerződés feltöltése, automatikus selejtezés konfigurálása

---

## 2. A menü funkciója és célja

Az **Iratkezelés és GDPR Megőrzés** modul a gazdasági társaság számviteli bizonylatainak, könyvviteli nyilvántartásainak, beszámolóinak és bérügyi dokumentumainak jogszabályi megőrzési határidőit, az adatfeldolgozói szerződések (GDPR 28. cikk) digitális archívumát és az érintetti joggyakorlási kérelmek nyilvántartását felügyeli.

### Fő feladatai és törvényi kötelezettségei:
1. **Számviteli bizonylatok 8 éves megőrzése (Sztv. 169. §):** A könyvviteli elszámolást közvetlenül és közvetve alátámasztó számviteli bizonylatokat (ideértve a főkönyvi számlákat, analitikus nyilvántartásokat, számlákat, szerződéseket és bankkivonatokat) legalább **8 évig** kell olvasható, az eredeti adatokkal megegyező és visszakereshető formában megőrizni.
2. **Bérügyi és szolgálati idő megőrzési kötelezettség (Tbj. és nyugdíjtörvény):** A munkaviszonyt, bérezést és társadalombiztosítási levonásokat tartalmazó nyilvántartásokat a biztosított nyugdíjkorhatárának eléréséig (akár 50 évig) meg kell őrizni az állami nyugdíjmegállapítás támogatására.
3. **GDPR 28. cikk szerinti adatfeldolgozói szerződések nyilvántartása:** Minden külső adatfeldolgozóval (pl. felhőszolgáltatók, bérszoftver üzemeltetők, digitális számlázók) kötött kétoldalú adatvédelmi szerződés digitális rögzítése és érvényességének folyamatos követése.
4. **Szabályozott automatikus selejtezés:** Az elévült, nem kötelező dokumentumok auditált törlése a GDPR adattakarékossági elvével összhangban.

---

## 3. Mit lehet benne a felhasználónak csinálni? (Funkciók részletes leírása)

### 3.1 Navigációs fejléc és „Vissza” gomb
- **Hogy hívják:** Vissza gomb (Balra mutató nyíl ikon)
- **Mire való:** Lehetővé teszi az azonnali visszalépést az előző felületre vagy a cég központi áttekintő műszerfalára.
- **Hol található a felületen:** A fejléc bal felső sarkában található kis négyzet alakú gomb (`ChevronLeft`).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a fejléc bal szélén lévő vissza nyílra.
  - **Eredmény:** A böngésző visszatér a megelőző nézetre vagy az ügyfél áttekintő oldalára.

---

### 3.2 Fülválasztó navigációs sáv
- **Hogy hívják:** Tématerületi fülek (Megőrzési idők / Adatfeldolgozói szerződések / Érintetti kérelmek)
- **Mire való:** Elkülöníti a belső iratkezelési szabályokat, a külső szerződéses dokumentumokat és az adatvédelmi jogérvényesítési feladatokat.
- **Hol található a felületen:** A fejléc alatt közvetlenül elhelyezkedő szürke gombcsoport.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kívánt fülre:
     - **Megőrzési idők (`Clock` ikon):** Számviteli és munkaügyi dokumentumtípusok táblázata.
     - **Adatfeldolgozói szerződések (`FileText` ikon):** GDPR 28. cikk szerinti megállapodások és fájlok.
     - **Érintetti kérelmek (`Database` ikon):** GDPR megkeresések áttekintése.
  - **Eredmény:** A képernyő alsó tartalmi területe azonnal átvált a kiválasztott modulra.

---

### 3.3 „Alapértelmezések betöltése (magyar jogszabályok)” gomb
- **Hogy hívják:** Alapértelmezések betöltése gomb
- **Mire való:** Egyetlen kattintással feltölti az ügyfél adatbázisát a magyar számviteli és adójogszabályok által előírt szabványos dokumentumtípusokkal, megőrzési évekkel és jogalap-hivatkozásokkal (pl. Számlák 8 év — Sztv. 169. § (2), Éves beszámoló 8 év — Sztv. 169. § (1), Bérkartonok 50 év).
- **Hol található a felületen:** A **Megőrzési idők** fülön jelenik meg, amennyiben az adott céghez még nincs rögzített megőrzési szabály.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Alapértelmezések betöltése (magyar jogszabályok)”** gombra.
  2. A gomb töltési állapotot jelez (*„Betöltés...”*).
  - **Eredmény:** A rendszer automatikusan legenerálja a jogszabályi szabálysort, és zöld felugró értesítés jelenik meg: *„Alapértelmezések betöltve — Magyar jogszabályok szerinti megőrzési idők beállítva.”*

---

### 3.4 „Új típus” gomb és inline rögzítő sor
- **Hogy hívják:** Új típus gomb
- **Mire való:** Lehetővé teszi egyedi belső céges dokumentumtípus (pl. minőségbiztosítási jegyzőkönyvek, gépjármű menetlevelek, selejtezési jegyzőkönyvek) felvételét saját megőrzési idővel és jogalappal.
- **Hol található a felületen:** A **Dokumentumtípusok és megőrzési idők** táblázat fejlécének jobb szélén található gomb (`Plus` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új típus”** gombra.
  2. A táblázat tetején megjelenik egy kék háttérrel kiemelt új beviteli sor.
  3. Adja meg a **Dokumentum típus** nevét (pl. *„Menetlevelek és útnyilvántartások”*).
  4. Írja be a **Megőrzés** éveinek számát (1 és 99 közötti numerikus érték).
  5. Adja meg a **Jogalap** törvényi hivatkozását (pl. *„Art. 78. § (3)”*).
  6. Szükség esetén pipálja be az **Auto törlés** jelölőnégyzetet, ha az idő lejárta után engedélyezett az automatikus törlés.
  7. Kattintson a sor végén lévő zöld **Mentés** lemez ikonra (vagy az elvetéshez az **X** gombra).
  - **Eredmény:** Az új dokumentumtípus azonnal megjelenik a szabályzatban, és az összesített számláló értéke eggyel nő.

---

### 3.5 Dokumentumtípusok táblázata és inline szerkesztése
- **Hogy hívják:** Dokumentumtípusok és megőrzési idők táblázat és sorvégi Szerkesztés gomb
- **Mire való:** Részletesen listázza az érvényes szabályokat, és lehetővé teszi a megőrzési évek vagy jogalapok gyors helyi módosítását.
- **Hol található a felületen:** A **Megőrzési idők** fül fő táblázata; a ceruza ikon (`Pencil`) a sorok legutolsó oszlopában található.
- **Megjelenő vizuális jelzések:**
  - **Megőrzési idő jelvény:**
    - Piros kiemelés: 50 év vagy hosszabb megőrzés (pl. bérkartonok, munkaügyi nyilvántartások).
    - Sárga kiemelés: 8 év (számviteli bizonylatok, főkönyvek, számlák).
    - Szürke kiemelés: 8 év alatti megőrzés (pl. ajánlatok, szerződéstervezetek).
  - **Auto törlés oszlop:** Zöld pipa karika (`CheckCircle`), ha engedélyezett az automatikus selejtezés, kötőjel (`—`), ha manuális felülvizsgálat szükséges.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a módosítani kívánt szabály sorának végén lévő **Ceruza** ikonra.
  2. A sor mezői szerkeszthető beviteli dobozokká alakulnak át.
  3. Írja át a megőrzési éveket vagy a jogalapot, illetve kapcsolja be/ki az auto törlés jelölőnégyzetét.
  4. Kattintson a zöld **Mentés** ikonra.
  - **Eredmény:** A módosítás elmentődik, és felugró értesítés igazolja a változtatást: *„Mentve — [Típus] megőrzési ideje frissítve.”*

---

### 3.6 Megőrzési szabály törlése gomb
- **Hogy hívják:** Szabály törlése (Piros kuka ikon)
- **Mire való:** Eltávolítja az adott dokumentumtípust a céges megőrzési szabályzatból.
- **Hol található a felületen:** A táblázat soraiban a ceruza ikon mellett elhelyezkedő piros kuka gomb (`Trash2`).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a törölni kívánt szabály sora mellett lévő kuka ikonra.
  - **Eredmény:** A szabály törlődik a listából, és felugró értesítés nyugtázza a műveletet.

---

### 3.7 „Új szerződés feltöltése” gomb és fájlkezelő űrlap
- **Hogy hívják:** Új adatfeldolgozói szerződés feltöltése űrlap
- **Mire való:** Lehetővé teszi a külső adatfeldolgozó partnerekkel (GDPR 28. cikk) kötött szerződések PDF vagy Word állományainak biztonságos feltöltését az eaisyBooks titkosított felhőtárhelyébe.
- **Hol található a felületen:** Az **Adatfeldolgozói szerződések** fülön található gomb és megjelenő rögzítő panel.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **Adatfeldolgozói szerződések** fülre.
  2. Kattintson az **„Új szerződés feltöltése”** gombra.
  3. A megjelenő szaggatott vonalas **Drag & Drop** zónába húzza be a szerződés fájlját (vagy kattintson rá és tallózza be a számítógépéről; elfogadott formátumok: `.pdf`, `.doc`, `.docx`).
  4. A **Partner neve** mezőbe írja be a szerződő partner pontos cégnevét (pl. *CloudBackup Zrt.*).
  5. Az **Érvényes eddig** mezőben válassza ki a szerződés hatályának lejárati dátumát (határozatlan szerződés esetén üresen hagyható).
  6. Kattintson a **„Feltöltés és mentés”** gombra.
  - **Eredmény:** A fájl biztonságosan feltöltődik, a szerződés megjelenik a listában, és zöld felugró üzenet értesít: *„Szerződés feltöltve — [Fájlnév] sikeresen feltöltve.”*

---

### 3.8 Adatfeldolgozói szerződések listája, Letöltés és Törlés funkciók
- **Hogy hívják:** Szerződések listája, Fájl letöltése és Szerződés törlése
- **Mire való:** Nyilvántartja a feltöltött szerződéseket, ellenőrzi azok érvényességét, és biztosítja az eredeti PDF iratok bármikori letölthetőségét hatósági ellenőrzés vagy audit során.
- **Hol található a felületen:** Az **Adatfeldolgozói szerződések** fül alsó kártyája.
- **Megjelenő adatok:**
  - Partner neve és az eredeti fájl neve.
  - Státusz jelvény: **„Érvényes”** (zöld) vagy **„Lejárt”** (piros).
  - Feltöltés dátuma és érvényesség lejárati ideje.
  - Műveleti gombok: **Letöltés** (`Download` ikon) és **Törlés** (`Trash2` ikon).
- **Hogyan használhatja a felhasználó:**
  1. A dokumentum megtekintéséhez vagy kinyomtatásához kattintson a **Letöltés** gombra (megnyílik a fájl új böngészőlapon).
  2. Szerződés törléséhez kattintson a **Kuka** ikonra, majd a megjelenő megerősítő kérdésre kattintson az **OK** gombra.
  - **Eredmény:** A szerződés letölthető, illetve törlés esetén véglegesen eltávolításra kerül az archívumból.

---

### 3.9 „Érintetti kérelmek” fül és ugrás a GDPR modulhoz
- **Hogy hívják:** Érintetti kérelmek modulváltó
- **Mire való:** Gyors átjárást biztosít az érintetti adatvédelmi joggyakorlásokhoz (hozzáférési, helyesbítési, korlátozási és törlési kérelmek) a központi GDPR felügyeleti rendszer felé.
- **Hol található a felületen:** Az **Érintetti kérelmek** fülön elhelyezkedő tájékoztató doboz és gombok.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **Érintetti kérelmek** fülre.
  2. Olvassa el a tájékoztatást, majd kattintson a **„Rendszerszintű GDPR modul →”** vagy a **„Megnyitás →”** gombra.
  - **Eredmény:** A rendszer átirányítja a felhasználót a központi GDPR kezelőfelületre, ahol a kérelmek jogi határideje és státusza intézhető.

---

## 4. Jogosultságok és Szerepkörök

| Szerepkör | Megtekintés | Alapértelmezések betöltése | Szerződés feltöltése | Szabályzat módosítása / Törlés |
| :--- | :---: | :---: | :---: | :---: |
| **Irodavezető adminisztrátor** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Szenior könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő asszisztens** |  Teljes | ❌ Nincs |  Feltöltés engedélyezett | ❌ Nincs |
| **Ügyfél (Cégvezető)** |  Megtekintés | ❌ Nincs | ❌ Nincs | ❌ Nincs |

---

## 5. Kapcsolódó jogszabályi és szakmai hivatkozások

- **2000. évi C. törvény a számvitelről (Sztv.):**
  - **169. § (1):** Az éves beszámolót, az üzleti jelentést, valamint az azokat alátámasztó leltárt, értékelést és főkönyvi kivonatot legalább **8 évig** kell megőrizni.
  - **169. § (2):** A könyvviteli elszámolást közvetlenül és közvetve alátámasztó számviteli bizonylatokat legalább **8 évig** kell olvasható formában, a könyvelési feljegyzések hivatkozása alapján visszakereshetően megőrizni.
- **Az Európai Parlament és a Tanács (EU) 2016/679 rendelete (GDPR):**
  - **5. cikk (1) bek. e) pont:** Korlátozott tárolhatóság elve — a személyes adatok tárolásának olyan formában kell történnie, amely az érintettek azonosítását csak a kezelés céljainak eléréséhez szükséges ideig teszi lehetővé.
  - **28. cikk:** Az adatfeldolgozó igénybevétele és a kötelező írásbeli adatfeldolgozói szerződés kellékei.
