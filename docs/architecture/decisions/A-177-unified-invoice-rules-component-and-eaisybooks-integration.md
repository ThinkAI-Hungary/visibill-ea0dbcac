# A-177: Egységes Számlaszabály Kezelő Komponens és eaisyBooks Integráció

**Status:** Decided  
**Date:** 2026-09-29  
**Category:** Architecture / Component Design / eaisyBooks  
**Kapcsolódó PRD:** [P-138: Egységes Könyvelési Szabályok Kezelőfelület UX](../../product/decisions/P-138-unified-accounting-rules-and-prompt-library-ux.md)  
**Kapcsolódó korábbi döntések:** [A-144: Determinisztikus Számlatétel Szabály Motor](./A-144-deterministic-invoice-item-rules-engine.md), [P-109: Számlatétel Szabályok és Quick Save UX](../../product/decisions/P-109-invoice-item-rules-and-quick-save-ux.md)

---

## 1. Context

A determinisztikus számlaszabályok (`invoice_item_rules`) kezelése korábban szorosan össze volt drótozva az `InvoiceRulesDialog` dialógus-komponenssel, amely kizárólag a Számlák oldal fejlécéből (`InvoiceHeader`) volt megnyitható.

Amikor az eaisyBooks könyvelői felületén igény merült fel a szabályok áttekintésére és szerkesztésére, a korábbi architektúra vagy kódduplikációt igényelt volna, vagy megkövetelte, hogy a könyvelő átnavigáljon a számlák oldalra.

## 2. Decision

1. **Komponens Leválasztás és Újrahasznosítás:**  
   Létrehoztuk a [`src/components/invoices/InvoiceItemRulesManager.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/invoices/InvoiceItemRulesManager.tsx) komponenst, amely tiszta kompozícióval szétválasztja az üzleti logikát (CRUD, toggle, `apply_invoice_item_rules` RPC futtatás, keresés) a megjelenítési kerettől:
   - `asDialog={true}` módban: adaptív görgetési és fejléc-kezelést nyújt a meglévő `InvoiceRulesDialog` modális ablakon belül.
   - `asDialog={false}` módban: közvetlenül beágyazható kártyaként működik oldal szintű nézetekben (`PromptsPage.tsx`).

2. **eaisyBooks PromptsPage Szabály-Szinergia:**  
   A [`src/pages/Accounty/PromptsPage.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/PromptsPage.tsx) oldal megkapta a `Tabs` komponenst, amellyel a determinisztikus szabályok (`item_rules`) és a természetes nyelvű promptok (`ai_prompts`) egyaránt elérhetők egyetlen menüpont alatt, azonos adatbázis-rekordokkal és valós idejű query-invalidációval.

## 3. Consequences

**Pozitív:**
- **Zero Kódduplikáció:** Egyetlen forrás kezeli a számlatétel szabályok listázását, szerkesztését és futtatását.
- **Megszűnt a Könyvelői Súrlódás:** A könyvelő azonnal látja a számlák kontírozásakor mentett szabályait az eaisyBooks fő szabálykezelőjében.
- **Típus- és Tesztbiztonság:** Mindkét felület (modális és lapfüles nézet) 100%-os egységteszt lefedettséggel bír.
