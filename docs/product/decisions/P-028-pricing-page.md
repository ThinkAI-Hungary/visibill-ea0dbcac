# P-028: Pricing Oldal

**Status:** Decided  
**Category:** Előfizetés & Pricing

**Question:** Hogyan jelenjen meg a pricing / csomagválasztó oldal?

**Decision:** 4 tier kártya layout, volume-based pricing, havi/éves toggle, Stripe Checkout redirect.

**Tierek:**
- **Salmon** (Free) — 3 számla/hó, ingyenes
- **Tuna** — Kisvállalkozásoknak, 25-500 számla/hó
- **Shark** — Közepes vállalkozásoknak, 25-500 számla/hó
- **Orca** — Nagyvállalatok számára, 25-500 számla/hó

**Volume sávok:** 25, 50, 75, 150, 300, 500 számla/hó

**Fizetés:** Havi / éves toggle (éves = 2 hónap ingyen). Stripe Checkout redirect, Customer Portal link.

**Implementáció:** Pricing.tsx, useSubscription context, create-checkout + customer-portal Edge Functions.

**Rationale:** Kártya layout áttekinthető, a volume-based pricing rugalmas, a Stripe Checkout biztonságos és megbízható.
