# 🛡️ Jogosultságkezelő Mátrix (Permission Matrix)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Iroda Adminisztráció  
> **Szükséges szerepkör:** Irodavezető adminisztrátor (`iroda_admin`)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében az **Adminisztráció** csoportban: **Jogosultságkezelő** menüpont (`/eaisybooks/admin/permissions`).
- **Ikon:** Pajzs (`Shield`) ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → Jogosultságkezelő
- **Gyorsműveletek:** Könyvelő-cég hozzárendelések módosítása, szerepkörök azonnali átállítása, modulonkénti olvasási és írási jogosultságok kapcsolása

---

## 2. A menü funkciója és célja

A **Jogosultságkezelő Mátrix** az eaisyBooks könyvelőirodai jogosultság- és feladatmegosztási központja. Biztosítja, hogy az iroda munkatársai kizárólag a rájuk bízott ügyfélcégek adataihoz férjenek hozzá, valamint modulonként (pl. Bérszámfejtés, TAO, Jóváhagyások) szabályozza az olvasási és adatrögzítési engedélyeket.

### Fő feladatai és biztonsági garanciái:
1. **Kétdimenziós Cég–Könyvelő Mátrix:** Áttekinthető táblázatban jeleníti meg az iroda összes ügyfelét és munkatársát, lehetővé téve a felelősségi körök azonnali hozzárendelését vagy megszüntetését.
2. **Négyfokozatú szerepkör-kezelés:** Minden hozzárendeléshez meghatározható az adott cégre érvényes szerepkör:
   - **Iroda Admin:** Korlátlan hozzáférés és cégbeállítások kezelése.
   - **Senior Könyvelő:** Szakmai felügyelet, bevallás jóváhagyás, zárások engedélyezése.
   - **Könyvelő:** Operatív számla-, bank- és bizonylatkönyvelés.
   - **Asszisztens:** Bizonylatelőkészítés, hiánylista kezelés jóváhagyási jog nélkül.
3. **Moduláris funkció-hozzáférés (Olvasás/Írás):** Külön lapfülön szabályozható, hogy az egyes munkatársak mely funkcionális modulokat használhatják (pl. béradatok elrejtése vagy csak olvasási jog biztosítása).
4. **Valós idejű szinkronizáció:** Minden változtatás mentési gomb nélkül, azonnal lefut az adatbázisban és érvényesül a munkatárs felületén.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Mátrix Nézetváltó Fülek és Keresősáv
- **Hogy hívják:** „Szerepkörök (Cég–Könyvelő)” és „Modul jogosultságok” lapfülek, valamint Keresőmező
- **Mire való:** Váltás az ügyfél-hozzárendelések és a funkcionális modulok finomhangolása között, valamint cég- és munkatársnevek szerinti gyors szűrés.
- **Hol található a felületen:** A fejléc alatt elhelyezkedő fülsor és a mellette lévő keresődoboz.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kívánt nézet fülre:
     - **Szerepkörök:** A cégek és könyvelők kapcsolatát mutató mátrix.
     - **Modul jogosultságok:** Felhasználónkénti olvasási és írási engedélyek.
  2. A keresőmezőbe írja be a cég vagy a könyvelő nevét a táblázat szűkítéséhez.
  - **Eredmény:** A táblázat azonnal leszűkül az érintett munkatársakra és cégekre.

### 3.2 Cég Hozzárendelése Könyvelőhöz
- **Hogy hívják:** Üres cella „+” Hozzáadás gombja
- **Mire való:** Egy adott ügyfélcég könyvelési feladatainak kiosztása a kiválasztott munkatársnak.
- **Hol található a felületen:** A Szerepkörök fül táblázatában az adott Cég sora és a Könyvelő oszlopa metszéspontjában lévő üres négyzet.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a cég sorát és a könyvelő oszlopát.
  2. Kattintson az üres cellában lévő **„+”** gombra.
  3. A felugró menüből válassza ki a kezdeti szerepkört (pl. *Könyvelő* vagy *Senior Könyvelő*).
  - **Eredmény:** A rendszer létrehozza az összerendelést, a cellában megjelenik a színes szerepkör-jelvény, és a cég azonnal láthatóvá válik a munkatárs Portfóliójában.

### 3.3 Hozzárendelt Szerepkör Módosítása és Eltávolítása
- **Hogy hívják:** Szerepkör választó legördülő jelvény és „Eltávolítás” (X / Kuka) ikon
- **Mire való:** A munkatárs cégre vonatkozó hatáskörének emelése/csökkentése (pl. Könyvelőből Senior Könyvelővé minősítés), vagy a cég levétele a könyvelőről.
- **Hol található a felületen:** A táblázat aktív celláiban elhelyezkedő színes jelvény (lila: Admin, kék: Senior, zöld: Könyvelő, szürke: Asszisztens).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a szerepkör jelvényre a cellában.
  2. A legördülő listából válassza ki az új szerepkört (pl. lépjen fel *Senior Könyvelő* szintre).
  3. Ha el szeretné venni a céget a munkatárstól, kattintson a cella jobb szélén lévő piros **„X”** (Eltávolítás) gombra.
  - **Eredmény:** A rendszer zöld megerősítő üzenetet ad: *„Szerepkör frissítve”* vagy *„Hozzárendelés törölve”*.

### 3.4 Modul Jogosultságok Finomhangolása (Olvasás / Írás)
- **Hogy hívják:** „Modul jogosultságok” táblázat, Olvasás kapcsoló (szem ikon) és Írás kapcsoló (ceruza ikon)
- **Mire való:** Globális funkciók modulonkénti engedélyezése vagy tiltása könyvelőnként (pl. bérszámfejtéshez vagy riportokhoz való hozzáférés).
- **Hol található a felületen:** A „Modul jogosultságok” lapfül táblázatában.
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a **„Modul jogosultságok”** lapfület.
  2. Keresse meg a munkatársat és az adott modult (pl. *Bérszámfejtés*, *TAO / KIVA*, *Jóváhagyó rendszer*, *Riportok*).
  3. Kattintson a **Szem ikonra** (Olvasási jog) a megtekintés engedélyezéséhez vagy tiltásához.
  4. Kattintson a **Ceruza ikonra** (Írási jog) az adatrögzítési és módosítási funkciók bekapcsolásához.
  - **Eredmény:** A munkatárs bal oldali menüjében a tiltott modulok elrejtésre kerülnek, és jogosulatlanul nem végezhet műveletet.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Újonnan belépő junior könyvelő portfóliójának összeállítása
1. Az irodavezető a munkatárs meghívása után megnyitja a **Jogosultságkezelő** felületet.
2. A **Szerepkörök** lapfülön megkeresi a munkatárs nevét.
3. Sorban rákattint a kollégára bízandó 15 kkv cég soraiban a **„+”** gombra, és kiválasztja a **„Könyvelő”** szerepkört.
4. Átvált a **Modul jogosultságok** fülre, és a bérszámfejtési modul írási jogát kikapcsolja nála, így a bérszámfejtéshez csak az iroda dedikált bérszámfejtője férhet hozzá.

### 4.2 Táppénz / Szabadság miatti helyettesítés beállítása
1. Egy szenior könyvelő 2 hetes szabadságra megy.
2. Az irodavezető a helyettesítő kolléga oszlopában az érintett cégeknél átmenetileg bekapcsolja a **„Senior Könyvelő”** jogkört a **„+”** gombokkal.
3. A szabadság letelte után a felületen az **„Eltávolítás”** (X) gombbal visszavonja az átmeneti jogosultságokat.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **GDPR (2016/679/EU rendelet) 25. cikk (Beépített és alapértelmezett adatvédelem):** Az adatokhoz való hozzáférés korlátozása kizárólag a munkaköri feladatok ellátásához szükséges mértékben (Need-to-know elv).
- **2000. évi C. törvény a számvitelről (Sztv.):** Számviteli felelősség megosztása az összeállító és a jóváhagyó személye között.
