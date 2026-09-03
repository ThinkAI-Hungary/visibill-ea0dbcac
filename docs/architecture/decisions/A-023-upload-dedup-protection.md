# A-023: Upload Dedup Védelem (DB Trigger + Frontend Mutex)

**Status:** Decided  
**Date:** 2026-06-28  
**Utoljára frissítve:** 2026-07-07  
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
- **Bypass feltétel (2026-07-07):** Ha `NEW.metadata->>'source'` **NEM NULL**, a dedup check skip-elődik. Jelenleg két source bypass-ol:
  - `email_alias` — Mailgun webhook feltöltések (idempotency a webhook szinten, Message-Id alapján, ld. [A-011](./A-011-email-processing.md))
  - `manual_reupload` — A user a duplikátum warning dialog-ban megerősítette hogy szándékosan tölti újra
- **Metadata a PGMQ payload-ban (2026-07-07):** A trigger a `NEW.metadata`-t is beleteszi a PGMQ `jsonb_build_object()`-be, így a worker megkapja az eredeti metadata-t (source, sender, subject) a job-ban.
- Alkalmazva: supabase-visibill, supabase-visibill-thinkerman, supabase-visibill-vsweb

### Rétegek együttműködése

```
Frontend upload (első feltöltés, source=NULL):
  User kattint → P0 Mutex (useRef) → BLOCK (99.9% itt megáll)
                      │
                P1 DB query (checkDuplicateFile) → Nincs duplikátum
                      │
                INSERT (metadata: NULL) → P2 dedup AKTÍV (source IS NULL)

Frontend upload (megerősített újrafeltöltés, source='manual_reupload'):
  User kattint → P1 duplikátum talált → WARNING dialog → User: "Igen, újra feltöltöm"
                      │
                INSERT (metadata: {source: 'manual_reupload'})
                      │
                P2 dedup BYPASS (source IS NOT NULL) → always enqueue

Email webhook upload:
  Mailgun hívás → Webhook Message-Id idempotency check → SKIP ha retry
                      │
                INSERT (metadata: {source: 'email_alias', ...})
                      │
                P2 dedup BYPASS (source IS NOT NULL) → always enqueue
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

## Bugfix History

### 2026-07-04: AFTER INSERT → BEFORE INSERT trigger fix

**Incidens:** Victoria Music Kft. 3 JPEG fájlt töltött fel duplikáltan (~1 mp-en belül). A dedup logika kihagyta a `pgmq.send()`-et (helyes), de a rekordok `pending` státuszban ragadtak (bug) → a dashboardon "Várakozik"-ként jelentek meg.

**Root cause:** A trigger `AFTER INSERT` típusú volt, de a dedup ág `NEW.processing_status := 'ignored'` módosítást használt. PostgreSQL-ben az `AFTER INSERT` trigger nem tudja módosítani a már beírt sort — a `NEW` módosítása hatástalan.

**Fix:** `DROP TRIGGER` + `CREATE TRIGGER trg_enqueue_invoice BEFORE INSERT` — a `BEFORE INSERT` trigger módosíthatja `NEW`-t, így a dedup ág sikeresen `'ignored'`-ra állítja a rekordot az INSERT pillanatában.

**Migration:** `20260704_fix_invoice_dedup_trigger_before_insert.sql`

**Tesztelés:** Tranzakcióban 2× INSERT ugyanazzal a fájlnévvel → 1. rekord `pending` + PGMQ message, 2. rekord `ignored` + nincs PGMQ message ✅

### 2026-07-07: Email Alias Dedup Bypass + Mailgun Idempotency

**Incidens:** Victoria Music Kft. Mailgun webhook-on érkező 38 csatolmány. A Mailgun retry policy 3× hívta meg a webhookot (~57s és ~130s gap-pal). A dedup trigger az összes email feltöltést `ignored`-ra állította, mert az 1 perces ablakba estek — **76 feltöltésből 75 `ignored`, 0 `processed`**.

**Root cause (2 bug):**
1. A dedup trigger nem különbözteti meg a frontend és az email forrást — `file_name + company_id` alapon matchel, ami email retry-knál hamis pozitívokat ad.
2. A worker `job.get("metadata")` → `None` → felülírja a DB metadata-t üres dict-tel → `source: email_alias` elvész.

**Fix (4 módosítás):**
1. **Trigger source-based bypass:** `IF (NEW.metadata->>'source') IS NULL` — dedup CSAK ha nincs explicit source. Bármilyen source (email_alias, manual_reupload) bypass-olja a dedup-ot.
2. **Metadata a PGMQ payload-ban:** `'metadata', NEW.metadata` hozzáadva a `jsonb_build_object()`-hez → a worker megkapja az eredeti metadata-t.
3. **Mailgun Message-Id idempotency a webhook-ban:** A `process-mailgun-webhook` EF kinyeri a `Message-Id`-t a `message-headers` JSON field-ből, és INSERT előtt ellenőrzi hogy az adott `message_id + file_name + company_id` kombináció létezik-e már. Ld. [A-011](./A-011-email-processing.md).
4. **Frontend manual_reupload:** Ha a user a duplikátum warning dialog-ban megerősíti a feltöltést, `metadata: { source: 'manual_reupload' }` kerül az INSERT-be → a trigger bypass-olja a dedup-ot.

**Migration:** `20260707_fix_dedup_trigger_email_bypass.sql`

### 2026-09-03: P3 Worker-oldali Fuzzy Duplikáció-Szűrő és Bankszámlaszám Védelem (B-commerce Incidens)

**Incidens:** FAKOV Kft. (Tóth-Csepregi Judit) support ticket. A szlovák *B-commerce Group s.r.o.* (`SK2121115601`) bejövő számláját a felhasználó kétszer töltötte fel (előbb egy 23 számlás kötegelt szkenben, később egyedi PDF-ként).

**Root cause:**
1. A szlovák számlán a Citibank forintos bankszámlaszám felett magyar nyelvű feliratként `"Számlaszám"` állt (`10800007-80000000-15562005`), míg a tényleges számlasorszám az `"Adódokumentum / Egyedi azonosító: 2146000883"` mezőben szerepelt.
2. A korábbi `sima_szamla.md`, `vegszamla.md` és `egyszerusitett_szamla.md` promptok JSON sémájában nem létezett `bankszamlaszam_iban` mező, így az AI a banki számlaszámot írta a `szamlaszam` mezőbe.
3. A két feltöltés OCR szövege között karaktereltérés keletkezett (`10800007-...` 4 db nulla vs `108000007-...` 5 db nulla), ami miatt a worker `upsert_invoice()` Check 2 pontos kulcsos egyezése (`company_id, bizonylatsorszam`) elbukott, duplikátumot hozva létre a rendszerben.

**Megoldás & Védelmi rétegek:**
1. **Prompt Standardizáció:** `bankszamlaszam_iban` bevezetése a `sima_szamla`, `vegszamla`, `egyszerusitett_szamla` promptokba. Határozott tiltás magyar (`XXXXXXXX-XXXXXXXX(-XXXXXXXX)`) és IBAN formátumok `szamlaszam`-ba írására, explicit szabály külföldi webshop / szlovák számlák felirataihoz.
2. **Pydantic Model Validáció (`worker/models.py`):**
   - `clean_szamlaszam()` automatikusan detektálja és elutasítja a banki számlaszám formátumokat (`is_bank_account_number()`).
   - A modellek `@model_validator(mode="before")` segítségével kimentik a felismert banki adatot a `bankszamlaszam_iban` mezőbe, és ha létezik valós bizonylatazonosító (`reference_number`), azt előléptetik számlasorszámmá.
3. **Worker Check 3 Fuzzy Dedup (`worker/db.py`):**
   - Lekérdezi a partner meglévő bizonylatait azonos cégre, bruttó összegre és devizára ±30 napos ablakban.
   - **Case 3a (OCR typo / bank collision / similarity >= 0.85):** Automatikus rekordfrissítés / merge, felülírva a hibás banki sorszámot a valós számlaszámmal.
   - **Case 3b (Gyanús egyezés - azonos partner és összeg 30 napon belül, de eltérő sorszám):** Beszúrás `statusz = 'jovahagyasra_var'` státusszal és magyarázó `approval_note` figyelmeztetéssel (ADR A-084 könyvelői kapu).
4. **Pre-push Teszt Védelem:** `test_bcommerce_duplicate_prevention.py` (13 egységteszt integrálva a `run_tests.py` futtatóba).

## Kapcsolódó
- [A-004: PGMQ Queue](./A-004-pgmq-queue.md) — a dedup guard a `pgmq.send()` előtt fut
- [A-007: LLM Strategy](./A-007-llm-strategy.md) — a felesleges hívások költségvonzata
- [A-011: Mailgun Email Processing](./A-011-email-processing.md) — Message-Id idempotency az email pipeline-ban
- [A-016: PostgreSQL Query Strategy](./A-016-postgresql-query-strategy.md) — trigger típusok dokumentáció
- [A-084: NAV Cross-check & Accountant Approval Gate](./A-084-nav-crosscheck-approval-gate.md) — könyvelői jóváhagyási kapu és approval_note kezelés
