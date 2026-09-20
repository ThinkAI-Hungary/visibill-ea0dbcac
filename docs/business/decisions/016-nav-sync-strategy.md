# Decision 016: NAV Szinkronizáció Stratégia

**Status:** Decided

**Category:** NAV Integráció

**Question:** Hogyan és milyen gyakran szinkronizáljuk a számlákat a NAV-val?

**Decision:**
- **Manuális sync** — felhasználó által indított (nav-sync Edge Function)
- **Automatikus sync & Hajnali Terheléselosztás** — ütemezett cron job (`nav-auto-sync` Edge Function), amely 01:00 és 04:00 UTC között 4 idősávra (slot 0..3) osztja el a cégeket UUID hex modulo 4 alapján, megelőzve a NAV API és a Supabase csúcsterhelést (lásd: [A-130](../../architecture/decisions/A-130-nav-auto-sync-dawn-load-staggering.md)).
- **Szinkronizáció logolás** — nav_sync_logs tábla
  - Nyomon követett adatok: sync típus, irány, dátum tartomány, lekért számlák száma, státusz, hiba üzenet, időtartam (ms), slot azonosító
- **Partner automatikus felismerés** — NAV számlákból automatikus partner létrehozás (adószám alapján), supplier_partner_id FK
- **Azonnali partner-alapú kategorizálás** — a beszinkronizált bejövő számlák azonnal megkapják a domináns partnerkategóriát a mentéskori DB triggeren keresztül (lásd: [A-129](../../architecture/decisions/A-129-partner-history-majority-categorization.md), [BRD 059](./059-partner-history-majority-categorization.md)).

**Rationale:** Az automatikus sync biztosítja, hogy a rendszer mindig naprakész legyen a NAV-val. A hajnali idő-ablakos staggering kiiktatja a NAV rate limitinget és az Edge Function timeoutokat. A manuális sync lehetőséget ad ad-hoc frissítésre. A részletes logolás segíti a hibakeresést és a rendszer monitorozást.

## Kapcsolódó
- [A-130: NAV Automatikus Szinkronizáció Hajnali Idő-ablakos Terheléselosztása](../../architecture/decisions/A-130-nav-auto-sync-dawn-load-staggering.md)
- [A-129: Partner-történeti Többségi Szabályú Számlakategorizálás & DB Triggerek](../../architecture/decisions/A-129-partner-history-majority-categorization.md)
- [059: Partner-történeti Többségi Számlakategorizálás](./059-partner-history-majority-categorization.md)

