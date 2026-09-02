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

## Következmények
- **Pozitív:** Megszűnik a hibás vagy be nem jelentett számlák automatikus főkönyvi könyvelése; a könyvelő teljes kontrollt és auditált döntési naplót kap mind az eaisybill, mind az eaisybooks felületen.
- **Negatív/Teendő:** A könyvelőnek a NAV-ban nem szereplő belföldi számlákat egyszeri döntéssel el kell bírálnia, de erre ergonomikus egykattintásos modál és csoportos szűrő áll rendelkezésre.

## Kapcsolódó
- BRD: [048: NAV Online Számla Megfelelőség és Könyvelői Zárlat](../../business/decisions/048-nav-crosscheck-approval-gate.md)
- PRD: [P-065: NAV Online Számla Ellenőrzés és Könyvelői Jóváhagyási Kapu UX](../../product/decisions/P-065-nav-crosscheck-approval-gate-ux.md)
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
- [A-043: Accounting Journals](./A-043-accounting-journals.md)
