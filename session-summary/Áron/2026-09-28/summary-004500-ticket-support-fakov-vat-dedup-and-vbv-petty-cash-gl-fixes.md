# Session Summary — 2026-09-28 00:45

```text
fix(support, vat, petty-cash, journals): Fakov Kft. B2C ÁFA analitika duplikáció és partnernév feloldás, VBV Vision Kft. házipénztár napló-kontírozás és tömeges főkönyvi átsorolás

- Ticket Support & Adatbázis Hibajavítás — Tóth-Csepregi Judit (Fakov Kft.)
  - Ügyfélprobléma: Nettó 311 000 Ft-os tétel kétszeresen jelent meg az ÁFA analitikában, a partnernév pedig hiányzott („Ismeretlen vevő” / `—`).
  - Gyökérok elemzés:
    - A kimenő számla magánszemély vevőnek (Tinyei Lászlóné) készült a NAV Online Számlázóban (`FAKOV-2026-33`), ahol a hatályos GDPR és adójogi szabályok miatt a NAV API anonimizálja a vevő adatait (`customer_name: null`).
    - A cég feltöltötte a számla PDF másolatát (`CCI_000611.pdf`), de a DeepSeek OCR nem tudta kiolvasni a fejlécből a sorszámot, így fallback azonosítót rendelt hozzá (`OCR-1da739b4`).
    - A `VatCollectorAnalyticsView.tsx` normalizált bizonylatszám alapján deduplikál, emiatt mindkét számlát különálló tételként jelenítette meg az analitika (5 bizonylat, 1 767 000 Ft adóalap 1 456 000 Ft helyett, duplázódó 311 000 Ft-os tétel).
    - A 2665-ös ÁFA bevallás 07-es sorának részletezőjében (`VatRowDrillDown.tsx`) a partner oszlop `—` maradt a számlaszám-eltérés miatt.
  - Végrehajtott javítás és adatbázis szinkronizáció:
    - `public.invoices`: `bizonylatsorszam = 'FAKOV-2026-33'`, `nav_status = 'verified'`, `statusz = 'feldolgozott'`, `approved_at = NOW()`, `approved_by = '7dfb224d-ff26-4f9b-af21-767556a363d6'`.
    - Triggerek aktiválása: a `mark_nav_invoice_as_submitted` és `trg_sync_submitted_invoice_on_bizonylat_change` automatikusan szinkronizálta a státuszokat.
    - `public.nav_invoices`: `customer_name = 'Tinyei Lászlóné'`, `customer_address = '7025 Bölcske, Paksi utca 59, Magyarország'`, `submitted = true`.
    - `public.nav_invoice_items`: `vat_code = 'KIM_27'`, `vat_code_id = 'fb84454f-3fe9-4dcf-9c9a-4a6742f200ba'`, `is_vat_code_manual = true`.
  - Evidence Gate & Validáció:
    - Az önálló/duplikált bizonylatok száma 0-ra csökkent, a 25-ös gyűjtőkódban a valós 4 db számla szerepel (1 456 000 Ft adóalap, 393 120 Ft ÁFA — fillérre megegyezik a 2665-ös 07-es sorral).
    - Tinyei Lászlóné neve mind az analitikában, mind a 2665-ös részletezőben pontosan megjelenik.
    - Ügyfélszolgálati tájékoztató levél megfogalmazása közvetlen, tegeződő hangnemben Judit részére.

- Ticket Support & Házipénztár Kontírozás — Kiss-Százi Emese (VBV Vision Kft., EB-0190)
  - Ügyfélprobléma: Kiküldetések és napidíjak téves főkönyvi számra kerültek (529 helyett 526), hiányzott a tömeges kontírozás lehetősége a Naplók felületen, nem látszott a kontírszám a listanézetben, valamint a pénztárból kifizetett átutalásos számlák költségre könyvelődtek a 4541-es szállítói kiegyenlítés helyett.
  - Végrehajtott javítások:
    - Adatbázis korrekció: A VBV Vision Kft. márciusi pénztári naplósoraiban (`acc_journal_lines`) a 4 érintett tételt 529-ről 4541-re módosítottuk (`3270814e-a1cb-4f79-9388-d99b598cf4cd`), a `petty_cash_entries` rekordokban összerendeltük a számla azonosítókat (`source_type = 'invoice_settlement'`, `source_table = 'invoices'`).
    - Intelligens fallback generálás (`draftFallbackGenerator.ts`): Kiküldetés és napidíj kulcsszavak (`kiküldetés`, `kikuldet`, `napidíj`) automatikus 526-os besorolása; a leírásban szereplő számlaszámok automatikus regex feloldása és 4541-es szállítói kiegyenlítésként való kontírozása.
    - Naplók felület ergonómia (`JournalsPage.tsx`): Új `Kontír (T / K)` oszlop a naplólistában vizuális T/K badge-ekkel (nem szükséges belépni a tételbe a kontír megtekintéséhez); új `Tömeges kontírozás` funkció modal ablakkal a kijelölt tételek egyidejű átkönyvelésére.
  - Minőségbiztosítás: Új egységtesztek hozzáadása (`draftFallbackGeneratorPettyCash.test.ts`), 2/2 sikeres teszt.

- Számlaillesztési és Normalizálási Finomhangolás (`invoiceMatchingUtils.ts`)
  - Számlaszám illesztés bővítése (`cleanNum`): prefix tisztítás (`SZA-`, `SZL-`, `DIJ-`) a NAV és feltöltött bizonylatok robusztusabb párosításához.
  - B2C kimenő számlák adószámnélküli javaslati logikájának feltárása és architektúra javaslat kidolgozása.

- Minőségbiztosítás, Típusellenőrzés & Build
  - TypeScript fordítás: `npx tsc --noEmit` hibamentes (code 0).
  - Vitest tesztcsomag: 122 tesztfájl és 1266 teszt sikeres lefutása.
```
