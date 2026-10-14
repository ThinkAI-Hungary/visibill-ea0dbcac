# Session Summary — 2026-10-12 23:15

```text
feat(journals, invoices, worker): Naplók táblázatfejléc rendezés, számlatétel Tartozik/Követel öröklődés fix, és banki tranzakciófeldolgozás élesítés (EB-0220)

- Banki Tranzakciófeldolgozás és Matching Gyökérok-Felszámolás (WR Home Kft. & Worker Engine)
  - Hiba feltárása (DigitalOcean worker prod logok): a tömeges kivonat-feltöltés során a Mistral API 429 Too Many Requests hibát dobott, amire a `_safe_categorize` vakon "nincs egyértelmű besorolás"-ra fallbackelt (113 tétel elbukása).
  - Determinisztikus gyorsítósáv (`transaction_categorizer.py`): banki költségek, számlavezetési díjak, NAV adóbefizetések (10032000 MÁK prefix), bérek, ATM és átvezetések 0 tokenből, 0 ms alatt, LLM hívás nélkül sorolódnak be.
  - Intelligens hibatűrés: AI kiesés vagy rate limit esetén az összeg iránya alapján automatikus vevői (pozitív) vagy szállítói (negatív) fallback a vak hiba helyett.
  - K&H kártyás vásárlások terhelési dátum regex (`transaction_extractor.py`): Pattern 4 hozzáadva a perjeles `YYYY/MM/DD` formátumhoz (`2026/07/30`), megelőzve a hétvégi könyvelési csúszás miatti matching elutasítást.
  - Adó- és járulékvédelem (`transaction_models.py`): `járulékok/adók` bekerült a `NO_MATCH_CATEGORIES` közé (automatikus `auto_settled` kék státusz számlakeresés helyett).
  - Éles PROD adatbázis rematchelés: "nincs egyértelmű besorolás" 113-ról 0-ra esett vissza (0%), 67 db auto_settled, 48 db matched, a maradék 57 db valós számlahiány (külföldi SaaS, hiteltörlesztés, kp kivét).
  - Élesítés DigitalOcean droplet-re: `visibill-worker` repo `main` ágra pusholva (commit `609632c`), mind a 7 worker konténer (`worker-prod-4..7`, `dev-1`, `vsweb-1`, `thinkerman-1`) frissítve és tiszta egészséges státuszban újraindítva.

- Naplók Oldal Interaktív Táblázatfejléc Rendezés (`JournalsPage.tsx`)
  - Felhasználói igény: a Könyvelési Naplók (`/journals`) táblázatának fejléceire kattintva lehessen rendezni a tételeket.
  - Implementáció: 9 oszlop interaktív, 3-állapotú rendezése (Dátum, Naplószám, Bizonylatszám, Partner, Megnevezés, Kontír T/K, Összeg, Típus, Státusz).
  - Megjelenés: `ArrowUp`, `ArrowDown` és `ArrowUpDown` ikonok az aktív és lebegő állapotok jelzésére.
  - Lapozáskezelés: rendezés váltásakor a lapozás automatikusan visszaugrik az 1. oldalra.
  - Unit tesztek hozzáadva: `JournalsPageActions.test.tsx` kibővítve (7/7 teszt sikeres).

- Számlatételek Tartozik / Követel Oldal és Főkönyvi Számla Öröklődés Javítása (`InvoiceItemsDialog.tsx`)
  - Felhasználói hibajelentés: a Számlák oldalon számlatételeknél nem hozott Tartozik oldalt, csak Követel oldalt (`- → 4541`).
  - Gyökérok: a partner oldal mindig rendelkezett alapértelmezett számlával (`4541` / `311`), míg a tétel főkönyvi száma (`netGl`) csak tételszintű besorolásból jött. Ha az hiányzott, vagy a könyvelő a számlafej szintjén állított be főkönyvi számot, az `InvoiceItemsDialog` nem örökítette le azt a tételekre, így féloldalas könyvelésként jelent meg.
  - Megoldás: `parentInvoice` lekérdezés kibővítése `gl_account_id` és `gl_classifications` mezőkkel mindkét számlatáblán (`invoices`, `nav_invoices`).
  - Automatikus számlafej-öröklés (`headerGlNumber`): a tétel automatikusan örökli a számlafej főkönyvi számát mint Tartozik oldalt (inbound esetén), így megjelenik mindkét oldal (`5291 → 4541`).
  - Előzetes kitöltés a tételszerkesztő popoverben (`openGlEdit`).
  - Unambiguous UI jelölés: ha egy tétel valóban nincs még kontírozva, a felület nem magányos kötőjelet tesz ki, hanem jól látható pontozott sárga jelvénnyel mutatja: `Nincs Tartozik → 4541` útmutató tooltippel.
  - Unit tesztek: `invoiceGlAccountRules.test.tsx` kibővítve unclassified és header fallback tesztekkel (17/17 teszt sikeres).

- Minőségbiztosítás, Build és Verifikáció
  - TypeScript fordítási ellenőrzés: `npx tsc --noEmit` hibamentes (code 0).
  - Kódminőségi kapu: `oxlint` 0 hibával lefutott a módosított fájlokon.
  - Böngészős UI ellenőrzés: Naplók felületen a fejléc-rendezés élőben ellenőrizve és képernyőképpel dokumentálva.
```
