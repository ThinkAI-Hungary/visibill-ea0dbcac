# A-162: Mailgun & IMAP Csatolmány Szűrési Szinkronizáció és Body-MIME Hardening

**Status:** Decided  
**Date:** 2026-09-27  
**Utoljára frissítve:** 2026-09-27

## Context

Az eaisybill rendszerbe két független csatornán érkezhetnek bejövő e-mailes dokumentumok:
1. **Mailgun Webhook (`process-mailgun-webhook/index.ts`):** Push-alapú bejövő levélkezelés Mailgun route-okon keresztül.
2. **Worker IMAP Pipeline (`imap_sync_pipeline.py`):** Pull-alapú időszakos szinkronizáció az ügyfelek beállított IMAP fiókjaiból.

A korábbi működésben aszimmetria és technikai adósság állt fenn:
- **Szűrési aszimmetria:** A Mailgun webhook részletes szűrést alkalmazott (1 KB minimális fájlméret, 100 KB alatti képek kiszűrése e-mail aláírások/logók miatt, angol és magyar kulcsszavak pl. `logo`, `signature`, `aláírás`, `fejléc`, valamint inline kép minták `image001.png`, `attachment-1.png`). Ezzel szemben az IMAP worker a kiterjesztésen kívül semmilyen méret- vagy kulcsszószűrést nem végzett, így az ügyfelek IMAP-on érkező leveleiből a pár kilobájtos céges logók és közösségi ikonok is bekerültek az `invoice_uploads` táblába és leterhelték az OCR/LLM folyamatokat.
- **Mailgun Body-MIME runtime hibák:** A `process-mailgun-webhook/index.ts` RFC822 `body-mime` fallback feldolgozó blokkja nem létező segédfüggvényeket hívott (`getClassificationReason`, `detectReportType`), az `isValidInvoiceAttachment` szignatúrája kizárólag `File` objektumot fogadott el (míg a bufferből kibontott csatolmányoknál string és byte adatok álltak rendelkezésre), továbbá hiányzott a párhuzamos idempotencia ellenőrzés és a 23505 Unique Violation lekezelése.

## Decision

1. **Egységes Csatolmány Szűrő Motor az IMAP Pipeline-ban:**
   - A `worker/imap_sync_pipeline.py` modulba beépítésre került az `is_valid_attachment(filename, file_bytes, log)` ellenőrzés:
     - 1 KB alatti fájlok automatikus eldobása.
     - 100 KB alatti képek (`.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`) kiszűrése (aláírások, bannerek kiszűrése; a valós fotózott/szkennelt számlák tipikusan >150-250 KB méretűek).
     - Angol és magyar junk kulcsszavak tiltása (pl. `logo`, `signature`, `banner`, `aláírás`, `alairas`, `fejléc`, `fejlec`, `szórólap`, `szorolap`, `hirdetés`, `plakát`).
     - Inline képminták szűrése (`image001.png`, `attachment-1.png`).
     - A valódi dokumentumok (pl. `attachment-1.pdf`, `attachment-2.xlsx`) megőrzése.
   - A szűrés közvetlenül a mellékletek kinyerésekor és a kicsomagolt archívumok (`.zip`, `.tar.gz`, `.7z`) elemeire is érvényesül.
   - Az IMAP pipeline-ban elhalasztottuk a `has_attachments = True` jelölőt: ha egy levél kizárólag kiszűrt szemetet (pl. 30 KB-os aláírás logót) tartalmaz, a levél olvasottnak jelölődik, de nem jön létre felesleges üres `invoice_uploads` bejegyzés.

2. **Mailgun Webhook Body-MIME Hardening:**
   - Az `isValidInvoiceAttachment` függvény túlterhelt szignatúrát kapott: támogatja a hagyományos `File` objektumot és a közvetlen `(name: string, size: number, type?: string)` paraméterezést is.
   - A `body-mime` feldolgozó ciklus a korábbi elavult hívások helyett a modern `classifyAttachment` struktúrált visszatérési értékeit (`suggestedType`, `isReport`, `isBankStatement`, `reason`) használja.
   - Beépítésre került a többcsatornás feltöltési táblákra kiterjedő `messageId` idempotencia ellenőrzés és az `isUniqueViolation` hibaelfedés.

3. **Unit Teszt Védelem:**
   - A `worker/test/unit_test/test_imap_sync.py` tesztkészlet kibővült a `TestAttachmentValidation` osztállyal (10 új teszteset, 100% lefedettség a szűrési ágakra).

4. **IMAP Payload Séma Konzisztencia és 23502 Null Constraint Védelem:**
   - Az IMAP pipeline feltöltési logikájában (`imap_sync_pipeline.py`) az `insert_payload` korábban nem tartalmazta a `file_type` és `upload_status` mezőket.
   - Mivel az `invoice_uploads` táblában a `file_type TEXT NOT NULL` megszorítással jött létre, minden beérkező IMAP melléklet Postgres `23502 (null value in column "file_type" violates not-null constraint)` hibát generált.
   - Beépítésre került a számított `content_type` (`mimetypes.guess_type`) átadása `file_type`-ként, valamint az explicit `"upload_status": "uploaded"`. Így mindkét bejövő csatorna garantáltan kitölti a kötelező oszlopokat.

## Consequences

**Pozitív:**
- **Zéró szemét-feltöltés:** Megszűnik a mikro-méretű aláírásképek, céges logók és szórólapok beáramlása az IMAP csatornán.
- **Költség- és terheléscsökkentés:** Jelentős megtakarítás az OCR (Vision / MarkItDown) és LLM költségeken, mivel az érdemtelen csatolmányok nem kerülnek feldolgozási sorba.
- **Nincs runtime crash:** A Mailgun `body-mime` fallback ága stabilan lefut elgépelt / nem létező függvényhívások nélkül.
- **Konzisztencia:** Mindkét bejövő e-mail feldolgozó csatorna azonos üzleti szabályok mentén szűri a fájlokat.

**Negatív / Kockázat:**
- Ha egy felhasználó rendkívül kisméretű, 100 KB alatti szkennelt képet küld (extrém ritka, rossz minőségű bélyegző méretű kép), a rendszer aláírásképnek minősítheti. (PDF formátumra a 100 KB-os korlát nem vonatkozik, csak a képformátumokra).

## Kapcsolódó
- [A-011: Mailgun email processing](./A-011-email-processing.md)
- [A-031: Mailgun Webhook Robustness](./A-031-mailgun-webhook-robustness.md)
- [A-041: Mailgun Webhook Concurrent Dedup — Háromrétegű Idempotency](./A-041-mailgun-concurrent-dedup.md)
- [A-043: ZIP / RAR / 7z Archívum Csatolmány Kicsomagolás és Body-MIME Parsing](./A-043-zip-archive-email-attachment-expansion.md)
- [A-052: Multi-Profile IMAP/SMTP Levelező Fiókok és Vault Integráció](./A-052-multi-profile-email-accounts-vault-integration.md)
