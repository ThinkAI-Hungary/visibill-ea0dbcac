# 📋 NAV Bérbevallások és 08-as Modul (Payroll Filings)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Bérszámfejtés  
> **Szükséges szerepkör:** Minden könyvelői és bérszámfejtői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Bérszámfejtő), aki jogosult a cég kezelésére  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a kijelölt cég bal oldali menüjében a **Bérszámfejtés** csoportban: **NAV bevallások** menüpont (`/eaisybooks/:companyId/:dateRange/payroll/filings`).
- **Ikon:** Iromány / Hatósági ellenőrző lista (`FileText` / `CheckCircle2`) ikon
- **Elérési útvonal:** Portfólió → Ügyfél kiválasztása → Bérszámfejtés → NAV bevallások
- **Gyorsműveletek:** Havi 08-as bevallás XML generálása, ÁNYK fájl letöltése, NAV nyugtaszám rögzítése, státusz léptetése

---

## 2. A menü funkciója és célja

A **NAV Bérbevallások és 08-as Modul** a havi rendszerességű hatósági elektronikus bevallások (különösen a 2608-as jelű havi adó- és járulékbevallás) összeállításának, ellenőrzésének, exportjának és nyugtanyilvántartásának a szakmai felülete.

### Fő feladatai és törvényi garanciái:
1. **Havi 08-as bevallás generálása (Art. 50. §):** A lezárt havi bérszámfejtési ciklus adataiból automatikusan előállítja a hatósági Főlapot és az egyedi munkavállalói M-lapokat.
2. **Közvetlen ÁNYK XML export:** Egyetlen kattintással letölthető a Nemzeti Adó- és Vámhivatal hivatalos Általános Nyomtatványkitöltő (ÁNYK) programjával kompatibilis `.xml` állomány.
3. **Éves M30-as és 2108-as igazolások:** Év végén kötegelten előállítja a munkavállalók részére kiadandó M30-as éves személyi jövedelemadó igazolásokat.
4. **Hivatalos NAV nyugtanyilvántartás:** Rögzíti az elektronikus beküldés dátumát és az adóhatóság által visszaigazolt nyugtaszámot, zárolva a béradatokat az utólagos elcsúszások ellen.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Cégfejléc és Akciógombok
- **Hogy hívják:** Fejléc cégadatok, „Új bevallás generálása” gomb (`Plus`) és „Exportálás” gomb (`ExportButton`)
- **Mire való:** Új hatósági bevallási állomány összeállításának indítása, valamint a bevallási lista CSV letöltése.
- **Hol található a felületen:** A fejléc jobb felső sarkában.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új bevallás generálása”** gombra: lenyílik az év és hónap választó panel.
  2. Válassza ki a tárgyévet és hónapot (pl. 2026 / 3. hó), majd kattintson a generálásra.
  3. A lista táblázatos letöltéséhez kattintson az **„Exportálás”** gombra.
  - **Eredmény:** A rendszer legenerálja a havi 08-as bevallást a számfejtett adatokból.

### 3.2 Bevallási KPI Statisztikai Kártyák
- **Hogy hívják:** Összes bevallás, Generálva, Beküldve, Elfogadva számlálókártyák
- **Mire való:** A cég adatszolgáltatási készültségének és a hatósági státuszoknak az azonnali felmérése.
- **Hol található a felületen:** A fejléc alatt sorakozó 4 színes információs doboz.
- **Hogyan használhatja a felhasználó:**
  1. Ellenőrizze a sárga **„Generálva”** dobozt a beküldésre váró nyomtatványok ellenőrzéséhez.
  2. Tekintse meg a kék **„Beküldve”** és a zöld **„Elfogadva”** mezőket a hatóságilag jóváhagyott állományok igazolására.
  - **Eredmény:** Biztos lehet benne, hogy a hónap 12-i határidőre minden bevallás eljutott a NAV-hoz.

### 3.3 Szűrősáv és Keresőmező
- **Hogy hívják:** „Keresés bevallásokban...” beviteli mező, Típus és Státusz szűrők
- **Mire való:** Keresés nyugtaszámra, időszakra, valamint szűrés bevallástípus (08, M30) és hatósági állapot szerint.
- **Hol található a felületen:** A KPI kártyák alatt elhelyezkedő szűrősáv.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a keresett időszakot (pl. „2026/03”) vagy a NAV nyugtaszámot.
  2. A **Típus** választóban szűrjön a *08-as bevallás* vagy *M30 igazolás* kategóriára.
  3. A **Státusz** választóban szűrjön a még be nem küldött tételekre.
  - **Eredmény:** A táblázat a kijelölt feltételeknek megfelelő bevallásokat listázza.

### 3.4 Bevallások Táblázata és Műveleti Ikonok
- **Hogy hívják:** Bevallási lista sorai, Típus és Státusz jelvények, ÁNYK XML letöltése (`Download`), Beküldés rögzítése (`Send`)
- **Mire való:** A havi bevallások adatainak (Időszak, Típus, Létszám, Összes kötelezettség, Nyugtaszám) áttekintése és a fájlok letöltése.
- **Hol található a felületen:** A képernyő középső részén lévő táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a tárgyhónapot és az M-lapok (munkavállalók) darabszámát.
  2. Tekintse meg az összesített kötelezettséget (SZJA, TB járulék, Szocho összege).
  3. Kattintson a sor végén lévő kék **Letöltés (`Download`)** ikonra a hivatalos `.xml` állomány lementéséhez.
  4. Nyissa meg az XML fájlt az ÁNYK programban, ellenőrizze és küldje be a NAV-hoz.
  5. A beküldés után kattintson a sor végén a **Send / Pipa** ikonra, és rögzítse a kapott NAV nyugtaszámot (pl. `NAV-2026-894120`).
  - **Eredmény:** A bevallás állapota zöld *Elfogadva* státuszra vált, garantálva az auditálhatóságot.

### 3.5 Lapozó Sáv
- **Hogy hívják:** Lapozó vezérlő (`UnifiedPagination`)
- **Mire való:** Navigálás a korábbi évek és hónapok bevallásai között (50 tétel / oldal).
- **Hol található a felületen:** A táblázat alatt.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a számozott gombokra a régebbi bevallások visszanézéséhez.
  - **Eredmény:** Betöltődnek a korábbi adóévek bevallási tételei.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Havi 08-as bevallás beküldése hó 12-ig
1. A könyvelő a bérszámfejtési ciklus lezárása után belép a **NAV bevallások** menübe.
2. Kattint az **„Új bevallás generálása”** gombra, kiválasztja a tárgyhónapot.
3. A rendszer létrehozza a bevallási sort, a könyvelő rákattint a **Letöltés** ikonra.
4. Az ÁNYK-ban betölti az XML fájlt, lefutattja az ellenőrzést, majd Cégkapun beküldi a NAV-nak.
5. A NAV nyugtát megkapva visszatér az eaisyBooks felületre, beírja a nyugtaszámot és a státuszt átállítja **„Elfogadva”** állapotra.

### 4.2 Éves M30 igazolások kötegelt előállítása januárban
1. Januárban az előző év utolsó számfejtése után a könyvelő a **Típus** szűrőnél az **M30**-at választja.
2. Legenerálja a munkavállalói jövedelemigazolásokat.
3. A rendszer egyetlen kattintással előállítja az összes dolgozó M30-as PDF adatlapját január 31-i határidővel.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2017. évi CL. törvény az adózás rendjéről (Art.) 50. §:** A munkáltató és kifizető havi adó- és járulékbevallási kötelezettsége (tárgyhót követő hó 12-ig).
- **1995. évi CXVII. törvény a személyi jövedelemadóról (Szja tv.):** M30-as éves összesített igazolás kiadási kötelezettsége a magánszemély részére január 31-ig.
- **2019. évi CXXII. törvény a társadalombiztosítás ellátásaira jogosultakról (Tbj.):** Biztosítottak egyéni járulékadatainak bejelentése.
