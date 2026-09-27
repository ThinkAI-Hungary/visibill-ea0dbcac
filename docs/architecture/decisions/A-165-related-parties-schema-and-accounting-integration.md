# A-165: Kapcsolt Vállalkozások Adatmodell, Forgalmi Lekérdezések és Kontírozási Integráció

**Állapot:** Elfogadva (Accepted)  
**Dátum:** 2026-09-27  
**Döntéshozó:** Architecture & Database Team  
**Kapcsolódó döntések:** A-003, A-024, A-118, P-124  

---

## 1. Döntési Kontextus

A P-124 termékdöntés alapján meg kell valósítani a partnertörzs kapcsolt vállalkozási adatmodelljét, a számlák kapcsolt kontírozási szabályait, valamint a gyors és skálázható forgalmi aggregációt multi-tenant RLS környezetben.

---

## 2. Adatbázis Séma Bővítés (`public.partners`)

A meglévő `partners` tábla kibővítése a következő oszlopokkal:
```sql
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS relation_type TEXT CHECK (relation_type IN ('parent', 'subsidiary', 'sister', 'owner_interest', 'other')),
  ADD COLUMN IF NOT EXISTS ownership_percent NUMERIC(5, 2) CHECK (ownership_percent >= 0 AND ownership_percent <= 100),
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS parent_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_party_notes TEXT;

-- Indexek a gyors szűréshez és kapcsoláshoz
CREATE INDEX IF NOT EXISTS idx_partners_related ON public.partners(company_id, related_party) WHERE related_party = true;
CREATE INDEX IF NOT EXISTS idx_partners_parent_partner ON public.partners(parent_partner_id) WHERE parent_partner_id IS NOT NULL;
```

---

## 3. Könyvelési Kontírozási Szabályok (`invoiceGlSides.ts` & Főkönyv)

Amikor egy partner kapcsolt vállalkozásként van megjelölve (`related_party = true`), a kontírozás az alábbi számviteli standardok szerint módosul:
* **Vevőkövetelés (Outbound számla):**
  * Független partner esetén: `311` (Belföldi vevők) vagy `316` (Külföldi vevők).
  * Kapcsolt partner esetén: `312` / `3121` (Követelések kapcsolt vállalkozással szemben).
  * Árbevétel: `912` (Belföldi értékesítés árbevétele kapcsolt vállalkozással szemben) a `911` helyett.
* **Szállítói kötelezettség (Inbound számla):**
  * Független partner esetén: `454` (Belföldi szállítók) vagy `455` (Külföldi szállítók).
  * Kapcsolt partner esetén: `455` / `4551` (Kötelezettségek kapcsolt vállalkozással szemben).
* **Egyedi felülírás:**
  * Ha a partnernél megadásra került a `custom_gl_account_id`, a rendszer ezt használja elsődleges partner számlaként.

---

## 4. Forgalmi Kimutatási és Aggregációs Logika

A kimutatás nem végez felesleges kliensoldali iterációt több tízezer számlán.
A `useRelatedPartyTurnover` hook:
1. Lekéri a cég aktív kapcsolt partnereit (`partners.related_party = true`).
2. Összegyűjti az adószámokat (`tax_number` és normalizált 8 jegyű törzsszámok).
3. Párhuzamosan lekérdezi az adott időszakra vonatkozó számlaforgalmat mindkét oldalról:
   * **Kimenő:** `nav_invoices` (ahol `supplier_tax_number = company.tax_number` és `customer_tax_number IN (kapcsolt adószámok)`) + `invoices` kimenő tételek.
   * **Bejövő:** `nav_invoices` (ahol `customer_tax_number = company.tax_number` és `supplier_tax_number IN (kapcsolt adószámok)`) + `invoices` bejövő tételek.
4. Kiszámítja partnerenként és göngyölve:
   * Nettó, áfa és bruttó forgalom (külön kimenő és bejövő).
   * Fizetési mód szerinti bontás (kiemelve a készpénzes kifizetéseket az Art. 114. § 1,5M Ft limithez).
   * Nyitott szaldó (kiegyenlítetlen számlák összege).
   * Éves göngyölt forgalom a 100M Ft-os transzferár határhoz.

---

## 5. Kapcsolódó Dokumentáció és Döntések
- [P-124: Kapcsolt Vállalkozások Kezelése és Forgalmi Kimutatása a Partnertörzsben](../../product/decisions/P-124-related-parties-management-and-turnover-ux.md)
- [21-master-data: Törzsadatok Adatbázis Séma](../database/21-master-data.md)
- [A-024: Partner Upsert Stratégia](./A-024-partner-upsert-strategy.md)

