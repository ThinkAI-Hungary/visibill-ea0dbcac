# A-145: Tömeges PDF Szeletelés (Physical Chunk Slicing), NAV Determinisztikus Fallback és Többszörös Mellékletkezelés

**Státusz:** ✅ Elfogadva  
**Dátum:** 2026-09-24  
**Döntéshozó:** Antigravity Architect & User Approval (EB-0177)  
**Kapcsolódó Hibajegy:** EB-0177 (Kiss-Százi Emese / Ván Iroda Kft.)  
**Adatbázis Migrációk:**
- [`20260924000200_add_attachments_to_invoices.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260924000200_add_attachments_to_invoices.sql)

---

## 1. Architektúrális Háttér & Indoklás

Az EB-0177 hibajegy kapcsán feltárt rendszerműködés szerint az irodai kétoldalas és kötegelt lapadagolós szkennerekből származó összetett számlakötegek feldolgozása során három alapvető hiányosság jelentkezett:

1. **Egyetlen közös PDF URL kötegelt számláknál:**
   Amikor a `pdf_splitter` egy 20 oldalas kötegben 6 különálló számlát detektált, mind a 6 számlarekord ugyanarra az eredeti, 20 oldalas fájl URL-jére (`melleklet_url`) mutatott. A felhasználónak a felületen végig kellett lapoznia a 20 oldalt minden egyes számla megtekintésekor.
2. **Üres lapok bekerülése a számlaképbe:**
   Kétoldalas szkenneléskor a számlák hátoldalai (üres lapok) belekerültek a dokumentumokba, növelve a tárhely- és sávszélesség-használatot, valamint zavarva az olvashatóságot.
3. **OCR hibák miatti NAV párosítási elakadás:**
   Ha az OCR elolvasta a számlaszámot (pl. `1069` helyett `2026/106`), vagy fallback azonosítót generált (pl. `OCR-1ad4a169`), a rendszer nem talált NAV párt, annak ellenére, hogy a partner 8 jegyű törzsszáma, a bruttó végösszeg és a kibocsátási dátum 100%-os egyezéssel elérhető volt a NAV adatbázisban.
4. **Hiányzó mellékletstruktúra (munkalapok, szerződések, szállítólevelek):**
   A rendszer korábban számlánként csak egyetlen `image_url` és egyetlen `melleklet_url` mezőt támogatott, így a számlához csatolt kísérő dokumentumokat (pl. teljesítésigazolás, munkalap, szerződés) nem lehetett struktúráltan kezelni és váltogatni.

---

## 2. Rendszerdöntések (Decisions D-1, D-2, D-3, D-4)

### Decision D-1: Fizikai PDF Szeletelés és Üres Lapok Kiszűrése (`worker/pdf_splitter.py`)
- **PyMuPDF (`fitz`) szeletelő motor:** A kötegelt PDF feldolgozásakor a `_slice_pdf_bytes` függvény kivágja a chunkhoz tartozó oldalakat egy új, önálló PDF dokumentumba (tömörítve `deflate=True, garbage=3`).
- **Üres lap szűrés (`_is_page_blank`):** Ha egy lapon a whitespace és írásjelek eltávolítása után kevesebb mint 15 karakter található, és a chunk tartalmaz egyéb tartalmas oldalakat, az üres oldal automatikusan kimarad a szeletelt PDF-ből.

### Decision D-2: Szeletelt Chunkok Feltöltése és Egyedi Tárolása (`worker/worker.py`)
- Minden szeletelt PDF független fájlként feltöltésre kerül a Supabase Storage-ba:
  `invoice-uploads/{user_id}/{upload_id}-chunk-{chunk_index + 1}.pdf`
- Az `invoices` táblában a számlarekord `melleklet_url`-je közvetlenül erre a szeletelt, célzott PDF-re mutat.

### Decision D-3: Determinisztikus NAV Fallback Illesztés (`worker/db.py`)
- A `_check_nav_invoice_info()` eljárás kiegészült egy **Strategy 4** tartalék mechanizmussal:
  - Partner 8 számjegyű törzsszáma (eladói bejövő esetén, vevői kimenő esetén).
  - Megegyező devizanem (`currency`).
  - Bruttó végösszeg egyezése ($\pm 5$ HUF vagy $0.5\%$ tűréshatár).
  - Dátum ablak: $\pm 7$ nap a kibocsátási dátumhoz képest.
  - **Biztonsági invariáns:** Kizárólag akkor hajtódik végre az összerendelés, ha az adott cég NAV számlái között **pontosan 1 rekord** elégíti ki a feltételeket. Ekkor a hibás OCR számlaszám felülíródik a hivatalos NAV számlaszámra (`bizonylatsorszam`), és a státusz `nav_status = 'verified'` / `statusz = 'feldolgozott'`-ra vált.

### Decision D-4: Többszörös Mellékletkezelés és Előnézeti Lapozó
- **Adatbázis mező:** `invoices.attachments` JSONB oszlop (`DEFAULT '[]'::jsonb`).
- **Frontend típusok:** `InvoiceAttachment` interfész (`{ id, url, name, type, uploaded_at, size }`).
- **Előnézet & Lapozó (`FilePreviewModal`, `InvoiceImageDialog`, `InvoiceImagePreview`):**
  - Ha egy számlához több dokumentum (fő számlakép + munkalap/szerződés) tartozik, a felugró és beágyazott nézet füleket/gombokat biztosít a dokumentumok közötti gyors váltáshoz.
  - Az `InvoiceDetailPopup` fejlécében minden melléklet külön letöltési / megnyitási gombot kap.
- **Edge Function védelem:** A `get-invoice-image-url` Edge Function támogatja az `attachmentIndex` paramétert, így RLS és auth védelemmel generál aláírt URL-eket bármely melléklethez.

---

## 3. Érintett Rendszerkomponensek

1. **Python Worker:**
   - [`worker/pdf_splitter.py`](file:///d:/ThinkAI/Visibill/worker/pdf_splitter.py): `_slice_pdf_bytes`, `_is_page_blank`, `InvoiceChunk.pdf_bytes`.
   - [`worker/worker.py`](file:///d:/ThinkAI/Visibill/worker/worker.py): Storage feltöltés chunkonként.
   - [`worker/db.py`](file:///d:/ThinkAI/Visibill/worker/db.py): Strategy 4 fallback és adószám-szeletelési javítás.
   - [`worker/test/unit_test/test_pdf_splitter_and_nav_fallback_eb0177.py`](file:///d:/ThinkAI/Visibill/worker/test/unit_test/test_pdf_splitter_and_nav_fallback_eb0177.py): 4/4 sikeres unit teszt.
2. **Supabase & Adatbázis:**
   - [`supabase/migrations/20260924000200_add_attachments_to_invoices.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260924000200_add_attachments_to_invoices.sql)
   - [`supabase/functions/get-invoice-image-url/index.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/get-invoice-image-url/index.ts)
3. **Frontend Alkalmazás (`eaisybill-prod`):**
   - [`src/types/invoices.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/types/invoices.ts): `InvoiceAttachment`, `BaseInvoice.attachments`, `SimaInvoice.attachments`.
   - [`src/integrations/supabase/types.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/integrations/supabase/types.ts): `invoices.Row/Insert/Update.attachments`.
   - [`src/components/ui/FilePreviewModal.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ui/FilePreviewModal.tsx): Több fájl lapozó/fül mechanizmus.
   - [`src/components/InvoiceImageDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImageDialog.tsx): Többszörös melléklet támogatás.
   - [`src/components/InvoiceImagePreview.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImagePreview.tsx): Beágyazott előnézeti fülváltó.
   - [`src/components/InvoiceDetailPopup.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx): Részletes számla modal fejléc mellékletgombokkal.
   - [`src/hooks/useInvoiceData.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceData.ts): `attachments` oszlop lekérése.
   - [`src/features/invoices/components/table/SubmittedInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx) & [`NavInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx).

---

## 4. Verifikáció & Minőségbiztosítás

- **Worker Unit Tesztek:** A `pytest test_pdf_splitter_and_nav_fallback_eb0177.py` lefutott:
  - `test_is_page_blank`: PASSED
  - `test_slice_pdf_bytes`: PASSED
  - `test_build_split_result_with_pdf_bytes_and_blank_filtering`: PASSED
  - `test_nav_crosscheck_fallback_strategy_4`: PASSED
- **Élő Adatbázis Tesztelés:** A Ván Iroda Kft. EB-0177 alá tartozó 6 számlája sikeresen javítva a NAV Online Számla adatai alapján (`statusz = 'feldolgozott'`, `nav_status = 'verified'`).
- **Frontend Build:** Az `npm run build` sikeresen lefutott 0 hibával és 0 figyelmeztetéssel.
