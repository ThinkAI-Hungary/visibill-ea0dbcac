# P-028: Pricing Oldal

**Status:** Superseded (2026-06-07)
**Category:** Előfizetés & Pricing

**Question:** Hogyan jelenjen meg a pricing / csomagválasztó oldal?

**Decision:** ~~4 tier kártya layout, volume-based pricing, havi/éves toggle, Stripe Checkout redirect.~~ **ELTÁVOLÍTVA.**

**Változás története:**
- 2026-05 — Stripe Pricing oldal implementálva (Pricing.tsx, SubscriptionContext, Edge Functions)
- 2026-06-07 — **Teljes Stripe integráció eltávolítva a kódból.** Törölt fájlok: `Pricing.tsx`, `SubscriptionContext.tsx`, `SubscriptionUsage.tsx`, `check-subscription/`, `create-checkout/`, `customer-portal/` edge functions.

**Jelenlegi állapot:** Nincs pricing oldal. Az értékesítés egyszeri díjas modellre vált (lásd [004-pricing-model.md](../../business/decisions/004-pricing-model.md)). A jövőbeli vásárlási flow még nem tervezett.

**Rationale:** A Stripe subscription modell nem illeszkedett a célpiac igényeihez. A termék egyszeri díjjal lesz eladva.
