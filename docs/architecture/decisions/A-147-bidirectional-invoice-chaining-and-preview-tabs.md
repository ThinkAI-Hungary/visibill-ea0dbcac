# A-147: Kétirányú Számlaláncolat (Invoice Chaining), Dinamikus Kapcsolt Bizonylat Feloldás és Előnézeti Dokumentum-lapozás

**Státusz:** ✅ Elfogadva  
**Dátum:** 2026-09-24  
**Döntéshozó:** Antigravity Architect & User Approval  
**Kapcsolódó PRD:** [P-111: Számlaláncolatok Megjelenítése, Kapcsolt Bizonylatok és Többdokumentumos Számlakép Lapozó UX](../../product/decisions/P-111-invoice-chain-and-multi-document-preview-ux.md)  
**Kapcsolódó ADR-ek:**
- [A-016: PostgreSQL query stratégia & RPC katalógus](./A-016-postgresql-query-strategy.md)
- [A-042: Sztornó Számla Kézi Lezárás Architektúra](./A-042-storno-settle-architecture.md)
- [A-145: Tömeges PDF Szeletelés és Többszörös Mellékletkezelés](./A-145-bulk-invoice-slicing-and-multi-attachment-architecture.md)
**Érintett Komponensek:**
- [`src/features/invoices/utils/invoiceChainFetch.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/utils/invoiceChainFetch.ts)
- [`src/features/invoices/utils/invoiceRelations.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/utils/invoiceRelations.ts)
- [`src/features/invoices/context/InvoiceContext.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/context/InvoiceContext.tsx)
- [`src/features/invoices/components/table/SubmittedInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx)
- [`src/features/invoices/components/table/NavInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx)
- [`src/features/invoices/components/expanded-row/LinkedInvoicesSection.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/LinkedInvoicesSection.tsx)
- [`src/components/InvoiceImageDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImageDialog.tsx)
- [`src/components/ui/FilePreviewModal.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ui/FilePreviewModal.tsx)

---

## 1. Kontextus & Problémafelvetés

A könyvelésben a számlák ritkán állnak elszigetelten: egy alapszámlához gyakran tartozik helyesbítő vagy sztornó számla, egy díjbekérőhöz előlegszámla, vagy előlegszámlához végszámla (pl. `THINK-2026-34` alapszámla és `THINK-2026-44` sztornó számla).

A rendszerben korábban két kritikus hiányosság állt fenn:
1. **Adatfolyam megszakadás az Expanded sorban:** A táblázat soraiban a kibontott nézet (`ExpandedInvoiceRow`) felé a kapcsolt számlák listája (`matches.linkedInvoices`) hardkódolt üres tömbként (`[] as any[]`) került átadásra. Emiatt a `LinkedInvoicesSection` komponensben a rendszer a létező referencia ellenére azt jelezte: *"Hiányzó bizonylat(ok) — A következő hivatkozott bizonylat(ok) hiányoznak vagy törölték őket"*, annak ellenére, hogy a számla elérhető volt az adatbázisban.
2. **Elszigetelt előnézet a számlakép modalban:** Amikor a felhasználó megnyitotta a számlaképet, kizárólag az éppen kijelölt számla képe jelent meg. A kapcsolódó számlák (alapszámla, sztornó, végszámla) dokumentumainak megtekintéséhez a könyvelőnek be kellett zárnia a modalt, megkeresnie a másik sort, és külön megnyitnia a számlaképet.

---

## 2. Architektúrális Döntések

### D-1: Kliensoldali In-Memory Gráf Indexelés (`InvoiceContext` + `buildLinkedInvoicesMap`)

Az N+1 típusú adatbázis-lekérdezések megelőzése érdekében a táblázatban megjelenő számlák és a dátumtartományon kívüli hivatkozott bizonylatok (`linkedInvoicesPool`, melyet a `get_linked_invoices` RPC biztosít) egyetlen reaktív index-struktúrába rendeződnek az `InvoiceContext`-ben:

```ts
const linkedInvoicesMap = useMemo(() => {
  return buildLinkedInvoicesMap(submittedInvoices, linkedInvoicesPool);
}, [submittedInvoices, linkedInvoicesPool]);
```

A `buildLinkedInvoicesMap` kétirányú O(1) hash map-et épít:
- **`byBizonylat: Map<string, SubmittedInvoice[]>`**: Bizonylatsorszám (`bizonylatsorszam`) alapján indexelve (normalizált kisbetűs kulcsokkal).
- **`byReference: Map<string, SubmittedInvoice[]>`**: Hivatkozott sorszámok (`reference_number`, `elolegszamla_hivatkozas`) alapján indexelve, támogatva a vesszővel, pontosvesszővel vagy sortöréssel elválasztott többszörös hivatkozásokat.
- **Deduplikáció:** Azonos ID-jú számlák szűrése az összefésüléskor.

### D-2: Kétirányú Láncolat-feloldás (`resolveLinkedInvoices`)

A sor lenyitásakor nem történik újabb hálózati kérés: a `resolveLinkedInvoices(invoice, linkedInvoicesMap)` in-memory bejárja a gráfot:
1. **Szülő irány (`relationDirection: 'parent'`):** Követi a számla `reference_number` és `elolegszamla_hivatkozas` hivatkozásait a `byBizonylat` indexen át.
2. **Gyermek irány (`relationDirection: 'child'`):** A számla `bizonylatsorszam` értékét keresi a `byReference` indexben, azonosítva az ezen számlára hivatkozó összes bizonylatot.
3. **Ciklusvédelem:** `visited: Set<string>` halmaz garantálja a végtelen ciklusok kizárását körkörös hivatkozás esetén.

### D-3: NAV és Beküldött Számlák Egységes Kezelése

Mind a `SubmittedInvoiceRow`, mind a `NavInvoiceRow` komponens integrálja a láncolat-feloldást:
- Beküldött számláknál közvetlenül a `subInvoice` alapján.
- NAV számláknál: ha van párosított beküldött számla, azon keresztül; ha nincs, a `navInvoice.original_invoice_number` és `invoice_number` alapján egy pszeudo-rekord segítségével feloldva a láncolatot.
- Az `invoiceReferenceNumber` prop átadása biztosítja a NAV-soroknál is a hiányzó bizonylat ellenőrzést.

### D-4: Determinisztikus Hiányzó Bizonylat Detektálás (`LinkedInvoicesSection`)

A hamis hibajelzések megszüntetésére a `LinkedInvoicesSection`:
- Tokenizálja a referenciaszámokat regex segítségével (`/[,;\n]+/`).
- Összeveti a tokeneket a feloldott `linkedInvoices` tömbben szereplő számlák sorszámaival (normalizált, szóközmentes és kisbetűs összehasonlítással).
- **Csak és kizárólag akkor** jeleníti meg a figyelmeztetést, ha van olyan hivatkozott sorszám, amely fizikailag nem található meg a rendszerben.

### D-5: Dinamikus Számlakép Dokumentum-lapozó (`fetchInvoiceChain` + `InvoiceImageDialog`)

A számlakép modal (`InvoiceImageDialog`) megnyitásakor a `fetchInvoiceChain` aszinkron eljárás lekéri a teljes láncolathoz tartozó számlákat és csatolmányokat:
1. **Szerepkör-címkék hozzárendelése:**
   - Eredeti / Alapszámla: `(Alapszámla)`
   - Sztornó számla: `(Sztornó)`
   - Végszámla: `(Végszámla)`
   - Előlegszámla: `(Előlegszámla)`
2. **Kiterjesztés-védelem:** A tab elnevezéseknél a szerepkör a kiterjesztés elé kerül (pl. `THINK-2026-44 (Sztornó).pdf`), a `FilePreviewModal`-ban lévő `getFileExtension` segédfüggvény pedig intelligensen felismeri a valós kiterjesztést az URL-ből és a névből is, megelőzve az ismeretlen fájltípus hibát.
3. **Villódzásmentes betöltés és Tab-váltás:** A teljes képernyős portál-spinner helyett a preview ablakon belül aktiválódik finom áttűnés és loading jelzés kizárólag tab-váltáskor.

---

## 3. Következmények & Előnyök

- **Zero False Warnings:** Megszűnt a hamis hibaüzenet a lenyitott számlasoroknál; a felhasználó azonnal látja a kapcsolt bizonylat kártyáját.
- **Kontextus-vesztés nélküli ellenőrzés:** A könyvelő a számlakép megnyitásakor azonnal láthatja és lapozhatja az összes kapcsolódó dokumentumot (alapszámla, sztornó, mellékletek).
- **Kiváló kliensoldali teljesítmény:** O(1) in-memory keresés a renderelés során, nincs hálózati N+1 hívás a táblázat sorainak kibontásakor.
- **Konzisztens típusbiztonság:** `original_invoice_number` explicit jelenléte a `NavInvoice` interfészben.
