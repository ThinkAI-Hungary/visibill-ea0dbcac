# A-126: Audit Trail Email Ingestion Metadata & Retrospective Invoice Linking

**Status:** Decided  
**Date:** 2026-09-18  
**Author:** Pair Programming Agent & Morfi  
**Supercedes/Extends:** [A-045](./A-045-audit-trigger-email-alias-service-role-bypass.md), [A-033](./A-033-exclude-service-role-from-audit.md), [A-020](./A-020-auth-trigger-chain-incident.md)

---

## Context

A felhasználók és könyvelők számára a Műveleti Napló (`ActivityLogSheet`) a központi felület az események (feltöltések, feldolgozások, törlések) nyomon követésére.
A bejövő számlák és bizonylatok jelentős része email-alapon (Mailgun webhook által vezérelve) érkezik az `invoice_uploads`, `transaction_uploads` vagy `report_uploads` táblákba.

Bár az [A-045](./A-045-audit-trigger-email-alias-service-role-bypass.md) engedélyezte az `email_alias` feltöltések auditálását `service_role` alatt, az alábbi hiányosságok álltak fenn:
1. **Elvesző metaadatok az audit triggerben:** A trigger funkció (`global_audit_trigger_func`) csak egy minimális `{"upload_source": "email_alias"}` mezőt írt az `audit_logs.details`-be. A feladó (`sender`), a tárgy (`subject`), a fogadás ideje (`received_at`) és az `upload_id` nem került átmásolásra.
2. **Feldolgozás (processed) hiánya a worker felől:** Amikor a Python worker befejezi a számla OCR/AI feldolgozását és `invoice_uploads.processing_status = 'processed'` státuszra állítja a rekordot, az `service_role` hívásként fut. Az audit trigger guardja korábban eldobta ezeket az UPDATE eseményeket, így a 2. lépés (sikeres feldolgozás számlává alakítva) hiányzott.
3. **Hiányzó retrospektív kapcsolat:** A múltbeli audit log rekordokhoz nem volt felületi összekötés, ami megmutatta volna, hogy egy adott fájlból milyen bizonylat/számla jött létre (`bizonylatsorszam`, `elado_nev`, összeg, pénznem), és nem lehetett egyetlen kattintással megnyitni a számla részleteit.

---

## Decision

### 1. Kétlépcsős eseménymodell és szétválasztás (Timeline Invariance)
A felületen explicit módon két diszkrét lépésként jelenik meg a folyamat:
- **1. Lépés: E-mail / dokumentum beérkezése (feltöltés):**
  - Ikon: `Mail` (amber színvilág).
  - Szöveg: *"A rendszer felé érkezett egy dokumentum e-mailből"* (vagy N dokumentum több csatolmány esetén).
  - Részletek: Feladó (`sender`), Tárgy (`subject`), Csatolmány(ok) listája (kattintható PDF előnézettel). A beérkezési kártyán szándékosan nem szerepel számlalink, megőrizve a beérkezés tiszta állapotát.
- **2. Lépés: Dokumentum feldolgozása (feldolgozás):**
  - Ikon: `CheckCircle2` (green színvilág).
  - Szöveg: *"A rendszer feldolgozott egy dokumentumot"*.
  - Részletek (szigorú sorrendben):
    - **Feladó (`sender`):** Az e-mail küldő címe (ha e-mailből érkezett).
    - **Tárgy (`subject`):** Az e-mail tárgysora (ha elérhető).
    - **Csatolmány:** Az eredeti fájlnév kattintható PDF előnézeti gombbal.
    - **Létrejött számla:** Számla kártya (`bizonylatsorszam`, `elado_nev`, bruttó összeg és deviza), amelyre kattintva felugrik az `<InvoiceDetailPopup />`.
    - **Forrás:** Manuális feltöltés esetén *"Manuális feltöltésből"*.

### 2. Adatbázis Trigger funkció bővítése (`global_audit_trigger_func`)
- Az INSERT ágban az `email_alias` metaadatok (`sender`, `subject`, `received_at`, `upload_id`) közvetlenül bekerülnek a `details` JSONB-be.
- Az UPDATE ágban az `invoice_uploads.processing_status = 'processed'` státuszváltáskor a trigger rögzíti az eseményt a worker `service_role` kontextusában is (`is_system: true`, `processing_type: 'invoice_processed'`).
- Szigorúan érvényesül az [A-020](./A-020-auth-trigger-chain-incident.md) szabály: `SECURITY DEFINER` és `SET search_path TO 'public'`.

### 3. Kliensoldali batch enricher (Retrospektív támogatás)
Az `ActivityLogSheet`-ben egy React Query hook fut (`audit_logs_enrichment`), amely a megjelenített naplóbejegyzések fájlnevei és azonosítói alapján párhuzamosan lekéri:
- Az `invoice_uploads`, `transaction_uploads`, `report_uploads` metaadatait (`sender`, `subject`, `source`).
- Időablak alapú felderítést (`timeRangeUploadsRes`): az aktuálisan látható naplók időintervallumában érkezett összes e-mailes feltöltést lekérdezi, így ha egy csatolmány törlődött vagy fallback miatt hiányzik a közvetlen rekordja, az azonos levélből származó csatolmányok feladója és tárgya automatikusan öröklődik.
- Az `invoices` táblából az `invoice_uploads_id` vagy `bizonylatsorszam` alapján a kapcsolódó számla adatait (`id`, `bizonylatsorszam`, `elado_nev`, `brutto_vegosszeg`, `penznem`).
Ezáltal mind a több hónappal ezelőtti, mind a jövőbeli események automatikusan és konzisztensen fel vannak gazdagítva.

### 4. Szűrés és Keresés Bővítése
- Az `AVAILABLE_ACTIONS` listába bekerült az `email` szűrő gomb (`E-mailek`, `Mail` ikonnal).
- A keresőmező (`searchQuery`) alfanumerikusan illeszkedik a feladóra (`sender`), a levél tárgyára (`subject`), a számlaszámra (`bizonylatsorszam`) és a partner nevére (`elado_nev`) is.

### 5. Multi-Attachment Aggregáció és Fallback Duplikáció Szűrés (Deduplication)
- **Miért keletkeztek többszörös sorok?** Az [A-035](./A-035-three-way-pipeline-fallback.md) szerinti szekvenciális feldolgozási fallback során, ha egy csatolmány nem számla (pl. tájékoztató PDF), a rendszer sorban megpróbálta az `invoice_uploads`, majd `report_uploads`, majd `transaction_uploads` táblákba tölteni. Minden egyes táblabeszúrás saját `feltöltés` audit naplóbejegyzést generált a trigger révén másodperceken belül.
- **Megoldás és csoportosítás (`groupEmailTimelineItems`):**
  - **Deduplikáció:** Ha egy email csoportban azonos csatolmány fájlnév szerepel, a felület automatikusan deduplikálja (csak egyetlen példányt tart meg, a leggazdagabb metaadatokkal és számlakapcsolattal).
  - **Email aggregáció és metaadat-öröklés:** Ha egy levélben több különböző melléklet érkezik (pl. 2-7 PDF), egyetlen elegáns email-kártya jön létre: *"A rendszer felé érkezett N dokumentum e-mailből"*, amelyben minden csatolmány külön sorban kap helyet saját PDF előnézeti gombbal. Ha bármelyik csatolmány rendelkezik feladóval vagy tárggyal, az a teljes aggregált kártyára átöröklődik.
  - **Időablak és konszolidáció:** 5-10 perces határon belül, nem ütköző feladó és tárgy alapján történik az aggregálás. A konszolidációs menet összefésüli azokat a bejegyzéseket is, amelyek metaadatai csak utólag állnak rendelkezésre.
  - **2 külön lépés:** A számla feldolgozása továbbra is önálló 2. lépésként jelenik meg a timeline-on ("A rendszer sikeresen feldolgozott egy dokumentumot"), felül a feladóval és tárggyal, alatta a csatolmánnyal és a létrejött számlával.

### 6. Hierarchikus Rendező Komparátor (Szintetikus Időbélyeg-eltolás Mentesítés)
- **Vakfolt és kockázat a szintetikus eltolással:** Kezdetben a feldolgozási események (`processed_doc`) beérkezési esemény (`grouped_email`) elé pozícionálására egy mesterséges `+15_000` ms időbélyeg-eltolás került megvalósításra. Ez azonban gyors egymásutánban érkező levelek esetén (pl. 2 másodpercen belül beeső több e-mail) "leapfrogging" hibát okozott volna: a második e-mail beérkezési kártyája a korábbi e-mail feldolgozási kártyája mögé/elé ugorhatott, torzítva az audit időrendet.
- **Megoldás (Determinisztikus 3-szintű komparátor):** A szintetikus időmódosítás teljes mértékben eltávolításra került. Minden bejegyzés megőrzi a valós `created_at` időbélyegét. A `groupEmailTimelineItems` rendező komparátora:
  1. **Elsődleges rendezési elv:** Valós időbélyeg csökkenő sorrendben (`timeB - timeA`).
  2. **Másodlagos feloldó elv (azonos időbélyeg esetén):** Lépéstípus prioritás (`priorityB - priorityA`), ahol `processed_doc: 2` > `grouped_email: 1` > `regular_log: 0`. Ez garantálja, hogy ha a feldolgozás és a beérkezés másodpercre egyezik, a lezárt feldolgozás mindig determinisztikusan a beérkezés fölött jelenik meg.
  3. **Harmadlagos feloldó elv:** Naplóazonosító szerinti determinisztikus összehasonlítás (`b.id.localeCompare(a.id)`), teljesen kizárva a véletlenszerű ugrálásokat.

### 7. Frontend Komponens Modularizáció (ActivityLogSheet Dekompozíció)
- **Tervezési indok:** Az `ActivityLogSheet.tsx` korábban 2222 soros monolitként tartalmazta az összes alpanelt, a custom `LocalSelect` komponenst, a PDF dialógust és a timeline kártyák renderelését.
- **Kiszervezett modulok:**
  - `ActivityLogFilters.tsx`: Felhasználói szűrők, művelettípus gombok (`AVAILABLE_ACTIONS`), alfanumerikus keresőmező, időszak preset-ek, egyedi dátumválasztó és a belső `LocalSelect` dropdown.
  - `ActivityLogTimelineItem.tsx`: A három diszkrét timeline eseménytípus (`grouped_email`, `processed_doc`, `regular_log`) vizuális kártyamegjelenítése, metaadat-blokkok, csatolmánylisták és számlalinkek.
  - `ActivityLogPdfDialog.tsx`: Csatolmányok (PDF, képek) modális előnézete, iframe renderelés, hiba-újrapróbálkozás és letöltőkártyák.
- **Eredmény:** Az `ActivityLogSheet.tsx` mérete 1291 sorra csökkent, kizárólag a fő state-menedzsmentet, a React Query adatkapcsolatokat, az enrichert és az aggregációs pipeline-t tartva meg.

### 8. Időbélyeg-konzisztencia Tisztázása (Created / Updated / Processed)
- A számla részletek felugró ablakában (`InvoiceDetailPopup`) a *Létrehozva*, *Utolsó frissítés* és *Feldolgozva* mezők azonos másodpercre esnek (pl. `10:44:51`).
- Ez a háttér worker valós működéséből adódik: a számla rekordja a feldolgozás pillanatában jön létre (pl. 14.1 másodperccel a feltöltés után) egyetlen tranzakcióban. Így a létrehozás, az utolsó rekordmódosítás és a feldolgozási státusz véglegesítése atomian azonos időbélyeget kap.

---

## Consequences

### Pozitív
- Teljes transzparencia: pontosan látható, hogy melyik e-mailből melyik számla jött létre.
- Zéró zaj: a fallback pipeline-ból eredő duplikált feltöltési sorok teljesen eltűnnek a felhasználó elől.
- Letisztult többcsatolmányos nézet: 1 levél = 1 email esemény a műveleti naplóban, áttekinthető mellékletlistával.
- Zökkenőmentes navigáció: a felhasználó a műveleti naplóból közvetlenül megnyithatja a teljes számla popupot (`InvoiceDetailPopup`) és bármelyik csatolmány PDF előnézetét.
- Retrospektív: a régi rekordoknál is azonnal láthatóak a feladók és a kapcsolódó számlák.
- Idővonal stabilitás: nincs mesterséges időeltolás, gyors egymásutáni leveleknél is stabil, determinisztikus sorrend.
- Moduláris kódbázis: izolált, könnyen tesztelhető és karbantartható szűrő, timeline és PDF komponensek.
- Megőrzi az A-045 és A-033 biztonsági garanciáit.

### Migrációs és Kód Állományok
- `supabase/migrations/20260918_enhance_audit_trigger_email_metadata.sql` (élesítve a `supabase-visibill` adatbázisban).
- `src/components/dashboard/ActivityLogFilters.tsx`
- `src/components/dashboard/ActivityLogTimelineItem.tsx`
- `src/components/dashboard/ActivityLogPdfDialog.tsx`
- `src/components/dashboard/ActivityLogSheet.tsx`
- `src/test/activityLogEmailEvents.test.ts`

---

## Kapcsolódó
- [A-045: Audit Trigger Email-Alias Bypass](./A-045-audit-trigger-email-alias-service-role-bypass.md)
- [A-035: Three-Way Pipeline Fallback](./A-035-three-way-pipeline-fallback.md)
- [A-033: Exclude Service Role From Audit](./A-033-exclude-service-role-from-audit.md)
- [A-020: Auth Trigger Chain Incident](./A-020-auth-trigger-chain-incident.md)
- [P-094: Activity Log Email Ingestion & Invoice Linking UX](../../product/decisions/P-094-activity-log-email-ingestion-and-invoice-linking-ux.md)
