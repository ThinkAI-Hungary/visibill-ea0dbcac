# P-195: Készpénzes Számlák Házipénztár Kiválasztása és Gyors Szabálymentés

**Dátum:** 2026-10-15  
**Státusz:** ✅ Elfogadva  
**Kontextus:** VisiBill Számlák (`/invoices`), Házipénztár élmény  
**Kapcsolódó döntések:** [P-092](./P-092-petty-cash-manual-entry-validation-and-settlement-ux.md), [P-109](./P-109-invoice-item-rules-and-quick-save-ux.md), [P-183](./P-183-petty-cash-invoice-attachment-and-unlink-ux.md), [A-263](../../architecture/decisions/A-263-cash-invoices-gl381-and-petty-cash-routing.md)

---

## 1. Felhasználói Igény és Célkitűzés
1. **Készpénzes kimenő számlák alapértelmezett 381-es kontírozása:** A kimenő készpénzes számlák ellenoldala alapértelmezetten a 381-es pénztár számlára kerüljön, de szükség esetén manuálisan módosítható maradjon (pl. 311-re vagy más vevői számlára).
2. **Pénztár kiválasztása készpénzes számlákhoz:** Készpénzes (kimenő és bejövő) számlák esetén mind a kinyitott nézetben (`ExpandedInvoiceRow`), mind a tételes nézetben (`InvoiceItemsDialog`) meg lehessen adni, hogy a számla melyik pénztárba menjen.
3. **Azonnali szabály létrehozás felajánlása:** Amint a felhasználó betesz egy készpénzes számlát egy pénztárba, a felület azonnal kínálja fel az automatikus szabály létrehozását az adott partnerre (ugyanúgy, mint az egyéb számlatétel kontírozási szabályoknál).

---

## 2. Felhasználói Élmény és UI Viselkedés

### 2.1 Pénztár választó a számla nézetekben
- **Kondicionális megjelenés:** Kizárólag akkor jelenik meg a borostyán színű (`amber-500`) "Házipénztár" kártya, ha a számla fizetési módja készpénzes (`isCashInvoice = true`).
- **Nézetek:**
  - **Kinyitott számlasor (`ExpandedInvoiceRow`):** A fejléc jobb oldalán található műveleti gombok és státuszok mellett kap helyet egy dedikált kis kártyán.
  - **Tételes dialógus (`InvoiceItemsDialog`):** A fejlécben a "Vevői / Szállítói & ÁFA kontír" kártya mellett helyezkedik el.
- **Pénztár választó Select:**
  - Kilistázza a cég összes aktív pénztárát.
  - Az alapértelmezett pénztár mellett kis zöld "(Alapértelmezett)" jelzés látható.
  - Tartalmaz egy "Nincs pénztár rendelve" leválasztási opciót is a kapcsolat gyors törléséhez.

### 2.2 Gyors Szabálymentő Dialógus (`PettyCashRuleQuickSaveDialog`)
- **Aktiválódás:** Amint a felhasználó sikeresen kiválaszt egy pénztárat a számlához, a sikeres hozzárendelést követően azonnal megnyílik a szabálymentő felugró ablak.
- **Tartalom:**
  - Partner neve szerkeszthető beviteli mezőben (előre kitöltve a számla partnerének nevével).
  - Célpénztár neve (nem szerkeszthető, megerősítő információs dobozban).
  - Szabály hatóköre: egyértelmű tájékoztató doboz arról, hogy a partner minden új és meglévő, még be nem sorolt készpénzes számlája erre a pénztárra fog mutatni.
  - "Mégse" és "Szabály mentése" akciógombok.
- **Visszajelzés:** Mentéskor borostyán/zöld színű toast értesítés jelenik meg, és a rendszer a jövőbeli számlák beolvasásakor ezt a szabályt automatikusan alkalmazza.

---

## 3. Minőségbiztosítás és Eredmények
- **Automatizált tesztek:** Vitest egységtesztek igazolják a 381-es alapértelmezést, a komponens renderelést és az RPC hívásokat (`src/test/cashInvoicesAndPettyCashRouting.test.tsx`).
- **Nincs felesleges zavarás:** A nem készpénzes (pl. átutalásos vagy bankkártyás) számláknál a pénztár kártya rejtve marad, megőrizve a felület tisztaságát.
