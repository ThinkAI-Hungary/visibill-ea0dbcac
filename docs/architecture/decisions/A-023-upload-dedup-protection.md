# A-023: Upload Dedup Védelem (DB Trigger + Frontend Mutex)

**Status:** Decided  
**Date:** 2026-06-28  
**Utoljára frissítve:** 2026-06-28  
**Trigger:** Thinkerman incidens — jún 26-27, duplikált API költségek

## Context

A Thinkerman projekt 2026. június 26-27-én **$3.49+ felesleges API költséget** generált, mert a felhasználó gyors egymás utáni kattintásokkal 5-10× párhuzamosan futtatotta a `proceedWithInvoiceUpload()` függvényt. 118 egyedi fájlból **615 upload** lett az `invoice_uploads` táblában, a worker **1717 LLM hívást** hajtott végre (ahelyett, hogy ~288-at).

**Gyökérok:** A React `setUploading(true)` state update aszinkron — a következő kattintás hamarabb lefut, mint ahogy a state frissül. Nincs szinkron guard.

**PGMQ VT retry kizárva:** PGMQ archive elemzés kimutatta, hogy **minden** üzenet `read_ct = 1` — a worker egyszer olvasta, nem volt VT retry.

## Decision

**3 rétegű védelmi rendszer:**

### P0: Frontend Upload Mutex (`useRef`)
- Szinkron `uploadMutexRef = useRef(false)` guard **minden** upload függvényben
- A ref értéke a JavaScript event loop-ban **szinkron** frissül → a következő kattintás azonnal return-öl
- Érintett függvények: `proceedWithInvoiceUpload`, `handleBankStatementUpload`, `handleSalaryUpload`, `proceedWithTransactionUpload`, `proceedWithReportUpload`
- Alkalmazva: eaisybill-prod, Thinkerman, vsweb (mindhárom frontend)

### P1: `checkDuplicateFile()` Javítás
- A duplikáció-ellenőrző lekérdezés korábban **csak** `processing_status = 'processed'` fájlokat kereste
- Mostantól **minden releváns státuszra** szűr: `processed`, `pending`, `processing`, `ignored`
- Így ha egy fájl már `pending`-ben van, a felhasználó figyelmeztetést kap mielőtt újra feltöltené

### P2: DB Trigger Dedup Guard (1 perces ablak)
- `trigger_enqueue_invoice_job()` BEFORE INSERT trigger
- Ha azonos `file_name + company_id` kombináció **1 percen belül** már létezik `pending` vagy `processing` státusszal:
  - Az INSERT megtörténik (a sor bekerül az `invoice_uploads`-ba)
  - De a `processing_status` → `'ignored'`, `error_message` → `'Duplicate skipped by trigger dedup (1 min window)'`
  - **NEM** küld `pgmq.send()` üzenetet → a worker nem kapja meg → nincs LLM hívás
- Alkalmazva: supabase-visibill, supabase-visibill-thinkerman, supabase-visibill-vsweb

### Rétegek együttműködése

```
User kattint → P0 Mutex (useRef) → BLOCK (99.9% itt megáll)
                    │
              P1 DB query (checkDuplicateFile) → WARNING dialog
                    │
              P2 DB trigger (1 min window) → 'ignored' status, no PGMQ
```

## Consequences

**Pozitív:**
- Teljes védelem multi-click burst ellen (a Thinkerman-féle incidens nem ismétlődhet)
- A worker nem kap duplikált üzeneteket → nincs felesleges LLM költség
- Defense in depth — 3 réteg, bármelyik egyedül is elegendő a normál esethez
- Az `invoices` tábla az upsert logika miatt **nem szennyeződött** — csak `invoice_uploads` szemét keletkezett

**Negatív:**
- **1 perces dedup ablak**: ha a felhasználó szándékosan akarja újra feltölteni ugyanazt a fájlt, 1 percet kell várnia
- A `checkDuplicateFile` most `pending` státuszú fájlokra is figyelmeztet → ha szándékos újrafeldolgozás kell, a dialog-on megerősítheti

## Kapcsolódó
- [A-004: PGMQ Queue](./A-004-pgmq-queue.md) — a dedup guard a `pgmq.send()` előtt fut
- [A-007: LLM Strategy](./A-007-llm-strategy.md) — a felesleges hívások költségvonzata
