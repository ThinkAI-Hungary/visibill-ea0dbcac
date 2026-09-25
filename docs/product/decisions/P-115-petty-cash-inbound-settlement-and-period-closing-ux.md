# P-115: Házipénztár Bejövő/Szállítói Számlák Kiegyenlítése és Időszaki Zárás Egyenleg UX

**Status:** Decided  
**Date:** 2026-09-24  
**Utoljára frissítve:** 2026-09-25  
**Kategória:** UI / Házipénztár & Számlakezelés  
**Érintett modulok:** `src/components/petty-cash/CashClosingDialog.tsx`, `src/components/petty-cash/EntriesTab.tsx`, `src/pages/PettyCashPage.tsx`  
**Kapcsolódó ADR:** [A-155](../../architecture/decisions/A-155-petty-cash-inbound-settlement-and-period-closing.md)  

---

## 1. Kérdés és Felhasználói Igény
Hogyan tehető átláthatóvá és egyértelművé a könyvelő számára, hogy a házipénztárban vevői (pénztári bevétel, növekmény) vagy szállítói (pénztári kiadás, csökkenés) számlát egyenlít ki készpénzben, és hogyan biztosítható a pontos időszaki záróegyenleg ellenőrzése?

---

## 2. Termékdöntés és Megoldás

### 1. Kézi Tétel Rögzítése Dialógus — Háromállású Számlaszűrő
A bizonylatrögzítő ablakban a számlák kiválasztásához egy új, szegmentált szűrősáv került beépítésre:
- **`[ Összes (X) | Vevői (Y) | Szállítói (Z) ]`**
  - **Vevői (+):** Zöld keretes `Vevői (+)` badge, a kiválasztott összeg zöld pozitív előjellel (`+X HUF`) jelenik meg.
  - **Szállítói (-):** Piros keretes `Szállítói (-)` badge, a kiválasztott összeg piros negatív előjellel (`-X HUF`) jelenik meg.
- **Dinamikus Nettó Összesítő Sáv:**
  - Kijelöléskor a rendszer valós időben kalkulálja a nettó pénztári hatást:  
    $$\Sigma \text{ Nettó} = \sum \text{Vevői} - \sum \text{Szállítói}$$
  - A felület egyértelmű szöveges tájékoztatást ad: `Σ +120 000 HUF (Pénztári bevétel)` vagy `Σ -45 000 HUF (Pénztári kiadás)`.

### 2. Időszaki Pénztárzárás Dialógus (`CashClosingDialog`)
- **Ötös Mutatószám Elrendezés Devizánként:**
  A zárási párbeszédablak kártyáin a könyvelő azonnal áttekintheti az időszak teljes pénzforgalmi dinamikáját:
  1. *Nyitó egyenleg* (korábbi időszakok kumulált zárója)
  2. *Időszaki bevétel (+)* (zöld növekvő ikon)
  3. *Időszaki kiadás (-)* (piros csökkenő ikon)
  4. *Időszaki forgalom* (a bevétel és kiadás szaldója)
  5. *Záró egyenleg* (kiemelt vastag betűs végösszeg)
- **Negatív Kassza Riasztás:**
  Ha a záróegyenleg 0 alá csökken, a kártya piros figyelmeztető hátteret kap, jelezve a lehetséges adminisztratív vagy kifizetési hiányt.

### 3. Nyomtatási és PDF Export Integritás
- A kinyomtatott vagy PDF-be exportált hivatalos pénztárjelentés fejléce a tételes bizonylatlista előtt egy dedikált összesítő táblázatot tartalmaz a nyitó, bevételezett, kiadott, forgalmi és záró egyenlegekkel, kielégítve a hatósági ellenőrzési követelményeket.

---

## 3. Kapcsolódó
- [A-155: Házipénztár Bejövő/Szállítói Számlák Kiegyenlítése és Időszaki Zárás Egyenleg Számítási Modell](../../architecture/decisions/A-155-petty-cash-inbound-settlement-and-period-closing.md)
- [P-092: Házipénztár Bizonylat Validáció és Számlakiegyenlítés UX](./P-092-petty-cash-manual-entry-validation-and-settlement-ux.md)
- [P-046: Pénztárbizonylatok Feltöltési Fül UX](./P-046-penztarbizonylat-upload-ux.md)
