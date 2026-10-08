# A-230: Könyvelési Naplók Kategorizálása, Tételsori Partner Relációk és Banki Kétirányú Szinkronizáció (EB-0257)

- **Státusz**: Elfogadva (Accepted)
- **Dátum**: 2026-10-08
- **Ügyfél / Referencia**: Lendvai Ádám (Ván Iroda / Kolos Transport Kft., EB-0257)
- **Érintett rétegek**: PostgreSQL sémák, RLS triggerek, TypeScript típusok, React komponensek, TanStack Query

---

## 1. Döntési Háttér és Kontextus

Az Eaisybooks rendszerben a könyvelési naplók és vegyes bizonylatok használata során három alapvető strukturális hiányosság mutatkozott:
1. **Hiányzó sor-szintű partner reláció**: Az `acc_journal_lines` táblában nem létezett `partner_id` oszlop, csupán a fejlécben (`acc_journal_headers.partner_id`). Ez akadályozta a több partneres vegyes tételek, skontó átrendezések, tagi kölcsönök és kompenzálások tiszta könyvelését és analitikus feladását.
2. **Banknapló és Céges Bankszámla elcsatoltsága**: A `company_bank_accounts` és az `acc_journals` között manuális hivatkozás volt; ha egy banknaplónál rögzítették a számlaszámot, az nem szinkronizálódott a cég bankszámláihoz, és a bankkivonatok importálásakor a banknapló-feloldás nem volt determinisztikus.
3. **Automatikus rendszer-naplók kézi módosításának veszélye**: Az év végi zárás (`901`), az értékcsökkenés leírás (`605`) és a devizás év végi átértékelés (`603`) dedikált naplókódjai nyitva álltak a manuális vegyes rögzítés előtt, ami a feladási automatizmusok megsérüléséhez vezethetett.

---

## 2. Adatbázis Módosítások (`supabase/migrations/20261008130000_eb0257_journal_line_partner_and_bank_sync.sql`)

### 2.1. Séma Módosítások
- `acc_journal_lines.partner_id UUID REFERENCES partners(id) ON DELETE SET NULL`
- Index: `idx_acc_journal_lines_partner_id ON acc_journal_lines(partner_id)`
- `acc_journals.bank_account_number VARCHAR(64)`
- `acc_journals.is_system_locked BOOLEAN NOT NULL DEFAULT false`

### 2.2. Automatikus Rendszer-Zárolás
```sql
UPDATE acc_journals
SET is_system_locked = true
WHERE code IN ('603', '605', '901');
```

### 2.3. Kétirányú Banki Szinkronizációs Triggerek
1. **`acc_sync_journal_to_bank_account()`**:
   Ha `acc_journals` rekord módosul vagy jön létre `type = 'BANK'` és `bank_account_number IS NOT NULL` értékkel, a trigger automatikusan frissíti vagy létrehozza a megfelelő rekordot a `company_bank_accounts` táblában (a számlaszám standardizálásával).
2. **`acc_sync_bank_account_to_journal()`**:
   Ha `company_bank_accounts` rekord módosul és rendelkezik `journal_id`-vel, automatikusan szinkronizálja az `account_number`-t a kapcsolt `acc_journals.bank_account_number` mezőbe.

---

## 3. Frontend Architektúra és Szolgáltatások

### 3.1. Bank Journal Resolver (`src/features/journals/services/bankJournalResolver.ts`)
Determinista prioritási sorrend a banki tranzakciók és kivonatok automatikus napló-párosítására:
1. Közvetlen egyezés `acc_journals.bank_account_number` alapján (szóköztől, kötőjeltől megtisztítva).
2. Egyezés `company_bank_accounts` összerendelés alapján.
3. Bizonylat / közlemény szövegében rejlő bankszámlaszám detektálása.
4. Bank név kulcsszavak (OTP, K&H, Erste, Revolut, MBH, CIB stb.) és deviza egyezése.
5. Devizanem szerinti egyezés.
6. Alapértelmezett `B1` / `201` banknapló.

### 3.2. Tételsori Partner Picker (`src/components/journals/JournalLinePartnerPicker.tsx`)
- Kompakt, gyorskeresős Popover combobox az `acc_journal_lines` táblázat minden sorában.
- Partnerkényszeres folyószámla észlelés (`gl_accounts.subledger_type === 'partner'`): ha kötelező, figyelmeztető vizuális jelzést ad és a mentés előtt blokkolja a hibás beküldést.

### 3.3. Kategorizálás és UI Túlcsordulás Megelőzés (`src/lib/journalUtils.ts`, `JournalsPage.tsx`)
- `JOURNAL_CATEGORIES`: 7 kategória (`ALL`, `OPENING`, `BANK`, `PETTY_CASH`, `INVOICE`, `MIXED`, `CLOSING`).
- Szigorú sorszámtartomány és kódfelismerés: a `VE` naplókód prioritással kerül a `MIXED` kategóriába a vevő számlák (`V`) elé.

---

## 4. Verifikáció és Tesztelés

- **Automatizált egység- és integrációs tesztek**:
  - `src/test/eb0257JournalsAndPartnerLines.test.ts` (11 teszt zöld)
  - `src/components/journals/__tests__/AddManualJournalEntryModal.test.tsx` (12 teszt zöld)
  - `src/components/journals/__tests__/CreateJournalModal.test.tsx` (9 teszt zöld)
  - `src/components/journals/__tests__/ManageJournalsModal.test.tsx` (3 teszt zöld)
  - Teljes napló tesztcsomag: 61/61 zöld teszt.
- **Kódminőség**: `oxlint` 0 hiba, `tsc --noEmit` hibamentes lefutás.
