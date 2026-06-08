# Decision 005: Előfizetés Scope

**Status:** Superseded

**Category:** Célpiac & Üzleti Modell

**Question:** Az előfizetés felhasználó-szintű vagy cég-szintű?

**Decision:** Kérdés érvényét vesztette — az üzleti modell egyszeri díjasra változott (lásd [004-pricing-model.md](./004-pricing-model.md)).

**Változás története:**
- 2026-05 — Subscription felhasználó-szintű volt (`user_subscriptions.user_id`)
- 2026-06-07 — **Stripe integráció eltávolítva.** Egyszeri díjas modellre váltás.

**Jelenlegi állapot:** A `user_subscriptions` tábla még létezik a DB-ben, de a frontend kód nem hivatkozik rá. A jogosultság-kezelés új modellje még kidolgozás alatt.

**Rationale:** Az egyszeri díjas modellben a subscription scope kérdés irreleváns. A hozzáférés-kezelést más mechanizmus (pl. licenckulcs, aktiválás) fogja biztosítani.
