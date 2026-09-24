# A-148: Könyvelőirodai Hibajegy Megosztás és Hibrid RLS Hozzáférés-vezérlés

* **Státusz:** Elfogadva (Accepted)
* **Dátum:** 2026-09-24
* **Terület:** Ügyfélszolgálat / Jogosultságkezelés / Supabase RLS / PostgreSQL

---

## 1. Kontextus és Problémafelvetés

A Visibill és eaisyBooks (Accounty) rendszerben a hibajegyeket (`feedback` tábla) korábban szigorú felhasználó-alapú hozzáférés-szabályozás védte:
* Egy adott hibajegyet csak az azt létrehozó felhasználó (`user_id = auth.uid()`), illetve a ThinkAI support adminok (`is_support_admin()`) tekinthették meg és kommentelhették.
* A könyvelőirodák (pl. Ván Iroda, Taxology) esetében azonban több könyvelő vagy asszisztens dolgozik együtt ugyanazokon a cégeken (pl. Sümegi és Társa Kft, Termometal Kft).
* Ha egy könyvelő (pl. Ván Emese) hibajegyet nyitott egy bérjegyzékről vagy számlaképről, a kollégái (pl. Lendvai Ádám, Végső Szilvia, Szvatek-Német Tünde) egyáltalán nem látták a nyitott jegyet, a support válaszait, és nem tudtak hozzászólni sem megerősíteni a megoldást. Ez duplikált hibajegyekhez és információs silókhoz vezetett.

## 2. Megoldási Opciók Mérlegelése

Három architektúrális opciót értékeltünk:

1. **Opció 1: Csak közvetlen cégtagság (`company_members` / `owner_id`)**
   * *Előny:* Egyszerű lekérdezés.
   * *Hátrány:* Könyvelőirodáknál a könyvelők nem `company_members` tagok a kezelt cégekben, hanem az `accounty_assignments` táblán keresztül vannak összerendelve `accounting_firm_id` alapján. Emiatt a könyvelők továbbra sem látták volna egymás jegyeit.
2. **Opció 2: Csak könyvelőiroda-szintű megosztás (`accounting_firm_id`)**
   * *Előny:* Az iroda tagjai látják egymás jegyeit.
   * *Hátrány:* Nem kezeli a normál KKV cégeket (ahol nincs könyvelőiroda, de több kolléga dolgozik ugyanannál a cégnél), illetve a cég nélkül nyitott általános rendszerhibákat.
3. **Opció 3: Hibrid hozzáférés RLS és RPC szinten (Kiválasztott)**
   * Egy hibajegyet megtekinthet és kommentelhet az `authenticated` felhasználó, ha:
     a) Ő maga a létrehozó (`user_id = auth.uid()`).
     b) Support admin / management / thinkai szerepkörű.
     c) Céghez kapcsolt jegy esetén a cég tulajdonosa (`companies.owner_id`) vagy tagja (`company_members`).
     d) Céghez kapcsolt jegy esetén a cég közvetlenül kijelölt könyvelője (`accounty_assignments.accountant_user_id`).
     e) Céghez kapcsolt jegy esetén az a könyvelő, akinek az irodája (`accounting_firm_id`) kezeli a céget.
     f) A jegyet létrehozó felhasználóval azonos könyvelőirodához tartozik (`accounting_firm_id` egyezés).

## 3. Megvalósítás Részletei

### 3.1 Adatbázis és RLS Migráció
* **Migrációs fájl:** `supabase/migrations/20260924220000_hybrid_ticket_access_rls.sql`
* **Optimalizált index:** `CREATE INDEX IF NOT EXISTS idx_accounty_assignments_user_firm ON public.accounty_assignments(accountant_user_id, accounting_firm_id);`
* **Központi hozzáférés-ellenőrző függvény:** `public.can_access_ticket(p_company_id uuid, p_creator_id uuid) RETURNS boolean` (STABLE, SECURITY DEFINER, search_path = public).
* **RLS Szabályok frissítése:**
  * `public.feedback`: `USING (public.can_access_ticket(company_id, user_id))`
  * `public.ticket_comments`: SELECT és INSERT szabályok `public.can_access_ticket` alapján.
  * `public.ticket_events`: SELECT szabály `public.can_access_ticket` alapján (belső jegyzetek szűrésével).

### 3.2 Megoldás Visszaigazolás (Resolution Confirmation) RPC & Versenyhelyzet Védelem
* A `public.respond_to_ticket_resolution` tárolt eljárás feljogosítja a kollégákat a megoldási kérés jóváhagyására vagy elutasítására.
* Audit naplózásban rögzítésre kerül: `confirmed_by_reporter` vs `confirmed_by_colleague` (vagy `rejected_by_colleague`).
* **Versenyhelyzet Védelem (Race Guard - Migráció: `20260924231500_ticket_race_guard_and_colleague_unread.sql`):**
  A tárolt eljárás a megerősítés végrehajtása előtt explicit tranzakciós ellenőrzést végez:
  ```sql
  IF v_waiting_for_confirmation IS NOT TRUE OR v_ticket_status = 'resolved' THEN
    RAISE EXCEPTION 'A hibajegy állapota időközben megváltozott vagy már lezárásra került.';
  END IF;
  ```
  Ez megakadályozza, hogy ha két könyvelőirodai kolléga párhuzamosan nyitja meg a jegyet és próbálja megerősíteni, a rendszer kettős állapotváltást vagy inkonzisztens audit logot hozzon létre.

### 3.3 Olvasatlan Számláló és Értesítési Izoláció (Unread Privacy)
* **SQL szinten (`public.get_unread_ticket_count` RPC):**
  A nem-admin (nem support/management) felhasználók esetében a számláló szigorúan az általuk nyitott hibajegyek aktivitását veszi figyelembe (`user_id = p_user_id OR created_by = p_user_id`).
  Ennek köszönhetően, ha az egyik kolléga jegyére választ küld a support csapat, az iroda többi tagjának badge számlálója nem ugrik meg irrelevánsan.
* **Frontend szinten (`src/hooks/useTickets.ts`):**
  A jegylista olvasatlansági állapota és rendezési prioritása (`canBeUnreadForUser = Boolean(isSupportAdmin || isManagement || isMyTicket)`) biztosítja, hogy a kollégák jegyei ne jelenjenek meg olvasatlannak kiemelve vagy a lista tetejére ugorva olyan munkatársaknál, akik nem bejelentői a jegynek.

### 3.4 Felhasználói Felület és Cég Keresősáv (Frontend)
* A [TicketsPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/TicketsPage.tsx) táblázatában a `Bejelentő & Cég` oszlop minden felhasználó számára megjelenik, így a könyvelőirodai munkatársak egy pillantással látják, melyik kolléga nyitotta a jegyet és melyik ügyfélcéghez kapcsolódik.
* **Cég Keresősáv (`companySearch`):** A könyvelőirodák nagyszámú kezelt cégéhez igazodva a táblázat fejlécében egy letisztult, azonnali szöveges cégkereső mező érhető el `Building2` ikonnal, törlés (`X`) gombbal és automata lapozás-visszaállítással, kiváltva a nehezen átlátható hosszú dropdown menüt.
* A [TicketDetailView.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/tickets/TicketDetailView.tsx) oldalsávja változatlanul precízen feltünteti a bejelentő nevét, e-mail címét és a cégnevet.

## 4. Tenant Izoláció és Biztonsági Verifikáció

Az éles adatbázison futtatott SQL tesztekkel verifikáltuk a teljes izolációt:
* **Ván Iroda kollégák:** Lendvai Ádám (`d04e75e5-...`), Végső Szilvia (`e3eaebbd-...`), Szvatek-Német Tünde (`0110aa41-...`) mind látják a Ván Iroda / Sümegi és Társa Kft 56 hibajegyét.
* **Unread izoláció teszt:** Lendvai Ádám saját jegyére érkező válasz esetén Lendvai Ádám = 1 db unread, míg Végső Szilvia = 0, Szvatek-Német Tünde = 0, Ván Emese = 0 db unread badge.
* **Taxology Iroda (Jámbor Viktor):** Csak a 4 db saját Taxology jegyet látja, 0 db Ván Iroda jegyet ér el.
* **Független KKV (Kuik Imre):** Csak a saját 1 db jegyét látja, 0 db könyvelőirodai jegyet ér el.

## 5. Kapcsolódó
- [A-018: Hibajegy Rendszer Architektúra](./A-018-ticket-system.md)
- [A-003: Multi-tenancy RLS alapon](./A-003-multi-tenancy-rls.md)
- [P-035: Hibajegy UI és Workflow](../../product/decisions/P-035-ticket-system.md)
