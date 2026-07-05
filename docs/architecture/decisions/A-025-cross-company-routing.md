# A-025: Cross-company Invoice Routing

**Status:** Decided  
**Date:** 2026-07-02  
**Utoljára frissítve:** 2026-07-05

## Context

Egy user több céghez is tagként hozzá lehet rendelve (`company_members`). Gyakori használati eset,
hogy a user az összes számláját egyetlen cég alá tölti fel — ilyenkor a rendszernek automatikusan
fel kell ismernie, hogy melyik számla melyik céghez tartozik, és átmozgatnia.

**Példa:** Alexa 4 céget kezel (EURODIFFERENT, PADI, RAHIMI, Taxology). Mind a 4 cég számláit
a Think AI Kft. alá tölti fel. A worker automatikusan szétszortírozza.

## Decision

**Worker-side routing** az AI extract UTÁN. Modul: `company_router.py`.

**Tiered matching (2026-07-05):**

| Tier | Jel típus | Match stratégia | match_type | Erő |
|------|-----------|-----------------|------------|-----|
| 1 | Adószám (vevo/elado_vat_id) | 8-digit prefix match | `"tax"` | Legerősebb |
| 2 | Cégnév (vevo/elado_nev) | Normalizált exact + containment | `"name"` | Fallback |
| 2+ | Cégnév + Cím | Név match + cím megerősítés | `"name_address"` | Erősebb fallback |

**Algoritmus:**
1. User összes cégének lekérdezése (`company_members JOIN companies` — név, adószám, cím)
2. Ha ≤1 cég → SKIP (single-company user)
3. **Tier 1:** Extraktált adószámok (vevő/eladó) összehasonlítása a cégek adószámaival (8-digit prefix)
4. **Tier 2 (2026-07-05):** Ha Tier 1 nem talált, normalizált cégnév matching (exact + containment)
   - Opcionális cím megerősítés → `name_address` match type
   - Név normalizáció: lowercase, jogi suffixek eltávolítása, kötőjel/pont/idézőjel → szóköz
5. Match alapján routing döntés:
   - **Vevő match** → INBOUND (a cég a vevő) — prioritás ha mindkettő match-el
   - **Eladó match** → OUTBOUND (a cég az eladó)
6. Routing alkalmazása:
   - **Normál eset:** `invoices` UPDATE ELŐSZÖR → `invoice_uploads` UPDATE UTÁNA
   - **Duplikátum eset:** Ha a target cégnél már létezik azonos bizonylatsorszámú számla:
     - Meglévő invoice upsert-elődik friss adatokkal
     - Duplikátum invoice törlése az eredeti cégnél
     - Upload átmozgatása a target céghez
7. Audit log INSERT az eredeti cég naplójába (`action = 'átirányítás'`, `match_type` a details-ben)

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
- Tier 2 név matching biztosítja a routing-ot adószám nélküli számlák esetén is (2026-07-05)
- Email alias-ok is működnek cross-company: beérkezik az alias cégéhez, a worker korrigálja
- Audit trail biztosított (`átirányítás` action type, `match_type` a details-ben)
- Duplikátum számla intelligens merge — upsert a meglévőbe, nem dob hibát
- Non-critical: hiba esetén a számla az eredeti cégnél marad

**Negatív:**
- A routing CSAK a user `company_members` tagságai között történik — ha a user nincs a céghez rendelve, nincs routing
- Külföldi adószámok (FOREIGN: prefix) nem matchelhetők Tier 1-ben — de Tier 2 névre matchelhet
- Név matching false positive kockázat — minimalizálva: csak exact + containment, nincs fuzzy; cím csak megerősítő

## Related

- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
- [A-011: Email Processing](./A-011-email-processing.md)
- [A-017: Security Architecture](./A-017-security-architecture.md) (audit trail)
- [BDR 009: Multi-company Model](../../business/decisions/009-multi-company-model.md)
- [BDR 034: Worker Pipeline](../../business/decisions/034-worker-pipeline.md)
- Worker docs: `DECISIONS.md` ADR-027 (routing) + ADR-028 (poison pill)
