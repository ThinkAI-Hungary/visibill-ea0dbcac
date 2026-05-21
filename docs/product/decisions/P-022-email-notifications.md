# P-022: Email Értesítés Típusok

**Status:** Decided  
**Category:** Értesítések & Kommunikáció  
**BRD Reference:** REQ-10.1

**Question:** Milyen email értesítéseket kap a felhasználó és mennyire konfigurálhatóak?

**Decision:** Típusonkénti toggle (granular kontroll), preset-ek nélkül.

**Current Implementation:**
- EmailPreferences komponens (Settings oldalon)
- user_email_preferences tábla: típusonkénti be/ki kapcsolás
- Típusok: számla feldolgozás, hibák, NAV sync, tranzakció párosítás, heti összefoglaló, havi összefoglaló
- Edge Function cron jobok: send-weekly-summary, send-monthly-summary

**Rationale:** A granular toggle működik és a felhasználó pontosan azt kapja amit akar. Az alapértelmezések jók (minden bekapcsolva). Preset-ek bevezetése felesleges bonyolítás.
