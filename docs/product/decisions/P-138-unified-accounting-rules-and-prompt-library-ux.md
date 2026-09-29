# P-138: Egységes Könyvelési Szabályok Kezelőfelület (Számlatétel Szabályok & AI Prompt Könyvtár) UX

**Státusz:** ✅ Decided  
**Dátum:** 2026-09-29  
**Kategória:** UX / eaisyBooks / Számlakontírozási Szabályok  
**Kapcsolódó Hibajegy:** Surányi Pál (TS Consult Kft.) bejelentése  
**Kapcsolódó ADR:** [A-177: Egységes Számlaszabály Kezelő Komponens és eaisyBooks Integráció](../../architecture/decisions/A-177-unified-invoice-rules-component-and-eaisybooks-integration.md)  
**Kapcsolódó korábbi döntések:** [P-109: Determinisztikus Számlatétel Szabály Motor és Quick Save UX](./P-109-invoice-item-rules-and-quick-save-ux.md), [A-144: Determinisztikus Számlatétel Szabály Motor](../../architecture/decisions/A-144-deterministic-invoice-item-rules-engine.md)

---

## 1. Döntési Kontextus és Problémafelvetés

A számlatételek kontírozása során a felhasználók nagyra értékelik a felugró gyorsmentő modált (`InvoiceRuleQuickSaveDialog`), amellyel a tétel megnevezéséből azonnal determinisztikus számlaszabály menthető.

Ugyanakkor az **eaisyBooks** menürendszerében a **„Könyvelési Szabályok”** (`/eaisybooks/:companyId/:dateRange/prompts`) menüpont kizárólag a természetes nyelvű AI Prompt Könyvtárat (`company_prompt_rules`) jelenítette meg. 

### A felhasználói súrlódás:
1. Amikor a könyvelő a számláknál létrehozott egy szabályt, azt természetes módon az eaisyBooks „Könyvelési Szabályok” menüjében kereste.
2. Mivel ott nem találta meg a számlaszabályokat (csak a céges AI promptokat látta), elbizonytalanodott, hogy a szabály elmentődött-e, ami többszöri mentéshez, felesleges duplikációkhoz és support jegyekhez vezetett.
3. A determinisztikus számlaszabályok kezelője korábban csak a Számlák menü jobb felső eszköztárában lévő kis gombból (`InvoiceRulesDialog`) volt elérhető, elszigetelve a könyvelői szabálykezeléstől.

---

## 2. A Döntés és Felületi Specifikáció

### 2.1 Kétlapfüles (Dual-Tab) Egységesített Szabálykezelő (`PromptsPage.tsx`)
Az eaisyBooks **„Könyvelési Szabályok”** menüpontja két különálló, egyértelmű lapfülre (Radix UI Tabs) bontja a szabályrendszert:

1. **Számlatétel szabályok (Alapértelmezett, `item_rules`):**
   - Vizuális számláló badge a cég aktív számlaszabályainak darabszámával (pl. `2 szabály`).
   - Megjeleníti az összes determinisztikus számlaszabályt (`InvoiceItemRulesManager`).
   - Keresőmező, ki/bekapcsolás (`Switch`), szerkesztés, törlés, új szabály manuális felvétele, valamint a **„Szabályok futtatása”** kötegelt ráfuttató gomb a még besorolatlan tételekre.
2. **AI Prompt könyvtár (`ai_prompts`):**
   - Vizuális számláló badge az aktív AI promptok darabszámával (pl. `1 szabály`).
   - Természetes nyelvű AI könyvelési instrukciók (pl. Benzin levonhatóság) és a jobb oldali gyorssablon-katalógus.

### 2.2 Reagáló Fejléc és Kontextus
- Fejléc cím: **Könyvelési Szabályok** (`Sliders` ikonnal).
- Leíró szöveg: *„Kezeld a számlatételek automatikus szövegminta-szabályait és az egyedi AI prompt instrukciókat. (Cégnév)”*.
- Az AI Prompt lapfülön automatikusan megjelenik a fejléc jobb oldalán az „+ Új szabály hozzáadása” gomb a felugró AI prompt felvevő dialógussal.

### 2.3 URL Szinkronizáció
- Támogatott URL minták: `.../prompts` (alapértelmezetten a számlatétel szabályok nyílnak meg) és `.../prompts?tab=ai_prompts` (közvetlen hivatkozás az AI prompt könyvtárra).

---

## 3. Érintett Komponensek és Fájlok

- [`src/components/invoices/InvoiceItemRulesManager.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/invoices/InvoiceItemRulesManager.tsx) — Új önálló, újrahasznosítható számlaszabály-kezelő (dialog és inline tab támogatással).
- [`src/components/invoices/InvoiceRulesDialog.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/invoices/InvoiceRulesDialog.tsx) — Delegáció az új komponensre, megtartva a számlák oldali dialógust.
- [`src/pages/Accounty/PromptsPage.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/PromptsPage.tsx) — Kétlapfüles egységes szabálykezelő nézet.
- [`src/locales/hu/accounty.json`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/locales/hu/accounty.json), [`src/locales/hr/accounty.json`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/locales/hr/accounty.json) — Többnyelvű lokalizációs kulcsok.
- [`src/pages/Accounty/__tests__/PromptsPage.test.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/__tests__/PromptsPage.test.tsx) — Automatizált egységtesztek.
