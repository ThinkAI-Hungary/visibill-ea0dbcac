# A-198: Manuális Beküldött Számlarögzítés, Dokumentum Csatolás és Többes Párosítás

**Státusz:** Decided  
**Dátum:** 2026-10-05  
**Kategória:** Frontend & Számlázási Architektúra  
**Kapcsolódó ADR-ek:** [A-054](./A-054-strict-nav-submitted-pairing.md), [A-062](./A-062-invoices-feature-slice-modularization.md), [A-065](./A-065-invoices-god-context-decomposition-and-expanded-row-modularization.md), [A-070](./A-070-multi-channel-upload-storage-bucket-alignment.md), [A-128](./A-128-strict-invoice-number-boundary-matching-and-subsumption-guard.md)

---

## 1. Kontextus

A Visibill számlakezelő rendszerében a beküldött számlák (`invoices` tábla) elsősorban külső csatornákon keresztül (Mailgun/IMAP email feldolgozás, közvetlen tömeges fájlfeltöltés, Számlázz.hu szinkron) érkeztek a rendszerbe. Létezett lehetőség a már rögzített számlaképek adatainak szerkesztésére (`InvoiceFullEditDialog.tsx`), azonban hiányzott a funkció, amellyel a felhasználó vagy a könyvelő közvetlenül, manuálisan rögzíthet egy új számlát egy hasonlóan ergonomikus felugró ablakban.

A felhasználói igény három kulcsfontosságú elemet tartalmazott:
1. **Manuális fejléc és tételes rögzítés** kétfüles elrendezésben (Számla adatok + Számlatételek).
2. **Közvetlen számlakép / PDF feltöltés** a létrehozás pillanatában, ami azonnal a Supabase Storage `invoice-uploads` bucketjébe kerül és csatolódik a számlához.
3. **Opcionális többes összerendelés a rögzítéskor:**
   - Kapcsolódó NAV számlapár kiválasztása intelligens adatelőtöltéssel (sorszám, partner, dátumok, összegek).
   - Kiegyenlítő banki tranzakció(k) azonnali hozzárendelése (`batchApplyMatches`), a kifizetettségi státusz (`paid`, `partially_paid`) automatikus kalkulációjával.

---

## 2. Döntés

1. **Dekomponált Moduláris Komponens Architektúra:**
   Ahelyett, hogy az 1124 soros `InvoiceFullEditDialog.tsx` komponenst terheltük volna újabb boolean propokkal és elágazásokkal, egy dedikált, fókuszált komponenst hoztunk létre az alábbi struktúrában:
   - `src/components/invoices/ManualInvoiceCreateDialog.tsx`: A fő orchestrator modal.
   - `src/components/invoices/manual-create/NavInvoicePicker.tsx`: Kereshető NAV számlaválasztó intelligens mező-előtöltéssel.
   - `src/components/invoices/manual-create/TransactionMultiPicker.tsx`: Kereshető többes banki tranzakció-választó fedezet-összehasonlítással és részfizetés kalkulációval.
   - `src/components/invoices/manual-create/InvoiceDocumentDropzone.tsx`: Drag-and-drop PDF és képfájl feltöltő méret- és típusellenőrzéssel.

2. **Központi Kontextus & Dialog Manager Integráció:**
   - Az `InvoiceContext.tsx` bővült a `createDialogOpen` és `setCreateDialogOpen` állapotokkal és metódusokkal.
   - Az `InvoiceHeader.tsx` megkapta a kiemelt elsődleges műveleti gombot (`Plus` ikonnal és `"actions.new_invoice"` lokalizációval).
   - Az `InvoiceDialogManager.tsx` mountolja a `ManualInvoiceCreateDialog`-ot, így a dialógus életciklusa a compound feature szeletből vezérelhető.

3. **Adatmentési és Integritási Szabályok:**
   - **PostgreSQL NOT NULL Constraint Védelem:** Az `invoices.elado_nev` és `invoices.vevo_nev` mezők élesben nem lehetnek `NULL` értékűek. Az `InvoiceDialogManager.tsx` átadja a `companyName` propot. Megnyitáskor és irányváltáskor a rendszer előtölti a saját céget a nem-elsődleges partner mezőbe, mentéskor pedig a garantált `companyName || 'Saját cég'` fallback biztosítja, hogy egyik mező se okozhasson 23502 SQL hibát.
   - **Szinkron Double-Submit Mutex:** A `savingRef.current` atomi zárral kiküszöböljük a felhasználói dupla kattintásokból adódó párhuzamos számlalétrehozási kéréseket még a React újrarenderelése előtt.
   - **Fejléc és Tételsorok Auto-Rekalkuláció:** Ha a számlához tételsorok (`lineItems`) tartoznak, a mentés pillanatában a fejlécösszegek (`adoalap_osszesen`, `afa_osszeg_osszesen`, `brutto_vegosszeg`, `fizetendo_osszeg`) automatikusan a tételek szummájából számolódnak újra, garantálva a numerikus konzisztenciát.
   - **Tranzakció-elrablás Elleni Védelem:** A `TransactionMultiPicker.tsx`-ben a már másik számlához kapcsolt banki tételek (`matched_invoice_id && !isSelected`) letiltásra kerülnek (`disabled`), kizárva a meglévő banki könyvelési párosítások akaratlan felülírását.
   - **Storage:** A feltöltött dokumentum közvetlenül az `invoice-uploads` bucketbe kerül `${userId}/${timestamp}-${cleanName}` útvonalon, és beállítja az `invoices.image_url`, `melleklet_url` és `attachments` mezőket. A dropzone hibaüzenetei egységes Toast értesítéssel jelennek meg.
   - **Multi-Jurisdiction & HR Lokalizáció:** Horvát nyelvű környezetben (`isHr`) a rendszer automatikusan az EUR pénznemet, a 25% és 13% helyi áfakulcsokat, a `kom` mértékegységet, valamint a PDV és EU adókódokat állítja be alapértelmezettként.
   - **NAV Kapcsolat:** Kiválasztás esetén az `invoices.nav_invoice_id` értéke beállításra kerül, a számla státusza `'verified'` lesz, a kapcsolódó NAV számlán pedig beállításra kerül a `submitted = true` jelölő.
   - **Tranzakció Kapcsolat:** Kiválasztott tranzakciók esetén az első tranzakció a `transactions.matched_invoice_id`-n keresztül, a további tranzakciók a `transaction_invoice_matches` kapcsolótáblán keresztül kapcsolódnak. A számla bruttó végösszege és a tranzakciók összege alapján automatikusan beállítódik a `paid`, `paid_amount` és `partially_paid` státusz.
   - **Tételes Sorok:** Opcionálisan megadott tételsorok az `invoice_items` táblába kerülnek kötegelt beszúrással.

---

## 3. Következmények

### Pozitív
- A könyvelők és cégvezetők másodpercek alatt rögzíthetnek olyan számlákat is, amelyek nem érkeztek meg emailben vagy API-n.
- A NAV számlapár választása és automatikus űrlap-kitöltése radikálisan csökkenti a kézi gépelést és kizárja az elgépelésekből eredő eltéréseket.
- A közvetlen tranzakció-csatolás révén a számla azonnal kiegyenlített vagy részben kiegyenlített státuszba kerül a főkönyv és a folyószámla analitikák számára.
- Teljes DB-szintű biztonság: nem keletkezhet 23502 NOT NULL hiba partnernevekre, kizárt a tranzakció-elrablás és a kettős kattintásos duplikáció.
- Zéró boolean prop robbanás és tiszta Vercel kompozíciós megfelelőség.

### Kapcsolódó
- [A-054](./A-054-strict-nav-submitted-pairing.md) — Szigorított NAV ↔ Beküldött Számla Összerendelés
- [A-062](./A-062-invoices-feature-slice-modularization.md) — Számla Feature Szelet Modularizáció
- [A-082](./A-082-partially-paid-invoices-status.md) — Részfizetések és Tranzakció Státuszok
- [A-109](./A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md) — Eaisybill i18n Horvát Lokalizáció és Útvonal Architektúra
- [P-157](../../product/decisions/P-157-manual-submitted-invoice-creation-dialog-and-pairings-ux.md) — Manuális Számlarögzítés Felületi Élmény (UX)
