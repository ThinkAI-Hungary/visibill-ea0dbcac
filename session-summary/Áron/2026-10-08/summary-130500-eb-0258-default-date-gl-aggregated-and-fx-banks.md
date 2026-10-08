# Session Summary — 2026-10-08 13:05

```text
feat(accounting): EB-0258 Teljesítés dátum-alapértelmezés, Összevont főkönyvi nézet, ~45 bankos hivatalos devizaárfolyam katalógus és NAV adószám auto-kitöltés

- EB-0258 Ügyféligények Megvalósítása (Lendvai Ádám / Kolos Transport Kft., tests/docs/lendvai_feature/258.pdf):
  - Teljesítés dátumának elsődlegessége (gl_date_basis: 'teljesites'):
    - A magyar számviteli gyakorlatnak megfelelően az alapértelmezett adatgyűjtési és szűrési alap mostantól a gazdasági teljesítés dátuma a kibocsátás helyett.
    - Sémamódosítás a company_settings táblában (DEFAULT 'teljesites'), DEFAULT_SETTINGS és GeneralLedgerPage kliens oldali állapot szinkronizálva.
  - Összevont (aggregált) főkönyvi nézet (gl_default_view_mode: 'osszevont'):
    - A cégprofilban beállítható, hogy a főkönyvi kivonat alapértelmezetten összevontan nyíljon meg.
    - Új AGGREGATED_EXPANDED_IDS készlet: megnyitáskor kizárólag a fő számlaosztályok (1, 2, 3, 4, 5, 8, 9, UNCLASSIFIED) látszanak, a mélyebb analitikus alábontások (pl. 311, 454, 466) és tételsorok csukva maradnak, megelőzve a képernyő 800+ soros elárasztását. Kibontás csak explicit felhasználói kattintásra történik.
  - Céges devizaárfolyam-bank és árfolyamtípus választó:
    - Létrejött az exchangeRateBanks.ts modul a 258.pdf-ben szereplő teljes, ~45 pénzintézetet tartalmazó hivatalos bankkatalógussal (MNB, MFB, OTP, CIB, Erste, Raiffeisen, MBH, K&H, Gránit, MagNet, Revolut, Wise stb.), országhívókkal, GIRO kódokkal és intelligens alias keresővel.
    - Cégprofilban konfigurálható a napi könyveléshez és a mérlegfordulónapi év végi devizaátértékeléshez használt bank, valamint az árfolyam típusa (közép / vétel / eladás).
  - NAV Adószám Auto-kitöltés:
    - A cégbeállítások felületen (BusinessSection.tsx) az adószám mező mellé egykattintásos "NAV lekérdezés" gomb került, amely a queryTaxpayerFromNav Edge Function segítségével automatikusan kitölti a cég hivatalos nevét, székhelyét és formázott adószámát.

- Minőségbiztosítás, Automatizált Tesztelés és Verifikáció:
  - Adatbázis migráció élesítve a Supabase adatbázisban: supabase/migrations/20261008140000_eb0258_accounting_settings_date_gl_fx.sql, index ellenőrizve.
  - Automatizált Vitest tesztcsomag: src/test/eb0258DefaultDateAndGlAggregated.test.ts (10/10 zöld teszt, bankkatalógus, profil alapértelmezések, összevont fa-kibontási logika lefedve).
  - Kapcsolódó regressziós tesztek: src/test/generalLedgerTreeCollapse.test.ts és src/test/eb0257JournalsAndPartnerLines.test.ts (15/15 zöld).
  - Oxlint ellenőrzés: 0 hiba a módosított komponenseken és modulokon.
  - TypeScript típusellenőrzés: npx tsc --noEmit 0 hibával lefutott.
  - Production build: npm run build 28.13s alatt sikeresen lefordult (dist/sw.mjs és minden chunk elkészült).
  - Dokumentáció frissítve: P-170 és A-231 döntési dokumentumok létrehozva és indexekbe bekötve.
  - Git állapot: minden módosítás commitolva és pusholva a távoli origin/main ágra (bea21517).
```
