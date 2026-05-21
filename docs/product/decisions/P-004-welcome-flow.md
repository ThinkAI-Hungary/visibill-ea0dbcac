# P-004: Welcome Email & Értesítések

**Status:** Decided  
**Category:** Onboarding & Első Élmény

**Question:** Milyen üdvözlő kommunikációt kap az új felhasználó?

**Decision:** Welcome email + email verifikáció, drip campaign nélkül.

**Current Implementation:**
- send-welcome-email Edge Function regisztráció után
- verify-email Edge Function email megerősítésre
- Email alias automatikus létrehozás (cegnev@inbox.visibill.hu)

**Rationale:** Minimális, nem spam-el. Drip campaign bevezetése akkor lesz aktuális ha az aktivációs ráta alacsonynak bizonyul.
