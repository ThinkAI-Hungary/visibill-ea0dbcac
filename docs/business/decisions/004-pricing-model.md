# Decision 004: Árazási Modell & Tier Nevek

**Status:** Open

**Category:** Célpiac & Üzleti Modell

**Question:** Mi az egyes előfizetési csomagok végleges neve, ára, és mit tartalmaznak? A jelenlegi tier nevek (salmon / tuna / shark / orca) véglegesek? Mennyi a számla limit tier-enként? Hány cég kezelhető az egyes csomagokban?

**Decision:**

**Jelenlegi implementáció:**

| Tier | DB név | Számla limit | Megjegyzés |
|------|--------|-------------|------------|
| Alap | `salmon` | ? | — |
| Közepes | `tuna` | ? | — |
| Haladó | `shark` | ? | — |
| Prémium | `orca` | ? | — |
| Teszt | `teszt` | 999,999 | Alapértelmezett, fejlesztési célokra |

Stripe integráció kész: checkout, customer portal, subscription management.

**Rationale:**
