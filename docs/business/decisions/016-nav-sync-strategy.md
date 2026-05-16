# Decision 016: NAV Szinkronizáció Stratégia

**Status:** Decided

**Category:** NAV Integráció

**Question:** Hogyan és milyen gyakran szinkronizáljuk a számlákat a NAV-val?

**Decision:**
- **Manuális sync** — felhasználó által indított (nav-sync Edge Function)
- **Automatikus sync** — ütemezett cron job (nav-auto-sync Edge Function), minden aktív NAV credential-hoz
- **Szinkronizáció logolás** — nav_sync_logs tábla (920 log a production-ben)
  - Nyomon követett adatok: sync típus, irány, dátum tartomány, lekért számlák száma, státusz, hiba üzenet, időtartam (ms)
- **Partner automatikus felismerés** — NAV számlákból automatikus partner létrehozás (adószám alapján), supplier_partner_id FK

**Rationale:** Az automatikus sync biztosítja, hogy a rendszer mindig naprakész legyen a NAV-val. A manuális sync lehetőséget ad ad-hoc frissítésre. A részletes logolás segíti a hibakeresést és a rendszer monitorozást.
