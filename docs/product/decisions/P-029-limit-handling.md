# P-029: Limit Közeledés & Túllépés Kezelés

**Status:** Decided  
**Category:** Előfizetés & Pricing

**Question:** Hogyan jelezzük a felhasználónak hogy közeledik a számlalimithez?

**Decision:** Grace period — 100% felett +10% grace, utána blokkolás + upgrade CTA.

**TODO:**
- 80%-nál: sárga figyelmeztetés banner a dashboardon
- 100%-nál: grace period indul (+10% extra kapacitás)
- Grace period alatt: upgrade CTA kiemelt megjelenítés
- Grace period lejárta után: feltöltés blokkolása, upgrade kötelező
- SubscriptionUsage widget: progress bar + limit közeledés vizualizáció

**Rationale:** A grace period nem frusztrálja a usert azonnali blokkolással, de motiválja az upgrade-et. A +10% grace elegendő időt ad a döntéshozatalra anélkül hogy korlátlan ingyenes használatot engedne.
