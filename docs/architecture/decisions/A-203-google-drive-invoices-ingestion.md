# A-203: Google Drive Automatikus Számlabegyűjtő Rendszer és Dinamikus MIME Kezelés

**Status:** Decided  
**Date:** 2026-10-06  
**Category:** Architecture / Ingestion / Google Drive / Customer API / Multi-Tenancy  
**Érintett komponensek:** `supabase/functions/customer-api/index.ts`, `scripts/gdrive-sync/VisibillGoogleDriveSync.js`, `scripts/gdrive-sync/README.md`  
**Kapcsolódó döntések:** [A-101: Közvetlen Szkript-Automatizációk Letiltása](./A-101-direct-script-automation-restriction.md), [A-117: Hivatalos Ügyfél REST API v2.2.2](./A-117-customer-rest-api-and-multi-company-keys.md), [A-023: Upload Dedup Védelem](./A-023-upload-dedup-protection.md), [A-004: PGMQ Queue](./A-004-pgmq-queue.md)

---

## Context

Ügyfeleink és könyvelő partnereink részéről igényként merült fel, hogy a beérkező számlákat (szállítói PDF-eket, fotózott bizonylatokat) ne csak a webes felületen vagy email csatolmányként lehessen feltölteni, hanem egy megosztott **Google Drive** mappába bedobva, automatikusan begyűjtve jussanak el a Visibill feldolgozó motorjához.

Az [A-101](./A-101-direct-script-automation-restriction.md) döntés értelmében a közvetlen, böngészős JWT tokenekkel történő scriptelés (`public.check_request` és `checkAutomationShield`) szigorúan tiltott. A külső rendszerek kizárólag a hivatalos, API kulccsal hitelesített [Customer REST API-n (A-117)](./A-117-customer-rest-api-and-multi-company-keys.md) keresztül kapcsolódhatnak.

---

## Decision

### 1. Zéró-Szerverköltségű Google Apps Script (GAS) Begyűjtő Motor
Ahelyett, hogy dedikált szerveren futó crontabot vagy Python daemont üzemeltetnénk külső gépen, a Google saját felhős futtatókörnyezetét (**Google Apps Script**) használjuk:
- **Helyszín:** `scripts/gdrive-sync/VisibillGoogleDriveSync.js`
- **Működés:** Beépített 5 perces Time-driven triggerrel fut a Google szerverein, zéró üzemeltetési költséggel és 100%-os rendelkezésre állással.
- **Hitelesítés:** A Visibill Customer REST API-val kommunikál (`Authorization: Bearer vb_<key>`).

### 2. Többcéges (Multi-Tenancy) Automatikus Mappafolyamat
Egyetlen Google Drive gyökérmappában cégenkénti almappák alakíthatók ki (pl. könyvelőirodák számára):
1. A script lefutáskor lekéri az API kulcshoz elérhető cégek listáját (`GET /v1/companies`).
2. A cégmappák nevéből automatikusan feloldja a célcéget az **adószám** (8 jegyű törzsszám vagy teljes adószám) vagy a **cégnév** alapján.
3. Minden cégmappán belül kezeli a kötelező almappákat:
   - `Bejövő/` (vagy `Inbox`): A felhasználó ide tölti fel a számlákat.
   - `Feldolgozva/ÉÉÉÉ-HH/`: Sikeres feltöltés után a rendszer ide mozgatja a fájlokat.
   - `Hibás/`: Hiba esetén ide kerülnek az elutasított fájlok.

### 3. Dinamikus Kép és PDF MIME Típus Felismerés (`customer-api`)
A `customer-api/index.ts` korábbi megvalósítása hardkódolva `contentType: "application/pdf"` beállítással mentette a fájlokat. Ezt kibővítettük:
- Új `detectInvoiceMimeType(fileName, explicitType)` segédfüggvény.
- Támogatott képtípusok: `image/jpeg` (`.jpg, .jpeg`), `image/png` (`.png`), `image/webp` (`.webp`), `image/tiff` (`.tif, .tiff`), valamint `application/pdf`.
- A Supabase Storage `invoice-uploads` bucketbe és az `invoice_uploads.file_type` mezőbe mostantól a valós, felismert MIME típus kerül mentésre, lehetővé téve a mobiltelefonnal fotózott számlák zökkenőmentes feldolgozását is.

### 4. Idempotencia és Duplikáció-Védelem
- **Drive szinten:** A sikeres API válasz után a fájl azonnal átkerül a `Feldolgozva` mappába, megelőzve az újra-beküldést.
- **API szinten:** A script minden fájlhoz egyedi `Idempotency-Key` fejlécet küld (`gdrive_<fileId>_<timestamp>`), amelyet a Customer REST API az `api_idempotency_keys` táblában ellenőriz ([A-117](./A-117-customer-rest-api-and-multi-company-keys.md)).
- **Adatbázis szinten:** Az [A-023](./A-023-upload-dedup-protection.md) SHA-256 hash indexe és a trigger dedup safety net megvédi a rendszert a redundáns feldolgozástól.

### 5. Multi-Project Útválasztás (Visibill PROD vs. Thinkerman Sharding)
A rendszer támogatja az izolált adatbázis-példányok közötti intelligens szétosztást:
- A Google Drive gyökérmappában közvetlenül elhelyezett cégmappák a **Visibill PROD** adatbázisba kerülnek (`vxxgvdlqvvchtlmqnrqf`, 84 cég, `visibill-worker-prod`).
- A gyökérmappán belüli **`Thinkerman`** nevű gyűjtőmappába helyezett cégmappák a **Thinkerman Supabase** adatbázisba kerülnek (`zgnukiocrnfnlwkbcssi`, 5 cég, `visibill-worker-thinkerman`).
- Mindkét projekt saját dedikált `customer-api` Edge Functionnel és Master API kulccsal rendelkezik, így a feldolgozásuk és PGMQ soraik teljesen függetlenek maradnak.

### 6. Fantom Számlák Megszüntetése és Teljes Folyamat-Azonosság a Kézi Feltöltéssel (Scenario 3)
A korábbi megvalósításban, ha egy számla külső API-n vagy Google Drive-on keresztül érkezett ismeretlen bizonylatszámmal (Scenario 3: unlinked upload), az Edge Function azonnal beszúrt egy ideiglenes, üres rekordot az `invoices` táblába (`bizonylatsorszam: 'UPLOAD-xxxxxx'`, `brutto_vegosszeg: 0`, `statusz: 'feldolgozas_alatt'`). Ez a felületen és az analitikákban fantom sorokat és duplikációkat eredményezett.
- **Új működés:** A Google Drive / API feltöltés mostantól 100%-ban megegyezik a webes felület kézi feltöltési folyamatával (`executeBatchUpload`):
  1. A fájl a Supabase Storage-ba kerül (`invoice-uploads`).
  2. Kizárólag az `invoice_uploads` táblába szúrunk be rekordot (`processing_status: 'pending'`).
  3. Semmilyen előzetes rekord nem jön létre az `invoices` táblában.
  4. Az adatbázis beépített `trg_enqueue_invoice` BEFORE INSERT triggere azonnal feladja a feladatot a `pgmq.q_invoice_jobs` üzenetsorba.
  5. A háttér-worker dolgozza fel a sort: elvégzi az OCR-t, LLM kinyerést, partnerpárosítást, és egyetlen atomi lépésben rögzíti a valós számlát és tételsorait az `invoices` és `invoice_items` táblákba, `invoice_uploads_id` idegen kulccsal visszacsatolva az eredeti feltöltéshez.

### 7. Szkennelt Duplex PDF Üres Oldal Kezelés és Sorszám-Védelem (Worker)
A valós ügyfélfájlok tesztelése során az alábbi két kritikus worker hibát javítottuk:
- **Kétoldalas (duplex) szkennelés üres oldalainak kezelése (`ocr_markitdown.py`):** Szkennelt PDF-eknél az üres hátoldalak (pl. 2., 4., 6. oldal) miatt az OpenAI Vision modell elutasító választ adott (*"I'm unable to assist with that."*). Mivel az elutasítás vizsgálata a teljes összefűzött szövegre futott, egyetlen üres oldal az egész 8 oldalas dokumentum szövegének eldobását okozta. Megoldás: `is_image_blank(pix)` segítségével a teljesen fehér lapokat a worker azonnal átugorja, a Vision hívások elutasításait pedig oldalanként szűri.
- **Sorszám prefixek (`SZ/`, `SZ-`) levágásának tiltása (`models.py` & Prompts):** A `clean_szamlaszam` korábbi reguláris kifejezése az `SZ/` kezdetű számlaszámoknál (pl. `SZ/2026/000325`) az `SZ` betűket a "Számla" szó rövidítésének vélte és levágta, így `/2026/000325` került mentésre. A tisztító logikát szigorítottuk (csak a valós címkéket vágja le), beépítettünk egy biztonsági prefix-helyreállítót vezető perjel esetére, és az összes számla extraction promptba (`sima_szamla.md`, `vegszamla.md`, `dijbekero_proforma.md`, `egyszerusitett_szamla.md`) beépítettük a prefix-megőrzési invariánst.

---

## Consequences

### Pozitív:
- **Zéró fantom rekord:** Nincsenek többé `UPLOAD-xxxxxx` 0 Ft-os ideiglenes sorok az `invoices` táblában; a számlák kizárólag sikeres worker feldolgozás után jelennek meg valós adatokkal.
- **Tökéletes folyamat-ekvivalencia:** A Google Drive-ról, emailből és böngészőből feltöltött számlák pontosan ugyanazon a PGMQ $\rightarrow$ Worker pipeline-on haladnak át.
- **Zéró szerverinfrastruktúra:** Nem kell új szervert vagy szolgáltatást fenntartani és fizetni.
- **Robusztus duplex szkenner támogatás:** Az üres hátoldalak nem okoznak OCR adatvesztést.
- **Pontos bizonylatszámok:** Az `SZ/` és egyéb perjelet vagy kötőjelet tartalmazó bizonylatszámok csonkítás nélkül kerülnek mentésre.
- **Rendkívül gyors bevezetés:** Egy könyvelő vagy ügyfél 10 perc alatt beállíthatja a leírás alapján.
- **Teljes biztonság:** Az A-101 védelmi reteszek és az A-003 multi-tenancy RLS garanciák 100%-ban érvényesülnek.
- **Mobil fotók támogatása:** A dinamikus MIME kezelés révén képi számlák is biztonságosan feldolgozhatók.

### Kötöttségek:
- A Google Apps Script egy futása maximum 6 percig tarthat; ezt a script egy futásonkénti 30 fájlos kötegkorláttal kezeli (a következő 5 perces ciklusban folytatja a többi fájllal).

---

## Kapcsolódó
- [A-101: Közvetlen Szkript-Automatizációk Letiltása](./A-101-direct-script-automation-restriction.md)
- [A-117: Hivatalos Ügyfél REST API v2.2.2](./A-117-customer-rest-api-and-multi-company-keys.md)
- [A-023: Upload Dedup Védelem](./A-023-upload-dedup-protection.md)
- [scripts/gdrive-sync/VisibillGoogleDriveSync.js](../../../scripts/gdrive-sync/VisibillGoogleDriveSync.js)
- [scripts/gdrive-sync/README.md](../../../scripts/gdrive-sync/README.md)
