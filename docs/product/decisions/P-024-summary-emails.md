# P-024: Összefoglaló Emailek

**Status:** Decided  
**Category:** Értesítések

**Question:** Kap-e a felhasználó heti/havi összefoglaló emailt?

**Decision:** Igen — minimál számok + trendek, heti és havi bontásban. Backend-only implementáció (Edge Function + cron trigger), nincs UI felület.

**Implementáció:**
- `send-weekly-summary` Edge Function (cron: hétfő)
- `send-monthly-summary` Edge Function (cron: hónap 1.)

**Rationale:** Az összefoglalók automatikusan mennek cron triggerrel, a felhasználónak nem kell semmit tennie. A toggle a Settings EmailPreferences szekcióban kezelhető.
