

# Átfogó technikai audit: Valós idejű frissítések, feldolgozási láncolatok és adatszinkronizáció

---

## 1. Rendszer architektúra áttekintés

```text
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Frontend    │────▶│  Edge Functions   │────▶│  n8n Workflow  │
│  (React)     │     │  (trigger-*)      │     │  (feldolgozás) │
└──────┬───────┘     └──────────────────┘     └───────┬───────┘
       │                                              │
       │  Supabase Realtime                           │ service_role INSERT
       │  (postgres_changes)                          │
       ▼                                              ▼
┌──────────────────────────────────────────────────────────┐
│                    PostgreSQL (Supabase)                  │
│  salary_files ─┬─ salary                                 │
│  invoice_uploads ─┬─ invoices ─── nav_invoices           │
│  transaction_uploads ─┬─ transactions ─── invoices/nav   │
│                                                          │
│  DB Triggerek: auto_approve, mark_paid, mark_completed   │
└──────────────────────────────────────────────────────────┘
```

**Adatáramlás:** Frontend feltölt → Edge Function → n8n webhook → n8n feldolgoz → service_role INSERT → DB triggerek → Realtime event → Frontend frissít

---

## 2. Realtime szinkronizáció (LiveNotificationProvider)

### Jelenlegi állapot: MŰKÖDIK, DE KORLÁTOKKAL

**Mi működik:**
- 8 tábla figyelt: `salary`, `salary_files`, `invoices`, `invoice_uploads`, `nav_invoices`, `transactions`, `partners`, `transaction_uploads`
- Supabase Realtime publication tartalmazza mind a 8 táblát ✅
- Kliens-oldali company_id szűrés ✅
- Debounced invalidáció (500ms) a query cache-re ✅
- Tab-refocus stratégia: háttérben elmulasztott események pótlása ✅
- Upload deduplication (`notifiedUploads` Set) ✅

**KRITIKUS PROBLÉMA: service_role INSERT-ek megbízhatatlansága**

Az n8n `service_role` kulccsal szúrja be a feldolgozott adatokat. A Supabase Realtime ezeket az eseményeket NEM mindig kézbesíti az `anon` key-es klienseknek. Ez az elsődleges oka annak, hogy a "Gratulálunk!" toast gyakran nem jelenik meg.

**Megoldás jelenleg:** Polling fallback a salary feltöltéseknél (5s intervallum, max 90s). Ez a logika NINCS implementálva a számlák és tranzakciók feltöltésénél.

### Hiányzó Realtime figyelés

| Tábla | Figyelt? | Probléma |
|---|---|---|
| `bank_statement_uploads` | ❌ NEM | Bankkivonat feltöltés semmilyen frissítést nem triggerel |
| `bank_statements` | ❌ NEM | Feldolgozott bankkivonatok nem frissülnek |
| `bank_transactions` | ❌ NEM | Banki tranzakciók nem szinkronizálnak |
| `categories` | ❌ NEM | Kategória módosítás nem frissíti a számla listákat |
| `projects` | ❌ NEM | Projekt módosítás nem propagál |
| `nav_sync_logs` | ❌ NEM | NAV szinkronizálás állapota nem frissül automatikusan |
| `dunning_sends` | ❌ NEM | Fizetési felszólítás küldés után nem frissül a Kintlevő oldal |

---

## 3. Feldolgozási láncolatok audit

### 3.1 Számla feldolgozás (invoice)

```text
Feltöltés → invoice_uploads (pending) → Edge: trigger-invoice-processing
  → n8n webhook → n8n feldolgoz → invoices INSERT (service_role)
  → DB trigger: set_invoice_feldolgozva_on_upload_link (statusz → 'feldolgozott')
  → DB trigger: mark_nav_invoice_as_submitted (NAV számla → submitted=true)
```

**PROBLÉMÁK:**
1. **invoice_uploads.processing_status SOHA NEM VÁL 'completed'-RE.** Jelenleg 132 rekord, MINDEGYIK `webhook_sent` státuszban. Nincs DB trigger ami lezárná (mint a salary_files-nál most van). Az UploadHistory ezért mindig "Feltöltve" státuszt mutat a számlákhoz.
2. **Polling fallback NINCS** a számlák feltöltéséhez. Ha a Realtime INSERT event nem érkezik meg, a felhasználó nem kap értesítést.
3. **Nincs automatikus invoice_uploads → completed átmenet.** A `salary_files`-hoz készült `trg_mark_salary_file_completed` mintájára kellene egy `trg_mark_invoice_upload_completed` trigger.

### 3.2 Tranzakció feldolgozás

```text
Feltöltés → transaction_uploads (pending) → Edge: trigger-transaction-processing
  → n8n webhook (fire-and-forget) → n8n feldolgoz → transactions INSERT
  → DB trigger: auto_approve_high_confidence (>=0.9 → is_verified=true)
  → DB trigger: mark_nav_invoice_paid_on_transaction_match (matched → paid=true)
```

**PROBLÉMÁK:**
1. **Polling fallback NINCS** a tranzakcióknál sem.
2. **42 high_confidence rekord van, de 0 matched_invoice_id-vel.** Ez azt jelenti, hogy az `auto_approve_high_confidence` trigger lefut, de a `matched_invoice_id` nem kerül beállításra az n8n által, vagy valami más logikai probléma van.
3. **86 tranzakció teljesen párosítatlan** (nem no_match_category, nem is matched). A felhasználónak kézi munkát kellene végeznie, de nincs batch-assign funkció.

### 3.3 Bérjegyzék feldolgozás

```text
Feltöltés → salary_files (pending) → Edge: trigger-salary-processing
  → n8n webhook → n8n feldolgoz → salary INSERT (service_role)
  → DB trigger: trg_mark_salary_file_completed (status → 'completed') ✅ ÚJ
  → Polling fallback (5s × 18 = 90s) ✅ ÚJ
```

**JELENLEGI ÁLLAPOT:** A legutóbbi 4 feltöltés (16:09) sikeresen `completed` státusszal rendelkezik, a polling fallback is működik. A korábbi 4 (15:56) még `webhook_sent`-ben ragadt (a trigger előtti feltöltések).

### 3.4 Bankkivonat feldolgozás

```text
Feltöltés → bank_statement_uploads (pending) → Edge: trigger-bank-statement-processing
  → n8n webhook → n8n feldolgoz → bank_statements + bank_transactions INSERT
```

**PROBLÉMÁK:**
1. **Teljesen láthatatlan a frontend számára.** Sem a `UploadHistory`, sem a `LiveNotificationProvider` nem figyeli a `bank_statement_uploads` táblát.
2. **Nincs connection a `transactions` táblával.** A bankkivonatból kinyert tranzakciók a `bank_transactions` táblába kerülnek, de NINCS automatikus szinkronizáció a fő `transactions` táblával.
3. **Nincs polling fallback.**

---

## 4. Adatkapcsolatok és láncolás

### 4.1 Számla-tranzakció párosítás

**Működő triggerek:**
- `mark_nav_invoice_paid_on_transaction_match` — ha `transactions.matched_invoice_id` be van állítva, a NAV/submitted számla `paid=true` + `transaction_id` kap értéket ✅
- `reset_paid_on_transaction_delete` — tranzakció törlésekor visszaáll ✅
- `reset_paid_on_transaction_unmatch` — unmatch esetén visszaáll ✅

**PROBLÉMA:** Jelenleg 0 tranzakciónak van `matched_invoice_id`-je (az auto_approve trigger fut, de az n8n nem állítja be a `matched_invoice_id`-t megfelelően). Ez azt jelenti, hogy a teljes számla-tranzakció kapcsolat NEM MŰKÖDIK a gyakorlatban.

### 4.2 NAV-Submitted láncolás

**Működő triggerek:**
- `mark_nav_invoice_as_submitted` — ha submitted invoice `bizonylatsorszam` megegyezik NAV `invoice_number`-rel → `submitted=true` ✅
- `match_nav_invoice_on_insert` — NAV számla beszúrásakor automatikus egyeztetés ✅
- `reset_nav_submitted_on_invoice_delete` — submitted számla törlésekor visszaáll ✅

**PROBLÉMA:** Jelenleg 0 NAV számla van (a cég még nem szinkronizált), de a logika helyes.

### 4.3 Bizonylatszám-alapú láncolt számlák

A `get_linked_invoices` RPC rekurzívan feloldja a `reference_number ↔ bizonylatsorszam` kapcsolatokat. **Ez helyesen működik**, de:
- A `reference_number` értékeket az n8n állítja be OCR alapján — ha az OCR hibás, a láncolás nem működik
- Nincs felhasználói felület a manuális reference_number szerkesztéshez

---

## 5. Query cache invalidáció problémák

### 5.1 Prefix-match logika

A `LiveNotificationProvider` `invalidate()` függvénye `[key, companyId]` prefix-match-et használ. Ez azt jelenti:
- `invalidate('navInvoices')` → invalidálja `['navInvoices', companyId, dateFrom, dateTo]` ✅

**DE:** A `filteredNavInvoices` és `filteredSubmittedInvoices` kulcsok NEM prefix-match kompatibilisek, mert az első elem `'filteredNavInvoices'`, de a `LiveNotificationProvider` nem invalidálja ezeket explicit módon.

**Érintett kulcsok amelyek KIMARADNAK az invalidációból:**
- `filteredNavInvoices` — szerver-oldali szűrt NAV számlák
- `filteredSubmittedInvoices` — szerver-oldali szűrt submitted számlák

Ez azt jelenti, hogy ha egy NAV számla frissül Realtime-on keresztül, a szűrt nézet NEM frissül automatikusan — csak a legacy `navInvoices` kulcs invalidálódik, amit a `useInvoiceFilters` már nem használ.

### 5.2 UploadHistory speciális kulcsstruktúra

Az `uploadHistory` kulcs: `['uploadHistory', companyId, activeTab, dateFrom, dateTo, refreshKey]`

A `LiveNotificationProvider` invalidálja: `['uploadHistory', companyId]` — ez prefix-match, tehát elvileg működik ✅. De a `refreshKey` paraméter miatt újabb lekérdezés futhat le indokolatlanul.

---

## 6. Amit fejleszteni kellene (prioritás szerint)

### P0 — Kritikus (nem működik valami)

1. **Invoice uploads completed trigger hiányzik.** Kell egy `trg_mark_invoice_upload_completed` trigger (mint a salary_files-nál), hogy az `invoice_uploads.processing_status` automatikusan `'completed'`-re váltson.
2. **`filteredNavInvoices` és `filteredSubmittedInvoices` invalidáció hozzáadása** a LiveNotificationProvider-hez. E nélkül a szűrt számla nézetek soha nem frissülnek Realtime eseményre.
3. **Tranzakció-számla párosítás nem működik** — az n8n nem állítja be a `matched_invoice_id`-t. Ez frontend-en kívüli probléma, de a frontend-nek kellene biztosítania egy manuális párosítási felületet.

### P1 — Fontos (hiányzó funkció)

4. **Polling fallback számla és tranzakció feltöltéshez** — a salary-nál már működik, ki kell terjeszteni.
5. **Bankkivonat integráció a frontend-en** — `bank_statement_uploads`, `bank_statements`, `bank_transactions` sehol nincs megjelenítve vagy Realtime-hoz kötve.
6. **categories és projects Realtime figyelés** — ha egy kategóriát vagy projektet módosítanak, a számla listák nem frissülnek.

### P2 — Fejlesztés (javítaná az élményt)

7. **Értesítés granularitás** — jelenleg csak "Gratulálunk!" üzenet van. Specifikusabb értesítések kellenének: "4 bérjegyzék feldolgozva", "12 tranzakció importálva", stb.
8. **Régi salary_files státuszok retroaktív javítása** — a 15:56-os feltöltések `webhook_sent` státuszban maradtak. Egy egyszeri migration frissíthetné ezeket `completed`-re, ha van hozzájuk `salary` sor.
9. **bank_transactions → transactions szinkronizáció** — a bankkivonatból kinyert tranzakciók jelenleg külön táblában vannak, nincs összefüggés a fő transactions táblával.

---

## 7. Összefoglalás: Mi dinamikus és mi NEM

| Funkció | Dinamikus? | Megjegyzés |
|---|---|---|
| Bérjegyzék feldolgozás + értesítés | ✅ IGEN | Polling fallback + DB trigger (ÚJ) |
| Számla Realtime invalidáció | ⚠️ RÉSZBEN | Legacy kulcsok igen, szűrt nézetek NEM |
| Tranzakció Realtime invalidáció | ⚠️ RÉSZBEN | INSERT event megbízhatatlan (service_role) |
| Számla feldolgozási értesítés | ❌ NEM | Nincs polling, nincs completed trigger |
| Tranzakció feldolgozási értesítés | ❌ NEM | Nincs polling fallback |
| Bankkivonat feldolgozás | ❌ NEM | Teljes mértékben hiányzik a frontendről |
| Számla-tranzakció párosítás | ❌ NEM | n8n nem állítja be matched_invoice_id-t |
| Kategória/Projekt módosítás propagáció | ❌ NEM | Nincs Realtime figyelés |
| Fizetési felszólítás státusz frissítés | ❌ NEM | dunning_sends nincs figyelve |

