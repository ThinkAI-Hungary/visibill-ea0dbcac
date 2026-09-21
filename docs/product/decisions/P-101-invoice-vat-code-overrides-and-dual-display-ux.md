# P-101: Számlatételek Áfakód Szerkesztése, Kettős Áfakód Megjelenítés és Tömeges Módosítás UX

> **Státusz:** Decided  
> **Dátum:** 2026-09-21  
> **Kategória:** UI / UX / Accounting Controls  
> **Érintett komponensek:** `InvoiceItemsDialog.tsx`, `VatCodeConfigTab.tsx`, `VatCollectorAnalyticsView.tsx`, `vatCodeMatching.ts`  
> **Kapcsolódó:** [ADR A-135](../../architecture/decisions/A-135-dual-vat-code-system-and-reverse-charge-recognition.md), [ADR A-136](../../architecture/decisions/A-136-invoice-vat-code-overrides-and-machine-learning.md), [BRD 061](../../business/decisions/061-invoice-vat-code-overrides-and-machine-learning.md)  

---

## Question (Kérdés)

Hogyan tehető a számlatételek ÁFA gyűjtőkódja közvetlenül és tömegesen szerkeszthetővé a könyvelők számára a felületen úgy, hogy a rendszer támogassa mind a konvencionális könyvelési kódokat (pl. 25, 05, FAD), mind a hivatalos NAV 2665 kódokat (pl. BE_27_LEV, BE_5_LEV), megjelenítse a gépi tanulási forrást, és elkerülje a modális dialógusok layout szétcsúszását?

---

## Decision (Döntés)

A könyvelői visszajelzések és a hatékonysági elvárások alapján az alábbi integrált felületi élményt valósítottuk meg:

### 1. Kettős Áfakód Megjelenítési Mód (Dual Display Mode)
- **Beállítás:** A Cégbeállítások ÁFA fülén (`VatCodeConfigTab.tsx`) a könyvelő kiválaszthatja a megjelenítési preferenciát:
  - **Konvencionális könyvelői kódok (`legacy`):** A szakmában megszokott 2-3 betűs/számos jelölések (`25`, `18`, `05`, `FAD`, `EXP`, `TAM`, `EU`, `ATHK`).
  - **Hivatalos NAV 2665 kódok (`nav`):** A hivatalos adóbevallási gyűjtőkódok (`BE_27_LEV`, `BE_5_LEV`, `KIM_27`, `BE_FORD_27`).
- **Reaktivitás:** A kiválasztott mód azonnal és egységesen érvényesül a számlatételeknél (`InvoiceItemsDialog`), a számlasorokban és az analitikai nézetekben.

### 2. Egyedi és Tömeges Áfakód Szerkesztés (`InvoiceItemsDialog`)
- **Egyedi cella szerkesztés:**
  - A tételek táblázatában az ÁFA kód oszlopban kattintásra interaktív popover nyílik meg.
  - A popoverben kereshető és szűrhető módon kiválasztható a kívánt ÁFA gyűjtőkód.
  - A mentés azonnal meghívja az `override_vat_code_batch` RPC-t, amely frissíti a tételt, naplóz a `vat_code_overrides_log` táblába, és bejegyzi a gépi tanulási szabályt.
- **Tömeges (Batch) szerkesztés:**
  - A tételek kijelölhetők egyenként vagy a fejlécben található „Összes kijelölése” checkbox-szal.
  - Kijelölés esetén a táblázat felett megjelenik a lebegő műveleti sáv: `„X tétel kijelölve | ÁFA kód módosítása”`.
  - Egyetlen kattintással és megerősítéssel az összes kijelölt tétel áfakódja egyszerre átkódolható.

### 3. Vizuális Intelligencia Jelzők (Badge & Tooltip)
- Az áfakód jelvények vizuálisan megkülönböztetik az adatforrást:
  - 🟣 **Lila / Sparkles ikon:** Kézi felülírás vagy megtanult szabály (`manual_override`, `partner_learned`, `company_learned`).
  - 🔵 **Kék / Normál:** Törvényi alapértelmezett kód (`legacy_default`).
- **Tooltip átláthatóság:** Az egérmutató rávitelekor megjelenik a kód teljes megnevezése, a partner adószáma és a tanulási összefüggés (pl. *"Kézzel felülbírált áfakód"* vagy *"Partner alapján megtanult áfakód"*).

### 4. Layout és Modal Méretigazítás
- A beállítások modál jobb széle korábban lelóghatott kisebb képernyőkön vagy keskenyebb viewport esetén.
- A fix pixel alapú szélességek helyett rugalmas, reszponzív maximális szélességet (`max-w-4xl`, `w-[95vw] sm:w-full`) és belső görgetést vezettünk be, garantálva, hogy a gombok és táblázatfejlécek soha ne essenek ki a látható tartományból.

---

## Rationale (Indoklás)
A könyvelők különböző szoftverekből érkeznek: sokan a megszokott „25, 05, FAD” kódokat keresik, mások a NAV 2665 struktúrát követik. A kettős nézet mindkét könyvelői szokást kompromisszum nélkül kiszolgálja. A tömeges szerkesztés és a gépi tanulás pedig megszünteti a több tucat tételes számlák manuális egyenkénti kódolásának unalmas és hibaveszélyes terhét.

---

## Kapcsolódó
- **ADR**: [A-135: Kettős Áfa Kódrendszer és F.AFA Fordított Adózási Felismerés](../../architecture/decisions/A-135-dual-vat-code-system-and-reverse-charge-recognition.md)
- **ADR**: [A-136: Számlatételek Áfakód Szerkeszthetősége és Gépi Tanulási (Machine Learning) Memória](../../architecture/decisions/A-136-invoice-vat-code-overrides-and-machine-learning.md)
- **BRD**: [Decision 061: Számlatétel Áfakód Felülbírálat és Gépi Tanulási (ML) Szabályrendszer](../../business/decisions/061-invoice-vat-code-overrides-and-machine-learning.md)
