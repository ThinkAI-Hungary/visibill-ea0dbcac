# 🔒 GDPR és Adatvédelem (GDPR & Data Protection)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Biztonság & Adminisztráció  
> **Szükséges szerepkör:** Irodavezető adminisztrátor (`iroda_admin`), Adatvédelmi tisztviselő (DPO)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Biztonság & Rendszer** csoportban: **GDPR** menüpont (`/eaisybooks/admin/gdpr`).
- **Ikon:** Biztonsági pajzs pipa (`ShieldCheck`) ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → GDPR
- **Gyorsműveletek:** Új érintetti kérelem felvétele, ügyféli és dolgozói kérelmek állapotának léptetése (Elkezd, Teljesít), jogszabályi határidők betartása

---

## 2. A menü funkciója és célja

A **GDPR és Adatvédelem** felület a könyvelőiroda által kezelt ügyfelek és bérszámfejtett munkavállalók érintetti adatvédelmi jogainak (DSAR - Data Subject Access Requests) hivatalos nyilvántartása és ügyintézési központja az Európai Unió Általános Adatvédelmi Rendelete (GDPR) szerint.

### Fő feladatai és jogi garanciái:
1. **Érintetti jogok nyilvántartása és határidő-követése:** Biztosítja a 30 napos törvényi határidő betartását a következő 4 kérelemtípusnál:
   - **Hozzáférés:** A tárolt személyes adatok és béradatok másolatának kiadása.
   - **Helyesbítés:** Téves személyes adatok hivatalos korrekciója.
   - **Korlátozás:** Adatkezelés ideiglenes felfüggesztése vitatott jogalap esetén.
   - **Törlés (Elfeledtetés):** Személyes adatok törlése a számviteli törvény szerinti 8 éves kötelező megőrzési idő lejárta után.
2. **Háromlépcsős ügyintézési folyamat:** Végigkíséri a kérelmet a beérkezéstől (*Függőben*), a feldolgozáson át (*Folyamatban*), a lezárásig (*Teljesítve* vagy indokolt esetben *Elutasítva*).
3. **Auditált nyilvántartás:** Minden kérelem benyújtási és teljesítési dátuma rögzítésre kerül a NAIH hatósági ellenőrzések igazolására.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 GDPR Statisztikai Állapotkártyák
- **Hogy hívják:** Függőben, Folyamatban, Teljesítve számlálókártyák
- **Mire való:** Az aktív és lezárt érintetti kérelmek azonnali számszaki áttekintése.
- **Hol található a felületen:** A képernyő tetején, a fejléc alatt elhelyezkedő 3 darab információs kártya (borostyánsárga, kék, zöld).
- **Hogyan használhatja a felhasználó:**
  1. Ellenőrizze a borostyánsárga **„Függőben”** kártyát: ez jelzi az újonnan beérkezett, még el nem kezdett kérelmek számát.
  2. Tekintse meg a kék **„Folyamatban”** kártyát az éppen adatgyűjtés alatt lévő ügyek ellenőrzésére.
  3. A zöld **„Teljesítve”** mezőben kövesse a sikeresen megválaszolt és lezárt ügyek számát.
  - **Eredmény:** Az adatvédelmi felelős azonnal látja a napi teendőket és elkerüli a határidő-túllépést.

### 3.2 „Új kérelem” Indítása Gomb
- **Hogy hívják:** „Új kérelem” gomb (`Plus` ikon)
- **Mire való:** Érintetti megkeresés hivatalos iktatását indító dialógusablak megnyitása.
- **Hol található a felületen:** A fejléc jobb felső sarkában, a cím mellett.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új kérelem”** gombra.
  - **Eredmény:** Megnyílik a kérelem-rögzítő párbeszédablak.

### 3.3 Új Érintetti Kérelem Rögzítése Dialógus
- **Hogy hívják:** „Új érintetti kérelem” modális ablak, beviteli mezők és „Létrehozás” gomb
- **Mire való:** Az érintett munkavállaló nevének, a kérelem típusának és az egyedi igényeknek a rögzítése.
- **Hol található a felületen:** A felugró ablak közepén.
- **Hogyan használhatja a felhasználó:**
  1. Írja be az érintett nevét az **„Érintett neve”** mezőbe (pl. *Kovács Béla*).
  2. Válassza ki a kérelem típusát a legördülő menüből:
     - **Hozzáférés:** Ha az érintett a róla tárolt adatok másolatát kéri.
     - **Helyesbítés:** Lakcím, név vagy adóazonosító javítása esetén.
     - **Korlátozás:** Adatkezelés zárolásának kérésekor.
     - **Törlés:** Volt munkavállaló adatainak elévülés utáni törlésekor.
  3. A **„Megjegyzés”** szövegdobozba írja le a megkeresés forrását (pl. *E-mailben érkezett megkeresés 2026. 09. 08-án*).
  4. Kattintson a kék **„Létrehozás”** gombra.
  - **Eredmény:** A kérelem azonnal bekerül a táblázatba *Függőben* státusszal.

### 3.4 Kérelem Feldolgozásának Indítása („Elkezd”)
- **Hogy hívják:** „Elkezd” műveleti gomb
- **Mire való:** A beérkezett kérelem vizsgálatának és az adatok összegyűjtésének hivatalos elindítása.
- **Hol található a felületen:** A táblázat adott kérelem sorának „Művelet” oszlopában (csak függőben lévő tételeknél látható).
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a függőben lévő sort.
  2. Kattintson az **„Elkezd”** gombra.
  - **Eredmény:** A kérelem státusza kék *Folyamatban* állapotra vált, jelezve a kollégáknak, hogy az ügyintézés elkezdődött.

### 3.5 Kérelem Lezárása („Teljesít”)
- **Hogy hívják:** „Teljesít” műveleti gomb (zöld színű)
- **Mire való:** Az érintett tájékoztatását követően a kérelem sikeres lezárása és az elvégzés időbélyegzőjének rögzítése.
- **Hol található a felületen:** A táblázat adott kérelem sorának „Művelet” oszlopában (folyamatban lévő tételeknél).
- **Hogyan használhatja a felhasználó:**
  1. Miután átadta a kért adatcsomagot az érintettnek vagy elvégezte a kért helyesbítést, kattintson a **„Teljesít”** gombra.
  - **Eredmény:** A kérelem állapota zöld pipás *Teljesítve* státuszra vált, a rendszer automatikusan rögzíti a befejezés másodpercre pontos dátumát, és a tétel átkerül a lezártak közé.

### 3.6 Lapozó Sáv
- **Hogy hívják:** Lapozó vezérlő (`UnifiedPagination`)
- **Mire való:** Több oldalnyi kérelem közötti kényelmes lapozás (alapértelmezetten 20 tétel/oldal).
- **Hol található a felületen:** A táblázat alsó láblécében.
- **Hogyan használhatja a felhasználó:**
  1. Lapozzon a számgombokkal a korábbi évek lezárt kérelmeinek megtekintéséhez.
  - **Eredmény:** A rendszer betölti a kért oldalt.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Munkavállalói adatkikérés (Hozzáférés iránti kérelem) teljesítése
1. Egy volt munkavállaló hivatalos levélben kéri a nála tárolt bérlapok és jövedelemigazolások kiadását.
2. Az adminisztrátor rákattint az **„Új kérelem”** gombra, beírja a dolgozó nevét, kiválasztja a **„Hozzáférés”** típust, majd elmenti.
3. A sorban lévő **„Elkezd”** gombra kattint.
4. A bérszámfejtési modulból kiexportálja a bérlapokat és átadja az érintettnek.
5. Visszatérve a GDPR oldalra rákattint a zöld **„Teljesít”** gombra, így a folyamat hivatalosan lezárul.

### 4.2 Személyes adatok helyesbítése
1. Egy dolgozó bemutatja az új lakcímkártyáját megváltozott lakcímmel.
2. A könyvelő felvesz egy **„Helyesbítés”** típusú kérelmet.
3. Elvégzi a módosítást a dolgozói törzskartonon, majd a GDPR felületen lezárja a kérelmet a **„Teljesít”** gombbal.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **GDPR (2016/679/EU rendelet) 15–17. cikk:** Az érintett hozzáférési joga, helyesbítéshez való joga és a törléshez („elfeledtetéshez”) való joga.
- **GDPR 12. cikk (3) bekezdés:** A kérelem beérkezésétől számított legfeljebb 1 hónapos válaszadási és teljesítési határidő.
- **2000. évi C. törvény a számvitelről (Sztv.) 169. §:** A számviteli bizonylatok kötelező 8 éves megőrzése felülírja a törlési kérelmet a megőrzési idő lejárta előtt (jogszabályi kötelezettség jogalap).
