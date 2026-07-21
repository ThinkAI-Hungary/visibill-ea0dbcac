# A-043: ZIP / Archívum Csatolmány Kicsomagolás az Email Pipeline-ban

**Status:** Decided  
**Date:** 2026-07-21  
**Utoljára frissítve:** 2026-07-21

## Context

A Visibill két email pipeline-on fogad számla- és dokumentum-csatolmányokat:
1. **IMAP sync** (`imap_sync_pipeline.py`) — cégek saját postaládáiból
2. **Mailgun webhook** (`process-mailgun-webhook/index.ts`) — email alias-on beérkező levelekből

Egyes könyvelők és partnerek ZIP archívumba csomagolva küldik a számlákat (pl. havi számlaköteg, scannelt dokumentumok). Az eredeti implementáció csak direkt fájl-mellékleteket támogatott — a ZIP-ben lévő számlák elvesztek, a user manuálisan kellett kicsomagolja és feltöltse.

## Decision

**Mindkét email pipeline-ba bevezetjük az automatikus ZIP/TAR.GZ kicsomagolást**, mielőtt az attachment feldolgozás megkezdődik. Az archívumban lévő belső fájlok pontosan úgy kerülnek feldolgozásra, mintha direkt csatolmányként érkeztek volna.

### Python worker (IMAP) — `imap_sync_pipeline.py`

- **Library:** stdlib `zipfile` + `tarfile` — nulla új pip dependency
- **Konstans:** `COMPRESSED_EXTENSIONS = {".zip", ".tar.gz", ".tgz"}`
- **Helper:** `extract_compressed_files(file_bytes, filename, depth=0) → list[tuple[str, bytes]]`
- **Rekurzió:** max 2 szint (zip-in-zip)
- **Szűrés:** `__MACOSX/*`, mappa bejegyzések kihagyva; basename-t ad vissza (nem teljes path)
- **Metadata:** `metadata["extracted_from_archive"] = "eredeti.zip"` minden kicsomagolt fájlnál

### Deno Edge Function (Mailgun webhook) — `process-mailgun-webhook/index.ts`

- **Library:** `npm:fflate@0.8.2` — Deno-compatible, 44KB, sync + async unzip API
- **Interface:** `ExpandedFile { name, bytes: Uint8Array, contentType, extractedFromArchive? }`
- **Helper:** `expandAttachments(filename, bytes) → Promise<ExpandedFile[]>`
- **Rekurzió:** max 2 szint
- **Storage upload:** `ef.bytes` (Uint8Array) direkt a Supabase storage `.upload()`-ba

### Közös szabályok mindkét pipeline-ban:

1. **Archív nem kerül be a DB-be** — csak a belső fájlok
2. **Idempotencia:** a belső fájl neve + Message-ID kombinációja alapján (nem az archív neve)
3. **Hibatűrés:** sérült archív → üres lista, pipeline folytatódik a többi csatolmánnyal
4. **Traceability:** `metadata.extracted_from_archive` + `notes[].extracted_from_archive` mező az archív nevével

## Alternatives Considered

### `jszip` Deno-ban

Elvetett. A `jszip` npm csomag Deno ESM-ben problémás (Node.js polyfill igény). Az `fflate` natívan ESM-kompatibilis, nincs Buffer/fs polyfill szükség.

### Python `zipfile` helyett `py7zr` (7zip support)

Elvetett. A 7zip formátum ritka email kontextusban. A `py7zr` pip dependency lenne. A stdlib `zipfile` + `tarfile` lefed minden releváns esetet (ZIP + TAR.GZ/TGZ).

### Csak IMAP-ban implementálni (Mailgun webhook kihagyása)

Elvetett. A két email forrás szimmetrikusan kell viselkedjen — ha IMAP-on bejön egy ZIP, a Mailgun alias-on ugyanúgy kell kezelni.

### Max rekurzió depth = 1 (nem zip-in-zip)

Elvetett. Valós esetben előfordul, hogy egy főarchívum belső mappáit is ZIP-ként csomagolják. 2 szint biztonságos kompromisszum (mélységi bomba védelem + valós igény lefedése).

## Consequences

**Pozitív:**
- Automatikus ZIP kezelés, nincs manuális kicsomagolás
- Nulla új Python dependency (stdlib)
- Traceability: minden kicsomagolt fájl tudja, melyik archívumból jött
- Unit tesztelve: 16 eset, valódi ZIP fixture-rel

**Negatív:**
- Csak `.zip`, `.tar.gz`, `.tgz` támogatott — `.rar`, `.7z` nem (elfogadható)
- Mélységi limit (2 szint) ritka esetekben nem elegendő — de védelmet ad mélységi bombák ellen
- Belső fájl neve közvetlen a DB-be kerül (basename) — névcütközés lehetséges azonos nevű fájloknál különböző mappákban (edge case, nem kritikus)

## Kapcsolódó

- [A-041: Mailgun Concurrent Dedup](./A-041-mailgun-concurrent-dedup.md) — idempotencia rétegek, amelyek a kicsomagolt fájlokra is vonatkoznak
- [A-005: Edge Functions](./A-005-edge-functions.md) — `process-mailgun-webhook` EF leírása
- [A-031: Mailgun Webhook](./A-031-mailgun-webhook-processing.md) — webhook feldolgozás általános architektúrája
