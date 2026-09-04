# A-088: Management Dashboard Adatkonzisztencia, Dedublikáció és Worker Fallback Ciklusvédelem

**Status:** Decided  
**Date:** 2026-09-04  
**Utoljára frissítve:** 2026-09-04  
**Category:** Management Dashboard / Telemetry / Worker Pipeline / Fallback Engine / Data Consistency  
**Érintett komponensek:** `ErrorControlPanel.tsx`, `TaskErrorRetryTable.tsx`, `useWorkerTelemetry.ts`, `errorsHandler.ts`, `workerHandler.ts`, `filesHandler.ts`, `get_management_files` RPC, `worker/worker.py`, `worker/db.py`, `cleanup_duplicate_error_uploads` migration  

---

## Context

Az `eaisybill-prod` Management Dashboard három kiemelt felületén súlyos adatmegjelenítési és állapot-inkonszisztenciák jelentkeztek:

1. **Duplikált Hibasorok (`ErrorControlPanel`):**
   - Ugyanaz a beérkező fájl (pl. `Auszahlung .pdf`) 3-4 különálló sorban is megjelent hiba státusszal a hibalistában, feleslegesen növelve a hibaszámot és félrevezetve az operátort.
   
2. **Duplikált Fájlrekordok (`FilesPanel`):**
   - A `get_management_files` RPC és a fájlkezelő több sorban mutatta ugyanazt a dokumentumot különböző upload táblákból (`invoice_uploads`, `report_uploads`, `transaction_uploads`).

3. **Hamis "OK" Státusz a Worker Naplóban (`WorkerPanel` Recent Jobs):**
   - A Worker Recent Jobs nézetében olyan feladatok is zöld, pipás "OK" státusszal szerepeltek, amelyek valójában sikertelenek voltak vagy a fallback közben elhasaltak.

4. **Körkörös Fallback Ciklus (Ping-Pong Loop) a Workerben:**
   - Amikor egy dokumentum (pl. szokatlan elszámolás vagy fizetési értesítő) nem felelt meg a számla formátumnak, az `invoice` pipeline átirányította a `report` pipeline-ba.
   - Mivel a `report_uploads` tábla korábban nem rendelkezett `fallback_from_invoice_upload_id` mezővel és a metadata elveszett, a `report` pipeline hibája esetén a rendszer újra megpróbálta `invoice` vagy `transaction` pipeline-ként feldolgozni.
   - A folyamat során 3-4 párhuzamos upload rekord keletkezett ugyanahhoz a fizikai fájlhoz, és a `cleanup_email_file_siblings` SQL szintaxis hibák miatt PostgREST szinten csendben elnyelődött.

---

## Decision

A probléma végleges megoldására egy 5 fázisú architektúrális tervet valósítottunk meg (Zero Silent Decisions elv szerint jóváhagyott **Option A** döntésekkel):

### 1. D-1: Adatbázis Tisztítás és Karbantartás (`20260904140000_cleanup_duplicate_error_uploads.sql`)
- Lefuttattunk egy biztonságos adatbázis migrációt, amely a többszörösen rögzített, azonos fájlnevet és cégazonosítót tartalmazó hiba-rekordok közül megtartotta a legfrissebbet (`keep_id`), és eltávolította a 42 felhalmozódott elárvult szellem-rekordot.
- Kizárólag a sikertelen (`status IN ('error', 'failed')`) sorok takarítása történt meg, a sikeresen feldolgozott bizonylatok érintetlenek maradtak.

### 2. D-2: Irányított Aszinkron Gráf (DAG) Ciklusvédelem a Workerben (`worker/worker.py`, `worker/db.py`)
- **Metadata Átörökítés:** A `fallback_to_invoice`, `fallback_to_transaction` és `fallback_to_report` hívások során a Worker a teljes `metadata` objektumot átadja, benne a `fallback_history` tömbbel.
- **DAG Látogatottság Vizsgálat:** A fallback eljárások a `pipelines_to_try` listából kiszűrik azokat a pipeline-okat, amelyeket a fájl az adott feldolgozási folyamatban már megjárt (`history = set(meta.get("fallback_history") or [])`). Ezzel a körkörös `Invoice → Report → Invoice` ping-pong elméletileg is kizártá vált.
- **Többtáblás Sibling Takarítás:** A `cleanup_email_file_siblings` függvényt átírtuk úgy, hogy mind a 4 upload táblából (`invoice_uploads`, `transaction_uploads`, `report_uploads`, `bank_statement_uploads`) lekéri az azonos fájlnévvel vagy `file_url`-lel rendelkező rekordokat, és Python szinten biztonságosan törli a felesleges korábbi hibás kísérleteket, megvédve a `keep_ids` listát és a sikeres sorokat.
- **Payroll Pipeline Átadás:** A bérjegyzék-felismerés és elakadás esetén is megmaradnak a metaadatok és a szülő hivatkozások.

### 3. D-3: Pontos Státusz-visszaadás a Worker Handlerben (`workerHandler.ts`)
- A `buildWorkerStatus` handler korábban ismeretlen vagy törölt `upload_id` esetén alapértelmezetten `"OK"`-t adott vissza.
- Ezt megszüntettük:
  - Ha az `upload_id` nincs jelen az upload táblákban (mert fallback közben törölték vagy felülírták), az állapota expliciten `"SUPERSEDED"` lesz.
  - Támogatottá váltak a `"REDIRECTED"` (átirányított) és `"PROCESSING"` állapotok is.
  - A frontend `TaskErrorRetryTable.tsx` és `useWorkerTelemetry.ts` komponensei megkapták a kék/szürke `SUPERSEDED` badge stílust.

### 4. D-4: Szerver-oldali Dedublikáció és Fallback Előzmény Nyomonkövetés
- **`errorsHandler.ts`:** A nyers upload hibákat `company_id` és normalizált `file_name` / `file_url` kulcs szerint csoportosítja. A legfrissebb hiba kerül ki elsődlegesként, de a válasz tartalmazza a `retry_count`-ot (próbálkozások száma), a `fallback_chain`-t (pl. `["invoice_uploads", "report_uploads", "transaction_uploads"]`) és a részletes `history` listát az egyes fázisok hibaüzeneteivel és időbélyegeivel.
- **`get_management_files` RPC (`20260904150000_dedup_get_management_files.sql`):** Az adatbázis eljárás `ROW_NUMBER() OVER (PARTITION BY company_id, LOWER(COALESCE(file_name, file_url)) ORDER BY status_category = 'success' THEN 1 ... created_at DESC)` ablakozó függvénnyel szűri az eredményeket. Ha egy fájlhoz sikeres és sikertelen rekord is létezik, a sikeres marad érvényben; ha több sikertelen van, csak a legfrissebb jelenik meg.

### 5. D-5: Biztonságos Fizikai Tárhely Törlés (`filesHandler.ts`)
- A fájlok végleges törlésekor (`deleteFiles`) a rendszer mielőtt a Supabase Storage-ból törölné a fizikai objektumot, leellenőrzi mind a 4 upload táblát, hogy létezik-e még más rekord, amely ugyanarra a `file_url`-re hivatkozik.
- Ha létezik testvér-hivatkozás, a fizikai blob megmarad, és kizárólag az adatbázis rekord törlődik (`shouldDeleteStorage = false`).

### 6. UI Továbbfejlesztések
- **`ErrorControlPanel.tsx`:** A fájlnév mellett megjelenik a narancssárga `{r.retry_count}x` badge, jelezve a többszöri sikertelen próbálkozást.
- **Lenyíló Drawer:** A hibasor kinyitásakor megjelenik a "Fallback lánc" blokk, lépésről lépésre bemutatva az átirányítások és pipeline próbálkozások történetét.

---

## Consequences

- **Pozitív:**
  - A Management Dashboard hibalistája és fájllistája pontos, valós darabszámokat tükröz (0 ghost duplikáció).
  - A Worker nem generál végtelen fallback köröket, kímélve az LLM kvótát és a PGMQ queue-t.
  - A felhasználók és operátorok tisztán látják, ha egy fájl többször próbálkozott (`3x badge`) és hogy melyik pipeline-okon ment keresztül.
  - A fizikailag tárolt fájlok nem törlődnek véletlenül, ha egy másik bejegyzés még használja őket.
- **Megjegyzés:**
  - Régi, archivált logokban a törölt `upload_id`-k `SUPERSEDED` címkével fognak megjelenni, ami szándékos és a valóságnak megfelelő viselkedés.

---

## Kapcsolódó
- [P-069: Management Dashboard Hiba Dedublikáció, Fallback Lánc és Állapot Kormányzás UX](../../product/decisions/P-069-management-dashboard-error-dedup-and-fallback-chain-ux.md)
- [A-035: Háromirányú Szekvenciális Pipeline Átirányítás (Invoice ↔ Transaction ↔ Report) és Hibakezelés](./A-035-three-way-fallback-redirection.md)
- [A-077: Management Stats Edge Function & Telemetry Decomposition](./A-077-management-stats-edge-function-and-telemetry-decomposition.md)

