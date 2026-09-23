# P-109: Determinisztikus Számlatétel Szabály Motor és 1-Kattintásos Kontírozási Gyorsmentő (Quick Save) UX

**Státusz:** ✅ Decided  
**Dátum:** 2026-09-24  
**Kapcsolódó Hibajegy:** EB-0178 (Kiss-Százi Emese / Ván Iroda Kft. / Sümegi és Társa Kft.)  
**Kapcsolódó Architektúra Döntés:** [A-144: Determinisztikus Számlatétel Szabály Motor](../../architecture/decisions/A-144-deterministic-invoice-item-rules-engine.md)  
**Érintett Komponensek:**
- [`InvoiceRuleQuickSaveDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx)
- [`InvoiceRulesDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRulesDialog.tsx)
- [`InvoiceItemsDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx)
- [`InvoiceHeader.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/header/InvoiceHeader.tsx)
- [`20260924120000_create_invoice_item_rules.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260924120000_create_invoice_item_rules.sql)

---

## 1. Problémafelvetés & Üzleti Kontextus

A Visibill Bank / Tranzakciók moduljában a könyvelők nagyra értékelték az automatikus 1-kattintásos gyors szabálymentést (`TransactionRuleQuickSaveDialog`): amikor egy banki tételnél főkönyvi számot rögzítettek, a felugró ablakból azonnal elmenthették a szövegmintát determinisztikus könyvelési szabályként.

Ezzel szemben a Számlák tételes kontírozó ablakában (`InvoiceItemsDialog`) kézi főkönyvi szám felülbírálás után a rendszer nem ajánlott fel szabálymentést. Bár az eaisyBooks modulban elérhető volt az AI Prompt szabálytár (`company_prompt_rules`), az külön menüpontban (`/prompts`) helyezkedett el, és nem nyújtott azonnali, felugró élményt a számla kontírozásának pillanatában.

Az **EB-0178** jegyben az ügyfél (Kiss-Százi Emese) kérte:
> *„A számlák kontírozásánál észre vettem, hogy itt nem ajánl fel könyvelési szabály létrehozását. Nagyon jó lenne ha a banknál beállított funkciót ide is át tudnátok ültetni. A javaslatom az, hogy a tétel megnevezése legyen a mérvadó a szabálynál és ahhoz rendeljen hozzá főkönyvi számot és esetleg áfa kódot, ha ez megoldható.”*

---

## 2. Felületi Döntések & UX Specifikáció

### 2.1 1-Kattintásos Gyors Szabálymentő Modal (`InvoiceRuleQuickSaveDialog`)
1. **Automatikus trigger:** Az `InvoiceItemsDialog`-ban mind a főkönyvi szám felülbírálás (`handleSaveGlOverride`), mind az áfakód felülbírálás (`handleSaveVatCodeOverride`) sikeres elmentése után azonnal megjelenik az `InvoiceRuleQuickSaveDialog`.
2. **Intelligens mintatisztítás:** A dialógus automatikusan levágja a számlatétel megnevezéséből (`line_description`) a zajt (mennyiségi egységek pl. `1 db`, `óra`, `hó`, cikkszámok, vezető sorszámok), és beállítja mintaként.
3. **Cél főkönyvi szám és áfakód megjelenítés:**
   - Kiemelt vizuális kártyákon jelenik meg a kiválasztott főkönyvi szám és a cél áfakód.
   - Ha a tételhez áfakód is tartozik, egy kétállású kapcsolóval (`Switch`) a felhasználó kérheti az áfakód rögzítését is a szabályban.
4. **Partner-szűrési opció:** Ha a számla partneradatai ismertek, egy jelölőnégyzettel kérhető, hogy a szabály *„Csak ennél a partnernél érvényesüljön”* (adószámos szűrés).
5. **Hatókör (Scope):**
   - **Csak ez a cég (`company`):** A szabály csak az aktuálisan kiválasztott ügyfélcég számláira vonatkozik.
   - **Könyvelőirodai sablon (`tenant`):** A szabály a könyvelő összes általa kezelt ügyfélcégénél érvényesül a jövőbeli számlákra.
6. **Azonnali visszamenőleges alkalmazás:** A mentés alapértelmezetten ráfuttatja a szabályt az aktuális időszak még besorolatlan számlatételeire (`apply_invoice_item_rules` RPC), és visszajelzi, hány meglévő tétel kapott azonnal kontírozást.

### 2.2 Számlák Fejléc "Könyvelési szabályok" Menüpont (`InvoiceRulesDialog`)
1. **Elhelyezkedés:** Az `InvoiceHeader.tsx` eszköztárában, a *"Feltöltött fájlok"* gomb mellett egy új *"Könyvelési szabályok"* gomb (`Sliders` ikonnal) került elhelyezésre.
2. **Kezelőkonzol képességek:**
   - Céges és irodai szintű számlaszabályok listázása és keresése (név, minta, GL szám, partner szerint).
   - Szabályok azonnali ki/be kapcsolása (`Switch`).
   - Szabályok szerkesztése és törlése.
   - Új szabály felvétele manuálisan.
   - **„Szabályok futtatása”** akciógomb: egy kattintással ráfuttatja a cég összes aktív szabályát a meglévő besorolatlan számlákra.

---

## 3. Minőségbiztosítás és Eredmények

- **Build verifikáció:** Sikeres produkciós csomagolás (`npm run build`, exit code: 0).
- **TypeScript típusbiztonság:** 0 fordítási és típus-hiba (`npx tsc --noEmit`).
- **Determinisztikus 0 token költség:** A determinisztikus számlaszabályok azonnal, külső LLM hívás nélkül futnak le a PostgreSQL adatbázis motorban.
