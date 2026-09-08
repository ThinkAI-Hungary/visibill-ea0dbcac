# 🔌 Integrációk (NAV Online Számla, Számlázz.hu és Email Alias)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Rendszer  
> **Szükséges szerepkör:** Tulajdonos (Owner), Adminisztrátor  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** A **Rendszer** csoport 1. menüpontja.
- **Ikon:** Csatlakozó / Integráció ikon
- **Elérési útvonal:** Integrációk menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** NAV kapcsolat tesztelése, számlafogadó email másolása, szinkronizációs napló megtekintése

---

## 2. A menü funkciója és célja

Az **Integrációk** felület köti össze az eaisyBill rendszert a külső hatósági rendszerekkel, számlázóprogramokkal és levelező szolgáltatókkal, biztosítva a bizonylatok és pénzügyi adatok emberi beavatkozás nélküli, automatikus áramlását.

### Fő integrációs csatornák:
- **NAV Online Számla rendszerkapcsolat:**
  - Technikai felhasználói adatok (Felhasználónév, Jelszó, XML Aláírókulcs, XML Cserekulcs) titkosított tárolása.
  - Automatikus, óránkénti kétirányú számlaszinkronizáció (kimenő vevői és bejövő szállítói számlák letöltése a NAV adatbázisából).
  - Szinkronizációs naplózás: pontos hibajelzések, státuszok és letöltött számlák darabszáma.
- **Számlafogadó E-mail Alias:**
  - Biztonságos céges számlafogadó e-mail cím generálása.
  - Nincs szükség közvetlen jelszavas hozzáférés megadására: a felhasználó saját levelezőjében (Google Workspace, Microsoft 365, cPanel) automatikus átirányítási szabályt állíthat be. A beérkező PDF számlákat a rendszer azonnal feldolgozza (optikai szövegfelismeréssel) és beemeli a számlák közé.
- **Számlázz.hu és külső számlázók összeköttetése:**
  - A számlázórendszerben kiállított bizonylatok valós idejű fogadása automatikus kapcsolaton keresztül.
- **Relax könyvelőprogram adatimport:**
  - Korábbi könyvelési előzményadatok és partnerállományok importálása Relax állományokból cégnév-validációval.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 NAV Online Számla Kulcsok és Kapcsolat Tesztelése
- **Hogy hívják:** „NAV Online Számla beállítások” panel és „Kapcsolat tesztelése” gomb
- **Mire való:** A Nemzeti Adó- és Vámhivatal technikai felhasználójának (Login, Jelszó, XML Aláírókulcs, XML Cserekulcs) biztonságos rögzítése a kimenő és bejövő számlák óránkénti automatikus letöltéséhez.
- **Hol található a felületen:** A képernyő bal felső nagy kártyáján.
- **Hogyan használhatja a felhasználó:**
  1. Jelentkezzen be a NAV Online Számla weboldalára, és hozzon létre egy *Technikai felhasználót* „Számlák lekérdezése” jogosultsággal.
  2. Másolja ki a 4 azonosító kulcsot, és illessze be az eaisyBill megfelelő beviteli mezőibe.
  3. Kattintson a kék **„Kapcsolat tesztelése és mentés”** gombra.
  4. A rendszer azonnal végrehajt egy próbalehívást a NAV felé.
  - **Eredmény:** Ha a kulcsok érvényesek, megjelenik a zöld „Sikeres NAV kapcsolat” jelzés, és azonnal elindul a számlák háttérbeli letöltése.

### 3.2 NAV Szinkronizációs Napló és Hibaelhárítás
- **Hogy hívják:** „Szinkronizációs előzmények” táblázat
- **Mire való:** A NAV felé intézett számlalehívások időpontjainak, a letöltött új bizonylatok számának és az esetleges hatósági szerverhibáknak az ellenőrzése.
- **Hol található a felületen:** A NAV konfigurációs kártya alján lévő lenyitható naplósáv.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Szinkronizációs napló megtekintése”** gombra.
  2. Tekintse át az időbélyegeket, a letöltött számlák darabszámát és a státuszkódokat.
  3. Ha piros hibaüzenet látható (pl. *Lejárt NAV jelszó* vagy *NAV szerver karbantartás*), a rendszer konkrét teendő javaslatot ad a javításra.
  - **Eredmény:** Teljes átláthatóság a számlaforgalom beérkezéséről.

### 3.3 Számlafogadó E-mail Alias Másolása és Újragenerálása
- **Hogy hívják:** „Számlafogadó E-mail Alias” kártya és „Másolás” gomb
- **Mire való:** Egyedi, titkosított céges e-mail cím biztosítása, ahová a beszállítók közvetlenül küldhetik a PDF számlákat, vagy ahová a felhasználó átirányíthatja a számlás leveleit.
- **Hol található a felületen:** A képernyő jobb felső kártyáján.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a másolás ikonra a generált cím mellett (pl. *cegnev-szamlak-8f3a@visibill.hu*).
  2. Állítson be saját céges levelezőjében (Gmail, Outlook stb.) automatikus továbbítási szabályt erre a címre a csatolt PDF számlákhoz.
  3. Ha kéretlen levelek (spam) érkeznének a címre, kattintson az **„Alias újragenerálása”** gombra egy friss cím létrehozásához.
  - **Eredmény:** Az ide továbbított PDF számlákat az AI másodpercek alatt beolvassa, optikailag felismeri (OCR), és beemeli a számlák közé.

### 3.4 Számlázz.hu és Külső Számlázók API Összeköttetése
- **Hogy hívják:** „Számlázz.hu integráció” beállító űrlap
- **Mire való:** A Számlázz.hu vagy más partner számlázórendszerből a kibocsátott vevői számlák valós idejű, azonnali átvétele számlaképpel és tételekkel együtt.
- **Hol található a felületen:** A képernyő középső sávjában lévő **„Számlázóprogramok”** szekcióban.
- **Hogyan használhatja a felhasználó:**
  1. Másolja ki az API kulcsot a számlázóprogram felületéről.
  2. Illessze be a számlázási kulcs mezőbe, és kapcsolja be az **„Automatikus számlaátvétel”** kapcsolót.
  3. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** Minden újonnan kiállított vevői számla másodperceken belül megjelenik az eaisyBill számlalistájában és főkönyvében.

### 3.5 Relax Könyvelési Adatimport Modul
- **Hogy hívják:** „Relax könyvelőprogram adatimport” zóna
- **Mire való:** A korábbi években Relax rendszerben könyvelt adatok, partnerállományok és számlatükör beolvasása az átállás megkönnyítésére.
- **Hol található a felületen:** Az oldal alsó harmadában található zöld doboz.
- **Hogyan használhatja a felhasználó:**
  1. Exportálja ki a Relax rendszerből az adatállományt.
  2. Húzza be a fájlt az import mezőbe.
  3. A rendszer ellenőrzi a cégnevet és adószámot az egyezőség igazolására.
  4. Kattintson az **„Importálás véglegesítése”** gombra.
  - **Eredmény:** A korábbi könyvelési előzmények beépülnek a cég archívumába.
