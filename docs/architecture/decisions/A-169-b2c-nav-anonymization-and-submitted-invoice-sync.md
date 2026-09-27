# A-169: B2C Kimenő Számlák NAV Anonimizáció-Feloldása, Bizonylat Normalizálás és Automatikus Jóváhagyási Trigger Lánc

**Status:** Decided  
**Date:** 2026-09-28  
**Category:** Architecture / Invoices / NAV Sync / Triggers  
**Kapcsolódó:** [A-096](./A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md), [A-128](./A-128-strict-invoice-number-boundary-matching-and-subsumption-guard.md), [A-161](./A-161-vat-image-scope-filtering.md), [P-128](../../product/decisions/P-128-journals-bulk-gl-reassignment-and-tk-column-ux.md)

---

## 1. Architekturális Kontextus és Kihívás

A magyar adózási szabályok (NAV Online Számla v3.0 interfész) és az európai adatvédelmi irányelvek (GDPR) értelmében a magánszemélyek (nem adóalanyok) részére kibocsátott értékesítési (OUTBOUND) számlák adatszolgáltatása során a vevő természetes azonosító adatait (név, cím) a NAV nem adja át:
* `customer_name: null`
* `customer_tax_number: ""`

Emiatt a NAV Online Számla szinkronizációval beérkező bizonylatok a rendszerben eredetileg partnernév nélkül („Ismeretlen vevő”, a bevallásokban `—`) jelennek meg.

A vállalkozások a hiányzó vevőadatok és a számlakép megőrzése érdekében feltöltik a számla eredeti PDF vagy szkennelt példányát az alkalmazásba. Ha az optikai karakterfelismerő (OCR) modell a bizonylatszámot nem tudja kiolvasni (pl. grafikus fejlécek, halvány nyomatok), biztonsági fallback azonosítót (`OCR-...`) generál.

Ez két súlyos anomáliához vezetett az analitikákban:
1. **Kettős számbavétel (duplikáció):** A normalizált számlaszámon alapuló deduplikáció nem ismerte fel a két rekord azonosságát, így az ÁFA gyűjtőkódos analitika mind a NAV tételt, mind a feltöltött tételt önálló bizonylatként vette fel.
2. **Hiányzó partnernév a bevallási sorokban:** Az ÁFA bevallás (pl. 2665 07-es sor) részletezője nem tudta feloldani a vevő nevét az `invoices` táblából az eltérő sorszám miatt.

---

## 2. Döntés & Rendszerarchitektúra

### 2.1 Adatbázis Trigger Lánc & Kétoldali Állapot-szinkronizáció
Az alkalmazás adatbázis rétegében dedikált triggerek felügyelik az összerendelést:

1. **`trg_sync_submitted_invoice_on_bizonylat_change` (BEFORE UPDATE ON invoices):**
   * Ha a feltöltött számla sorszáma (`bizonylatsorszam`) egy létező NAV számlára módosul a cégen belül:
     ```sql
     NEW.nav_status := 'verified';
     IF NEW.statusz = 'jovahagyasra_var' THEN
       NEW.statusz := 'feldolgozott';
     END IF;
     ```
2. **`trigger_mark_nav_invoice_submitted` (AFTER UPDATE ON invoices):**
   * Automatikusan beállítja a célzott NAV számlán a `submitted = true` állapotot, jelezve a számlakép és a beküldött dokumentum meglétét.
3. **Partneradatok átörökítése:**
   * A jóváhagyott összerendeléskor a feltöltött bizonylat valós vevőneve (`vevo_nev`) és címe (`vevo_cim`) átkerül a `nav_invoices` rekordba, feloldva az anonimizációt a könyvelési és analitikai exportok számára.

### 2.2 Kliensoldali Reaktív Gazdagítás és Deduplikáció
A [VatCollectorAnalyticsView.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/vat/components/VatCollectorAnalyticsView.tsx) és a [VatRowDrillDown.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/vat/VatRowDrillDown.tsx) komponensekben a következő szabályok érvényesülnek:

* **Szigorú deduplikáció:**
  ```typescript
  const existingNavNumbers = new Set(navInvs.map((i) => normalizeInvNum(i.invoice_number)).filter(Boolean));
  const standaloneSubInvs = subInvs.filter((i) => !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));
  ```
  Ha az összerendelés megtörtént, a feltöltött számla kikerül a `standaloneSubInvs` listából, megelőzve az adóalap és ÁFA duplázódását.
* **Partnernév feloldás Fallback lánccal:**
  ```typescript
  const resolvedCustomer = inv?.customer_name || matchedSub?.vevo_nev;
  const partnerName = isOutbound
    ? (resolvedCustomer || t('accounting:vat_return.analytics_view.unknown_customer', 'Ismeretlen vevő'))
    : (inv?.supplier_name || matchedSub?.elado_nev);
  ```
  Ha a partner neve a feltöltött számláról származik, a felület vizuális `Számláról` indikátor badge-dzsel jelzi a könyvelőnek az adat forrását.

### 2.3 Prefix-Tisztítási Szabály a Bizonylatszám Illesztésben (`cleanNum`)
A [src/lib/invoiceMatchingUtils.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/lib/invoiceMatchingUtils.ts) illesztő függvényeiben bevezetésre került a prefix-normalizálás:
```typescript
const cleanNum = (s: string) => s.replace(/[^A-Z0-9]/g, '').replace(/^(SZA|SZL|SZLA|DIJ)/, '');
const numMatches = navNum === subNum || (cleanNum(navNum).length >= 4 && cleanNum(navNum) === cleanNum(subNum));
```
Ez garantálja, hogy a számlázóprogramok által használt eltérő formátumok (pl. `SZLA-2026-33` vs. `2026-33`) automatikusan felismerésre és összerendelésre kerüljenek.

---

## 3. Következmények és Előnyök

* **Pozitív:**
  * Teljes adategyezőség az ÁFA analitika és a 2665-ös nyomtatvány között (0 Ft kerekítési vagy duplikációs eltérés).
  * A magánszemélyes számlák esetében is megmarad a vevőazonosítás és a számlakép-kapcsolat.
  * Az adatbázis triggerek automatikusan gondoskodnak a belső konzisztenciáról kézi vagy RPC alapú módosítás esetén is.
* **Kockázat & Trade-off:**
  * B2C számlák esetén az adószám hiánya miatt az automatikus heurisztikának a bruttó összegre és dátumra kell támaszkodnia a téves összerendelések elkerülése érdekében.
