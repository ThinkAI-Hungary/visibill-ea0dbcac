# P-046: Pénztárbizonylat feltöltési fül UX
 
**Status:** Decided
**Category:** UI / Navigation
**Question:** Hogyan tegyük lehetővé a felhasználóknak a pénztárbizonylatok (cash vouchers) manuális feltöltését?
**Decision:** Bevezetünk egy önálló „Pénztárbizonylatok” tabot a manuális feltöltés oldalon (`ManualUpload.tsx`), ahol a felhasználók közvetlenül és elkülönítve tudnak pénztárbizonylatokat feltölteni.
 
## Rationale
 
1. **Explicit Felhasználói Szándék:** Bár az AI képes automatikusan osztályozni a beérkező dokumentumokat, a pénztárbizonylat manuális feltöltésénél a felhasználónak határozott szándéka van. A külön fül kiválasztása biztosítja számukra a kontrollt.
2. **Költség- és Pontosság-optimalizálás:** Ha a felhasználó a „Pénztárbizonylatok” fül alá tölti fel a fájlt, a worker pipeline-ban a Stage 1 osztályozó (Classification) fázist átugorjuk (`document_category: 'penztarbizonylat'`), and közvetlenül a specifikus adatkinyerő (Extraction) fut le. Ez csökkenti az LLM API költségeket és megelőzi az osztályozási hibákat.
3. **Izolált előzmény-kezelés:** Az `UploadedFilesModal` és `UploadHistory` komponensek az `activeTab === 'vouchers'` állapotot érzékelve csak a `document_category: 'penztarbizonylat'` típusú feltöltéseket listázzák, megkönnyítve a történet ellenőrzését.
 
## UI/UX Specifikáció
 
- **Tab gomb:** A `Számlák` mellett helyezkedik el, `lucide-react` `Coins` ikonnal és „Pénztárbizonylatok” felirattal.
- **Dropzone és Tallózás:** A számlafeltöltőhöz hasonlóan támogatja a fogd-és-vidd (drag and drop) funkciót és a tallózást (.pdf, .jpg, .jpeg, .png, .webp).
- **Cache Invalidation:** Sikeres feldolgozás után automatikusan frissíti a házipénztár adatait (`['pettyCashEntries']` és `['uploadHistory']` cache kulcsok invalidálása).
 
## Kapcsolódó
- [A-036: Pénztárbizonylat (Cash Voucher) Processing](../../architecture/decisions/A-036-penztarbizonylat-processing.md)
- [ManualUpload.tsx](../../../src/pages/ManualUpload.tsx)
- [UploadedFilesModal.tsx](../../../src/components/UploadedFilesModal.tsx)
