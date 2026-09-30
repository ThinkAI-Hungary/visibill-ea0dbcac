# Session Summary — 2026-09-30 14:07

```text
feat(payroll, petty-cash, vat): 3-oszlopos bérszámfejtés EFO szétválasztással, házipénztár számlakiegyenlítés RPC hotfix (ticket support) és ÁFA A60 közösségi összesítő

- eaisyBooks Bérszámfejtés 3-Oszlopos Dashboard & EFO Különválasztás (`PayrollDashboardPage.tsx`, `usePayrollData.ts`)
  - A fő bérszámfejtési áttekintő rács átszervezése 3 különálló, reszponzív oszlopba:
    1. Havi ciklusok: időrendi bérszámfejtési ciklusok, 8-lépéses folyamatjelző sáv (1/8 ... 8/8), állapotjelvények (Tervezet, Adatbekérés, Számfejtve, Jóváhagyva, Lezárva) és új ciklus indítása.
    2. Foglalkoztatottak: kizárólag az állandó jogviszonyú munkavállalók (munkaviszony, társas vállalkozó, megbízási jogviszony), dedikált keresőmező, munkakör és TAJ adatok, kilépő iratok közvetlen elérése, létszám badge.
    3. EFO: kifejezetten az egyszerűsített foglalkoztatott (alkalmi munka, mezőgazdasági/turisztikai idénymunka) dolgozók listája, külön keresőmező, TAJ szám és éves 120 napos keretfelhasználás kijelzése (nap / 120 nap), küszöbérték-figyelmeztetéssel (>90 nap esetén kiemelt figyelmeztetés).
  - Dolgozók intelligens szétválogatása jogviszonykódok (1138, 81, 82, 83, efo_alkalmi), `employment_type` és NAV ÜPO `accounty_efo_entries` rekordok alapján.
  - Felső KPI kártya felirat dinamikus bontása: pl. "2 állandó • 4 EFO".
  - Új adathook és típus: `EfoEntry` interfész és `useCompanyEfoEntries` hook a NAV ÜPO-ból szinkronizált EFO napok és kvóták lekérdezésére.

- Foglalkoztatotti Részletes Lista Típusfülek & Útvonalkontextus (`EmployeesPage.tsx`)
  - Típus szerinti gyorsválasztó fülek implementálása a státuszfülek mellett: Mind (összes dolgozó), Állandó (sima munkavállalók száma), EFO (alkalmi dolgozók száma).
  - URL paraméteres állapotkezelés (`useSearchParams`): a dashboardról érkező `?type=regular` és `?type=efo` paraméterek automatikus kiértékelése és kétirányú szinkronizációja.
  - Új "Típus" oszlop és jelvények a táblázatban az Állandó és EFO jogviszonyok egyértelmű megkülönböztetésére.
  - Kontextus-megőrző belső útvonalak: az alkalmazott adatlap, kilépő iratok, új dolgozó varázsló és Excel import hivatkozások mostantól precízen megőrzik a cégazonosítót (`companyId`), az érvényes dátumintervallumot (`effectiveDateRange`) és az opcionális `/hr` előtagot.

- Házipénztár Számlakiegyenlítés RPC Hotfix & Ticket Support (VBV Vision Kft. — Kiss-Százi Emese)
  - Ügyfél hibajegy kivizsgálása a `/visibill-ticket-support` protokoll szerint: a VBV Vision Kft. házipénztárában az "Utalásos számla KP-ban rendezve" dialógusban szállítói számla (SZZJ-2026-3, Szanyi Zoltánné, -160 000 Ft) kiegyenlítésének rögzítésekor a rendszer `column "partner_id" does not exist` hibát dobott.
  - Gyökérok feltárása: a 2026-09-24-i kétirányú számlakiegyenlítési migrációban (`20260924200000_petty_cash_inbound_settlement.sql`) a `MIN(partner_id::text)::uuid` kifejezés közvetlenül az `invoices` táblára hivatkozott, holott az `invoices` táblában nincs `partner_id` oszlop (a számlák adószám és név mezőkkel azonosítják a partnereket).
  - Javítás és migráció: `supabase/migrations/20260930140000_fix_settle_invoices_via_petty_cash_partner_id.sql`
    * Hibás `MIN(partner_id::text)` eltávolítva az `invoices` lekérdezésből.
    * Egyedi számlakiegyenlítés esetén a tárolt eljárás a számlán szereplő adószám (8 jegyű törzsszám normalizálással) vagy név alapján intelligensen feloldja a partner ID-t a `public.partners` táblából, és ezt rögzíti a pénztári tételben (`petty_cash_entries.partner_id`).
  - Élesítés: a migráció az éles Supabase PostgreSQL adatbázisban sikeresen lefutott (`npx supabase db push`).
  - Ügyfél-kommunikáció: professzionális, közvetlen, technikai zsargontól mentes magyar válaszlevél összeállítva az ügyfélszolgálat számára.

- ÁFA A60 Közösségi Összesítő Nyilatkozat & VIES Cross-Check
  - Hivatalos A60-as összesítő nyilatkozat táblázat és számítási motor (`VatA60Table.tsx`, `core/vatEngine.ts`).
  - EU-s közösségi termékértékesítések és szolgáltatásnyújtások tételes és partner-összesített kimutatása, VIES státusz és adószám-formátum ellenőrzéssel.
  - Új migráció és BDR: `supabase/migrations/20260930120000_fix_vat_a60_community_and_vies.sql` és `docs/business/decisions/064-a60-community-vat-and-vies-crosscheck.md`.

- Minőségbiztosítás, Verifikáció & Dokumentáció
  - Új egységtesztek: `src/test/accounty/payrollEfoSeparation.test.ts` (dolgozók szétválogatása, 120 napos keretfelhasználás, küszöbérték-riasztás, NAV ÜPO feloldás — 4/4 passed).
  - Pénztári validációs teszt: `src/test/pettyCashManualEntryValidation.test.ts` (11/11 passed).
  - Teljes Accounty tesztkészlet futtatása: 61 tesztfájl, 828 teszt hiba nélkül lefutott.
  - Statikus típusellenőrzés: `npx tsc --noEmit` hibátlan (exit code 0).
  - Döntési dokumentációk szinkronizálása: BDR 032 (`032-payroll-module.md`) és ADR A-155 (`A-155-petty-cash-inbound-settlement-and-period-closing.md`) frissítve.
```
