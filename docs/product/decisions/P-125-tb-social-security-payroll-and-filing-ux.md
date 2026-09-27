# P-125: Társadalombiztosítási (TB) Bérszámfejtési Modul, Pre-Flight Ellenőrzés és Kilépő Igazolványok UX

**Állapot:** Elfogadva (Decided)  
**Dátum:** 2026-09-27  
**Döntéshozó:** Product, Tax & Payroll Lead  
**Érintett modulok:** Bérszámfejtés Ciklus (`/payroll`), NAV 2608 Bevallás (`Filing2608Page`), Pre-Flight Ellenőrző (`FilingPreFlightDialog`), Kilépő Dokumentumok (`ExitDocumentsPage`), Anomália Elemző (`AiAnomalyReportPage`).  

---

## 1. Háttér és Felhasználói Probléma

A bérszámfejtést végző könyvelők egyik leggyakoribb hibaforrása a NAV 08-as havi bevallás elkészítésekor:
1. **Minimális járulékalap elfelejtése részmunkaidőnél:** A könyvelő a dolgozónak alacsony bért (pl. heti 10 órában 60 000 Ft-ot) számfejt, de nem veszi figyelembe, hogy a Tbj. 27. § (2) szerinti 30%-os minimális alap küszöböt el kell érni, így a munkáltatónak különbözeti TB-járulékot és SZOCHO-t kell fizetnie, hacsak nincs mentesülési jogcím (pl. diák, kisgyermekes).
2. **0 Ft-os bruttó bér és munkáltatói teher:** Igazolatlan hiányzás vagy fizetés nélküli szabadság esetén előfordulhat 0 Ft-os bruttó bér, miközben a minimális alap után fizetendő teher váratlanul megjelenik.
3. **Többes jogviszonyos ÁNYK hiba:** Ha egy dolgozó egyszerre több munkakörben vagy megbízásban dolgozik, a NAV hibát dob, ha a két jogviszony nincs külön M-lapon külön `<Jogviszonysorszam>` sorszámmal elküldve.
4. **Kilépő TB Igazolvány kiadásának nehézkessége:** Kilépéskor a munkavállalónak kötelező átadni a társadalombiztosítási ellátásokhoz szükséges igazolást (biztosítási idő, táppénz napok, járulékalapok).

---

## 2. Megoldás és UI/UX Munkafolyamat

### 2.1 Bérszámfejtés Zárás és Pre-Flight Ellenőrző (`FilingPreFlightDialog`)
A havi 2608-as bevallás generálása és letöltése előtt a rendszer automatikus előzetes ellenőrzést (Pre-Flight Check) végez:
- **0 Ft Bruttó Bér és Minimum Alap Figyelmeztetés:**
  Ha egy munkavállaló bruttó bére 0 Ft, de a Tbj. 27. § (2) alapján minimális alap utáni munkáltatói teher keletkezett, a dialógus sárga figyelmeztetéssel jelzi:
  > *"Figyelem: A munkavállaló bruttó bére 0 Ft, de a Tbj. 27. § (2) alapján minimális járulékalap utáni munkáltatói teher keletkezett. Kérjük ellenőrizze az igazolatlan hiányzás vagy fizetés nélküli szabadság jogcímét!"*
- **Hiányzó adatok jelzése:** Figyelmeztet, ha hiányzik a TAJ szám, FEOR kód, vagy érvénytelen az adóazonosító jel.

### 2.2 Többes Jogviszony Megjelenítés a 2608 Felületen (`Filing2608Page`)
- A dolgozók táblázatában a több jogviszonnyal rendelkező munkavállalók jogviszonyonként külön sorban jelennek meg.
- A név mellett egyértelmű azonosító jelvény látható: `(Jogviszony #1)`, `(Jogviszony #2)`, a FEOR számmal és a heti munkaórával.
- Az ÁNYK XML export mindkét jogviszonyt önálló M-lapként generálja le.

### 2.3 Kilépő TB Igazolvány és Hatósági Kivonat (`ExitDocumentsPage`)
- A dolgozó kiléptetésekor az `ExitDocumentsPage` felületen a megszokott kilépő bizonylatok (Adatlap 2026, Kilépő munkáltatói igazolás) mellett új gomb érhető el:
  - **„TB Igazolvány Kivonat (PDF)”**:
    - Generálja a hivatalos formátumú kivonatot a biztosítási jogviszony időtartamáról, a munkakörről, a levont TB járulékokról és az igénybe vett betegszabadság/táppénz napokról.
    - PDF letöltés és nyomtatás közvetlenül az alkalmazásból.

### 2.4 Mesterséges Intelligencia és Anomália Elemző (`AiAnomalyReportPage`)
- A bérszámfejtési ciklus lezárása előtt az Anomália Elemző automatikusan átvizsgálja a kalkulációkat:
  - Detektálja, ha egy dolgozónál a bruttó bér a minimális alap alatt van, de nincs rögzítve mentesülési indok.
  - Figyelmeztet, ha a dolgozó születési dátuma alapján elérte a nyugdíjkorhatárt, de nincs bejelölve a nyugdíjas státusz.
  - Jelzi, ha többes jogviszony esetén a halmozott heti munkaidő meghaladja a megengedett törvényi maximumot (48 óra).

---

## 3. Kapcsolódó Döntések
- [A-166: TB Adómotor és 2608 M-lap Architektúra](../../architecture/decisions/A-166-tb-social-security-minimum-base-and-pensioner-payroll-engine.md)
