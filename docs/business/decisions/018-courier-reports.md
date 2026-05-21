# Decision 018: Futárszolgálat Riportok

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Milyen futárszolgálatokat támogat a rendszer és hogyan működik a riport feldolgozás?

**Decision:**
Támogatott futárszolgálatok: GLS, MPL, Mixpack, DPD, FoxPost, Sprinter.

CSV riport upload → automatikus parsing → NAV számla és tranzakció párosítás. Párosítási státuszok: unmatched → partial_trx → partial_nav → full → total. Sorok típusa: item (egyedi csomag) / total (napi aggregált összeg).

**Rationale:** Az e-commerce szektorban a futárszolgálat riportok és a NAV/banki adatok összevetése kritikus. Az automatikus párosítás jelentős időt takarít meg.
