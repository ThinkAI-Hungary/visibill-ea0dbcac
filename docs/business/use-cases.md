# Visibill — Use Cases

> Strukturált use case dokumentáció a prod (visibill-709fffdf) kódbázis alapján.
> Minden use case az aktor, előfeltétel, fő folyamat, alternatív folyamatok és utófeltétel sémát követi.

---

## UC-001: Regisztráció & Cég Létrehozás

| Mező | Érték |
|------|-------|
| **Aktor** | Új felhasználó |
| **Előfeltétel** | Nincs — publikus |
| **Trigger** | Felhasználó megnyitja a regisztrációs oldalt |

**Fő folyamat:**
1. Felhasználó megadja email + jelszó
2. Rendszer létrehozza a Supabase auth user-t
3. Rendszer küld verifikációs emailt (verify-email Edge Function)
4. Felhasználó megerősíti az emailt (email_verified = true)
5. Rendszer létrehozza a profiles rekordot (role = 'user')
6. Felhasználó kitölti a cég adatait (név, adószám)
7. Rendszer létrehozza a companies rekordot (owner_id = user.id)
8. Rendszer létrehozza a company_members rekordot (role = 'owner')
9. Product Tour indul (has_completed_tour = false → true)

**Alternatív folyamatok:**
- **A1:** Email már regisztrálva → hibaüzenet
- **A2:** Verifikáció nem történik meg → korlátozott funkciók
- **A3:** Felhasználó share_token-nel csatlakozik meglévő céghez → skip cég létrehozás

**Utófeltétel:** Felhasználó bejelentkezett, van legalább egy cége, Product Tour lefutott.

---

## UC-002: Számla Feltöltés (Manuális)

| Mező | Érték |
|------|-------|
| **Aktor** | Cégvezető / admin |
| **Előfeltétel** | Bejelentkezett, van kiválasztott cég |
| **Trigger** | Új számla érkezett (papír/PDF/email melléklet) |

**Fő folyamat:**
1. Felhasználó navigál a Feltöltés oldalra
2. Kiválasztja a document_category-t (invoice / payroll)
3. Drag&drop vagy fájlválasztó → PDF/kép feltöltés
4. Rendszer feltölti a fájlt Supabase Storage-ba
5. Rendszer létrehozza az invoice_uploads rekordot (status = 'pending')
6. trigger-invoice-processing Edge Function → PGMQ message
7. Worker felszedi: OCR (Textract/MarkItDown) → LLM extraction
8. Worker elmenti: invoices rekord + invoice_items + GL classification
9. Felhasználó értesítést kap (LiveNotificationProvider)
10. Felhasználó megtekinti a feldolgozott számlát

**Alternatív folyamatok:**
- **A1:** document_category = 'payroll' → trigger-salary-processing → salary rekord
- **A2:** OCR sikertelen → status = 'error', felhasználó kap hibaértesítést
- **A3:** LLM extraction részleges → felhasználó manuálisan javít

**Utófeltétel:** Számla feldolgozva, GL-hez rendelve, felhasználó értesítve.

---

## UC-003: Számla Fogadás Emailben

| Mező | Érték |
|------|-------|
| **Aktor** | Külső küldő (szállító / partner) |
| **Előfeltétel** | Cégnek van email alias-a (cegnev@inbox.visibill.hu) |
| **Trigger** | Email érkezik az alias címre |

**Fő folyamat:**
1. Szállító küld emailt a cég Visibill email alias-ára
2. Mailgun fogadja → process-mailgun-webhook Edge Function
3. Rendszer kinyeri a mellékleteket (PDF/kép)
4. Feltölti Supabase Storage-ba
5. Létrehozza az invoice_uploads rekordot
6. Triggereli a worker pipeline-t (→ UC-002, 6-10. lépés)

**Alternatív folyamatok:**
- **A1:** Nincs melléklet → email logolva de nem feldolgozva
- **A2:** Nem támogatott fájlformátum → hibajelzés

**Utófeltétel:** Email mellékletből számla feldolgozva, automatikusan.

---

## UC-004: NAV Szinkronizáció

| Mező | Érték |
|------|-------|
| **Aktor** | Cégvezető / rendszer (auto-sync) |
| **Előfeltétel** | NAV credentials beállítva (Vault-ban tárolva) |
| **Trigger** | Felhasználó kattint "Szinkronizálás" / cron job fut |

**Fő folyamat:**
1. nav-sync Edge Function indul (manuális) vagy nav-auto-sync (cron)
2. Rendszer NAV token-t kér (nav-token Edge Function)
3. Lekérdezi a bejövő számlákat (query-nav-invoices) a dátum tartományban
4. Lekérdezi a kimenő számlákat (nav-query-outbound-invoices)
5. Elmenti/frissíti a nav_invoices + nav_invoice_items rekordokat
6. Partner rekordokat hoz létre/frissít (adószám alapján)
7. AI GL kategorizálás fut (trigger-nav-categorization)
8. nav_sync_logs rekord mentése (időtartam, számla szám, státusz)
9. Felhasználó értesítést kap

**Alternatív folyamatok:**
- **A1:** NAV API hiba → error log, retry
- **A2:** Credential lejárt → hibajelzés, újra beállítás szükséges
- **A3:** details_fetched = false → részletes lekérdezés indul

**Utófeltétel:** NAV számlák szinkronizálva, partnerek frissítve, sync log rögzítve.

---

## UC-005: Tranzakció Import & Párosítás

| Mező | Érték |
|------|-------|
| **Aktor** | Cégvezető |
| **Előfeltétel** | Banki CSV elérhető |
| **Trigger** | Havi pénzügyi egyeztetés |

**Fő folyamat:**
1. Felhasználó navigál a Tranzakciók oldalra
2. CSV feltöltés (transaction_uploads rekord)
3. trigger-transaction-processing Edge Function → PGMQ
4. Worker parse-olja a CSV-t (transaction_extractor)
5. Transactions rekordok létrehozása
6. AI matching: transaction_matcher összerendeli a számlákat
7. Minden tranzakcióhoz: matched_invoice_id, confidence_score, match_type, reason
8. GL osztályozás (gl_account_id, gl_reasoning)
9. Felhasználó ellenőrzi a párosításokat
10. Jóváhagyás: is_verified = true

**Alternatív folyamatok:**
- **A1:** Ismeretlen CSV formátum → parsing hiba
- **A2:** Alacsony confidence → felhasználó manuálisan párosít
- **A3:** Nincs megfelelő számla → unmatched marad

**Utófeltétel:** Tranzakciók importálva, számlákhoz párosítva, GL-hez rendelve.

---

## UC-006: Éves Beszámoló Készítés

| Mező | Érték |
|------|-------|
| **Aktor** | Cégvezető / könyvelő |
| **Előfeltétel** | Az üzleti év összes számlája, tranzakciója és GL bejegyzése rögzítve |
| **Trigger** | Üzleti év lezárása |

**Fő folyamat:**
1. Felhasználó ellenőrzi a Főkönyvet (GeneralLedgerPage)
2. Megnyitja az Eredménykimutatás oldalt → automatikus generálás
3. Megnyitja a Mérleg oldalt → automatikus generálás
4. Beszámoló oldalon létrehozza az éves beszámolót (status = 'draft')
5. Kitölti a kiegészítő melléklet sablonokat (19 sablon)
6. Rögzíti az osztalék adatokat (dividend_amount, retained_earnings)
7. Előző évi adatokat rögzíti (bs_prior_year)
8. Validálja a beszámolót (status = 'validated')
9. Véglegesíti (status = 'finalized') → frozen snapshot mentés
10. Benyújtja (status = 'submitted')

**Alternatív folyamatok:**
- **A1:** GL egyenleg hibás → vissza a Főkönyvbe javítani
- **A2:** Draft törlése és újrakezdés

**Utófeltétel:** Éves beszámoló véglegesítve, frozen data snapshot elmentve.

---

## UC-007: Fizetési Felszólítás Küldés

| Mező | Érték |
|------|-------|
| **Aktor** | Cégvezető |
| **Előfeltétel** | Van lejárt, kifizetetlen számla |
| **Trigger** | Fizetési határidő lejárt |

**Fő folyamat:**
1. Felhasználó megnyitja a Kintlévőség oldalt
2. Szűri a lejárt számlákat
3. Kiválasztja az adóst
4. Megnyitja a DunningDialog-ot
5. Ellenőrzi/módosítja az email adatokat (adós név, email, összeg)
6. Küld felszólító emailt (send-dunning-email Edge Function)
7. Rendszer rögzíti a dunning_sends rekordot

**Utófeltétel:** Felszólító email elküldve, rögzítve a rendszerben.

---

## UC-008: Tárgyi Eszköz Aktiválás

| Mező | Érték |
|------|-------|
| **Aktor** | Cégvezető |
| **Előfeltétel** | Van feldolgozott számla vagy NAV számla eszköz beszerzésről |
| **Trigger** | Eszköz üzembe helyezése |

**Fő folyamat:**
1. Felhasználó navigál a TENY oldalra
2. Új eszköz létrehozása (source_invoice_id megadása)
3. Eszköz adatok kitöltése: név, bruttó érték, beszerzés dátuma
4. TAO értékcsökkenési sablon kiválasztása (11 sablon)
5. Telephely hozzárendelés (location_id)
6. Dokumentum csatolás (documents JSONB)
7. Aktiválás (AssetActivationDialog) → asset_events: activation
8. Automatikus értékcsökkenés kalkuláció indul (lineáris, TAO rate)

**Alternatív folyamatok:**
- **A1:** Egyedi amortizációs ráta → rate_override
- **A2:** Eszköz áthelyezés → asset_events: transfer
- **A3:** Selejtezés → asset_events: disposal, status = 'disposed'

**Utófeltétel:** Eszköz aktív, értékcsökkenés fut, GL-hez rendelve.

---

## UC-009: Munkaidő Rögzítés (Employee)

| Mező | Érték |
|------|-------|
| **Aktor** | Alkalmazott (employee role) |
| **Előfeltétel** | Employee regisztráció megtörtént (registration_token) |
| **Trigger** | Napi munkaidő rögzítése |

**Fő folyamat:**
1. Employee bejelentkezik → csak WorkingTimePage elérhető
2. Napi órák rögzítése (hours, project hozzárendelés)
3. Hiányzás típus jelölése ha van (vacation/sick/personal/other)
4. Mentés (status = 'draft')
5. Beküldés jóváhagyásra (status = 'submitted')
6. Admin/owner jóváhagyja (status = 'approved')

**Alternatív folyamatok:**
- **A1:** Szabadságkérelem → LeavePanel → leave_requests (pending → approved/rejected)
- **A2:** Admin visszadobja → employee javít és újra beküld

**Utófeltétel:** Munkaidő jóváhagyva, szabadság nyilvántartva.

---

## UC-010: Futárszolgálat Riport Feldolgozás

| Mező | Érték |
|------|-------|
| **Aktor** | E-commerce cégvezető |
| **Előfeltétel** | Futárszolgálat CSV riport elérhető |
| **Trigger** | Havi elszámolás futárszolgálattal |

**Fő folyamat:**
1. Felhasználó navigál a Tranzakciók → Futár riport tab-ra
2. Kiválasztja a futárszolgálatot (GLS/MPL/DPD/FoxPost/Mixpack/Sprinter)
3. CSV feltöltés (report_uploads rekord)
4. Worker parse-olja: report_extractor → report_rows (item/total típus)
5. NAV számla matching: report_matcher → matched_nav_invoice_id
6. Tranzakció matching → matched_transaction_id
7. Párosítási státusz frissítés: unmatched → partial_trx → partial_nav → full → total
8. Felhasználó ellenőrzi a párosított/párosítatlan sorokat

**Utófeltétel:** Futár riport sorok párosítva NAV számlákhoz és tranzakciókhoz.

---

## UC-011: Visszajelzés Küldés

| Mező | Érték |
|------|-------|
| **Aktor** | Bármely bejelentkezett felhasználó |
| **Előfeltétel** | Bejelentkezett állapot |
| **Trigger** | Hiba/javaslat/kérdés felmerülése |

**Fő folyamat:**
1. Felhasználó kattint a FeedbackFab gombra (lebegő gomb, minden oldalon)
2. FeedbackDialog megnyílik
3. Kiválasztja a céget, típust (bug/feature_request/feedback/question)
4. Leírja az üzenetet
5. Küldés → feedback tábla rekord (Slack integrációval)

**Utófeltétel:** Feedback rögzítve, Slack értesítés elküldve.

---

## UC-012: Előfizetés Kezelés

| Mező | Érték |
|------|-------|
| **Aktor** | Cégvezető (owner) |
| **Előfeltétel** | Bejelentkezett, teszt csomag aktív |
| **Trigger** | Számlalimit közeledik / premium funkció igény |

**Fő folyamat:**
1. Felhasználó navigál az Előfizetés oldalra (Pricing.tsx)
2. Kiválasztja a kívánt csomagot
3. create-checkout Edge Function → Stripe Checkout Session
4. Felhasználó fizet a Stripe-on
5. check-subscription webhook frissíti a user_subscriptions rekordot
6. Tier, invoice_limit, period_start/end frissül

**Alternatív folyamatok:**
- **A1:** Meglévő előfizetés módosítás → customer-portal Edge Function → Stripe Customer Portal
- **A2:** Előfizetés lejárt → check-subscription-status → figyelmeztetés

**Utófeltétel:** Előfizetés aktív, számla limit frissítve.

---

## UC-013: Manuális Kifizetés Rögzítése

| Mező | Érték |
|------|-------|
| **Aktor** | Cégvezető |
| **Előfeltétel** | Bejelentkezett, van párosítatlan számla, amit nem a cég bankszámlájáról fizettek ki |
| **Trigger** | Számla kifizetve privát forrásból / készpénzből |

**Fő folyamat:**
1. Felhasználó megnyitja a Számlák oldalt
2. Kiválasztja a kifizetetlen számlát
3. Kattint a "Fizetés rögzítése" (vagy "Máshogyan kiegyenlített") gombra
4. Megnyílik a ManualPaymentDialog
5. Felhasználó megadja:
    - Kifizetés dátuma
    - Kifizetés módja (Privát kártya / Készpénz / Tagi hitel)
    - Opcionális megjegyzés
6. Rendszer meghívja a `record_manual_invoice_payment` RPC-t
7. Létrejön a virtuális tranzakció (`is_manual = true`)
8. Rendszer automatikusan párosítja a számlát a virtuális tranzakcióval
9. Számla státusza "Párosítva" (vagy "Kifizetve") lesz

**Utófeltétel:** Számla kifizetettként rögzítve, virtuális tranzakció létrejött és párosítva.

