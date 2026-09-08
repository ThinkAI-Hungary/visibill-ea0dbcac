# 📑 Ügyfél Számlák és Bizonylatok (Client Invoices)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Bizonylatok  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő), aki jogosult a cég kezelésére  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen egy adott cég kiválasztása után a bal oldali menüben: **Számlák** menüpont (`/eaisybooks/:companyId/:dateRange/invoices`).
- **Ikon:** Számla / Bizonylat (`FileText`) ikon
- **Elérési útvonal:** Portfólió → Ügyfél kiválasztása → Számlák
- **Gyorsműveletek:** NAV számlák kézi szinkronizálása, számlakép (PDF) megtekintése, főkönyvi kontírozás és T-számlás felosztás, könyvelőprogram exportok (RLB, Kulcs-Soft, Novitax)

---

## 2. A menü funkciója és célja

Az **Ügyfél Számlák** modul a vállalkozás összes kimenő (vevői) és bejövő (szállítói) számlájának könyvviteli feldolgozó központja. Itt futnak össze a NAV Online Számla rendszeréből letöltött elektronikus számlák és a manuálisan vagy eaisyBill-en keresztül feltöltött PDF bizonylatok.

### Fő feladatai és szakmai értéke:
1. **NAV és Számlakép összerendelés:** Valós időben összekapcsolja a NAV XML adatszerkezetét a szkennelt vagy digitális PDF számlaképpel, így a könyvelő azonnal látja a hivatalos tételeket és az eredeti bizonylatot.
2. **Kettős könyvviteli kontírozás és T-számlás analitika:** Megjeleníti a Tartozik és Követel főkönyvi számlaszámokat (pl. T 511 - K 454), lehetővé téve a költségnemek, projektek és ÁFA analitika soronkénti felosztását.
3. **Külső könyvelőszoftver exportok:** Egyetlen kattintással generál szabványos importfájlokat a legnépszerűbb magyar könyvelőprogramokba (RLB60, Novitax, Kulcs-Soft).
4. **Automatikus ÁFA minősítés:** Ellenőrzi az adókulcsokat (27%, 18%, 5%, AAM, Fordított adózás FAD), segítve a hibátlan 65-ös ÁFA bevallás elkészítését.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Számlaszinkron és Technikai Fejléc Akciók
- **Hogy hívják:** „NAV Szinkron” gomb (`RefreshCcw`), „NAV Beállítások” gomb (`Settings`) és „Számla feltöltése” gomb (`Upload`)
- **Mire való:** Új számlák letöltése a NAV-ból adott idősávra, technikai felhasználói adatok ellenőrzése, valamint kézi PDF számla feltöltése.
- **Hol található a felületen:** A fejléc jobb felső sarkában.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„NAV Szinkron”** gombra: a felugró ablakban adja meg a kezdő és záró dátumot (pl. `2026-03-01` – `2026-03-31`), majd kattintson a letöltésre.
  2. Ha a NAV kapcsolat hibát jelez, kattintson a **„NAV Beállítások”** fogaskerék ikonra a technikai kulcsok megújításához.
  3. Kézi számla hozzáadásához kattintson a **„Számla feltöltése”** gombra, és húzza be a PDF fájlt.
  - **Eredmény:** Az új számlák bekerülnek a feldolgozandó számlalistába.

### 3.2 Szűrősáv és Keresőmező
- **Hogy hívják:** „Keresés számlákban...” beviteli mező, Típus, Státusz és Speciális szűrők
- **Mire való:** Számlaszám, partnernév vagy összeg szerinti keresés, valamint szűrés könyvelési státusz és adójellemzők alapján.
- **Hol található a felületen:** A táblázat feletti szűrősávban.
- **Hogyan használhatja a felhasználó:**
  1. Gépelje be a keresőbe a partner nevét vagy a számlaszámot.
  2. A **Típus** választóban szűrjön: *Minden számla*, *Kimenő (vevői)* vagy *Bejövő (szállítói)*.
  3. A **Státusz** választóban jelölje ki: *Feldolgozás alatt*, *Kontírozott*, *Exportálva* vagy *Problémás*.
  4. Használja a gyorskapcsolókat:
     - **FAD (Fordított adózás):** Csak a fordított adós számlák listázása.
     - **Hiányzó számlakép:** Olyan NAV számlák, amelyekhez még nincs feltöltve a PDF kép.
  - **Eredmény:** A számlatáblázat azonnal leszűkül az ellenőrizendő tételekre.

### 3.3 Strukturált Számlatáblázat és T-számlás Előnézet
- **Hogy hívják:** Számlalista sorai, Kontírozási kódok (`TAccountLedger`) és Státusz jelvény
- **Mire való:** A számla fő adatainak áttekintése és a lekönyvelt T/K főkönyvi számlaszámok ellenőrzése.
- **Hol található a felületen:** A képernyő közepén elhelyezkedő táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a számlaszámot, a partnert és a kibocsátási/teljesítési dátumokat.
  2. Tekintse meg a Nettó, ÁFA és Bruttó forintösszegeket.
  3. Vigye az egeret a kontírozási mező fölé: a rendszer lebegő dobozban megjeleníti a **T-számlás főkönyvi bontást** (pl. T 511 Anyagköltség / K 454 Belföldi szállító).
  - **Eredmény:** Azonnali visszajelzést kap a számla számviteli helyességéről.

### 3.4 Eredeti Számlakép Megtekintése
- **Hogy hívják:** Számlakép megtekintése ikon / dialógus (`InvoiceImageDialog`)
- **Mire való:** Az eredeti papír vagy e-számla PDF dokumentumának felnagyítása, ellenőrzése.
- **Hol található a felületen:** A sorvégi műveleti menüben vagy a számlaszámra kattintva.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a számla sorában a dokumentum ikonra.
  2. A felugró ablakban megjelenik a PDF számlakép, amely nagyítható, forgatható vagy letölthető.
  - **Eredmény:** Ellenőrizheti a számla kötelező tartalmi elemeit a jóváhagyás előtt.

### 3.5 Számla Jóváhagyása és Kontírozás Munkalap
- **Hogy hívják:** „Jóváhagyás és kontírozás” dialógus (`InvoiceApprovalDialog`)
- **Mire való:** A számla főkönyvi számainak módosítása, költséghely hozzárendelése és végleges könyvelői jóváhagyása.
- **Hol található a felületen:** A sorvégi műveleti menü „Jóváhagyás” elemére kattintva.
- **Hogyan használhatja a felhasználó:**
  1. Nyissa meg a jóváhagyó ablakot.
  2. Válassza ki a költségszámlát (pl. 529 - Igénybe vett szolgáltatások).
  3. Állítsa be az ÁFA levonhatóságát (Levonható / Nem levonható).
  4. Kattintson a **„Jóváhagyás”** gombra.
  - **Eredmény:** A számla státusza zöld *Kontírozott* állapotra vált, és bekerül a főkönyvi zárásba.

### 3.6 Exportálás Könyvelőszoftverbe (RLB60, Kulcs-Soft, Novitax)
- **Hogy hívják:** „Exportálás” gomb és szoftverválasztó menü
- **Mire való:** A lekönyvelt számlák átadása a külső könyvviteli programok felé.
- **Hol található a felületen:** A táblázat feletti export gombsorban.
- **Hogyan használhatja a felhasználó:**
  1. Jelölje ki a kontírozott számlákat.
  2. Kattintson az **„Exportálás”** gombra.
  3. Válassza ki a könyvelőiroda szoftverét: **RLB60 formátum**, **Kulcs-Soft kettős könyvvitel** vagy **Novitax állomány**.
  4. Mentse el a letöltött adatfájlt.
  - **Eredmény:** Az állomány közvetlenül beimportálható a külső főkönyvi programba.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Havi szállítói számlák tömeges kontírozása
1. A könyvelő belép a cég **Számlák** menüpontjába.
2. A típus szűrőnél kiválasztja a **„Bejövő (szállítói)”** opciót, a státusznál a **„Feldolgozás alatt”** szűrőt.
3. Megnyitja az első számla adatlapját, ellenőrzi a számlaképet és a NAV XML adatokat.
4. Kiválasztja az 521-es Bérleti díj főkönyvi számot, majd a **„Jóváhagyás”** gombra kattint.
5. Végighalad a havi számlákon, amíg a feldolgozásra váró számláló nullára csökken.

### 4.2 Számlaadatok exportálása RLB60 programba
1. A havi bizonylatok lekönyvelése után a könyvelő bejelöli a tárgyhavi kontírozott számlákat.
2. Kattint az **Exportálás** → **RLB60** gombra.
3. A letöltött fájlt megnyitja az RLB programban az automatikus könyvelés futtatásához.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2007. évi CXXVII. törvény az általános forgalmi adóról (Áfa tv.) 169. §:** A számla kötelező tartalmi kellékei és a számlakibocsátási határidők.
- **2000. évi C. törvény a számvitelről (Sztv.):** Bizonylati elv, a gazdasági műveletek könyvviteli számlákon történő rögzítésének kötelezettsége.
- **NAV Online Számla rendelet:** Valós idejű elektronikus adatszolgáltatási szabályzat.
