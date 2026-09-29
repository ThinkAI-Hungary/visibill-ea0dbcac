# P-139: Egyéni Számlatükör Főkönyvi Szám Törlése és Ergonómiai UX

**Dátum:** 2026-09-29  
**Státusz:** ✅ Elfogadva (Decided)  
**Érintett képernyők:** Főkönyvi kivonat (`/general-ledger`), Alsó szintű főkönyvi tétel `<Sheet>`  
**Kapcsolódó ADR:** [A-178](../../architecture/decisions/A-178-custom-chart-of-accounts-unused-account-deletion.md)  
**Előzmény:** [P-071](./P-071-safe-chart-of-accounts-preset-deletion-and-remapping-ux.md), [P-122](./P-122-general-ledger-ui-ux-restructuring-and-clutter-reduction.md)

---

## 1. Felhasználói Igény és Probléma

Könyvelői munkavégzés során előfordul, hogy egy új számlaszám vagy alábontás rögzítésekor elírás történik (pl. téves 4668 felvitele a 466 alá). Korábban a felhasználó nem találta a felületen a törlés lehetőségét, ami ügyfélszolgálati bejelentésekhez és felesleges várakozáshoz vezetett (pl. TS Consult Kft. support jegy).

---

## 2. Termék és UX Megoldás

### 2.1. Természetes Felfedezhetőség (Natural Discoverability)
- A Főkönyvi kivonat fastruktúrájában minden alsó szintű (levél) számla kattinthatóvá vált a számlaszámra (`row.id`) és a megnevezésre (`row.name`) kattintva is.
- A kattintás megnyitja a jobbról beúszó tételrészletező panelt (`<Sheet>`).

### 2.2. Kontextuális Törlés Gomb
- Amikor az aktív számlatükör a cég saját egyéni sablonja:
  1. **A Sheet Fejlécében:** Megjelenik a piros szegélyű *„Számla törlése”* gomb szemeteskuka (`Trash2`) ikonnal.
  2. **Üres Állapotban:** Ha a számlához még nem tartozik könyvelési tétel, az üres állapot dobozban kiemelt másodlagos cselekvésként is megjelenik a *„Számla törlése a számlatükörből”* gomb.

### 2.3. Biztonsági Megerősítő Dialógus (`<AlertDialog>`)
- A gombra kattintva felugrik a törlési megerősítő modális ablak:
  - Cím: *„Főkönyvi szám törlése”*
  - Szöveg: *„Biztosan törölni szeretnéd a(z) [szám] ([név]) főkönyvi számot a számlatükörből?”*
  - Figyelmeztetés: *„A törlés végleges, és csak akkor hajtható végre, ha a főkönyvi számhoz nem kapcsolódnak könyvelt tételek vagy alszámlák.”*
  - Műveletek: *Mégse* és destruktív stílusú *Törlés*.

### 2.4. Intelligens Hibakezelés és Visszajelzés
- Ha a számlának vannak alszámlái: értesítés jelenik meg, hogy előbb az alszámlákat kell törölni.
- Ha könyvelési tétel van rajta: értesítés tájékoztatja a felhasználót, hogy könyvelt tételt tartalmazó számla nem törölhető.
- Sikeres törlés esetén: a panel bezárul, a lista automatikusan frissül, és zöld visszaigazoló toast tájékoztat a törlés sikerességéről.
- Kétnyelvű támogatás (magyar és horvát).
