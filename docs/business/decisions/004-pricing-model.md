# Decision 004: Árazási Modell

**Status:** Partially Decided

**Category:** Célpiac & Üzleti Modell

**Question:** Mi az értékesítési modell és az árazási struktúra?

**Decision:** Egyszeri díjas modell — a felhasználó egyszeri vásárlással kapja a szoftvert.

**Változás története:**
- 2026-05 — Stripe subscription (SaaS) modell implementálva (salmon/tuna/shark/orca tierek)
- 2026-06-07 — **Stripe integráció eltávolítva a kódból.** Nem subscription modellel lesz eladva a termék. Egyszeri díj.

**Jelenlegi állapot:**
- A Stripe kód (checkout, customer portal, subscription management) eltávolítva
- A `user_subscriptions` tábla még létezik a DB-ben (inaktív)
- Az árazási struktúra (mennyi legyen az egyszeri díj, mit tartalmazzon) még nyitott

**Még eldöntendő:**
- Egyszeri díj összege
- Mit tartalmaz az alap csomag vs. Accounty modul
- Van-e ingyenes próba időszak
- Frissítések/upgradek díjazása

**Rationale:** Az előfizetéses modell nem illeszkedett a célpiac igényeihez. A magyar KKV cégvezetők inkább egyszeri vásárlást preferálnak.
