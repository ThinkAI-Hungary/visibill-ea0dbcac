# A-025: Cross-company Invoice Routing

**Status:** Decided  
**Date:** 2026-07-02  
**Utoljára frissítve:** 2026-07-02

## Context

Egy user több céghez is tagként hozzá lehet rendelve (`company_members`). Gyakori használati eset,
hogy a user az összes számláját egyetlen cég alá tölti fel — ilyenkor a rendszernek automatikusan
fel kell ismernie, hogy melyik számla melyik céghez tartozik, és átmozgatnia.

**Példa:** Alexa 4 céget kezel (EURODIFFERENT, PADI, RAHIMI, Taxology). Mind a 4 cég számláit
a Think AI Kft. alá tölti fel. A worker automatikusan szétszortírozza adószám alapján.

## Decision

**Worker-side routing** az AI extract UTÁN. Modul: `company_router.py`.

**Algoritmus:**
1. User összes cégének lekérdezése (`company_members JOIN companies`)
2. Ha ≤1 cég → SKIP (single-company user)
3. Extraktált adószámok (vevő/eladó) összehasonlítása a cégek adószámaival (8-digit prefix match)
4. Match alapján routing döntés:
   - **Vevő adószám match** → INBOUND (a cég a vevő) — prioritás ha mindkettő match-el
   - **Eladó adószám match** → OUTBOUND (a cég az eladó)
5. Routing alkalmazása:
   - **Normál eset:** `invoices` UPDATE ELŐSZÖR → `invoice_uploads` UPDATE UTÁNA
   - **Duplikátum eset:** Ha a target cégnél már létezik azonos bizonylatsorszámú számla:
     - Meglévő invoice upsert-elődik friss adatokkal
     - Duplikátum invoice törlése az eredeti cégnél
     - Upload átmozgatása a target céghez
6. Audit log INSERT az eredeti cég naplójába (`action = 'átirányítás'`)

**Email routing:** Ha egy email alias az A céghez tartozik, de a csatolt számla a B céghez kellene
kerüljön (mindkettő a user tagságai) — a webhook az A cég `company_id`-jával dolgozik, a routing a
worker-ben történik.

**Tenant definíció:** `company_members.user_id` (NEM `companies.owner_id`).

**Művelet sorrend:** Az `invoices` UPDATE előbb történik mint az `invoice_uploads` UPDATE,
hogy ha a unique constraint (`company_id, bizonylatsorszam`) ütközik, az upload ne maradjon
inkonzisztens állapotban.

## Consequences

**Pozitív:**
- Multi-company user-ek bármelyik cégük alá tölthetnek — a rendszer szétválogat
- Email alias-ok is működnek cross-company: beérkezik az alias cégéhez, a worker korrigálja
- Audit trail biztosított (`átirányítás` action type)
- Duplikátum számla intelligens merge — upsert a meglévőbe, nem dob hibát
- Non-critical: hiba esetén a számla az eredeti cégnél marad

**Negatív:**
- A routing CSAK a user `company_members` tagságai között történik — ha a user nincs a céghez rendelve, nincs routing
- Külföldi adószámok (FOREIGN: prefix) nem matchelhetők — a routing csak magyar 8-jegyű törzsszámra működik
- Nincs UI feedback a routing-ról (MVP scope) — csak az audit log rögzíti

## Related

- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
- [A-011: Email Processing](./A-011-email-processing.md)
- [A-017: Security Architecture](./A-017-security-architecture.md) (audit trail)
- [BDR 009: Multi-company Model](../../business/decisions/009-multi-company-model.md)
- [BDR 034: Worker Pipeline](../../business/decisions/034-worker-pipeline.md)
- Worker docs: `DECISIONS.md` ADR-027 (routing) + ADR-028 (poison pill)

