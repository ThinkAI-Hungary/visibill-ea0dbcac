# P-104: Tranzakció jutalék és számlaszám exportálása

**Státusz:** Elfogadva  
**Dátum:** 2026-09-22  
**Érintett modulok:** Tranzakciók (`TransactionsPage`), Tranzakció táblázat (`TransactionTable`), Export modul (`useTransactionData`)  

---

## 1. Kontextus és Üzleti Igény
Ügyfél megkeresés (Kollár Kristóf, Victoria Music Kft.):
A SimplePay bankkártyás elszámolások feldolgozásánál a könyvelők felé havonta át kell adni az elszámolt tranzakciók listáját. A könyvelés számára nélkülözhetetlen:
1. A tranzakcióhoz tartozó kártyás jutalék / banki költség (`Tranzakciós jutalék` / `fee_amount`), amely közvetlen költségként könyvelendő.
2. A tranzakcióhoz heurisztikusan vagy mesterséges intelligenciával párosított kiállított számla számlaszáma (`bizonylatsorszam` / `invoice_number`), hogy a vevői követelések könyvelése tételesen összerendelhető legyen.

Korábban az exportban (`.csv` és `.xlsx`) csak az alapadatok (dátum, leírás, összeg, deviza, típus, státusz, indoklás) szerepeltek, a kapcsolódó számla száma és a jutalék nem volt elérhető, így a felhasználóknak kézzel kellett összefésülniük a listát.

---

## 2. Termékdöntés
1. **Tranzakciós Export Kiegészítése:**
   - Az exportálandó oszlopok köre bővült: `['Dátum', 'Leírás', 'Összeg', 'Pénznem', 'Díj / Jutalék', 'Kapcsolódó számla', 'Típus', 'Státusz', 'Pontszám', 'Indoklás']`.
   - Amennyiben a tranzakcióhoz tartozik jutalék, a `Díj / Jutalék` oszlopban numerikus értékként jelenik meg.
   - Amennyiben a tranzakció párosítva van számlához, a `Kapcsolódó számla` mező tartalmazza a hivatalos számlaszámot.
2. **UI Megjelenítés a Tranzakciók Táblázatában:**
   - A tranzakciók listájában az összeg alatt finom, másodlagos tipográfiával megjelenik a jutalék mértéke: `díj: -X Ft`.
   - Ez biztosítja, hogy a felhasználó és a könyvelő azonnal lássa a tranzakció nettó elszámolását külön exportálás nélkül is.
