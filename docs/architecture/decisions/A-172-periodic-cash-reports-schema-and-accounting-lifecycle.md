# A-172: Időszaki Pénztárjelentés Adatbázis Modell, Szigorú Számadású Sorszámozás és Főkönyvi Életciklus

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-09-28  
> **Szerző:** Antigravity  
> **Kapcsolódó specifikáció:** `Idoszaki_penztarjelentes_funkcionalis_specifikacio.docx`  
> **Kapcsolódó PRD:** [P-132](../../product/decisions/P-132-periodic-cash-reports-and-closing-wizard-ux.md)  
> **Kapcsolódó korábbi ADR-ek:** [A-155](./A-155-petty-cash-inbound-settlement-and-period-closing.md), [A-142](./A-142-customer-and-vat-gl-rules-enforcement.md)

---

## 1. Kontextus

A házipénztári tételek egyszerű nyilvántartása mellett a magyar Számviteli törvény (Sztv. 165–168. §) szigorú megkötéseket támaszt a készpénzes elszámolásokkal szemben:
1. **Időszaki elszámolás (Pénztárjelentés):** A nyitó és záró egyenleg közötti folytonosságot bizonylati láncolatként kell garantálni.
2. **Szigorú sorszámozás:** A bevételi (BPB) és kiadási (KPB) pénztárbizonylatoknak, valamint az időszaki pénztárjelentéseknek hiánytalanul, kihagyásmentesen növekvő sorszámmal kell rendelkezniük.
3. **Fizikai készpénzszámlálás:** A zárás elengedhetetlen kelléke a címletjegyzék szerinti tényleges rovancsolás.
4. **Megváltoztathatatlanság és Audit Trail:** Lezárt jelentés és bizonylat nem törölhető vagy írható felül; javítás kizárólag indoklással ellátott újranyitási jegyzőkönyvvel és új verziószámmal lehetséges.
5. **Kettős könyvvitel integráció:** A lezárt jelentés tételei feladandók a 381-es pénztárszámlára (T/K).

---

## 2. Döntés és Architektúra

### 2.1 Adatbázis Séma (`20260928120000_periodic_cash_reports_schema.sql`)

1. **`cash_reports`:**
   - Kulcsmezők: `id`, `company_id`, `cash_register_id`, `report_number`, `period_start`, `period_end`, `opening_balance`, `total_in`, `total_out`, `closing_balance_book`, `closing_balance_actual`, `difference`, `status` (`open`, `closing`, `closed`, `posted`, `reopened`), `version`, `content_hash`, `closed_at`, `closed_by`.
   - Indexek: `idx_cash_reports_company_register`, `idx_cash_reports_period`, `idx_cash_reports_status`.
   - RLS: Multi-tenancy és cégtagság ellenőrzés InitPlan-optimalizált segédfüggvénnyel.

2. **`cash_receipts`:**
   - Szigorú számadású egyedi bizonylatok (BPB / KPB).
   - Kulcsmezők: `receipt_number`, `receipt_type` (`in`/`out`), `seq_no`, `payer_or_payee_name`, `amount`, `currency`, `amount_in_words`, `legal_title`, `is_cancelled`.

3. **`denomination_sheets`:**
   - A pénztárrovancs címletbontása JSONB formátumban: `[{"denomination": 20000, "count": 5, "subtotal": 100000}, ...]`.
   - `total_amount`, `counted_by`, `counted_at`, `version`.

4. **`cash_closing_protocols`:**
   - Zárási jegyzőkönyv: `book_balance`, `actual_balance`, `difference`, `difference_reason`, `action` (`booked_as_shortage`, `booked_as_surplus`, `cashier_repays`, `none`), `cashier_name`, `controller_name`, `approver_name`.

5. **`petty_cash_registers` és `petty_cash_entries` kiegészítések:**
   - Kasszánkénti szabályzat: `closing_frequency`, `cash_limit`, `limit_action`, `receipt_policy`, `approval_threshold`, `gl_account`, `single_person_mode`.
   - Tételekhez hozzárendelt `cash_report_id`, `cash_receipt_id`, `line_no`.

---

### 2.2 Tranzakcionális PostgreSQL RPC-k (`20260928121000_cash_report_workflow_rpcs.sql`)

1. **`create_cash_receipt_with_seq`:**
   - PostgreSQL advisory lock (`pg_advisory_xact_lock`) használata párhuzamos számozási ütközések (race condition) ellen.
   - Évenként és bizonylattípusonként folytonos sorszámgenerálás (pl. `BPB-2026-00042`).

2. **`finalize_cash_report_closing`:**
   - Újraszámolja a tételek összegét (`total_in`, `total_out`), rögzíti a sorrendet (`line_no`).
   - Ha van megállapított eltérés és az intézkedés könyvelést ír elő, automatikusan létrehoz egy korrekciós tételt:
     - Hiány esetén kiadási tétel `3681` ellenszámlával.
     - Többlet esetén bevételi tétel `4791` ellenszámlával.
   - Generálja a hivatalos zárási bizonylatszámot (`PJ-{EV}-{SORSZAM}`).
   - SHA-256 tartalmi ellenőrző hash-t számít a fejadatokból és tételekből a sértetlenség igazolására.
   - Létrehozza a címletjegyzéket és a zárási jegyzőkönyvet.

3. **`reopen_cash_report`:**
   - Ha a jelentés le volt zárva (és nincs még főkönyvbe adva), újranyitható.
   - A korábbi jegyzőkönyvi adatok megmaradnak, a jelentés verziószáma nő (`version = version + 1`), a státusz `reopened`-re vált.

---

### 2.3 Főkönyvi Feladás és Validáció (`20260928122000_post_cash_report_to_gl.sql`)

1. **`validate_cash_report_for_posting`:**
   - Ellenőrzi a FR-66 szabályokat: státusz lezárt-e, van-e aktív tétel, és minden tétel rendelkezik-e megadott ellenszámlával (`gl_contra_account`).

2. **`post_cash_report_to_gl`:**
   - Bejegyzi a tételt az `acc_journal_headers` táblába `PETTY_CASH` forrással és `381` alapértelmezett számlával.
   - Tételenként generálja a T/K főkönyvi sorokat az `acc_journal_lines` táblában:
     - Bevétel: T 381 (Pénztár) / K Kontra (pl. 311 Vevő)
     - Kiadás: T Kontra (pl. 454 Szállító, 3681 Hiány) / K 381 (Pénztár)
   - A jelentés státusza `posted`-ra vált, rögzítve a `gl_journal_header_id`-t.

3. **`unpost_cash_report_from_gl`:**
   - Törli a kapcsolódó naplófejlécet és könyvelési sorokat.
   - A jelentés státuszát visszateszi `closed`-ra, lehetővé téve az esetleges újranyitást vagy javítást.

---

## 3. Következmények és Előnyök

- **Tranzakcionális biztonság:** Minden zárási és számozási művelet a PostgreSQL szerveroldalon fut atomi tranzakcióként, kliensoldali hibákból adódó inkonzisztencia kizárva.
- **Szigorú Számadás Garantálása:** A sorszámok és a zárási bizonylatok sértetlenségét kriptográfiai hash és zárt állapotgép védi.
- **Teljes Kettős Könyvvitel Megfelelőség:** A 381-es pénztárszámla egyenlege és mozgása fillérre pontosan egyezik a fizikai címletszámlálás és a házipénztári tételek összegével.
