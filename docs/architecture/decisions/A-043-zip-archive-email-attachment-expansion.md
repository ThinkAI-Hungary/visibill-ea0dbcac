# A-043: ZIP / RAR / 7z Archívum Csatolmány Kicsomagolás és Body-MIME Parsing az Email Pipeline-ban

**Status:** Decided  
**Date:** 2026-07-21  
**Utoljára frissítve:** 2026-07-22

## Context

A Visibill két email pipeline-on fogad számla- és dokumentum-csatolmányokat:
1. **IMAP sync** (`imap_sync_pipeline.py`) — cégek saját postaládáiból
2. **Mailgun webhook** (`process-mailgun-webhook/index.ts`) — email alias-on beérkező levelekből

A könyvelők és partnerek gyakran ZIP, RAR vagy 7z archívumba csomagolva küldik a számlákat (pl. havi számlaköteg, scannelt dokumentumok). Emellett a Mailgun webhook továbbított levelek esetén (pl. forwarding egy könyvelési címre) gyakran `application/x-www-form-urlencoded` formátumban küldi az adatokat, ahol a csatolmányok nem direkt `File` objektumként, hanem a `body-mime` RFC822 törzsbe ágyazva érkeznek.

## Decision

**Mindkét email pipeline-ban teljeskörű archívum- és MIME-törzs kezelést vezetünk be**, amely felbontja a csomagolt számlákat és kibontja az beágyazott csatolmányokat.

### 1. Deno Edge Function (Mailgun webhook) — `process-mailgun-webhook/index.ts`

- **ZIP formátum:** Helyben kicsomagolás `npm:fflate@0.8.2` segítségével (in-place expansion).
- **Késleltetett archívumok (.rar, .7z, .tar.gz, .tgz):** Mivel a Deno környezetben a RAR/7z binárisok nehezen futtathatók, a webhook feltölti az archívumot a storage-ba `is_deferred_archive: true` metadata flag-gel, átadva a kicsomagolást a Python Workernek.
- **`body-mime` RFC822 fallback (`npm:postal-mime@2.4.1`):** Ha `attachmentCount > 0`, de a webhookban nem érkeztek direkt `File` objektumok (pl. url-encoded forwarded email), a webhook leparszolja a nyers `body-mime` MIME struktúrát a `postal-mime` könyvtárral, kibontja a beágyazott csatolmányokat, és végigviszi azokat a normál feldolgozási láncon.
- **Path sanitization:** Belső fájlneveknél szűri a Windows backslash (`\`) és Unix slash (`/`) elválasztókat.

### 2. Python Worker (IMAP & Deferred Archives) — `imap_sync_pipeline.py` & `archive_expander.py`

- **Formátumok:** `.zip`, `.tar.gz`, `.tgz`, `.rar` (via `rarfile`), `.7z` (via `py7zr` + temp directory pattern).
- **IMAP pipeline:** Az `extract_compressed_files()` közvetlenül kicsomagolja az archívumokat 2 szint mélységig.
- **Deferred archive expander (`archive_expander.py`):** Új modul, amely a worker mindhárom pipeline handlerében (`process_single_job`, `process_transaction_job`, `process_report_job`) elfogja az `is_deferred_archive: true` rekordokat:
  1. Letölti az archívumot Supabase Storage-ból.
  2. Kicsomagolja a belső fájlokat (`extract_compressed_files()`).
  3. Besorolja az egyes fájlokat (`classify_attachment()`).
  4. Feltölti őket Storage-ba és új upload rekordokat hoz létre (`invoice_uploads`, `transaction_uploads`, `report_uploads`), melyek DB trigger-en keresztül PGMQ job-ot generálnak.
  5. Az eredeti archívum rekordot `completed` / `expanded` státuszra állítja.

### Közös szabályok mindkét pipeline-ban:

1. **Rekurzió limit:** Max 2 szint (zip-in-zip / rar-in-7z).
2. **Idempotencia:** A belső fájl neve + Message-ID kombinációja alapján.
3. **Hibatűrés:** Sérült archívum → `app_error_logs` figyelmeztetés / status=`error`, a pipeline nem omlik össze.
4. **Traceability:** `metadata.extracted_from_archive` / `metadata.extracted_from_body_mime` mezők a beazonosíthatóságért.

## Consequences

**Pozitív:**
- Teljeskörű archívum támogatás (.zip, .rar, .7z, .tar.gz, .tgz) mindkét email útvonalon.
- A továbbított emails (forwarded emails body-mime) csatolmányai is automatikusan beérkeznek.
- Tiszta architektúra: Deno végzi a könnyű feladatokat, Python Worker a komplex dekódolást.
- Unit tesztelt: 17 teszt a Worker kicsomagoló moduljára.

**Negatív:**
- A `.rar` és `.7z` kicsomagolás a Workerben aszinkron történik (rövid késleltetés a Mailgun beérkezés és az belső számlák feldolgozása között).
- `py7zr` és `rarfile` függőségek hozzáadva a Worker Docker image-hez.

## Kapcsolódó

- [A-011: Mailgun email processing pipeline](./A-011-email-processing.md)
- [A-031: Mailgun Webhook Robustness](./A-031-mailgun-webhook-robustness.md)
- [A-041: Mailgun Webhook Concurrent Dedup](./A-041-mailgun-concurrent-dedup.md)
- [Worker Architecture Documentation](../../../worker/docs/ARCHITECTURE.md)

