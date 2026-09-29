# Session Summary — 2026-09-29 12:15

```text
feat(general-ledger, vat, docs): NAV 2665 replika nyomtatvány 08-as lap szélesség-túlcsordulás javítása, egyéni számlatükör téves főkönyvi szám törlése és felületi önkiszolgáló törlési funkció, A-178/P-139 és tesztek

- NAV 2665 Digitális Nyomtatványreplika 08-as Lap Szélesség-túlcsordulás Javítása (`src/features/vat/components/replica/Nav2665Sheet08.tsx`, `Nav2665Sheet07.tsx`, `Nav2665CharBox.tsx`)
  - Felhasználói hibajelzés: az ÁFA Bevallás oldalon a NAV replika nyomtatvány utolsó oldalán (7. / 08-as lap) a jobb széle szélességében kilógott a keretből
  - Gyökérok: a lapon használt meződobozok (karakterboxok, adószám boxok, dátum boxok) fix 244px/162px szélességgel rendelkeztek, ami a sokoszlopos táblázatos felosztásban túlnyúlt az A4 / nyomtatvány konténerén
  - Megoldás: `compact?: boolean` opció bevezetése a `Nav2665CharBox`, `Nav2665TaxNumberBoxes` és `Nav2665DateBoxes` komponensekbe (~142px és ~88px szélességre méretezve), explicit `<colgroup>` és `table-fixed w-full` elrendezés
  - Minőségbiztosítás: 10/10 replika unit teszt sikeresen lefutott (`src/test/vat/nav2665Replica.test.tsx`)

- TS Consult Kft. Support Hibajegy Kivizsgálás és Adatbázis-tisztítás (`gl_accounts`, `bs_mapping`)
  - Ügyfélmegkeresés: Surányi Pál (TS Consult Kft.) – „Tévesen létrehozott főkönyvi számot valahogy tudok törölni?” (4668-as számla a 466 alatt a „Jó számlatükör” egyéni sablonban)
  - Vizsgálat: a 4668-as számlához nem kapcsolódott könyvelési tétel sem az analitikában (845 tétel ellenőrizve), sem a naplósorokban, alszámlája sem volt
  - Megoldás: az idegen kulcs védelem miatt a kapcsolódó `bs_mapping` rekord eltávolítása után a `gl_accounts` rekord törlésre került a TS Consult Kft. sablonjából

- Új Funkció: Egyéni Számlatükör Főkönyvi Szám Törlése a Felületen (`GeneralLedgerTable.tsx`, `hu/accounting.json`, `hr/accounting.json`)
  - Felületi képesség: a felhasználók a cég saját egyéni sablonjaiban (`type === 'custom' && company_id === selectedCompany.id`) a főkönyvi kivonatban bármely levél számla kártyáján vagy alsó szintű tétel `<Sheet>` paneljén közvetlenül kezdeményezhetik a törlést
  - Biztonsági reteszek: a rendszer ellenőrzi az alszámlák hiányát (`parent_id`), a könyvelési naplósorok hiányát (`acc_journal_lines`, `gl_journal_entries`), és megerősítő `<AlertDialog>` ablakot jelenít meg
  - Függőségek kezelése: törléskor a relációs `bs_mapping` és `pnl_mapping` rekordok is automatikusan törlődnek, majd lefut a `gl_accounts` törlés és a teljes cache invalidáció
  - Kétnyelvű lokalizáció: magyar és horvát fordítások beépítve

- Minőségbiztosítás és Build
  - TypeScript fordítás: `npx tsc --noEmit` hibátlan (code 0)
  - Unit tesztek: 40/40 teszt zöld (`DeleteGlAccount.test.tsx` 3/3 passed, teljes general-ledger tesztcsomag 100%)
  - Production Vite build: `npm run build` sikeres (25.42s)
  - Git commit & push: `7cb89ea2` a `main` ágon

- Architektúra és Termék Dokumentáció Szinkronizáció (/visibill-doc-sync)
  - `A-178-custom-chart-of-accounts-unused-account-deletion.md` létrehozva és regisztrálva
  - `P-139-custom-chart-of-accounts-unused-account-deletion-ux.md` létrehozva és regisztrálva
```
