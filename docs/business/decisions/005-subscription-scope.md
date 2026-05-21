# Decision 005: Előfizetés Scope

**Status:** Open

**Category:** Célpiac & Üzleti Modell

**Question:** Az előfizetés felhasználó-szintű vagy cég-szintű? Jelenleg a user_subscriptions tábla user_id-hoz kötött. Ha egy felhasználó több céget kezel, egy előfizetés fedi le az összeset? Vagy cégenként külön előfizetés szükséges?

**Decision:**

**Jelenlegi implementáció:** Az előfizetés felhasználó-szintű (user_subscriptions.user_id). Egy felhasználónak egy subscription-je van, ami az összes általa kezelt cégre vonatkozik. Az invoices_used számláló az összes cég számláit összesíti.

**Rationale:**
