# A-111: Közvetlen Bizonylat-visszanyitás (Unpost), Főkönyvi Sztornó Kioltás és Sorszámfolytonossági Védelem

**Status:** Decided  
**Date:** 2026-09-11  
**Utoljára frissítve:** 2026-09-11  

---

## Context

A kettős könyvvitel (Sztv.) hagyományosan szigorú immutabilitási szabályokat követ: a lekönyvelt bizonylatokat tilos közvetlenül módosítani vagy törölni. Hibás rögzítés esetén a javítás ellentétes előjelű sztornó bizonylat generálásával és egy új helyesbítő bizonylat lekönyvelésével történik.

Azonban a gyakorlati könyvelői munkafolyamat és a Kiss-Százi Emese (VBV Vision Kft.) által beküldött hibajegy rávilágított több kritikus hiányosságra:
1. **Főkönyvi egyenlegtorzulás sztornózáskor:** A korábbi főkönyvi SQL lekérdezések (`get_gl_balances`, `get_gl_categorized_items`, `get_gl_account_card_items`) kizárólag a `status = 'KONYVELT'` tételeket vették figyelembe. Amikor az eredeti tétel állapota `SZTORNOZOTT`-ra változott, az kiesett a főkönyvi összesítésből, miközben az inverz sztornó tétel benne maradt. Ez azt eredményezte, hogy ahelyett, hogy a két tétel egymást 0-ra kioltotta volna, a forgalom és az egyenleg az inverz irányba torzult (pl. egy 6 000 Ft-os bevétel sztornózásakor +6 000 Ft költség maradt látható a 9649-es számlán, 0 Ft helyett).
2. **Import-kulcs (`import_key`) elvesztése:** Az `acc_storno_journal_entry` nem örökítette át az eredeti bizonylat `import_key`-ét a generált javító piszkozatra, így újrakönyveléskor az eredeti számlatétel kapcsolata elveszett, és a tétel duplikálódva újra megjelent a feldolgozatlan naplójavaslatok között.
3. **Felesleges sztornó bizonylatok nyitott időszakban:** A könyvelői szakma elvárása, hogy amíg egy adott adóév/hónap könyvelése nincs lezárva és az ÁFA bevallás sincs véglegesítve, a könyvelő közvetlenül visszanyithassa piszkozattá és javíthassa a tételt, megőrizve az eredeti bizonylatszámot, anélkül, hogy a naplót felesleges sztornó bizonylatpárok terhelnék.
4. **Sorszámfolytonossági rések veszélye (Sztv. 166. §):** Ha egy korábban lekönyvelt és sorszámmal (pl. `V/9`) ellátott tételt piszkozattá nyitunk vissza, majd a felhasználó azt törli, a naplóban sorszámhézag (`V/8`, majd `V/10`) keletkezik, ami súlyos számviteli szabálytalanság.

---

## Decision

A rendszerben többszintű adatbázis és alkalmazásszintű védelmet vezettünk be a lekönyvelt tételek javítására, visszanyitására és integritására:

### 1. Főkönyvi Lekérdezések Javítása (Sztornó Kioltás és Teljes Auditnyom)
- A `get_gl_balances`, `get_gl_categorized_items` és `get_gl_account_card_items` függvényekben a belső naplótételek (`acc_journal_lines`) szűrését kiterjesztettük:
  ```sql
  WHERE h.company_id = p_company_id
    AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
  ```
- **Hatás:** Az eredeti tétel (`SZTORNOZOTT`) és az ellentétes előjelű sztornó tétel (`KONYVELT`) egyszerre van jelen az aggregációban, így matematikailag pontosan 0-ra kivezetik egymást. A főkönyvi kartonon a teljes eseménylánc ellenőrizhető marad, felszámolva a fiktív egyenlegeket.

### 2. Közvetlen Visszanyitás RPC (`acc_unpost_journal_entry`)
- Új `SECURITY DEFINER` PostgreSQL RPC funkció a lekönyvelt tételek visszanyitására:
  - **Állapotátmenet:** `KONYVELT` → `KEZI_PISZKOZAT`.
  - **Sorszámmegőrzés:** A fejléc `journal_number` értéke nem nullázódik, hanem megmarad a rekordon.
  - **Session Flag a Trigger ellenőrzéshez:** `PERFORM set_config('visibill.allow_unpost', 'true', true);` utasítással engedélyezi az átmenetet a szigorú immutabilitási trigger számára.
  - **Audit Naplózás:** Az `acc_journal_audit_logs` táblába `UNPOST` eseménykóddal, időbélyeggel és indoklással ellátott bejegyzés készül.

### 3. Kétszintű Zárlati Retesz (Accounting Period & VAT Lock)
- A visszanyitás kizárólag nyitott időszakban engedélyezett:
  - **Számviteli zárlat:** Ha az `acc_accounting_periods` táblában a tétel keltének éve/hónapja `is_closed = TRUE`, a visszanyitás fizikai kivétellel leáll:
    > *"A könyvelési időszak le van zárva. Lezárt időszakban lévő tétel kizárólag számviteli sztornózással helyesbíthető!"*
  - **ÁFA zárlat:** Ha a `vat_returns` táblában az érintett havi/negyedéves/éves bevallás állapota `finalized`, a visszanyitás leáll:
    > *"Az időszak ÁFA bevallása már véglegesítve van. Véglegesített ÁFA időszakban a tétel kizárólag számviteli sztornózással helyesbíthető!"*
- Lezárt időszak esetén kizárólag a hivatalos sztornózási és korrekciós folyamat futtatható.

### 4. Sorszámmegőrzés Újrakönyveléskor (`acc_post_journal_entry`)
- Az `acc_post_journal_entry` módosítása:
  ```sql
  IF v_header.journal_number IS NOT NULL THEN
    v_next_num := v_header.journal_number;
  ELSE
    v_next_num := public.acc_get_next_journal_number(v_header.journal_id, v_header.accounting_year);
  END IF;
  ```
- Ez garantálja, hogy visszanyitás és javítás után az újbóli könyvelés nem generál új sorszámot, hanem megtartja az eredeti bizonylatszámot (pl. `V/9`), kizárva a sorszámugrásokat.

### 5. Sorszámfolytonossági Védelem (Sztv. 166. § – Opció A)
- **Adatbázis trigger védelem (`acc_enforce_header_immutability`):**
  Amennyiben egy törlésre jelölt fejléc rendelkezik `journal_number`-rel, a trigger elutasítja a törlést:
  ```sql
  IF OLD.journal_number IS NOT NULL THEN
    RAISE EXCEPTION 'Journal entry with assigned journal number (%) cannot be deleted to prevent gaps in sequential numbering. Use storno or repost instead.', OLD.journal_number;
  END IF;
  ```
- **Frontend UI védelem (`JournalsPage.tsx`):**
  - A felületen a `journal_number`-rel rendelkező piszkozatok mellett a törlés gomb helyett védett, inaktív ikon jelenik meg magyarázó tooltippel.
  - A `deleteMutation` és `bulkDeleteMutation` automatikusan ellenőrzi a sorszámokat: egyedi törlésnél hibát dob, tömeges törlésnél pedig automatikusan megőrzi a számozott tételeket, és tájékoztatja a könyvelőt.

### 6. Import-kulcs Örökítés (`acc_storno_journal_entry`)
- A storno függvény a javító piszkozat (`KEZI_PISZKOZAT`) létrehozásakor átmásolja az eredeti bizonylat `import_key`-ét:
  ```sql
  INSERT INTO public.acc_journal_headers (..., import_key, ...)
  VALUES (..., v_orig_header.import_key, ...);
  ```
- Ez megakadályozza, hogy a javítás alatt lévő tétel alapjául szolgáló számla vagy tranzakció lekönyveletlenként jelenjen meg az analitikában.

---

## Consequences

**Pozitív:**
- Teljes összhang a könyvelői elvárások és a jogszabályi előírások között: nyitott időszakban gyors, adminisztrációs teher nélküli javítás.
- Megszűnik a főkönyvi forgalomtorzulás sztornózáskor; az egyenlegek pontosan 0-ra futnak ki.
- Lezárt könyvelési és ÁFA időszakokban a rendszer szigorúan kényszeríti a számviteli sztornót, garantálva a benyújtott bevallások védelmét.
- A sorszámfolytonossági védelem kizárja a lyukas naplókat (Sztv. 166. §).
- Megszűnik az `import_key` elvesztéséből eredő javaslat-duplikáció.

**Negatív / Kötöttségek:**
- Ha egy lekönyvelt tételt visszanyitnak, azt nem lehet egyszerűen törölni; ha mégsem kívánják felhasználni, le kell könyvelni és sztornózni kell a sorszámfolytonosság megőrzése érdekében.

---

## Kapcsolódó
- **ADR:** [A-057: Könyvelési Napló Architektúra](./A-057-accounting-journals-architecture.md)
- **ADR:** [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md)
- **PRD:** [P-055: Könyvelési Napló UX](../../product/decisions/P-055-accounting-journals-ux.md)
- **DB Migráció:** `supabase/migrations/20260911100000_fix_gl_storno_and_enable_unpost.sql`
- **Tesztek:** `src/components/journals/__tests__/JournalsUnpostStorno.test.tsx`
