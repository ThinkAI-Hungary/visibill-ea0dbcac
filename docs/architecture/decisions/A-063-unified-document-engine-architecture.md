# A-063 — Unified DocumentEngine & Ports-and-Adapters Exporter Architecture

**Dátum:** 2026-08-31  
**Státusz:** ✅ Decided  
**Kategória:** Frontend Architektúra / Export & Dokumentumgenerálás  
**Érintett komponensek:** `src/lib/documents/`, `src/lib/exportPdf.ts`, `src/lib/exportUtils.ts`, `src/lib/payslipPdf.ts`, `src/lib/cashReceiptPdf.ts`, `src/lib/annualReportPdf.ts`, `src/lib/vatReturnPdf.ts`, `src/lib/vatReturnXml.ts`, `src/lib/documentPdfs.ts`

---

## Kontextus & Probléma

A Visibill és eaisyBooks rendszerekben korábban 12+ különböző segédfájl végezte a PDF, ÁNYK XML, CSV és XLSX fájlok generálását. Ez komoly technikai adóssághoz és duplikációkhoz vezetett:
1. **Duplikált kódolás és transzliteráció:** A jsPDF beépített Helvetica fontjának Latin-1 korlátja miatti magyar `ő/ű -> ö/ü` normalizálás (`hu()`) 6 különböző fájlban volt másolva.
2. **Duplikált XML escaping:** Az ÁNYK XML fájlok kézi string összefűzéssel és ismétlődő `escapeXml()` függvényekkel készültek.
3. **Statikus vs. Dinamikus import inkonzisztencia:** Egyes modulok statikusan importálták a `jspdf` (~390 KB) és `jspdf-autotable` (~31 KB) könyvtárakat, feleslegesen növelve az induló kliens bundle méretét.
4. **Memóriakezelési kockázat:** A fájlletöltéseknél ad-hoc módon generálódtak Blob URL-ek, sok helyen hiányzó `URL.revokeObjectURL()` hívással.

---

## Döntés

Bevezettük az egységes, mély **DocumentEngine** könyvtárat a `src/lib/documents/` alatt, **Ports & Adapters (Hexagonális)** architektúrában:

```
src/lib/documents/
├── core/
│   ├── types.ts                     # Dokumentum sémák (Descriptor), típusok
│   ├── DocumentEngine.ts            # Fő motor: render(), export(), previewInNewTab(), createPreviewUrl()
│   ├── libraryLoader.ts             # Központosított, memoizált Lazy Loader (jsPDF, autoTable, XLSX)
│   └── downloadHelper.ts            # Memóriabiztos Blob/String letöltő automatikus revoke-kal
├── encoding/
│   ├── hungarianEncoding.ts         # Latin-1 normalizálás, szám- és devizaformázás, CSV cella tisztítás
│   └── xmlSanitizer.ts              # XML escaping, ÁNYK struktúra generátor (buildAnykEnvelope)
├── adapters/
│   ├── PdfDocumentAdapter.ts        # jsPDF + autotable adapter, egységes fejléccel és lapozással
│   ├── XmlDocumentAdapter.ts        # ÁNYK XML adapter
│   ├── SpreadsheetAdapter.ts        # CSV és XLSX adapter (UTF-8 BOM támogatással)
│   └── HtmlPreviewAdapter.ts        # Nyomtatható és iframe preview HTML adapter
├── templates/
│   ├── payslipTemplate.ts           # Bérjegyzék sablon
│   ├── cashReceiptTemplate.ts       # Pénztárbizonylat sablon & numberToWordsHu
│   ├── payrollReportsTemplate.ts    # Bérszámfejtési jelentések (M30, Járulékösszesítő, Bérköltség)
│   ├── vatReturnTemplate.ts         # 2665 ÁFA bevallás sablon
│   ├── annualReportTemplate.ts      # Éves beszámoló sablon
│   └── tableExportTemplate.ts       # Általános analitikus táblázat export sablon
└── index.ts                         # Publikus barrel export
```

### Visszafelé Kompatibilitás (Facade Pattern)
A meglévő `src/lib/*Pdf.ts`, `src/lib/*Xml.ts` és `src/lib/exportUtils.ts` fájlok vékony facade réteggé alakultak, amelyek a `src/lib/documents/`-re delegálnak, garantálva a 100%-os regressziómentességet.

---

## Következmények és Előnyök

1. **Locality & Zero Duplication:** A magyar ékezetkezelés, számformázás és XML escape egyetlen központi modulban él.
2. **Kisebb Bundle & Gyorsabb Betöltés:** A nehézsúlyú könyvtárak kizárólag a letöltés gombra kattintáskor töltődnek be aszinkron (`import()`).
3. **Memóriabiztonság:** Az automatikus `URL.revokeObjectURL()` megakadályozza a kliensoldali memóriaszivárgást.
4. **Típusbiztonság és Tesztelhetőség:** Tiszta leíró objektumok (DocumentDescriptor), 100%-ban izolált unit tesztekkel.

---

## Kapcsolódó
- PRD: [P-058: Unified DocumentEngine UX](../../product/decisions/P-058-unified-document-engine-ux.md)
- BRD: [046: Unified DocumentEngine Business Rules](../../business/decisions/046-unified-document-engine.md)
