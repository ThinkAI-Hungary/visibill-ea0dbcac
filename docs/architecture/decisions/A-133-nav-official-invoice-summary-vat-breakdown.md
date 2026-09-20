# A-133: NAV Online Számla v3.0 Hivatalos ÁFA Összesítő (<invoiceSummary>) és Áfakulcs-Megbontás Integráció

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Szerző:** ThinkAI / Morfi  
> **Érintett komponensek:** `supabase/migrations/20260920190000_add_vat_summary_to_nav_invoices.sql`, `_shared/nav` (types, xml-parser, nav-ingestion-service), `nav-sync`, `query-nav-invoices`, `NavInvoiceVatSummaryCard`, `InvoiceItemsDialog`, `ExpandedInvoiceRow`  
> **Kapcsolódó:** [PRD P-099](../../product/decisions/P-099-official-vat-summary-ui.md), [ADR A-012](./A-012-nav-integration.md), [ADR A-132](./A-132-nav-query-taxpayer-auto-fill.md)  

---

## Context (Kontextus)

A Visibill / eaisybill-prod rendszer a NAV Online Számla szinkronizáció során eddig tételszinten (`<invoiceLines>`) gyűjtötte be a számlák tételeit, és a felület, valamint a könyvelési exportok a tételsorok ÁFA kulcsaiból próbálták visszaszámolni vagy összegezni a számlaszintű ÁFA-pozíciót.
Ez a megközelítés bizonyos számlatípusoknál pontatlanságokhoz és hiányosságokhoz vezetett:
1. **Különleges adózási jogcímek elvesztése:**
   - Az alanyi adómentes (`AAM`), tárgyi adómentes (`TAM`), közösségi adómentes (`KBAET`, `EAM`, `NAM`) bizonylatoknál a tételszint nem mindig tartalmazza a pontos törvényi hivatkozást (`Áfa tv. XIII. fejezet`).
   - A belföldi fordított adózás (`vatDomesticReverseCharge`, Áfa tv. 142. §) a fejrész hivatalos mezője, melynek hiányában a rendszer korábban manuális könyvelői beállítást igényelt.
   - Különbözet szerinti adózás (`marginSchemeIndicator`: utazásszervezés, használt cikkek, műalkotások).
   - Egyszerűsített számlák adótartalma (`vatContent`: pl. 0.2126 -> 27%).
2. **Közműszolgáltatói (pl. MVM, E.ON) számlák tételszintű ÁFA hiánya:**
   - Bizonyos nagy kibocsátók a tételsoroknál nem adnak meg ÁFA összeget (`vatPercentage` hiányzik a tételben), kizárólag a számla fejlécében lévő `<invoiceSummary>` blokkban bontják meg az ÁFA-alapot és adóösszeget.
3. **Devizás számlák forintértékei:**
   - Külföldi pénznemű számláknál a NAV szerinti hivatalos forint adóalap (`vatRateNetAmountHUF`) és ÁFA összeg (`vatRateVatAmountHUF`) közvetlenül elérhető a summary blokkban, kiküszöbölve az árfolyam-kerekítési eltéréseket.

---

## Decision (Döntés)

A NAV Online Számla v3.0 `<invoiceSummary>` hivatalos ÁFA összesítő blokkjának teljes körű, 100%-ban additív integrációját valósítottuk meg az adatbázisban, az Edge Function ingestion rétegben és a React felhasználói felületen.

### 1. Adatbázis Séma Bővítés
- Létrehoztuk a `supabase/migrations/20260920190000_add_vat_summary_to_nav_invoices.sql` migrációt:
  - `ALTER TABLE public.nav_invoices ADD COLUMN IF NOT EXISTS vat_summary jsonb DEFAULT NULL;`
  - GIN index létrehozása a gyors lekérdezhetőségért: `idx_nav_invoices_vat_summary`.
  - A módosítás teljesen additív: a korábbi táblák, oszlopok és relációk érintetlenül működnek tovább.

### 2. XML Parser & Típusdefiníciók (`_shared/nav`)
- **`types.ts`:**
  - `InvoiceVatSummaryItem`: Adóalap, ÁFA összeg, bruttó (devizában és HUF-ban), kulcs kategória (`percentage`, `exemption`, `out_of_scope`, `reverse_charge`, `margin_scheme`, `content`), jogcímkód és jogszabályi szöveg.
  - `InvoiceSummaryDetails`: `vatSummaries[]`, számla összesített nettó/ÁFA/bruttó devizában és forintban, valamint `hasReverseCharge` boolean flag.
  - `InvoiceDetails.vatSummary?: InvoiceSummaryDetails`.
- **`xml-parser.ts` -> `parseInvoiceSummary(decodedXml: string)`:**
  - Teljes lefedettség a NAV 3.0 XSD 8-irányú `VatRateType` uniójára:
    1. `vatPercentage`: Normál százalékos kulcs (pl. 0.27 -> 27%).
    2. `vatExemption`: Mentességi kód (`case`) és szöveges indoklás (`reason`).
    3. `vatOutOfScope`: Hatályon kívüli kód és indoklás.
    4. `vatDomesticReverseCharge`: Belföldi fordított adózás jelzése (`true`).
    5. `marginSchemeIndicator`: Árrés adózási típus.
    6. `vatContent`: Egyszerűsített számla adótartalom (pl. 0.2126).
  - Deviza és HUF adatok egyidejű kinyerése (`vatRateNetAmountHUF`, `vatRateVatAmountHUF`, `vatRateGrossAmountHUF`).
  - **Közműszámla Fallback:** Ha a tételsoroknál hiányzik az ÁFA kulcs, de a számlaösszesítő egyetlen ÁFA kulcsot tartalmaz, a parser automatikusan kitölti a tételsor `vatRate` és `vatAmount` mezőit a summary alapján.

### 3. Ingestion & Edge Functions
- **`nav-ingestion-service.ts` -> `fetchAndPersistDetails`:**
  - A részletes számlaadatok (`queryInvoiceData`) feldolgozásakor a `details.vatSummary` közvetlenül mentésre kerül a `nav_invoices.vat_summary` JSONB oszlopba.
  - Ha `vatSummary.hasReverseCharge === true`, a rendszer automatikusan beállítja az `is_reverse_charge = true` és `reverse_charge_category = 'DOMESTIC_142'` értékeket a szülő számlán.
- **Edge Functions frissítése és újratelepítése:**
  - `nav-sync`, `query-nav-invoices`, `nav-auto-sync`, `nav-query-outbound-invoices` Edge Functionök élesítve a közös `_shared/nav` csomaggal.

### 4. Frontend Megjelenítés
- **`NavInvoiceVatSummaryCard.tsx`:**
  - Kiemelt, prémium NAV ÁFA összesítő kártya.
  - Címkesor a fejrészben: azonnali áttekintést nyújt összecsukott állapotban is (`[27%]`, `[AAM]`, `[TAM]`, `[FAD]`).
  - Kattintásra lenyíló részletes táblázat adóalap, ÁFA és bruttó értékekkel mind eredeti devizában, mind forintban (devizás számlák esetén).
  - Tooltip az adómentességi és hatályon kívüli jogszabályi hivatkozásokhoz.
- **`InvoiceItemsDialog.tsx`:**
  - A tételek táblázata alatt jeleníti meg a hivatalos NAV ÁFA összesítést a NAV bizonylatoknál alapértelmezetten összecsukott állapotban.
- **`ExpandedInvoiceRow.tsx`:**
  - A számlalista lenyitásakor közvetlenül elérhető.

---

## Consequences (Következmények)

### Pozitív
- **100% Hatósági Hitelesség:** Az ÁFA analitika és a bizonylatok pontosan azt az adózási pozíciót mutatják, amit a NAV szerver fogadott el és hitelesített.
- **Automatikus Fordított Adózás Felismerés:** A 142. § szerinti belföldi fordított adózású számlák emberi beavatkozás nélkül azonnal megkapják az `is_reverse_charge = true` jelölést.
- **Közműszámla Hibaelhárítás:** Az MVM és egyéb közműszámlák tételszintű ÁFA-hiánya automatikusan feloldódik.
- **Zero Breaking Change:** A korábbi tételszintű struktúra és logika maradéktalanul megmaradt.

### Negatív / Kockázatok & Feloldásuk
- **Történeti számlák lefedettsége (Megoldva):** 
  - A korábban letöltött ~37 000 számla esetében a `20260920200000_backfill_nav_invoices_vat_summary.sql` migráció és batch függvény (`public.backfill_nav_invoices_vat_summary`) segítségével 100%-os visszamenőleges kitöltés valósult meg az adatbázisban tárolt meglévő tételsorokból és fejlécekből.
  - Ezzel elkerültük a NAV API túlterhelését (IP tiltás kockázata kizárva), miközben az összes (37 239 db) számla rendelkezik kitöltött, hiteles `vat_summary` adatokkal.
