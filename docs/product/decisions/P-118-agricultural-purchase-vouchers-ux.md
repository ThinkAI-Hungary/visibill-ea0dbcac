# P-118: Mezőgazdasági Felvásárlási Jegyek UX

**Status:** Decided  
**Category:** Workflow / UI / Statutory Accounting  
**Date:** 2026-09-26  
**Kapcsolódó architektúra döntés:** [A-158: Mezőgazdasági Felvásárlási Jegyek Modul és Bérügyi Integráció](../../architecture/decisions/A-158-agricultural-purchase-vouchers-module.md)  
**Érintett felületek:** Bérek és járulékok (`/salaries?tab=purchase_vouchers`), Cégbeállítások (`/settings?tab=business`)

---

## 1. Termékkérdés és Célkitűzés

A mezőgazdasági termékeket (gabonafélék, zöldség-gyümölcs, élőállat, tej) őstermelőktől és kistermelőktől felvásárló vállalkozások nem számla, hanem szigorú számadású felvásárlási jegy alapján számolnak el.

Hogyan alakítsunk ki olyan felhasználóbarát, könyvelő-központú és jogszabálykövető munkafolyamatot, amely:
1. Biztosítja az Áfa tv. 199. § szerinti kompenzációs felár (12% és 7%) automatikus, hibamentes számítását?
2. Nem terheli felesleges menüpontokkal és bonyolultsággal azokat a cégeket (~95%), amelyek nem végeznek agrár-felvásárlást?
3. Zökkenőmentesen integrálódik a meglévő bér- és járulékkezelési (`/salaries`), valamint a pénztári és banki munkafolyamatokba?

---

## 2. Termékdöntés

### A. Elhelyezés és Feltételes Aktiválás (Opt-in Feature Flag)
- A modul a **Bérek és járulékok (`/salaries`)** oldal második füleként érhető el: `[ Alkalmazottak & NAV ]  [ Felvásárlási jegyek ]`.
- Ha a cég profiljában még nincs bekapcsolva a modul (`has_purchase_vouchers = false`), a fül megnyitásakor egy esztétikus, tájékoztató promóciós kártya jelenik meg, amely összefoglalja az előnyöket és 1-kattintásos azonnali bekapcsolást kínál.
- A funkció a **Cégbeállítások (`/settings?tab=business`)** felületen is bármikor ki- és bekapcsolható.

### B. Vezérlőpult és KPI Kártyák (`PurchaseVoucherKpiCards.tsx`)
A lista tetején 4 azonnali vezetői és könyvelői KPI kártya fogadja a felhasználót:
1. **Összes felvásárlás (Bruttó kifizetés):** Az időszak teljes őstermelői kifizetési összege.
2. **Levonható kompenzációs felár (ÁFA):** Az ÁFA bevallásba bekerülő 12%-os és 7%-os felárak szummája.
3. **Kifizetésre váró összeg:** A még ki nem fizetett bizonylatok nyitott állománya.
4. **Őstermelők / Bizonylatok száma:** Aktív partnerek és kiállított jegyek volumene.

### C. Új Felvásárlási Jegy Kiállítása Dialógus (`PurchaseVoucherDialog.tsx`)
- **Partner & Őstermelői Adatok:**
  - Őstermelő neve, címe, adóazonosító jele / adószáma (NAV 08-hoz kötelező), őstermelői igazolványszáma vagy FELIR azonosítója, bankszámlaszáma.
- **Dátumok:** Kiállítás dátuma, teljesítés dátuma, fizetési határidő.
- **Kompenzációs Mérték Választó:**
  - `12%` — Növénytermesztés, kertészet, erdészet, vetőmag (alapértelmezett).
  - `7%` — Állattenyésztés, élőállat.
  - `0%` — Egyedi kivétel / felár nélküli felvásárlás.
- **Dinamikus Tételrács:**
  - Megnevezés, VTSZ / KN kód, mennyiség, mértékegység, egységár.
  - Automatikus élő kalkuláció: nettó ár, kompenzációs felár összege, bruttó összeg.
- **Kifizetési Mód és Levonások:**
  - Fizetési mód: `Átutalás` vagy `Készpénz`.
  - Opcionális SZJA előleg levonás mező.

### D. Bizonylatkezelés és Életciklus
- **Státuszok:** `unpaid` (kifizetésre vár) és `paid` (kifizetve).
- **1-Kattintásos Fizetési Státusz Váltás:** A bizonylatlistából közvetlenül megjelölhető kifizetettként a fizetés dátumának rögzítésével.
- **CSV Minta és Export:** Lehetőség van a kiállított bizonylatok listájának szűrésére és letöltésére.

---

## 3. Racionálé és Számviteli Integráció

- **Törvényi megfelelőség:** A 12%-os és 7%-os felárak elszámolása megfelel az Áfa tv. 199. § előírásainak; a felvásárlónál a kompenzációs felár levonható adóként érvényesíthető.
- **Automatikus főkönyvi kontírozás:** A felvásárlási jegyek automatikusan generálják a `4662T` (Kompenzációs felár) és `454K` (Őstermelői kötelezettség) főkönyvi feladásokat.
- **Zero UI clutter:** Az inaktív cégeknél nem jelennek meg felesleges menüpontok, a felület tiszta és gyors marad.

---

## 4. Kapcsolódó Dokumentumok
- [A-158: Mezőgazdasági Felvásárlási Jegyek Modul és Bérügyi Integráció](../../architecture/decisions/A-158-agricultural-purchase-vouchers-module.md)
- [P-119: Törvényi ÁFA Nézetek és Fordított Adózás (FAD) UX](./P-119-statutory-vat-views-upgrade-and-reverse-charge-ux.md)
