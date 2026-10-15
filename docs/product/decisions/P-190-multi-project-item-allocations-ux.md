# P-190: Számlatételek Többes Projekt-Költségmegosztása, Lebegő Műveleti Sáv és Zero-Jitter Kiválasztás UX

**Status:** Decided  
**Category:** UI / Workflow / Invoices / Projects  
**Date:** 2026-10-15  
**Kapcsolódó döntések:** [074 (BRD)](../../business/decisions/074-multi-project-item-allocations-and-cost-split.md), [A-260 (ADR)](../../architecture/decisions/A-260-multi-project-item-allocations-and-financial-split.md), [P-015 (Bulk Actions)](./P-015-bulk-actions.md)

---

## Question
Hogyan jelenjen meg és hogyan szerkeszthető a számlatételek többes projekt-költségmegosztása a számlatételek ablakban, a számlatáblázat soraiban, valamint a csoportos kijelölés lebegő műveleti sávján (`FloatingBulkBar`) anélkül, hogy a felület villódzna, felesleges aktivációs gyűrűket rajzolna ki, vagy beragadt állapotokat hagyna maga után?

---

## Decision

### 1. Kompakt Táblázat Cella az `InvoiceItemsDialog`-ban
* **Egyedi projekt vagy örökölt állapot:**
  * Gyors `Select` legördülő menü (1 kattintással választható projekt vagy örökölt `-`).
  * Mellette egy diszkrét százalék (`%`) funkciógomb, amely közvetlenül felnyitja a megosztás-kezelő Popovert.
* **Többes allokáció állapota (>1 projekt):**
  * A cellában egy zöld kiemelésű gomb jelenik meg: `[ % ] X projekt (100%)` a projektek számát mutató számláló badge-dzsel.
  * Erre kattintva a megosztás-kezelő Popover közvetlenül megnyílik a meglévő százalékokkal kitöltve.

### 2. Megosztás-kezelő Popover (`ItemProjectAllocationPopover`)
1. **Dinamikus projektsorok:** Projektválasztó + `%` beviteli mező + törlés gomb. A kiválasztott projektek automatikusan kiszűrésre kerülnek a többi sor választójából.
2. **Gyorsműveletek:**
   * **„+ Hozzáadás”**: Új sor a még elérhető projektekből.
   * **„Egyenlő” (Mérleg ikon)**: Egyenlő arányban elosztja a 100%-ot a kiválasztott projektek között (pl. 50-50%, 33.34% / 33.33% / 33.33%).
   * **„Maradék” (Varázspálca ikon)**: Az utolsó projekt százalékát a 100%-hoz hiányzó összegre kerekíti.
3. **Valós idejű Validációs Csík:**
   * **Összeg = 100%:** Zöld visszajelzés (`CheckCircle2`), a mentés engedélyezett.
   * **Összeg ≠ 100%:** Sárga/piros figyelmeztetés hiányzó vagy túllépő százalékkal; a mentés szigorúan letiltva.
4. **Visszaállítás (Örökölt):** Az „Örökölt” gomb azonnal törli az egyedi felosztást, visszaállítva a tételt a számla projektjére.

### 3. Számlasor Megjelenítés a Számlatáblázatban (`NavInvoiceRow`)
* Amennyiben egy számla tételei több projektre lettek felosztva, a számlasor Projekt oszlopában egy interaktív zöld `% X projekt [count]` badge jelenik meg.
* A számla így nem tűnik hozzárendelés nélkülinek a táblázatban, és a felhasználó azonnal látja a tételek megosztottságát.

### 4. Csoportos Lebegő Műveleti Sáv (`InvoiceBulkActionsBar`)
* **Projekt dropdown és Megosztás gomb:**
  * A lebegő sáv Projekt mezője mellett megjelenik a `% Megosztás (%)` vagy `% X projekt (100%)` gomb.
  * A megosztás gombra kattintva felugrik az `ItemProjectAllocationPopover`, amellyel az összes kijelölt számla egyszerre osztható fel több projekt között.
* **Többprojekt prioritás:** Ha a kijelölt számlák közül bármelyik már rendelkezik többes megosztással, a sáv automatikusan ezt az elosztást örökli meg és jeleníti meg prefillként.
* **Zero-Jitter és villódzásvédelem:** A TanStack Query memóriagyorsítótárnak és a `placeholderData` folytonosságnak köszönhetően új sor kijelölésekor a sáv nem ugrik vissza egyetlen pillanatra sem az üres állapotra.
* **Azonnali Uncheck szinkronizáció:** Amint a projekttel rendelkező számla uncheckelésre kerül, a lebegő sáv azonnal, beragadt állapotok nélkül visszavált a kiinduló állapotra.
* **Zero-Focus-Ring:** A lebegő sáv akciógombjain szigorúan el van nyomva a böngésző alapértelmezett kék/fehér fókuszkerete (`[outline:none!important]`, `[box-shadow:none!important]`), letisztult és prémium megjelenést biztosítva.

### 5. Projektek Modul Pénzügyi Számítás
* A `/projects` oldalon a tételek megnevezése mellett megjelenik az arány (pl. `Irodabútor beszerzés (60%)`), és a projekt költségvetése arányosítva terhelődik.

---

## Rationale
A pénzügyi adminisztrációban a projektek költségmegosztása mindennapos igény. A felület azonnali vizuális visszajelzést ad a hibákról (százalékos eltérés), meggátolja a téves mentéseket, miközben a tömeges műveletek során is zavartalan, villódzásmentes felhasználói élményt garantál.
