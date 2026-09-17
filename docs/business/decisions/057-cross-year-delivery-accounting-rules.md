# Decision 057: Évek Közötti Áthúzódó Teljesítésű Számlák Számviteli és ÁFA Üzleti Szabályzata

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** Business Rule / Accounting / General Ledger / Tax Compliance  
**Érintett területek:** Főkönyv, évzárás, ÁFA analitika (2665), időbeli elhatárolások, 46671 karton  
**Kapcsolódó döntések:** [A-121: Cross-Year Delivery Guard](../../architecture/decisions/A-121-cross-year-delivery-vat-and-general-ledger-guard.md), [BRD 043: Könyvelési Naplók](./043-accounting-journals.md), [BRD 049: Főkönyvi Dátum Alap](./049-gl-date-basis-fulfillment-vs-issue.md), [BRD 050: Főkönyvi Könyvelési Státusz](./050-gl-posting-status-and-journal-governance.md)

---

## Question

Hogyan kell eljárnia a könyvelési és ÁFA motornak azokban az esetekben, amikor egy számla teljesítési dátuma az előző üzleti évre esik (pl. 2025. december), de a bizonylat kibocsátása vagy beérkezése már a tárgyévben történik (pl. 2026. január), megvédve a már lezárt üzleti év kartonjait és a helyes ÁFA bevallási időszakokat?

---

## Decision

1. **Számviteli Időbeli Elhatárolás Elsőbbsége (Sztv. 15. §):**
   - A költséget/ráfordítást annak az üzleti évnek a gazdálkodásában kell elszámolni, amelyik évben a teljesítés történt (2025).
   - Amennyiben az előző üzleti év könyvelési időszaka lezárult (`is_closed = true`), a rendszer szigorúan megtiltja az automatikus visszamenőleges bejegyzések létrehozását a lezárt év naplójába.
2. **ÁFA Levonhatósági Időszak és Áthúzódó Tételek (Áfa tv. 55-58. §, 119-120. §):**
   - A számla ÁFA tartalma kizárólag a számla rendelkezésre állásakor (kibocsátás/beérkezés hónapja) vagy – ha az előző évi decemberi bevallás még nem lett benyújtva – a decemberi időszakban vonható le.
   - Ha a számla januárban érkezik és az előző év nem nyitható meg, a tétel a **46671** (Előzetesen felszámított áthúzódó / le nem vonható ÁFA) főkönyvi számlára kerül tervezetként, és nem torzíthatja a normál 4661/4662 levonható ÁFA kartonokat.
3. **Automatikus vs. Szakértői Könyvelői Jóváhagyás:**
   - Az évek közötti áthúzódó tételek soha nem véglegesülhetnek teljesen némán (blind post).
   - A rendszer `pending_accountant_review` státuszba helyezi a tervezetet, és figyelmeztető jelzéssel látja el a könyvelő számára az ÁFA és Főkönyv felületeken.

---

## Rationale

A lezárt pénzügyi évek utólagos felborulása az egyik legveszélyesebb hibaforrás a könyvelésben (NAV ellenőrzés, adóbírság, téves társasági adó és osztalékalap). Az üzleti szabály biztosítja a jogszabályi megfelelést és a könyvelői felelősség védelmét.
