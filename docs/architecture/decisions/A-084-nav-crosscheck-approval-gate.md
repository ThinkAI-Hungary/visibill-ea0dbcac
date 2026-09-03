# A-084: NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu (Approval Gate)

## Státusz
Elfogadva (Accepted) — 2026-09-03

## Kontextus és Probléma
Éles könyvelői visszajelzés és incidens (Kiss-Százi Emese, Ván Iroda Kft. / Dr. Ván Lajos):
Belföldi adóalanyok számláinál előfordulhat, hogy feltöltésre kerülnek olyan számlák (pl. papíralapú számla, elírásos bizonylat, vagy olyan számla, amelyet a kiállító nem jelentett be a NAV Online Számla rendszerébe).
Korábban, ha egy ilyen számla bekerült az `invoices` táblába, a rendszer automatikusan könyvelhetőnek (`statusz = 'feldolgozott'`) tekintette, és a naplók (`acc_journal_headers`), főkönyv, valamint pénztárkönyv automatikusan generáltak hozzá könyvelési tételeket.
Könyvelői elvárás:
> *„Belföldi adóalanyok által kiállított bejövő számlák, továbbá a kimenő számlák esetében a rendszer ne generáljon le automatikus könyvelési tételeket, hanem minden olyan esetben, ahol nincs online számla adatszolgáltatás, jelezze ezt, és kelljen könyvelői jóváhagyás.”*

## Döntés

### 1. Adatbázis Séma Bővítés
Az `invoices` tábla új mezőkkel bővült:
- `nav_status TEXT CHECK (nav_status IN ('verified', 'missing_nav', 'not_applicable')) DEFAULT 'missing_nav'`
- `approved_at TIMESTAMPTZ` (könyvelői jóváhagyás időbélyege)
- `approved_by UUID REFERENCES auth.users(id)` (jóváhagyó könyvelő azonosítója)
- `approval_note TEXT` (jóváhagyás indoklása)
- Index: `idx_invoices_company_nav_status ON public.invoices(company_id, nav_status)`

### 2. Kétirányú Védelem
1. **Worker szint (`worker/db.py`):**
   - Mentéskor a rendszer meghatározza a belföldi adóalanyiságot (`is_domestic_invoice`).
   - Ha belföldi számla esetén nincs `nav_invoices` találat: `nav_status = 'missing_nav'` és `statusz = 'jovahagyasra_var'`.
   - Külföldi partner/számla esetén: `nav_status = 'not_applicable'` és `statusz = 'feldolgozott'`.
   - Korábbi jóváhagyás esetén megőrzi az `approved_at` audit értékeket.
2. **Adatbázis Trigger (`sync_submitted_invoice_on_nav_insert`):**
   - Amikor a NAV Online Számla szinkronból új számla érkezik a `nav_invoices`-ba, a trigger automatikusan megerősíti (`nav_status = 'verified'`) és feloldja (`statusz = 'feldolgozott'`) a beküldött számlát.

### 3. Könyvelési Zárlat (`get_gl_categorized_items`)
A `get_gl_categorized_items` RPC-be beépült az `i.statusz != 'jovahagyasra_var'` és `(i.nav_status != 'missing_nav' OR i.approved_at IS NOT NULL)` feltétel.
Ez garantálja, hogy:
- Az `acc_generate_drafts_from_ledger` RPC nem generál napló tételeket jóváhagyatlan számlára.
- A frontend főkönyvi és napló javaslatkészítő sem látja a zárolt számlákat.
- A `petty_cash_entries` szinkronizáció is kizárja a jóváhagyatlan tételeket.

### 4. Könyvelői Jóváhagyási RPC (`approve_invoice_for_accounting`)
`SECURITY DEFINER` RPC többszintű jogosultságkezeléssel:
- Ellenőrzi a hívó jogosultságát:
  - Cégtagság (`public.company_members`), VAGY
  - Accounty (eaisyBooks) könyvelői vagy irodai adminisztrátori hozzáférés (`public.has_accounty_company_access(v_company_id)` az `accounty_assignments` és irodák alapján), VAGY
  - Rendszerszintű adminisztrátor (`profiles.role = 'admin'`).
- `statusz = 'feldolgozott'`-ra állítja a számlát.
- Rögzíti a jóváhagyás idejét (`approved_at`), a jóváhagyó személyt (`approved_by`), és az indoklást (`approval_note`).
- Pénztárbizonylat esetén azonnal lefuttatja a `sync_petty_cash_entries`-t.

### 5. Frontend UI/UX — Visibill és Accounty (eaisyBooks)
- **Visibill Fő Számlalista (`SubmittedInvoiceRow`):**
  - A partner neve helyett a `BIZ.SZÁM` oszlopban, közvetlenül a bizonylatszám mellett jelenik meg az amber felkiáltójel (`AlertTriangle`).
  - Az egér fölé húzva magyarázó custom tooltip jelenik meg (*„NAV adatszolgáltatás hiányzik!...”*).
  - Rákattintva közvetlenül felugrik az `InvoiceApprovalDialog`.
  - Jóváhagyás után diszkrét kék pipa (`Check`) ikon jelzi a státuszt a rögzített indoklással.
- **Lenyitott Számlasor (`ExpandedInvoiceRow`):**
  - Figyelmeztető banner a hiányzó NAV adatszolgáltatásról, beágyazott *„Jóváhagyás könyvelésre”* gombbal.
  - Jóváhagyott bizonylat esetén kék információs kártya mutatja a jóváhagyás jogcímét és dátumát.
- **Accounty / eaisyBooks Ügyfél Számlák (`ClientInvoicesPage`):**
  - Eszköztárban új gyorsszűrő gomb számlálóval: `⚠️ NAV hiányzik ({missingNavCount})`.
  - A táblázatban azonos felkiáltójel és tooltip a bizonylatszám mellett.
  - A három pontos műveleti menüben elérhető a *„Jóváhagyás könyvelésre (NAV kapu)”* opció.
- **Jóváhagyási Dialógus (`InvoiceApprovalDialog`):**
  - Bizonylat adatok összefoglalója (bizonylatszám, partner, dátum, bruttó összeg devizával).
  - 4 előre definiált jogcím (Papíralapú számla, NAV technikai késés, Külföldi/mentesített ügylet, Egyéb felelősségvállalás).
  - Egyedi könyvelői megjegyzés mező.

### 6. Dinamikus Gyorsítótár és Supabase Realtime Szinkronizáció
- **Központi TanStack Query invalidáció:** Az `InvoiceApprovalDialog` és az `invalidateInvoiceQueries` érvényteleníti a `['company-invoices']` és `['submittedInvoices']` kulcsokat is, azonnali frissülést biztosítva bármely nézetben.
- **Supabase Realtime:** A `LiveNotificationProvider` és a `useAccountyRealtime` feliratkozása az `invoices` tábla változásaira biztosítja, hogy ha egy felhasználó jóváhagy egy számlát az egyik felületen, egy másik gépen dolgozó könyvelőnél vagy kollégánál manuális oldalfrissítés nélkül, valós időben frissüljön a nézet.

### 7. OCR Sorszám Prefix-Csonkolás Elleni Védelem & Javasolt Összerendelés (3 Pilléres Rendszer)
Éles tapasztalat (2026-09-03, VBV Vision Kft. / Kiss-Százi Emese incidens):
Amikor az OCR modell (pl. `deepseek/deepseek-v4-flash`) elhagyja a sorszám kezdő betűit (pl. `SZJE-2026-1` helyett `JE-2026-1`), a számla nem talált NAV párt, a jóváhagyási kapu zárolta (`missing_nav`), és a NAV számlasoron inaktív maradt a csatolmány ikon. A hiba rendszerszintű megelőzésére és kezelésére 3 pilléres architektúra épült ki:

1. **1. Pillér — Worker Megelőzés & Automatikus Helyreállítás:**
   - **Worker Prompts:** Szigorú prefix-megőrzési szabály beépítve minden számlatípus promptjába (`sima_szamla.md`, `vegszamla.md`, `egyszerusitett_szamla.md`, `dijbekero_proforma.md`): a sorszám minden kezdőbetűjét kötelező megőrizni, szigorúan tilos levágni.
   - **Worker NAV Fallback (`worker/db.py`):** Ha az egzakt és a szóköz/kötőjel nélküli sorszámkeresés nem talál NAV számlát, a worker suffix-alapú keresést hajt végre (`nav_invoices.invoice_number.ilike("%" + clean_num)`). Ha az eladó adószáma és a bruttó összeg megegyezik, a worker automatikusan felülbírálja és helyreállítja a bizonylatszámot a hivatalos NAV sorszámra, így a számla rögtön `verified` státuszt kap.

2. **2. Pillér — Frontend Javasolt Párosítás & Egykattintásos Összerendelés:**
   - **Külföldi Számlák Teljes Kizárása (`isForeignSubmittedInvoice`):** A külföldi számlák (pl. Mailgun, AWS, külföldi adószám vagy `nav_status === 'not_applicable'`) nem szerepelnek a NAV Online Számlában, így velük szemben tilos NAV javasolt csatolmányt felajánlani.
   - **Determinisztikus Matcher Szabály (`evaluateNavAndSubmittedSuggestedMatch`):** A borostyán javaslat gomb **KIZÁRÓLAG AKKOR** jelenik meg, ha:
     1. A külső partner adószáma (8 jegyű törzsszám) mindkét számlán szerepel és egyezik.
     2. A partner neve megegyezik.
     3. A bruttó végösszeg és a deviza megegyezik (eltérő deviza, pl. HUF vs EUR esetén azonnali elutasítás).
     4. A kibocsátás dátuma napra pontosan megegyezik mindkét számlán (`YYYY-MM-DD` === `YYYY-MM-DD`). Ezzel megelőzhető, hogy azonos összegű havi átalánydíjas számlák (pl. Trend-Art havi díjak) keresztbe ajánlódjanak.
     5. A számlairány azonos (`INBOUND` vs `OUTBOUND` soha nem egyezhet).
     6. Kizárólag a bizonylatsorszám tér el (pl. OCR prefix-csonkolás vagy elírás).
   - **UI Megjelenítés (`NavInvoiceRow`):** A NAV számlák csatolmány oszlopában hiányzó pontos egyezés esetén borostyánsárga ikon (`Sparkles` + `FileText`) jelzi a javasolt számlaképet.
   - **Összerendelési Modál (`SuggestedInvoiceLinkDialog`):** Egymás melletti kártyákon hasonlítja össze a NAV és a feltöltött számla adatait. A dialógus a központi `InvoiceDialogManager`-be és az `InvoiceContext`-be van bekötve (`modal={true}`), megelőzve a React Portals szintetikus eseményeinek kiszivárgását a táblázat soraihoz. A beágyazott számlakép előnézet (`InvoiceImagePreview`) `interactive={true}` módban fut (340px magasság, PDF esetén `pointer-events-auto` natív görgetéssel, képeknél belső görgetőkonténerrel).
   - **Adatbázis RPC (`link_and_verify_submitted_invoice`):** `SECURITY DEFINER` függvény szigorú cég- és jogosultság-ellenőrzéssel, valamint duplikált sorszám elleni védelemmel. Egyetlen tranzakcióban a hivatalos NAV sorszámra javítja a feltöltött számla sorszámát, `verified` és `feldolgozott` státuszba állítja, audit naplót rögzít, és a NAV tételt `submitted = true`-ra jelöli.

3. **3. Pillér — Bizonylatszám Kézi Javításának Támogatása & Trigger Szinkronizáció:**
   - **Kézi Módosítás (`InvoiceDetailPopup` & `InvoiceFullEditDialog`):** A könyvelők és adminisztrátorok közvetlenül szerkeszthetik a bizonylatsorszámot mind az előugró részletes nézetben (inline ceruza ikon), mind a teljes szerkesztő dialógusban.
   - **Automatikus Trigger Szinkronizáció (`sync_submitted_invoice_on_bizonylatsorszam_change`):** `BEFORE INSERT OR UPDATE` trigger, amely a bizonylatsorszám módosításakor azonnal ellenőrzi, hogy létezik-e azonos sorszámú NAV tétel a cégnél. Ha igen, automatikusan `verified`-re és `feldolgozott`-ra váltja a számla státuszát, feloldva a jóváhagyási zárlatot.
   - **NAV submitted flag kétirányú szinkronja (`mark_nav_invoice_as_submitted`):** A trigger nemcsak az új NAV rekordnál állítja be a `submitted = true` értéket, hanem a bizonylatszám megváltozásakor a korábbi NAV tételen automatikusan visszaállítja a `submitted = false` állapotot, ha már nincs hozzá tartozó más feltöltött bizonylat.

## Következmények
- **Pozitív:** Megszűnik a hibás vagy be nem jelentett számlák automatikus főkönyvi könyvelése; az OCR hibák (prefix-csonkolás) több szinten, automatikusan vagy egyetlen kattintással korrigálhatók; a könyvelő teljes auditált kontrollt kap mindkét felületen.
- **Negatív/Teendő:** A könyvelőnek a NAV-ban nem szereplő belföldi számlákat egyszeri döntéssel el kell bírálnia, de erre ergonomikus egykattintásos modál és csoportos szűrő áll rendelkezésre.

## Kapcsolódó
- BRD: [048: NAV Online Számla Megfelelőség és Könyvelői Zárlat](../../business/decisions/048-nav-crosscheck-approval-gate.md)
- PRD: [P-065: NAV Online Számla Ellenőrzés és Könyvelői Jóváhagyási Kapu UX](../../product/decisions/P-065-nav-crosscheck-approval-gate-ux.md)
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
- [A-043: Accounting Journals](./A-043-accounting-journals.md)
