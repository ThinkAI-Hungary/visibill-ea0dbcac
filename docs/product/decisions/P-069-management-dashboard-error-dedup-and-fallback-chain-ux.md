# P-069: Management Dashboard Hiba Dedublikáció, Fallback Lánc és Állapot Kormányzás UX

**Status:** Decided  
**Date:** 2026-09-04  
**Category:** Platform Üzemeltetés / Management Dashboard / Error Tracking / UX  
**Question:** Hogyan kezelje és jelenítse meg a Management Dashboard az azonos fájlhoz tartozó többszöri sikertelen kísérleteket és az automatikus pipeline átirányítások (fallback chain) történetét anélkül, hogy a felületet elárasztanák a redundáns duplikált hibasorok?  
**Decision:** A felület egyetlen authoritative sorba vonja össze az azonos fájlhoz tartozó hibákat, narancssárga kísérlet-számláló jelvénnyel látja el őket, lenyitható panelen auditálhatóvá teszi a teljes Fallback láncot, a törléskor pedig automatikusan kiterjeszti a műveletet az összes korábbi testvérrekordra.  
**Current Implementation:** `ErrorControlPanel.tsx`, `TaskErrorRetryTable.tsx`, `useWorkerTelemetry.ts`, `errorsHandler.ts`  
**Rationale:** Korábban ha egy Mailgunon beérkező fájl elbukott számlaként, majd riportként és tranzakcióként is, 3 különálló sor jelent meg a hibatáblázatban. Ez mesterségesen felduzzasztotta a hibaszámot, és az operátor számára nem volt egyértelmű, hogy ugyanarról a fizikai dokumentumról van szó. Az összevonás és a lenyíló lánc-nézet tiszta, átlátható és gyors beavatkozást tesz lehetővé.

---

## 🖥️ Felhasználói Felület és Workflow Viselkedés

### 1. Dedublikált Fájlsor és Próbálkozás Jelvény (Retry Badge)
* Ha egy fájlhoz (`company_id + file_name/file_url`) több hibás kísérlet tartozik az adatbázisban, a táblázatban **kizárólag a legfrissebb** kísérlet jelenik meg fő sorként.
* A fájlnév mellett egy kompakt, narancssárga jelvény mutatja a próbálkozások számát (pl. `2x`, `3x`):
  ```tsx
  {r.retry_count && r.retry_count > 1 && (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800">
      {r.retry_count}x
    </Badge>
  )}
  ```

### 2. Lenyitható Fallback Lánc (Audit Trail Drawer)
* A hiba sor lenyitásakor (expand) a hibaüzenet és metaadatok alatt egy dedikált "Fallback lánc" blokk jelenik meg.
* A lánc időrendben, lépésről lépésre listázza a korábbi próbálkozásokat:
  - Forrás pipeline jelvény (pl. `invoice_uploads` $\to$ `report_uploads` $\to$ `transaction_uploads`).
  - Az adott próbálkozás pontos időbélyege.
  - Az adott pipeline-ban tapasztalt konkrét hibaüzenet.

### 3. Tranzakcionális Törlés Kiterjesztés (Cascade Sibling Delete)
* Amikor az operátor egy többszörös próbálkozással rendelkező hibára a "Törlés" gombra kattint:
  - A dialógus nemcsak a fő sort, hanem a `history` tömbben szereplő összes korábbi testvérrekordot is felveszi a törlési célpontok közé (`deleteTargets`).
  - Ezzel megelőzhető, hogy egy korábbi meghiúsult próbálkozás "felszínre bukkanjon" a legfrissebb törlése után.

### 4. Valós Státuszok a Worker Telemetriában (`SUPERSEDED` Badge)
* A korábbi megtévesztő zöld "OK" címkék helyett a törölt vagy felülírt job-ok expliciten `SUPERSEDED` címkét kapnak (`TaskErrorRetryTable.tsx`).
* A badge vizuálisan visszafogott kékesszürke árnyalatot kap, jelezve, hogy a feladat feldolgozása egy újabb rekordban vagy pipeline-ban folytatódott.

### 5. Kereszt-Tab Reaktív Cache Érvénytelenítés
* Hiba törlése vagy manuális újraindítása (Retry) esetén a React Query azonnal érvényteleníti a `['management-errors']`, `['management-overview']`, `['management-files']` és `['worker-telemetry']` lekérdezéseket.
* A felhasználónak nem kell kézzel frissítenie (F5) az oldalt a lapok közötti konzisztens adatok megtekintéséhez.

---

## 🔗 Kapcsolódó Dokumentumok
- [A-088: Management Dashboard Adatkonzisztencia, Dedublikáció és Worker Fallback Ciklusvédelem](../../architecture/decisions/A-088-management-dashboard-dedup-and-worker-fallback-loop-prevention.md)
- [P-036: Management Dashboard UI és navigáció](./P-036-management-dashboard.md)
- [P-061: Management Worker Telemetry Decomposition & Calendar Month LLM UX](./P-061-management-worker-telemetry-and-monthly-llm-ux.md)
