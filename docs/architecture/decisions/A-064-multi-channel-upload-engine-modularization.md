# A-064: Multi-Channel Document Upload Engine és Feature Szelet Modularizáció (`src/features/upload`)

**Status:** Decided  
**Date:** 2026-08-31  
**Utoljára frissítve:** 2026-08-31  

## Context
A korábbi `src/pages/ManualUpload.tsx` fájl 2155 soros monolitikummá nőtt. 6 független fájlfeltöltési csatorna (számlák, pénztárbizonylatok, bankkivonatok, béradatok, tranzakciók, futár riportok) másolta le szinte 100%-ban ugyanazt a fájlvalidációs, drag-and-drop, duplikátum-keresési, multi-click mutex szinkronizációs, Supabase Storage feltöltési, PGMQ sorbaállítási és React Query cache frissítési logikát.

A kódduplikáció miatt az [A-023](./A-023-upload-dedup-protection.md) és [A-041](./A-041-mailgun-concurrent-dedup.md) védelmeket (P0 szinkron mutex, P1 DB duplikáció check, P2 trigger bypass `source: 'manual_reupload'`) minden új csatornánál kézzel kellett volna újraimplementálni, ami magas hiba- és regressziós kockázatot hordozott.

## Decision
1. **Domain Feature Slice Könyvtárstruktúra (`src/features/upload/`):**
   - `types/index.ts`: Közös típusok (`UploadChannelId`, `ChannelConfig`, `SelectedFileItem`, `UploadBatchOptions`, `UploadHistoryRecord`).
   - `config/channelConfigs.ts`: Deklaratív konfigurációs mátrix mind a 6 csatornához (MIME típusok, táblák, bucketek, ikonok, metadata, specifikus opciók: bank hint / futár típus).
   - `core/documentUploadService.ts`: Tiszta, headless TypeScript szolgáltatás fájlvalidációhoz, adatbázis duplikátum-kereséshez, Supabase Storage batch feltöltéshez és hibák esetén atomi rollback-hez.
   - `core/uploadCacheSync.ts`: React Query `['uploadHistory']` optimista gyorsítótár frissítés és késleltetett invalidáció.
   - `hooks/useDocumentUpload.ts`: Mutex-védett React hook az állapotkezeléshez és duplikátum dialógus feloldásokhoz.
   - `components/dropzone/UploadDropzone.tsx`: Újrahasznosítható, billentyűzet- és akadálymentesített drag-and-drop zóna.
   - `components/file-list/UploadFileList.tsx` & `UploadFileItem.tsx`: Kiválasztott fájlok listája méret/típus jelvényekkel és tömeges ürítéssel.
   - `components/channel/UploadChannelTab.tsx`: Egységes csatorna nézet kompozíció (Dropzone + Opcionális szelektorok + Fájllista + Feltöltési akciógomb).
   - `components/dialogs/UploadDialogManager.tsx`, `DbDuplicateDialog.tsx`, `ListDuplicateDialog.tsx`: Centralizált dialóguskezelés.
   - `ManualUploadFeature.tsx`: Fő orchestrator komponens URL-szinkronizált tab-váltással (`useUrlTab`).
   - `index.ts`: Publikus barrel export.

2. **15 soros Facade az `src/pages/ManualUpload.tsx`-ben:**
   - A `src/pages/ManualUpload.tsx` oldal egy vékony facade lett, amely kizárólag a `<ManualUploadFeature />`-t rendereli, 100%-ban megőrizve a meglévő scoped route (`/:companyId/:dateRange/upload/:tab?`) kompatibilitást.

3. **Duplikáció és Mutex Védelem (A-023 & A-041) Garanciák:**
   - **P0 Szinkron Mutex (`uploadMutexRef = useRef(false)`):** A `useDocumentUpload` hookban azonnal és szinkron blokkolja a rapid multi-click eseményeket.
   - **P1 DB Duplikátum Lekérdezés:** Minden releváns státusz (`processed`, `pending`, `processing`, `ignored`, `completed`, `webhook_sent`) ellenőrzése fut le indítás előtt.
   - **P2 Trigger Bypass:** Duplikáció megerősítésekor `metadata: { source: 'manual_reupload' }` kerül beírásra, így a DB trigger dedup guard szándékos újrafeltöltésként kezeli.

## Consequences
**Pozitív:**
- A `ManualUpload.tsx` mérete 2155 sorról ~15 sorra csökkent, a bundle méret 76 kB-ról 50 kB-ra csökkent.
- A 6 feltöltési csatorna közötti ~1500 sor duplikáció megszűnt.
- A feltöltési logika 100%-ban unit-tesztelhetővé vált React DOM mountolás nélkül.
- Új feltöltési csatorna hozzáadása 1 konfigurációs objektum deklarálásával megvalósítható.

**Negatív / Trade-off:**
- A csatornák állapota (kiválasztott fájlok) független hook instance-okban él a tab-váltások közötti fájlmegőrzéshez.

## Kapcsolódó
- [A-023: Upload Dedup Védelem (DB Trigger + Frontend Mutex)](./A-023-upload-dedup-protection.md)
- [A-041: Mailgun Webhook Concurrent Dedup — Háromrétegű Idempotency](./A-041-mailgun-concurrent-dedup.md)
- [A-060: Moduláris App Router & Platform Bootstrap Architektúra](./A-060-modular-app-router-and-bootstrap-shell.md)
- [A-062: Számla Feature Szelet Modularizáció és Dekompozíció](./A-062-invoices-feature-slice-modularization.md)
