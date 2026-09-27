# Session Summary — 2026-09-27 15:10

```text
feat(dedup, worker, webhook, db): Tartalmi SHA-256 hash deduplikáció, gpt-4o-mini Vision OCR váltás, image001.pdf szűrés és részleges indexek

- LLM Költségkiugrás és Root Cause Elemzés (eaisybill-prod)
  - 2026-09-27 hajnalban fellépő ~$50 LLM költségkiugrás mélyelemzése és megszüntetése
  - Gyökérok: A Mauroni Events Kft. részére érkező, továbbított email láncokban (Fwd:...) szereplő azonos tartalmú szkennelt PDF mellékletek minden levélben új RFC Message-ID-t kaptak, kikerülve a korábbi üzenet-szintű idempotenciát
  - A fallback OCR réteg az 50-100 oldalas tender PDF-eket és több tucatnyi `image001.pdf` szemétfájlt oldalanként gpt-4o Vision hívásokkal dolgozta fel
  - Azonnali biztonsági intézkedés: az összes droplet környezetben (.env.prod, .env.vsweb, .env.thinkerman) és a worker config.py-ban az `OCR_VISION_MODEL` átállítva `gpt-4o-mini`-re (~95%-os tokenköltség megtakarítás)

- Adatbázis Részleges B-Tree Indexek és Migráció (20260927140000)
  - Követelmény: A duplikált fájlok ne logoljanak Postgres hibát a szervernaplóba és ne generáljanak 23505 unique_violation kivételt
  - Megoldás: Nem UNIQUE, hanem gyors feltételes részleges B-Tree indexek létrehozása a `(company_id, ((metadata ->> 'sha256')))` oszlopokon
  - Érintett táblák: `invoice_uploads`, `transaction_uploads`, `report_uploads`
  - Migrációs fájl: `supabase/migrations/20260927140000_add_sha256_upload_dedup_indexes.sql`
  - Éles adatbázis igazolás: az indexek élnek és aktívak a PostgreSQL katalógusban, a verzió rögzítve a `schema_migrations` táblában

- IMAP Szinkronizációs Pipeline Deduplikáció és Szűrés (`imap_sync_pipeline.py`)
  - Szemétfájl szűrés: az `image001.pdf` és beágyazott email képek (`image\d+`) azonnali elutasítása az `is_valid_attachment()`-ben
  - Tartalmi hash kalkuláció: csatolmányonkénti SHA-256 generálás natív Python `hashlib` segítségével
  - `is_attachment_duplicate()` függvény: cross-table ellenőrzés cégenként mindhárom feltöltési táblán (`metadata->>sha256`)
  - 14 napos fallback: régebbi, még hash nélküli rekordok védelme `file_name` és `file_size` alapján
  - Retry & Fallback védelem (A-035): explicit `.neq("processing_status", "error")` és `.neq("upload_status", "failed")` szűrés, így a sikertelen feldolgozású fájlok újrapróbálkozása és pipeline fallbackje sosem akad el
  - Csendes kihagyás: duplikáció esetén a fájl Storage feltöltés és DB insert nélkül kimarad, az email `\Seen` jelölést kap, így a Management Dashboard hibakártyája teljesen tiszta marad

- Mailgun Webhook Edge Function Deduplikáció (`process-mailgun-webhook/index.ts`)
  - `isValidInvoiceAttachment()`: `image001.pdf` kiszűrése az ajtóban
  - `computeSha256()`: W3C Web Crypto API (`crypto.subtle.digest`) alapú aszinkron hash számítás
  - `isSha256Duplicate()`: cross-table indexelt lekérdezés + 14 napos név+méret fallback + hibás rekordok kizárása a dedupból
  - Az `"sha256": fileHash` mező perzisztálása az `emailMetadata` JSONB objektumban mind a közvetlen multipart, mind a body-mime fallback ágon
  - Éles Edge Function frissítés: sikeresen kitelepítve a Supabase-re (`v229`, ACTIVE)

- Minőségbiztosítás, Verifikáció és Git Szinkronizáció
  - `/morfi-implementation-review` mélyaudit lefolytatva és jóváhagyva
  - Worker unit tesztek: `test_imap_sync.py` (50/50 passed), teljes gyors tesztcsomag `python run_tests.py` (101/101 passed)
  - Frontend ellenőrzés: `npx tsc --noEmit` 0 hiba, `npm run build` tiszta (19.79s)
  - Worker repo push: `c62f55a` az `origin/main` ágra (GitHub Actions CI/CD auto-deploy)
  - Eaisybill-prod repo push: `f6307e14` az `origin/main` ágra
```
