# P-188 — Házipénztár Egyedi Név, Kézi/Auto Bizonylatszám, Gyors Pénztárkészítés és 65-ös ÁFA Rögzítés UX

> **Státusz:** ✅ Elfogadva (Decided)  
> **Dátum:** 2026-10-13  
> **Szerző:** Antigravity  
> **Érintett komponensek:** `src/components/petty-cash/EntriesTab.tsx`, `src/components/petty-cash/RegisterDialog.tsx`, `src/components/petty-cash/RegistersTab.tsx`, `src/components/petty-cash/types.ts`

---

## 1. Háttér és Felhasználói Igény

A felhasználó a Házipénztár modul kapcsán négy konkrét bővítési igényt fogalmazott meg:
1. **„lehessen egyedi nevet megadni”** — Alkalmi, egyszeri partnerek, magánszemélyek vagy alkalmazottak nevének szabad szöveges rögzítése a partner törzsben való kötelező felvétel nélkül (pl. Kis János, Alkalmi eladó, stb.).
2. **„kellene bele bizonylatszám”** — Perzisztált bizonylatszám tárolása az adatbázisban, kézi felülírási lehetőséggel vagy automatikus, szekvenciális sorszám-generálással (pl. `BPB-2026-00001`, `KPB-2026-00001`).
3. **„innen el kell lehessen érni az új pénztár létrehozását”** — Új házipénztár létrehozásának közvetlen elérése a Tételek (EntriesTab) eszköztárából, valamint a manuális rögzítés dialógusából a pénztár-választó mellől.
4. **„fel kell tudjak venni ÁFÁs tételt is, az összes bevallási sorral együtt”** — Készpénzes tételek ÁFA-s rögzítése valós idejű Nettó / ÁFA / Bruttó szinkronizált kalkulátorral, és a hivatalos magyar 65-ös ÁFA bevallás összes releváns bevallási sorának (66, 65, 64, 77, 63, 29, 67, 70, 68, 07, 05, 03, 45, 43, 01, 02, 91, 92) hozzárendelésével.

---

## 2. Felületi Élmény és Megoldás

### 2.1. Közvetlen Új Pénztár Létrehozás (Dual Access)
- **Tételek fül eszköztár:** A `[+ Új pénztár]` gomb közvetlenül a `[+ Manuális tétel]` mellett érhető el, így a felhasználónak nem kell átváltania a Pénztárak lapfülre új kassza létrehozásakor.
- **Manuális tétel modál:** A Pénztár kiválasztó mező felett egy `+ Új pénztár` gyorshivatkozás található. Létrehozás után az új pénztár automatikusan kiválasztásra kerül az űrlapon.

### 2.2. Bizonylatszám (Sorszám) Kezelés
- A manuális tétel dialógusban megjelent a **Bizonylatszám** mező.
- **Hibrid működés:**
  - Ha a felhasználó beír egy egyedi azonosítót (pl. `KPB-2026-00101` vagy saját iktatószámot), az perzisztálódik.
  - Ha a mezőt üresen hagyja, a rendszer a PostgreSQL `generate_next_cash_receipt_number` RPC segítségével automatikusan kiadja a következő szigorú számadású bizonylatszámot (Kiadás esetén `KPB-ÉÉÉÉ-XXXXX`, Bevétel esetén `BPB-ÉÉÉÉ-XXXXX`).
- A táblázat **Sorszám** oszlopában az adatbázisban tárolt valós szám jelenik meg kiemelt badge-ben.

### 2.3. Egyedi Név / Befizető / Átvevő Mező
- A meglévő Partner választó mellett megjelent a **Befizető neve (egyedi név)** / **Átvevő neve (egyedi név)** mező, melynek felirata dinamikusan igazodik a tétel irányához (Kiadás: Átvevő, Bevétel: Befizető).
- A táblázat **Leírás** oszlopában a leírás alatt külön kiemelve látható az átvevő / befizető neve.
- A keresőmező (`Search`) azonnal szűr a rögzített egyedi nevekre is.

### 2.4. ÁFA-s Tétel Rögzítése és 65-ös Bevallási Sorok
- **ÁFÁ-s tétel kapcsoló (`Switch`):** Bekapcsolásakor megnyílik a dedikált ÁFA blokk `65-ös ÁFA bevallás` jelvénnyel.
- **65-ös bevallási sor választó:**
  - **Kiadás esetén:** 66. sor (27% levonható), 65. sor (18%), 64. sor (5%), 77. sor (Tárgyi eszköz / Beruházás), 63. sor (TAM), 29. sor (Fordított adózás), 67. sor (Külföldi szolgáltatás), 70. sor (Közösségi termék), 68. sor (Közösségi tárgyi eszköz), valamint Egyedi sorszám megadása.
  - **Bevétel esetén:** 07. sor (27% értékesítés), 05. sor (18%), 03. sor (5%), 45. sor (Kapott előleg), 43. sor (Tárgyi eszköz értékesítés), 01. sor (AAM), 02. sor (TAM), 91. sor (Export/ATHK), 92. sor (EU szolgáltatás), valamint Egyedi sor.
- **Kétirányú kalkuláció:** Bármelyik érték módosításakor (Nettó, ÁFA összeg, Bruttó végösszeg, ÁFA kulcs) a többi mező automatikusan és kerekítés-biztosan újraszámolódik.
- **Táblázat megjelenítés:** ÁFA-s tételeknél a leírás mellett megjelenik a narancs ÁFA badge (pl. `ÁFA: +5400 HUF (66. sor)`), az összeg oszlopban pedig a bruttó összeg alatt látható a `Nettó: ... | ÁFA: ...` analitikai bontás.

---

## 3. Minőségi és Regresszióvédelmi Garanciák
- **Oxlint:** 0 hiba, 0 figyelmeztetés.
- **TypeScript:** `npx tsc --noEmit` 0 típushiba.
- **Vitest:** 16/16 zöld teszt (`pettyCashManualVatEntry.test.ts`, `vatRegressionTaxology.test.ts`).
