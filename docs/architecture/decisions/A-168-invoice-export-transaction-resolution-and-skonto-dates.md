# A-168: Számla Export Banki Tranzakció Feloldás, Skontó-Dátum Architektúra és Intelligens Fül-Válogatás

**Status:** Decided  
**Date:** 2026-09-27  
**Utoljára frissítve:** 2026-09-27  
**Érintett fájlok:** `src/features/invoices/context/InvoiceContext.tsx`, `src/components/invoices/InvoiceDataExportDialog.tsx`, `src/features/invoices/__tests__/invoiceExportPaymentDatesAndRouting.test.ts`  

---

## 1. Context

A Visibill / eaisybill számla modulban a könyvelők és a cégvezetők az Excel (.xlsx) formátumú exportálás során gyakran a „Fizetési mód szerint bontva (3 fül)” elrendezést használják a hó végi könyvelési egyeztetésekhez:
1. fül: *Utalás és bankkártya*
2. fül: *Készpénz és házipénztár*
3. fül: *Egyéb bizonylatok*

### Felmerült problémák:
1. **Közüzemi számlák téves besorolása:** A közműszolgáltatók (pl. MVM Next Energiakereskedelmi Zrt., Fővárosi Vízművek) a számlákat a NAV Online Számla rendszerébe technikai okokból `'OTHER'` vagy üres fizetési mód kóddal küldik be (a csoportos beszedés, egyedi megállapodás vagy csekk miatt). Az export korábbi fül-szétválogatója kizárólag a számla fejlécében lévő szöveges mezőt (`payment_method`) vizsgálta regex-szel. Ennek következtében a ténylegesen banki átutalással rendezett számlák az „Egyéb bizonylatok” fülre kerültek.
2. **Hiányzó fizetési és esedékességi dátumok a skontó ellenőrzéshez:** Az exportban korábban csupán egyetlen logikai „Fizetve: Igen/Nem” oszlop szerepelt. A partnerekkel kötött skontó megállapodások (pl. fizetési határidő előtt 8–10 nappal történő utalás esetén 2–3% engedmény) ellenőrzéséhez a könyvelőnek és az ügyfélnek közvetlenül egymás mellett kell látnia az eredeti esedékességet és a banki teljesülés valós napját.

---

## 2. Decision

### 1. Kötegelt Banki Tranzakció Dátum Feloldás (`txDateMap`)
Az export elindításakor (`handleDataExportConfirm`) a rendszer aszinkron módon egyetlen párhuzamos lekérdezéssel feloldja a kijelölt számlákhoz tartozó valós banki könyvelési napokat mind az egyedi, mind a többszörös párosításokból:
- **Közvetlen tranzakció kapcsolat:** `invoices.transaction_id` és `nav_invoices.transaction_id` alapján a `transactions.transaction_date` beemelése.
- **Többszörös számlapárosítás (Multi-match):** A `transaction_invoice_matches` kapcsolótáblából a csatolt banki tétel könyvelési dátumának kinyerése.

```typescript
const directTxIds = selectedInvoices.map(i => i.transaction_id).filter(Boolean) as string[];
const invoiceIds = selectedInvoices.map(i => i.id);
const txDateMap = new Map<string, string>(); // invoice_id -> transaction_date

if (directTxIds.length > 0) {
  const { data: txData } = await supabase
    .from('transactions')
    .select('id, transaction_date')
    .in('id', directTxIds);
  // id -> date feltöltése
}

if (invoiceIds.length > 0) {
  const { data: multiMatches } = await supabase
    .from('transaction_invoice_matches')
    .select('invoice_id, transactions:transaction_id (transaction_date)')
    .in('invoice_id', invoiceIds);
  // multi-match hozzárendelés
}
```

### 2. Intelligens Banki Fül-Válogatás (`isBankOrCard`)
A lapfülekre sorolás nem bízható kizárólag a partner által a NAV-ba beküldött technikai kódra. Ha a számla valójában bankon keresztül lett kiegyenlítve (létezik hozzárendelt banki tranzakció), akkor az exportban automatikusan az **„Utalás és bankkártya”** fülre kerül:
```typescript
const isBankOrCard = (inv: ExportableInvoice) => {
  if (txDateMap.has(inv.id) || inv.transaction_id) return true;
  const p = (inv.payment_method || '').toLowerCase();
  return (
    p.includes('átutalás') ||
    p.includes('transfer') ||
    p.includes('bankkártya') ||
    p.includes('card') ||
    p.includes('kártya') ||
    p.includes('utalás') ||
    p.includes('beszedés') ||
    p.includes('sepa') ||
    p.includes('direct debit') ||
    p.includes('bank')
  );
};
```

### 3. Kétkomponensű Dátumstruktúra az Excel Fejlécekben
A korábbi egyszerű `Fizetve` boolean mező helyett az összesítő és tételes exportfejlécekbe két egzakt dátumoszlop került:
- **„Fizetési határidő”:** A számla eredeti esedékességi ideje (`nav_invoices.payment_date` vagy `invoices.fizetesi_hatarido`).
- **„Fizetés dátuma”:** A számla tényleges kiegyenlítésének napja:
  1. Elsődlegesen a feloldott banki tranzakció dátuma (`txDateMap`).
  2. Másodlagosan a manuálisan rögzített fizetési dátum (`manual_payment_date`).
  3. Kiegyenlített státusz esetén fallback az esedékességre / 'Fizetve' jelzésre.
  4. Részben fizetett számláknál 'Részben fizetve'.
  5. Nyitott számláknál `—`.

---

## 3. Consequences

### Pozitív:
- **Pontos könyvelői egyeztetés:** A skontók jogosultsága (pl. esedékesség előtt 9 nappal utalt számla) másodpercek alatt kimutatható Excelben képletekkel (`Fizetési határidő - Fizetés dátuma >= 8`).
- **Zéró téves MVM / közüzemi besorolás:** A közműszámlák nem szorulnak ki az egyéb kategóriába, ha banki utalás tartozik hozzájuk.
- **Minimális hálózati terhelés:** Az exportálás 1-2 kötegelt SQL lekérdezéssel (`.in('id', ids)`) fut le memóriában, O(1) Map kereséssel.

### Negatív:
- Ha egy számla külső bankból lett rendezve, de a kivonat még nincs feltöltve vagy nincs összepontozva, és a számlán `'OTHER'` szerepel, az továbbra is az egyéb fülre kerül a párosítás hiányában (ami helyes, amíg a bizonylat be nem érkezik).

---

## 4. Kapcsolódó
- [P-127: Számlák Többfüles Excel Exportja, Skontó- és Fizetési Dátum Feloldás és Banki Fül Routing UX](../../product/decisions/P-127-invoices-multitab-export-payment-dates-and-routing-ux.md)
- [A-058: Banki Utalások és Csomagkészítés](./A-058-bank-transfers-architecture.md)
- [A-118: Skontó és Partner Fizetési Határidő Atomi Újraszámítás](./A-118-atomic-partner-skonto-recalculation.md)
- [A-063: Egységes Dokumentumgeneráló Motor (DocumentEngine)](./A-063-unified-document-engine-architecture.md)
