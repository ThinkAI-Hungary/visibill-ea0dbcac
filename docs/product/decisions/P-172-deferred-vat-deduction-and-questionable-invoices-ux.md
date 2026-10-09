# P-172: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák UX

**Status:** Decided  
**Date:** 2026-10-09  
**Category:** UI / Workflow / Invoices & Dashboard  
**Kapcsolódó döntések:** [BDR-065](../../business/decisions/065-deferred-vat-deduction-and-questionable-invoices.md) · [A-234](../../architecture/decisions/A-234-deferred-vat-deduction-and-questionable-invoices-architecture.md) · [P-089](./P-089-invoice-exclude-from-accounting-optimistic-toggle-ux.md)

---

## 🎯 Question
Hogyan biztosítsuk a vállalkozás és a könyvelő számára az ÁFA levonás törvényes halasztásának (Áfa tv. 153/A. §) egyszerű rögzítését a számlalistában, a kérdéses számlák szem előtt tartását a vezérlőpulton a 2 éves jogvesztő határidő visszaszámlálásával, valamint az ÁFA bevallás készítésekor a proaktív beemelési lehetőséget?

---

## 💡 Decision

### 1. Kétpólusú Kizárási Választó Modál (`ExclusionReasonDialog.tsx`)
A számlák táblázatban a „Kizárás a könyvelésből” művelet kiválasztásakor a rendszer nem hajt végre azonnali, vak törlést, hanem egy egyértelmű döntési modált jelenít meg:
- **Opció 1 (Alapértelmezett és Ajánlott):** *„Későbbre halasztom a számla elszámolását és az ÁFA levonását (Kérdéses számla)”*
  - Tájékoztatja a felhasználót az Áfa tv. szerinti 2 éves elszámolhatósági keretről.
  - Opcionális szöveges indoklás mező (pl. „Teljesítésigazolás hiányzik”, „Könyvelői konzultáció szükséges”).
- **Opció 2:** *„Véglegesen kizárom a könyvelésből és az ÁFA levonásból”*
  - Nem a vállalkozás érdekében felmerült kiadás, reprezentáció vagy magánhasználat esetén.
  - Végleges elrejtés mind a könyvelésből, mind az ÁFA analitikából.

### 2. Vizuális Megkülönböztetés a Számlalistában
A `NavInvoiceRow`, `SubmittedInvoiceRow` és `ExpandedInvoiceRow` komponensekben:
- A halasztott számlák különleges borostyánsárga/lila jelvényt (`Badge variant="outline" className="border-amber-500 text-amber-600"`) kapnak: **„Kérdéses (Halasztott ÁFA)”**.
- A felugró tooltipben megjelenik a megadott indoklás és a halasztás kezdő időpontja.

### 3. Vezérlőpulti "Kérdéses Számlák" Widget (`DeferredInvoicesWidget.tsx`)
A főoldali Irányítópulton (`/`) kiemelt widgetként jelenik meg az aktív kérdéses számlák állománya:
- **KPI kártyák:** Függőben lévő számlák száma, Függő ÁFA tartalom (Ft), Függő nettó költség (Ft).
- **2 éves törvényi jogvesztő határidő figyelő (Progress & Badge):**
  - 🟢 **Zöld:** > 365 nap van hátra a jogvesztő határidőig.
  - 🟡 **Sárga:** 180 – 365 nap van hátra.
  - 🔴 **Piros / Villogó:** < 180 nap van hátra (sürgős döntést igényel).
- **Akciók sora:**
  - *„Beemelés az aktuális időszakba”*: célidőszak választóval (`target_period = 'YYYY-MM'`).
  - *„Végleges kizárás”*: áttétel `PERMANENT` státuszba.
  - *„Tételek megtekintése”*: tételes kibontó nézet.
  - *„Tömeges beemelés”*: több számla egyidejű jóváhagyása.

### 4. Proaktív ÁFA Bevallási Értesítő Sáv & Dialógus (`DeferredVatPromptBanner.tsx`, `DeferredVatPromptDialog.tsx`)
Az ÁFA bevallás felületére (`/vat-return`) lépve:
- Ha a cég rendelkezik korábbi időszakból származó kérdéses számlákkal, automatikusan megjelenik egy élénk figyelmeztető sáv:
  > *„Figyelem! X db kérdéses számla várakozik elszámolásra Y Ft ÁFA tartalommal. Kívánja beemelni őket a [YYYY-MM] időszaki bevallásba?”*
- A gombra kattintva a `DeferredVatPromptDialog` táblázatában a könyvelő kijelölheti a beemelni kívánt számlákat.
- A beemelt számlák azonnal bekerülnek a 65-ös bevallás 64–66. soraiba és a 65M belföldi tételes lapra.

---

## 🔍 Current Implementation
- `src/features/invoices/components/ExclusionReasonDialog.tsx`
- `src/components/dashboard/DeferredInvoicesWidget.tsx`
- `src/features/invoices/hooks/useQuestionableInvoices.ts`
- `src/features/vat/components/DeferredVatPromptBanner.tsx`
- `src/features/vat/components/DeferredVatPromptDialog.tsx`
- `src/pages/Index.tsx`
- `src/features/vat/components/VatReturnViewTab.tsx`

---

## 📈 Rationale
Az ÁFA törvény 153/A. § szerinti 2 éves jogvesztő határidő az egyik leggyakoribb kockázati forrás a könyvelésben. A felület kettős védelmet ad: egyrészt a Dashboardon folyamatosan láthatóvá teszi a kérdéses tételeket a visszaszámlálóval, másrészt a havi ÁFA záráskor közvetlenül rákérdez a beemelésre, így a levonási jog garantáltan nem veszik el.

---

## 🔗 Kapcsolódó
- **BDR:** [065: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák Üzleti Szabályzata](../../business/decisions/065-deferred-vat-deduction-and-questionable-invoices.md)
- **ADR:** [A-234: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák Architektúrája](../../architecture/decisions/A-234-deferred-vat-deduction-and-questionable-invoices-architecture.md)
