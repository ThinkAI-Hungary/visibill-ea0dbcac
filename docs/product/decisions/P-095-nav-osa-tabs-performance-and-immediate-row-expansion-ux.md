# P-095: NAV OSA Tabok Elnevezése, Gyorsítótárazott Tab-Váltás és Azonnali Sorlenyitási Animáció UX

**Status:** Decided  
**Category:** UI / Navigation / Performance  
**Question:** Hogyan tehető hivatalossá és egyértelművé a számlák oldal fül-struktúrája, hogyan szüntethető meg a NAV OSA bejövő fülre navigáláskor és lapozáskor tapasztalható renderelési késleltetés, valamint hogyan iktatható ki a számlasorok lenyitásakor megjelenő átmeneti, félig kinyílt sötét üres állapot?  
**Decision:** 

1. **Hivatalos Fül-elnevezések (NAV OSA Kimenő / NAV OSA Bejövő):**
   - A korábbi köznapi elnevezések helyett a rendszerben egységesen és hivatalosan a **NAV OSA Kimenő** és **NAV OSA Bejövő** megnevezéseket alkalmazzuk a navigációs fejlécben, az `InvoiceTabSelector`-ban, valamint a magyar és horvát lokalizációs fájlokban (`src/locales/hu/invoices.json`, `src/locales/hr/invoices.json`).
   - A beküldött számlák fülei megmaradnak a tiszta beküldött kategóriában (*Beküldött kimenő*, *Beküldött bejövő*), így a felhasználó számára azonnal egyértelmű a számla eredete.

2. **Lusta Táblázatsor-Vezérlők (`LazyRowSelect` DOM Pruning):**
   - A lapozott táblázat soraiban megjelenő Kategória és Projekt választóknál megszüntettük a teljes Radix `<Select>` / `<SelectItem>` fák előzetes DOM-ba renderelését. 50 számlasornál ez soronként 55 opcióval számolva 2 750 felesleges DOM csomópontot generált minden renderelési ciklusban, ami fagyást és kattintási késleltetést okozott a fülváltáskor.
   - Helyette a sorokban egy könnyűsúlyú, azonnal megjelenő trigger gomb látható, és a teljes interaktív legördülő menü kizárólag a felhasználó közvetlen interakciójára (hover / kattintás) mountolódik be a memóriába.

3. **Azonnali Tartalommal Gördülő Harmonika Animáció (Option B):**
   - Megszüntettük a belső kártyák és badge-ek `opacity: 0` kiindulási állapotát és a késleltetett fade-in animációt: a kibontott rész tartalma (`GeneralLedgerBadgeSection`, `MatchedTransactionsSection`, kapcsolódó kártyák) azonnal 100% opacity-vel rendelkezik.
   - A felső kitöltést (`py-6`-ról `pt-3 pb-5`-re) optimalizáltuk, és a konténer CSS Grid harmonika animációt (`accordionSlideDown`) 180 ms-os feszes görbére (`cubic-bezier(0.16, 1, 0.3, 1)`) állítottuk. Ennek eredményeképpen a felső elemek azonnal, a nyílás legelső pillanatától láthatóan és folyamatosan gördülnek lefelé, mint egy fizikai fiók vagy redőny – teljesen megszüntetve a sötét üres sáv illúzióját.

4. **Késleltetett URL Szinkronizáció (Router Re-render Retesz):**
   - A számlasor kattintásakor a nyitási/csukási állapot (`expandedRowIds`) azonnal érvényesül a komponensben, de a deep-link URL paraméter (`?invoice=<id>`) beállítását 200 ms-mal késleltetjük. Ez megakadályozza, hogy a React Router re-render megszakítsa vagy befagyassza a futó 180 ms-os CSS átmenetet.

**Current Implementation:**
- [navigation.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/navigation.ts)
- [InvoiceTabSelector.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceTabSelector.tsx)
- [NavInvoiceRow.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx)
- [ExpandedInvoiceRow.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/ExpandedInvoiceRow.tsx)
- [InvoiceTableContainer.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/InvoiceTableContainer.tsx)
- [invoiceRelations.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/utils/invoiceRelations.ts)

**Rationale:** A könyvelők és pénzügyi vezetők napi szinten több száz számlasort vizsgálnak át. A fülváltásnak és a részletek kinyitásának akadásmentesnek (60 fps), azonnalinak és professzionálisnak kell lennie. A vizuális fekete lyukak és az input-lag felszámolása közvetlenül növeli a rendszer megbízhatósági érzetét és a munkafolyamat sebességét.

## Kapcsolódó
- [A-127: Számlatáblázat Tab-Váltási Render-Skálázás és Accordion Re-Render Retesz](../../architecture/decisions/A-127-invoice-table-tab-switch-scaling-and-accordion-re-render-latch.md)
- [P-057: Invoices Feature Slice UX](./P-057-invoices-feature-slice-ux.md)
- [P-010: Invoice List View & Filters](./P-010-invoice-list.md)
