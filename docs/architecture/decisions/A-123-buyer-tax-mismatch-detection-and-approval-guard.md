# A-123: Vevő Adószám Inkonzisztencia Detektálás és Könyvelői Jóváhagyási Figyelmeztetés (Buyer Tax Number Mismatch Guard)

**Status:** Decided  
**Date:** 2026-09-17  
**Utoljára frissítve:** 2026-09-17  

## Context
A felhasználók és könyvelők többcéges környezetben dolgoznak, és gyakran előfordul, hogy egy felhasználó tévesen olyan bejövő számlát tölt fel vagy hagy jóvá egy cég felületén, amely nem az adott cég nevére, hanem egy másik (pl. magánszemély vagy partnercég) nevére és adószámára szól. 

Egy konkrét support incidens során a felhasználó egy idegen cég nevére kiállított bizonylatot könyvelt be tévesen, ami később a főkönyvi zárás és a NAV ellenőrzés során hibaként és figyelmeztetésként jelent meg. Szükség volt egy megelőző védőhálóra, amely már a feltöltés és a jóváhagyási folyamat során észleli a vevői adószám és az aktív cég adószáma közötti eltérést.

## Decision
Bevezettük a központi **Buyer Tax Mismatch** detektálási és figyelmeztetési mechanizmust:

1. **Adószám Normalizáció és Összehasonlítás (`src/lib/invoiceMatchingUtils.ts`):**
   * A rendszer kizárólag a magyar adószám első 8 számjegyét (törzsszám / cégazonosító) hasonlítja össze a telephely- és áfakód eltérések miatti álpozitív riasztások elkerülése érdekében (`cleanTaxNumber`).
   * Támogatja a csoportos ÁFA-azonosítókat és a nemzetközi/külföldi formátumokat.
   * A `isBuyerTaxMismatch(invoiceBuyerTax, activeCompanyTax)` és a `getBuyerMismatchDetails(...)` tiszta segédfüggvények szolgáltatják az eltérés tényét és részleteit.

2. **Könyvelői Jóváhagyási Kapu Figyelmeztetés (`InvoiceApprovalDialog.tsx`):**
   * Ha a jóváhagyásra váró számlán szereplő vevő adószáma eltér az aktív cégétől, a dialógus egy kiemelt, borostyánsárga (amber) figyelmeztető dobozt jelenít meg.
   * A figyelmeztetés feltünteti a számlán szereplő vevő nevét/adószámát, valamint az aktív cég adatait.
   * **Nem-blokkoló védelem:** A jóváhagyás nincs keményen letiltva (pl. áthárított költségek vagy kapcsolt vállalkozások miatt), de explicit jóváhagyást követel meg a felhasználótól.

3. **Vizuális Telemetria a Számlatáblázatban (`SubmittedInvoiceRow.tsx`):**
   * A számlasorban figyelmeztető badge / ikon jelzi a könyvelő számára az adószám-eltérést még a részletező vagy a jóváhagyási dialógus megnyitása előtt.

## Consequences

**Pozitív:**
* Megelőzi a tévesen bekönyvelt, idegen cégre szóló számlák bekerülését a főkönyvbe és az ÁFA-bevallásba.
* Azonnali visszajelzést ad a felhasználónak feltöltés és jóváhagyás közben.
* 8 számjegyű törzsszám-alapú összehasonlítás révén robusztus a telephely-váltásokkal és áfakód-módosulásokkal szemben.

**Negatív / Kockázatok:**
* Ha egy számlán a vevő adószáma hiányzik vagy hibásan lett OCR-ezve, a figyelmeztetés tévesen megjelenhet (ezért nem blokkoló a dialógus).

## Kapcsolódó
- [P-091: Buyer Tax Mismatch Warning UX](../../product/decisions/P-091-buyer-tax-mismatch-warning-ux.md)
- [058: Buyer Tax Validation & Misdirected Invoices Policy](../../business/decisions/058-buyer-tax-mismatch-accounting-guard.md)
- [A-084: NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu](./A-084-nav-crosscheck-approval-gate.md)
