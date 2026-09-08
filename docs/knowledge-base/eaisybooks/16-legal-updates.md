# ⚖️ Jogszabály-frissítések és Adóváltozások (Legal Updates)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Szakmai Törzsadatok & Adminisztráció  
> **Szükséges szerepkör:**  
> - *Megtekintés:* Minden könyvelő és bérszámfejtő  
> - *Feed szinkronizáció és bejegyzéskezelés:* Irodavezető adminisztrátor (`iroda_admin`)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Törzsadatok & Rendszer** csoportban: **Jogszabály-frissítések** menüpont (`/eaisybooks/admin/legal-updates`).
- **Ikon:** Igazság mérlege (`Scale`) ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → Jogszabály-frissítések
- **Gyorsműveletek:** Hivatalos NAV és Magyar Közlöny hírfolyam azonnali frissítése, új jogszabályi tétel manuális rögzítése, informatikai lefejlesztési státusz követése

---

## 2. A menü funkciója és célja

A **Jogszabály-frissítések** felület az eaisyBooks hivatalos szakmai változáskövető naplója, amely figyeli a Magyar Közlönyben kihirdetett törvényeket és a NAV hivatalos közleményeit. Célja, hogy a könyvelőiroda csapata naprakész maradjon az adó- és munkaügyi változásokról, és lássa azok szoftveres lefejlesztési állapotát.

### Fő feladatai és szakmai értéke:
1. **Automatikus hatósági hírfolyam-letöltés:** Beépített szinkronizációval (`fetch-legal-updates`) közvetlenül lekéri a legfrissebb NAV közleményeket és közlöny kivonatokat.
2. **Érintett rendszermodulok megjelölése:** Pontosan azonosítja, hogy a jogszabályváltozás mely területeket érinti (Bérszámfejtés, Bevallások, NAV kapcsolat, Adóparaméterek, Foglalkoztatottak, GDPR, Sablonok, Jogviszonykódok).
3. **Megvalósítási státuszkövetés:** Jelzi a könyvelőknek, hogy a változás még csak *Tervezett*, fejlesztés alatt áll (*Folyamatban*), vagy már a kalkulációs motorba beépítve elérhető (*Élesítve*).
4. **Közvetlen jogforrás linkek:** Egy kattintással megnyitható az eredeti hatósági közlemény vagy jogszabályi szöveg.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 „Feed frissítése” Gomb (Automatikus Szinkron)
- **Hogy hívják:** „Feed frissítése” gomb (`RefreshCw` forgó ikon)
- **Mire való:** A háttérbeli hírgyűjtő Edge Function azonnali meghívása a legújabb Magyar Közlöny és NAV közlemények letöltéséhez.
- **Hol található a felületen:** A fejléc jobb felső sarkában, az „Új bejegyzés” gomb mellett balra.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Feed frissítése”** gombra.
  2. A gomb pörgő animációra vált a lekérés ideje alatt.
  3. A lefutás után zöld felugró üzenet tájékoztat: *„Feed frissítve — X új bejegyzés · NAV: Y, Közlöny: Z”*.
  - **Eredmény:** A hírfolyam tetején megjelennek a frissen kihirdetett jogszabályok és adózási útmutatók.

### 3.2 „Új bejegyzés” Rögzítése Gomb
- **Hogy hívják:** „Új bejegyzés” gomb (`Plus` ikon)
- **Mire való:** Egyedi irodai állásfoglalás vagy speciális szakmai hír manuális felvitele a naplóba.
- **Hol található a felületen:** A fejléc jobb felső sarkában.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új bejegyzés”** gombra.
  - **Eredmény:** Megnyílik a jogszabályi adatlap űrlapja.

### 3.3 Új Jogszabályi Bejegyzés Létrehozása Párbeszédablak
- **Hogy hívják:** Jogszabály rögzítő modal, Modulválasztó gombok és „Mentés” gomb
- **Mire való:** A törvényi tétel címének, forrásának, közzétételi dátumának, érintett moduljainak és státuszának beállítása.
- **Hol található a felületen:** A felugró ablak közepén.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a törvény címét a **„Cím”** mezőbe (pl. *2026. évi minimálbér kihirdetése*).
  2. Válassza ki a forrást a legördülőből: **Magyar Közlöny**, **NAV közlemény** vagy **Egyéb**.
  3. Adja meg a közzététel dátumát.
  4. Kattintson az érintett rendszermodulok gombjaira (több is kiválasztható, pl. *Bérszámfejtés*, *Adóparaméterek*).
  5. Állítsa be a megvalósítási státuszt: **Tervezett**, **Folyamatban** vagy **Élesítve**.
  6. Írjon rövid szakmai összefoglalót a **„Megjegyzések”** mezőbe.
  7. Kattintson a **„Létrehozás”** gombra.
  - **Eredmény:** A bejegyzés bekerül az irodai hírfolyamba.

### 3.4 Hírfolyam Kártyák és Szakmai Elemzés
- **Hogy hívják:** Jogszabályi kártya, Forrás jelvény, Állapot jelvény és Érintett modul címkék
- **Mire való:** A jogszabályváltozások gyors áttekintése, szakmai kommentárok elolvasása.
- **Hol található a felületen:** A képernyő középső részén időrendben elhelyezkedő kártyák.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa el a kártya vastag betűs címét.
  2. Ellenőrizze a forrást (lila Magyar Közlöny vagy kék NAV jelvény).
  3. Tekintse meg a jobb oldali státusz jelvényt:
     - 🟡 **Tervezett:** Törvény kihirdetve, fejlesztési tervezés alatt.
     - 🔵 **Folyamatban:** A fejlesztők már implementálják a rendszerben.
     - 🟢 **Élesítve:** A funkció már működik az eaisyBooks kalkulátoraiban.
  4. Olvassa el a kártya alján található szakmai magyarázatot és érintett modulokat.
  - **Eredmény:** A könyvelő azonnal látja, hogy a változás milyen ügyfeleket és mely modulokat érinti.

### 3.5 Külső Jogforrás Megnyitása
- **Hogy hívják:** Külső hivatkozás ikon (`ExternalLink`)
- **Mire való:** Az eredeti hatósági cikk vagy közlönyoldal megnyitása új böngészőlapon.
- **Hol található a felületen:** A hírfolyam kártya jobb szélén lévő kis ikon.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a külső link ikonra.
  - **Eredmény:** A böngésző új lapon megnyitja a hivatalos NAV tájékoztatót vagy a Magyar Közlöny PDF-et.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Új NAV állásfoglalás ellenőrzése a reggeli műszakban
1. Az irodavezető reggel belép a **Jogszabály-frissítések** felületre.
2. Rákattint a **„Feed frissítése”** gombra, amely letölti az elmúlt 24 óra NAV közleményeit.
3. Megjelenik egy új bejegyzés a távmunkavégzés költségtérítésének SZJA elszámolásáról.
4. Átolvassa a megjegyzést, megnyitja az eredeti cikket az **ExternalLink** gombbal, majd a bérszámfejtő kollégák figyelmébe ajánlja a szabályt.

### 4.2 Szoftverfrissítési státusz ellenőrzése ügyfélkérdésnél
1. Az ügyfél rákérdez, hogy a könyvelőrendszer már tartalmazza-e az új KIVA belépési értékhatárt.
2. A könyvelő megkeresi a KIVA törvénymódosítás kártyáját a naplóban.
3. Látja a zöld **„Élesítve”** jelvényt, így biztosan tájékoztathatja az ügyfelet, hogy a rendszer már a módosított szabályok szerint számol.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **Magyar Közlöny:** Magyarország hivatalos lapja, a jogszabályok kihirdetésének kötelező helye.
- **Nemzeti Adó- és Vámhivatal (NAV) szakmai tájékoztatói és állásfoglalásai:** Gyakorlati adójogi iránymutatások.
- **2017. évi CL. törvény az adózás rendjéről (Art.):** Jogszabályi hatálybalépések és felkészülési idők.
