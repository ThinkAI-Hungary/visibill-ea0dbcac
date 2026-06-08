# P-029: Limit Közeledés & Túllépés Kezelés

**Status:** Superseded (2026-06-07)
**Category:** Előfizetés & Pricing

**Question:** Hogyan jelezzük a felhasználónak hogy közeledik a számlalimithez?

**Decision:** ~~Grace period — 100% felett +10% grace, utána blokkolás + upgrade CTA.~~ **ELTÁVOLÍTVA.**

**Változás története:**
- 2026-05 — SubscriptionUsage widget + grace period terv
- 2026-06-07 — **Stripe integráció eltávolítva.** A `SubscriptionUsage.tsx` widget és a `SubscriptionContext.tsx` (canProcessInvoice, incrementUsage) törölve.

**Jelenlegi állapot:** Nincs számlalimit és nincs grace period. Az egyszeri díjas modellben (lásd [004-pricing-model.md](../../business/decisions/004-pricing-model.md)) korlátlan a számla feldolgozás.

**Rationale:** Egyszeri vásárlás → korlátlan használat. Limit kezelés nem releváns.
