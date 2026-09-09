# 🚀 Ügyfél Onboarding és Új Ügyfél Varázsló (Onboarding & New Client Wizard)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Portfólió  
> **Szükséges szerepkör:**  
> - *Onboarding műszerfal és fiókbeállítás:* Irodavezető adminisztrátor  
> - *Új ügyfél felvétele varázsló:* Minden könyvelő és adminisztrátor  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:**
  - Az eaisyBooks bal oldali menüjében a **Portfólió** csoportban: **Onboarding** menüpont (`/eaisybooks/onboarding`)
  - Közvetlen új ügyfél indítás: **„Új ügyfél”** gomb a felső Portfólió fejlécben vagy az oldalsávban (`/eaisybooks/new-client`)
- **Ikon:** Rakéta (`Rocket`) / Felhasználó hozzáadása (`UserPlus`) ikon
- **Elérési útvonal:** Portfólió → Onboarding, vagy Portfólió → Új ügyfél
- **Gyorsműveletek:** Új cég regisztrációjának indítása, meghívókód érvényesítése, AI cégprofil generálás, irodai munkatársak meghívása

---

## 2. A menü funkciója és célja

Az **Onboarding és Új Ügyfél Varázsló** kettős célt szolgál: egyrészt biztosítja a frissen regisztrált könyvelőiroda fiókjának zökkenőmentes beüzemelését, másrészt strukturált, több lépéses folyamatban vezeti végig a könyvelőt az új ügyfélcégek felvételén.

### Fő feladatai és üzleti értéke:
1. **Irodai felkészültség ellenőrzése:** 5 lépéses harmonika-folyamatban garantálja, hogy az iroda profilja, adószáma, első ügyfele és kollégái beállításra kerüljenek, folyamatgyűrűvel (progress ring) vizualizálva a készültséget.
2. **Új ügyfél felvétele varázsló:** Minimális adatbevitellel, AI támogatással hozza létre az ügyfél profilt, felkészítve a bizonylatok fogadására és a könyvelési rendszerkapcsolatokra.
3. **Automatikus TEÁOR AI profilgenerálás:** A cég elsődleges TEÁOR száma és neve alapján az AI másodpercek alatt létrehozza a vállalkozás tevékenységi leírását, segítve a későbbi automatikus bizonylat-kontírozást.
4. **Kétoldalú kapcsolat (eaisyBill és eaisyBooks):** Az ügyfél vagy meghívókóddal összekapcsolható a már létező eaisyBill fiókjával, vagy közvetlenül a varázslóból generálható le számára a hozzáférés.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Irodai Felkészültségi Mutató (Progress Ring)
- **Hogy hívják:** Fiók előkészítettsége állapotjelző gyűrű
- **Mire való:** Valós időben mutatja az 5 alapvető irodai beállítási lépés teljesítettségi százalékát és a befejezett feladatok számát (pl. 3 / 5 lépés befejezve).
- **Hol található a felületen:** Az Onboarding oldal fejlécében, a cím és leírás alatti kiemelt fehér kártya bal oldalán.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg a kördiagram belsejében lévő százalékos értéket (0–100%).
  2. Olvassa el a diagram melletti szöveges összesítést a még hátralévő lépésekről.
  3. A gyűrű 100%-os elérésekor a rendszer konfetti animációval nyugtázza a fiók teljes felkészültségét.
  - **Eredmény:** Az irodavezető azonnal látja, milyen adminisztratív teendők hiányoznak még a rendszer éles használatához.

### 3.2 1. Lépés — Könyvelői Profil Beállítása
- **Hogy hívják:** „Könyvelői profil beállítása” kártya és „Profil mentése” gomb
- **Mire való:** A belépett könyvelő nevének és irodai beosztásának (Irodavezető, Szenior könyvelő, Könyvelő) rögzítése.
- **Hol található a felületen:** Az Onboarding oldal harmonika-listájának 1. eleme.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az 1. sorszámú sorra a kibontáshoz.
  2. A „Teljes név” mezőbe írja be a nevét.
  3. A „Beosztás / Jogkör” legördülő listából válassza ki a szerepkörét (pl. Iroda adminisztrátor vagy Szenior könyvelő).
  4. Kattintson a jobb alsó **„Profil mentése”** gombra.
  - **Eredmény:** A profiladatok elmentődnek, a fejlécben megjelenik a könyvelő neve, és az 1. lépés zöld pipával áthúzva jelzi a befejezettséget.

### 3.3 2. Lépés — Könyvelőiroda Adatai
- **Hogy hívják:** „Könyvelőiroda adatainak rögzítése” panel és „Iroda adatainak mentése” gomb
- **Mire való:** A könyvelőiroda hivatalos adatainak (cégnév, adószám, székhely) elmentése a hivatalos értesítésekhez és bizonylatbekérőkhöz.
- **Hol található a felületen:** Az Onboarding harmonika-lista 2. lépése.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a 2. lépésre.
  2. Töltse ki az „Iroda / Cég neve”, „Adószám” és „Székhely címe” beviteli mezőket.
  3. Kattintson az **„Iroda adatainak mentése”** gombra.
  - **Eredmény:** A rendszer elmenti az irodai beállításokat, amelyek a kiküldött bizonylatbekérő e-mailek fejlécében és a portfólió adatlapon is megjelennek.

### 3.4 3. Lépés — Első Ügyfél Hozzárendelése és Meghívókód Ellenőrzése
- **Hogy hívják:** „Első ügyfél hozzárendelése” panel, „Kód ellenőrzése” és „Új ügyfél felvétele” gombok
- **Mire való:** Létező ügyfél összekapcsolása a kapott 6-8 karakteres eaisyBill meghívókóddal, vagy új cég manuális regisztrációjának elindítása.
- **Hol található a felületen:** Az Onboarding harmonika-lista 3. lépése.
- **Hogyan használhatja a felhasználó:**
  1. Ha az ügyfél már használja az eaisyBill számlázót és megosztotta a meghívókódját:
     - Gépelje be a kódot a „Meghívókód” mezőbe.
     - Kattintson a **„Kód ellenőrzése”** gombra. A rendszer kiírja a talált cég nevét és adószámát.
     - Kattintson a **„Cég összekapcsolása”** gombra.
  2. Ha a cég még nem regisztrált az eaisyBill-be:
     - Kattintson a szürke dobozban lévő **„Új ügyfél felvétele”** gombra.
  - **Eredmény:** A cég bekerül a könyvelőiroda portfóliójába, és a lépés teljesítetté válik.

### 3.5 4. Lépés — Irodai Preferenciák Beállítása
- **Hogy hívják:** „Irodai preferenciák és alapbeállítások” panel és „Preferenciák mentése” gomb
- **Mire való:** Globális irodai működési szabályok, mint az automatikus bizonylatbekérők engedélyezése és az alapértelmezett nyelv beállítása.
- **Hol található a felületen:** Az Onboarding harmonika-lista 4. lépése.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a 4. lépésre.
  2. Kapcsolja be vagy ki az „Automatikus bizonylatbekérő emlékeztetők” kapcsolót.
  3. Válassza ki a kommunikáció alapértelmezett nyelvét (Magyar / Angol).
  4. Kattintson a **„Preferenciák mentése”** gombra.
  - **Eredmény:** A rendszer beállítja az irodai automatizmusokat.

### 3.6 5. Lépés — Munkatársak Meghívása
- **Hogy hívják:** „Munkatársak meghívása” panel, „Meghívó küldése” és „Kihagyás / Később” gombok
- **Mire való:** Kollégák bevonása az iroda felületére e-mail cím és jogosultsági szint alapján, vagy a lépés átugrása egyéni könyvelők esetén.
- **Hol található a felületen:** Az Onboarding harmonika-lista 5. lépése.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az 5. lépésre.
  2. Írja be a kolléga e-mail címét és válassza ki a szerepkörét (Szenior könyvelő vagy Könyvelő).
  3. Kattintson a **„Meghívó küldése”** gombra.
  4. Ha egyedül dolgozik az irodában, kattintson a **„Kihagyás / Később”** linkgombra.
  - **Eredmény:** A rendszer meghívó e-mailt küld a kollégának, a lépés lezárul, és aktiválódik az „Onboarding befejezése” gomb.

### 3.7 Új Ügyfél Varázsló — Cégadatok és AI Profilgenerálás
- **Hogy hívják:** Új Ügyfél űrlap, „TEÁOR kód”, „Cégleírás generálása AI-val” és „Tovább” gomb
- **Mire való:** Új cég felvétele a portfólióba, a tevékenységi körhöz illeszkedő automatikus szöveges leírás elkészítése mesterséges intelligenciával.
- **Hol található a felületen:** A Portfólió fejlécéből elérhető Új Ügyfél oldalon (`/eaisybooks/new-client`), az 1. lépésben.
- **Hogyan használhatja a felhasználó:**
  1. Adja meg a vállalkozás hivatalos nevét és adószámát.
  2. Írja be az elsődleges 4 jegyű TEÁOR számot (pl. `6201` - Számítógépes programozás).
  3. Kattintson a csillag ikonnal jelölt **„Cégleírás generálása AI-val”** gombra. A rendszer másodpercek alatt megfogalmazza a gazdasági tevékenység jellemzőit, a tipikus költségnemeket és bevételi forrásokat.
  4. Igény esetén pontosítsa a generált szöveget a szövegdobozban.
  5. Kattintson a kék **„Tovább”** gombra.
  - **Eredmény:** A cégprofil létrejön, megalapozva a későbbi intelligens számlakontírozást.

### 3.8 Új Ügyfél Varázsló — Könyvelőszoftver Integráció és Kommunikációs Csatornák
- **Hogy hívják:** Könyvelőprogram választó kártyák (RLB, Novitax, Egyéb), Kapcsolattartó adatok és „Ügyfél létrehozása” gomb
- **Mire való:** A könyvelőiroda által használt külső analitikai vagy főkönyvi szoftver kiválasztása, valamint az ügyféli kapcsolattartó elérhetőségeinek megadása.
- **Hol található a felületen:** Az Új Ügyfél oldal 2. és 3. lépésében.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a külső könyvelőprogramot (RLB60, Novitax vagy Egyéb / eaisyBooks natív).
  2. A következő lépésben adja meg a cégvezető vagy pénzügyi felelős nevét, e-mail címét és telefonszámát.
  3. Jelölje be az értesítési csatornákat (E-mail, SMS értesítő).
  4. Kattintson az **„Ügyfél létrehozása”** gombra.
  - **Eredmény:** A cég azonnal megjelenik a Portfólió ügyféllistájában, és a rendszer kiküldi az üdvözlő hozzáférési értesítést.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Új könyvelőiroda indulása (Day 1 Setup)
1. Az irodavezető regisztráció után megnyitja az **Onboarding** felületet.
2. Kitölti saját nevét és beosztását, majd elmenti az iroda hivatalos adatait és adószámát.
3. Beállítja az automatikus emlékeztetőket heti gyakoriságra.
4. Meghívja a 3 kollégáját az e-mail címük megadásával, majd a folyamat végén a rendszer átirányítja a Portfólió központi oldalára.

### 4.2 Újonnan szerződött ügyfél felvétele
1. A könyvelő a Portfólió oldalon az **„Új ügyfél”** gombra kattint.
2. Beírja az ügyfél adószámát és TEÁOR kódját, majd az **„AI leírás generálása”** gombra nyom.
3. Kiválasztja az irodai szoftverkapcsolatot (pl. RLB60 formátum), és megadja az ügyvezető e-mail címét.
4. A mentés után a rendszer generál egy meghívókódot, amelyet az ügyvezető az eaisyBill belépéskor megadva azonnal összekapcsolja saját számlázóját a könyvelővel.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2017. évi LIII. törvény a pénzmosás és a terrorizmus finanszírozása megelőzéséről (Pmt.):** Ügyfél-átvilágítási kötelezettség, tényleges tulajdonos és képviselő adatainak rögzítése az ügyfélkapcsolat létesítésekor.
- **2000. évi C. törvény a számvitelről (Sztv.):** Számviteli politika és számlatükör kialakítása az új gazdasági társaság profiljához igazítva.
- **2013. évi V. törvény a Polgári Törvénykönyvről (Ptk.):** Megbízási szerződés szerinti felelősségi körök és képviseleti jogok meghatározása.
